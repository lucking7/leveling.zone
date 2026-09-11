#!/usr/bin/env python3
"""Validated, atomic IP database snapshots for GitHub Actions and Linux/macOS hosts."""
from __future__ import annotations

import argparse
from array import array
import contextlib
import csv
import datetime as dt
import gzip
import ipaddress
import json
import mmap
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import struct
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

try:
    from scripts import ipdb_snapshot as snapshot
except ModuleNotFoundError:
    import ipdb_snapshot as snapshot

MAX_BYTES = snapshot.MAX_ASSET_BYTES
FORMATS = snapshot.FORMATS
Error = snapshot.Error
safe_name = snapshot.safe_name
digest = snapshot.digest


def checked_url(url, allow_local=False):
    p = urllib.parse.urlsplit(url)
    if p.username or p.password or p.fragment or not p.hostname:
        raise Error('Invalid source URL')
    if p.scheme != 'https' and not (allow_local and p.scheme == 'http' and p.hostname in {'127.0.0.1', 'localhost', '::1'}):
        raise Error('HTTPS is required')
    return p


class Redirects(urllib.request.HTTPRedirectHandler):
    def __init__(self, allow_local=False):
        self.allow_local = allow_local

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        checked_url(newurl, self.allow_local)
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if urllib.parse.urlsplit(req.full_url).netloc != urllib.parse.urlsplit(newurl).netloc:
            new.remove_header('Authorization')
        return new


def download(url, target, max_bytes=MAX_BYTES, token=None, allow_local=False):
    checked_url(url, allow_local)
    # Use the operating system trust store, including locally managed CA roots.
    # Hostname and certificate validation remain mandatory.
    import truststore
    context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    opener = urllib.request.build_opener(Redirects(allow_local), urllib.request.HTTPSHandler(context=context))
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; leveling-zone-ipdb/1)', 'Accept-Encoding': 'identity'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=headers)
            with opener.open(req, timeout=60) as response, open(target, 'wb') as out:
                if response.status != 200:
                    raise Error('Unexpected HTTP status')
                length = response.headers.get('Content-Length')
                expected = int(length) if length is not None else None
                if expected is not None and (expected < 1 or expected > max_bytes):
                    raise Error('Invalid download size')
                count = 0
                while chunk := response.read(1024 * 1024):
                    count += len(chunk)
                    if count > max_bytes:
                        raise Error('Download exceeds size limit')
                    out.write(chunk)
                if not count or (expected is not None and count != expected):
                    raise Error('Empty or truncated download')
            return
        except Exception as exc:
            Path(target).unlink(missing_ok=True)
            retry = isinstance(exc, (TimeoutError, ConnectionError, urllib.error.URLError))
            if isinstance(exc, urllib.error.HTTPError):
                retry = exc.code in {429, 500, 502, 503, 504}
                exc.close()
            if retry and attempt < 2:
                time.sleep(2**attempt)
                continue
            # Never print exception text: HTTP/network errors may embed credential URLs.
            raise Error('Download failed (' + type(exc).__name__ + ')') from None


def bounded_copy(source, target, limit):
    total = 0
    with open(target, 'wb') as out:
        while chunk := source.read(1024 * 1024):
            total += len(chunk)
            if total > limit:
                raise Error('Extracted database exceeds size limit')
            out.write(chunk)


def unpack(archive, target, entry):
    kind = entry.get('compression', 'none')
    limit = entry.get('maxBytes', MAX_BYTES)
    member = entry.get('member')
    if kind == 'auto':
        with open(archive, 'rb') as f:
            magic = f.read(4)
        kind = 'gzip' if magic.startswith(b'\x1f\x8b') else 'zip' if magic.startswith(b'PK\x03\x04') else 'none'
    if kind == 'none':
        shutil.move(archive, target)
    elif kind == 'gzip':
        with gzip.open(archive, 'rb') as f:
            bounded_copy(f, target, limit)
    elif kind in {'zip', 'tar.gz'}:
        if not member or member.startswith('/') or '..' in member.split('/') or '\\' in member:
            raise Error('Archive requires an exact safe member name')
        if kind == 'zip':
            with zipfile.ZipFile(archive) as z:
                matches = [i for i in z.infolist() if i.filename == member]
                if len(matches) != 1 or matches[0].is_dir() or matches[0].file_size > limit:
                    raise Error('Archive member missing, duplicated or too large')
                with z.open(matches[0]) as f:
                    bounded_copy(f, target, limit)
        else:
            with tarfile.open(archive, 'r:gz') as z:
                matches = [i for i in z.getmembers() if i.name == member]
                if len(matches) != 1 or not matches[0].isfile() or matches[0].size > limit:
                    raise Error('Archive member missing, duplicated or too large')
                with z.extractfile(matches[0]) as f:
                    bounded_copy(f, target, limit)
    else:
        raise Error('Unsupported compression')
    Path(archive).unlink(missing_ok=True)


def validate_ipdb(path):
    """Check IPIP IPDB trie/records using the layout in npm ipdb/index.js.

    Branch nodes are pairs of big-endian uint32 pointers. Leaf offsets are
    pointer + node_count * 7, relative to the start of the data section;
    records are a big-endian uint16 length followed by tab-separated UTF-8.
    """
    with path.open('rb') as f, mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as raw:
        if len(raw) < 4:
            raise Error('Invalid IPDB header')
        length = struct.unpack_from('>I', raw)[0]
        if not 1 <= length <= 1024 * 1024 or 4 + length >= len(raw):
            raise Error('Invalid IPDB metadata size')
        meta = json.loads(raw[4:4 + length])
        nodes, total = meta.get('node_count'), meta.get('total_size')
        if not isinstance(nodes, int) or nodes < 1 or not isinstance(total, int) or total <= nodes * 8 or len(raw) != 4 + length + total:
            raise Error('Invalid IPDB data bounds')
        fields, languages = meta.get('fields'), meta.get('languages')
        if not isinstance(fields, list) or not fields or not all(isinstance(v, str) and v for v in fields):
            raise Error('Invalid IPDB fields')
        if not isinstance(languages, dict) or not languages or not all(isinstance(v, int) and v >= 0 for v in languages.values()) or meta.get('ip_version') not in {1, 2, 3}:
            raise Error('Invalid IPDB metadata')
        width = max(languages.values()) + len(fields)
        start = 4 + length

        def child(node, bit):
            if not 0 <= node < nodes:
                raise Error('IPDB branch pointer out of bounds')
            return struct.unpack_from('>I', raw, start + node * 8 + bit * 4)[0]

        def record(node):
            offset = node + nodes * 7
            if node < nodes or offset < nodes * 8 or offset + 2 > total:
                raise Error('IPDB record pointer out of bounds')
            size = struct.unpack_from('>H', raw, start + offset)[0]
            if not size or offset + 2 + size > total:
                raise Error('IPDB record length out of bounds')
            values = raw[start + offset + 2:start + offset + 2 + size].decode('utf-8').split('\t')
            if len(values) < width:
                raise Error('IPDB record does not match fields/languages')
            return values

        # Inspect every pointer and every distinct referenced record, not just
        # metadata or a few lucky lookups. Kahn's algorithm rejects cycles with
        # compact arrays so a malformed multi-node loop cannot hide off-probe.
        leaves = set()
        indegree = array('I', [0]) * nodes
        for offset in range(start, start + nodes * 8, 4):
            pointer = struct.unpack_from('>I', raw, offset)[0]
            if pointer >= nodes:
                if pointer + nodes * 7 + 2 > total:
                    raise Error('IPDB tree pointer out of bounds')
                leaves.add(pointer)
            else:
                indegree[pointer] += 1
        if not leaves:
            raise Error('IPDB has no data records')
        for leaf in leaves:
            record(leaf)
        queue = array('I', (node for node, degree in enumerate(indegree) if degree == 0))
        cursor = 0
        while cursor < len(queue):
            node = queue[cursor]
            cursor += 1
            for bit in (0, 1):
                pointer = child(node, bit)
                if pointer < nodes:
                    indegree[pointer] -= 1
                    if indegree[pointer] == 0:
                        queue.append(pointer)
        if cursor != nodes:
            raise Error('IPDB tree contains a cycle')

        v4node = meta.get('v4node')
        if meta['ip_version'] & 1:
            if v4node is None:
                v4node = 0
                for bit in [0] * 80 + [1] * 16:
                    if v4node >= nodes:
                        break
                    v4node = child(v4node, bit)
            if not isinstance(v4node, int) or not 0 <= v4node < nodes:
                raise Error('IPDB IPv4 root is invalid')

        def lookup(address):
            ip = ipaddress.ip_address(address)
            node = v4node if ip.version == 4 else 0
            for byte in ip.packed:
                for shift in range(7, -1, -1):
                    if node >= nodes:
                        return record(node)
                    node = child(node, (byte >> shift) & 1)
            if node < nodes:
                raise Error('IPDB lookup never reaches a record')
            return record(node)

        results = {}
        probes = []
        if meta['ip_version'] & 1:
            probes += ['1.1.1.1', '8.8.8.8', '114.114.114.114']
        if meta['ip_version'] & 2:
            probes += ['2001:4860:4860::8888', '2606:4700:4700::1111']
        language_offset = min(languages.values())
        for address in probes:
            values = lookup(address)
            results[address] = dict(zip(fields, values[language_offset:language_offset + len(fields)]))
        return results


def validate_file(path, entry):
    if path.is_symlink() or not path.is_file() or path.stat().st_size == 0:
        raise Error('Missing, empty or symbolic-link database')
    with path.open('rb') as f:
        prefix = f.read(512)
    if prefix.lstrip().lower().startswith((b'<!doctype', b'<html', b'<?xml', b'version https://git-lfs')):
        raise Error('Database contains an error page or Git LFS pointer')
    fmt = entry['format']
    if fmt == 'mmdb':
        import maxminddb
        with maxminddb.open_database(str(path)) as db:
            metadata = db.metadata()
            if not metadata.node_count or metadata.ip_version not in {4, 6} or not metadata.database_type:
                raise Error('Invalid MMDB metadata')
            records = [db.get(address) for address in ('8.8.8.8', '114.114.114.114')]
            if not any(isinstance(record, dict) and record for record in records):
                raise Error('MMDB sample lookups returned no records')
    elif fmt in {'ip2location', 'ip2proxy'}:
        if len(prefix) < 64 or not 1 <= prefix[0] <= 32 or not 2 <= prefix[1] <= 32:
            raise Error('Invalid BIN header')
        count, base = struct.unpack_from('<II', prefix, 5)
        count6, base6 = struct.unpack_from('<II', prefix, 13)
        size = path.stat().st_size
        if not count or base < 65 or base - 1 + count * prefix[1] * 4 > size:
            raise Error('BIN IPv4 table exceeds file bounds')
        if count6 and (base6 < 65 or base6 - 1 + count6 * (prefix[1] * 4 + 12) > size):
            raise Error('BIN IPv6 table exceeds file bounds')
        if fmt == 'ip2location':
            import IP2Location
            db = IP2Location.IP2Location(str(path))
            try:
                sample = db.get_all('8.8.8.8')
            finally:
                db.close()
        else:
            import IP2Proxy
            db = IP2Proxy.IP2Proxy()
            try:
                db.open(str(path))
                sample = db.get_all('8.8.8.8')
            finally:
                db.close()
        values = sample.values() if isinstance(sample, dict) else vars(sample).values()
        invalid = ('INVALID', 'MISSING', 'NOT SUPPORTED')
        if not any(str(value).strip() and not any(marker in str(value).upper() for marker in invalid)
                   for value in values if value is not None):
            raise Error('BIN sample lookup returned no usable record')
    elif fmt == 'ipdb':
        validate_ipdb(path)
    elif fmt == 'csv':
        columns = entry.get('columns')
        if not isinstance(columns, list) or not columns:
            raise Error('CSV requires configured columns')
        rows = 0
        with path.open(encoding='utf-8-sig', newline='') as f:
            reader = csv.reader(f, delimiter=entry.get('delimiter', ','))
            if entry.get('header', True) and next(reader, None) != columns:
                raise Error('CSV header does not match schema')
            for row in reader:
                if len(row) != len(columns) or not any(row):
                    raise Error('Invalid CSV row')
                for col, value in zip(columns, row):
                    if col in {'start_ip', 'end_ip', 'network'}:
                        ipaddress.ip_network(value, strict=False)
                    elif col in {'start_ip_int', 'end_ip_int', 'asn'} and (not value.isdigit() or int(value) < 0):
                        raise Error('Invalid numeric CSV field')
                rows += 1
        if not rows:
            raise Error('CSV contains no data')
    else:
        raise Error('Unsupported database format')


def config_entries(config, only=None, allow_local=False):
    obj = json.loads(Path(config).read_text())
    if obj.get('schemaVersion') != 1 or not isinstance(obj.get('databases'), list) or not obj['databases']:
        raise Error('Invalid database configuration')
    requested = set(only.split(',')) if only else None
    result, ids, names = [], set(), set()
    for source in obj['databases']:
        e = dict(source)
        ident, name = safe_name(e['id']), safe_name(e['filename'])
        if ident in ids or name in names or name in snapshot.RESERVED_NAMES:
            raise Error('Duplicate or reserved database name')
        ids.add(ident)
        names.add(name)
        if requested is not None and ident not in requested:
            continue
        if e['format'] not in FORMATS:
            raise Error('Unsupported database format')
        if e.get('tokenEnv') and not os.environ.get(e['tokenEnv']):
            raise Error('Required environment variable is unset: ' + e['tokenEnv'])
        def substitute(match):
            key = match.group(1)
            if not os.environ.get(key):
                raise Error('Required environment variable is unset: ' + key)
            return urllib.parse.quote(os.environ[key], safe='')
        e['url'] = re.sub(r'\$\{([A-Z][A-Z0-9_]*)\}', substitute, e['url'])
        now = dt.datetime.now(dt.timezone.utc)
        e['url'] = e['url'].replace('{YYYY-MM}', now.strftime('%Y-%m')).replace('{YYYYMM}', now.strftime('%Y%m'))
        checked_url(e['url'], allow_local)
        if not isinstance(e.get('maxBytes', MAX_BYTES), int) or e.get('maxBytes', MAX_BYTES) < 1:
            raise Error('Invalid maxBytes')
        # Source identity deliberately omits paths and query strings, either can contain tokens.
        e['source'] = urllib.parse.urlsplit(e['url']).hostname
        result.append(e)
    if not result or (requested is not None and requested - ids):
        raise Error('No databases selected or unknown --only identifier')
    return result


@contextlib.contextmanager
def store_lock(store):
    store.mkdir(parents=True, exist_ok=True)
    lock = store / '.update.lock'
    try:
        lock.mkdir()
    except FileExistsError:
        raise Error('Store is locked; confirm no updater is running before manually removing .update.lock') from None
    try:
        (lock / 'owner.json').write_text(json.dumps({'pid': os.getpid(), 'host': socket.gethostname(), 'createdAt': dt.datetime.now(dt.timezone.utc).isoformat()}))
        yield
    finally:
        shutil.rmtree(lock)


def verify(directory):
    return snapshot.verify(directory, validate_file)


def activate(store, stage, version):
    current = store / 'current'
    if current.exists() and not current.is_symlink():
        raise Error('Store current must be a symlink')
    versions = store / 'versions'
    versions.mkdir(exist_ok=True)
    target = versions / version
    if target.exists():
        existing = verify(target)
        incoming = snapshot.read_manifest(stage)
        if snapshot.content_identity(existing) != snapshot.content_identity(incoming):
            raise Error('Version already exists with different content')
        shutil.rmtree(stage)
    else:
        stage.rename(target)
    pointer = store / ('.current-' + uuid.uuid4().hex)
    try:
        pointer.symlink_to(Path('versions') / version)
        os.replace(pointer, current)
    finally:
        pointer.unlink(missing_ok=True)
    return current.resolve()


def update(store, config, only=None, version=None, allow_local=False):
    entries = config_entries(config, only, allow_local)
    version = safe_name(version) if version else snapshot.new_version()
    store = Path(store).resolve()
    with store_lock(store):
        stage = Path(tempfile.mkdtemp(prefix='.stage-', dir=store))
        try:
            for e in entries:
                try:
                    archive = stage / '.download'
                    download(e['url'], archive, e.get('maxBytes', MAX_BYTES), allow_local=allow_local)
                    unpack(archive, stage / e['filename'], e)
                    validate_file(stage / e['filename'], e)
                except Exception as exc:
                    detail = str(exc) if isinstance(exc, Error) else type(exc).__name__
                    raise Error('Database failed: ' + e['id'] + ' (' + detail + ')') from None
            snapshot.write(stage, version, entries)
            verify(stage)
            return activate(store, stage, version)
        finally:
            if stage.exists():
                shutil.rmtree(stage)


def install(store, repo, tag=None, api_url='https://api.github.com', allow_local=False):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise Error('Invalid repository')
    if tag:
        safe_name(tag)
    base = checked_url(api_url, allow_local)
    # A custom test API never receives the real GitHub credential.
    token = os.environ.get('GITHUB_TOKEN') if base.hostname == 'api.github.com' and base.scheme == 'https' else None
    store = Path(store).resolve()
    with store_lock(store):
        stage = Path(tempfile.mkdtemp(prefix='.stage-', dir=store))
        try:
            endpoint = '/tags/' + urllib.parse.quote(tag, safe='') if tag else '/latest'
            metadata = stage / '.release.json'
            download(api_url.rstrip('/') + '/repos/' + repo + '/releases' + endpoint, metadata, 4 * 1024**2, token, allow_local)
            release = json.loads(metadata.read_text())
            metadata.unlink()
            version = safe_name(release['tag_name'])
            if release.get('draft', True) or release.get('prerelease', True) or not release.get('published_at') or (tag and tag != version):
                raise Error('Release is unpublished, prerelease or tag mismatched')
            assets = snapshot.index_release_assets(release['assets'])
            def fetch(name, limit):
                if name not in assets or assets[name].get('state') != 'uploaded':
                    raise Error('Release asset missing or incomplete: ' + name)
                url = assets[name]['browser_download_url']
                parsed = checked_url(url, allow_local)
                allowed = parsed.hostname == 'github.com' and parsed.path.startswith('/' + repo + '/releases/download/' + version + '/')
                if not allowed and not (allow_local and parsed.hostname == base.hostname):
                    raise Error('Release asset URL is outside the selected repository')
                download(url, stage / name, limit, allow_local=allow_local)
            fetch(snapshot.MANIFEST_NAME, 1024**2)
            manifest = snapshot.read_manifest(stage)
            if manifest['version'] != version:
                raise Error('Manifest version does not match Release tag')
            assets = snapshot.validate_install_assets(manifest, release['assets'])
            fetch(snapshot.CHECKSUMS_NAME, 1024**2)
            for f in manifest['files']:
                fetch(f['name'], f['size'])
            verify(stage)
            return activate(store, stage, version)
        finally:
            if stage.exists():
                shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('update')
    p.add_argument('--store', default='data/db')
    p.add_argument('--config', default='config/databases.json')
    p.add_argument('--only', help='Comma-separated database IDs; every selected entry is required')
    p.add_argument('--version', help='Immutable snapshot ID, also used as the Release tag')
    p = sub.add_parser('install')
    p.add_argument('--store', default='data/db')
    p.add_argument('--repo', default='lucking7/leveling.zone')
    p.add_argument('--tag')
    p = sub.add_parser('verify')
    p.add_argument('--directory', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'update':
            print(update(args.store, args.config, args.only, args.version))
        elif args.command == 'install':
            print(install(args.store, args.repo, args.tag))
        else:
            m = verify(args.directory)
            print('Verified ' + m['version'] + ': ' + str(len(m['files'])) + ' databases')
    except Exception as exc:
        print('ipdb: ' + (str(exc) if isinstance(exc, Error) else type(exc).__name__), file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
