"""Immutable IP database snapshot contract shared by update, install and publish adapters."""
from __future__ import annotations

from dataclasses import dataclass
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import uuid


MANIFEST_NAME = 'manifest.json'
CHECKSUMS_NAME = 'SHA256SUMS'
SCHEMA_VERSION = 1
MAX_ASSET_BYTES = 2 * 1024**3
FORMATS = frozenset({'mmdb', 'ip2location', 'ip2proxy', 'ipdb', 'csv'})
RESERVED_NAMES = frozenset({MANIFEST_NAME, CHECKSUMS_NAME})


class Error(Exception):
    """The snapshot does not satisfy its immutable storage or release contract."""


@dataclass(frozen=True)
class AssetSpec:
    name: str
    size: int
    sha256: str


@dataclass(frozen=True)
class ReleasePlan:
    version: str
    names: tuple[str, ...]
    assets: dict[str, AssetSpec]


def safe_name(value):
    if (not isinstance(value, str)
            or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', value)
            or value in {'.', '..'}):
        raise Error('Unsafe file name or version')
    return value


def digest(path):
    hasher = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def new_version(now=None, suffix=None):
    moment = now or dt.datetime.now(dt.timezone.utc)
    entropy = suffix or uuid.uuid4().hex[:8]
    return safe_name('ip-db-' + moment.strftime('%Y%m%dT%H%M%SZ') + '-' + entropy)


def release_version(value):
    safe_name(value)
    if not value.startswith('ip-db-'):
        raise Error('Tag must start with ip-db- and contain only safe characters')
    return value


def checksum_text(manifest):
    return ''.join(f"{item['sha256']}  {item['name']}\n" for item in manifest['files'])


def write(directory, version, entries, created_at=None):
    directory = Path(directory)
    version = safe_name(version)
    files = []
    for entry in entries:
        name = safe_name(entry['filename'])
        ident = safe_name(entry['id'])
        path = directory / name
        row = {
            'id': ident,
            'name': name,
            'size': path.stat().st_size,
            'sha256': digest(path),
            'format': entry['format'],
            'source': entry['source'],
        }
        for key in ('columns', 'delimiter', 'header'):
            if key in entry:
                row[key] = entry[key]
        files.append(row)
    manifest = {
        'schemaVersion': SCHEMA_VERSION,
        'version': version,
        'createdAt': (created_at or dt.datetime.now(dt.timezone.utc)).isoformat(),
        'selected': [entry['id'] for entry in entries],
        'files': files,
    }
    validate_manifest(manifest)
    (directory / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2) + '\n')
    (directory / CHECKSUMS_NAME).write_text(checksum_text(manifest))
    return manifest


def validate_manifest(manifest):
    if (not isinstance(manifest, dict)
            or manifest.get('schemaVersion') != SCHEMA_VERSION
            or not isinstance(manifest.get('files'), list)
            or not manifest['files']):
        raise Error('Invalid manifest schema')
    safe_name(manifest.get('version'))
    names, identifiers = set(), set()
    for item in manifest['files']:
        if not isinstance(item, dict):
            raise Error('Invalid manifest entries')
        name = safe_name(item.get('name'))
        ident = safe_name(item.get('id'))
        if (name in names or ident in identifiers or name in RESERVED_NAMES
                or item.get('format') not in FORMATS):
            raise Error('Invalid manifest entries')
        size, sha256 = item.get('size'), item.get('sha256')
        if (not isinstance(size, int) or not 0 < size <= MAX_ASSET_BYTES
                or not isinstance(sha256, str)
                or not re.fullmatch(r'[0-9a-f]{64}', sha256)):
            raise Error('Invalid manifest size or digest')
        names.add(name)
        identifiers.add(ident)
    selected = manifest.get('selected')
    if (not isinstance(selected, list) or len(selected) != len(identifiers)
            or set(selected) != identifiers):
        raise Error('Manifest selection mismatch')
    return manifest


def read_manifest(directory):
    path = Path(directory) / MANIFEST_NAME
    try:
        if path.is_symlink() or not path.is_file() or path.stat().st_size > 1024**2:
            raise Error('Invalid manifest file')
        manifest = json.loads(path.read_text())
    except Error:
        raise
    except (OSError, ValueError):
        raise Error('Invalid manifest file') from None
    return validate_manifest(manifest)


def database_names(manifest):
    validate_manifest(manifest)
    return tuple(item['name'] for item in manifest['files'])


def release_names(manifest):
    return database_names(manifest) + (MANIFEST_NAME, CHECKSUMS_NAME)


def content_identity(manifest):
    validate_manifest(manifest)
    return tuple(json.dumps(item, sort_keys=True, separators=(',', ':'))
                 for item in manifest['files'])


def verify(directory, validate_file=None):
    directory = Path(directory)
    manifest = read_manifest(directory)
    sums = directory / CHECKSUMS_NAME
    try:
        sums_valid = not sums.is_symlink() and sums.is_file() and sums.read_text() == checksum_text(manifest)
    except OSError:
        sums_valid = False
    if not sums_valid:
        raise Error('SHA256SUMS mismatch')
    for item in manifest['files']:
        path = directory / item['name']
        if (path.is_symlink() or not path.is_file() or path.stat().st_size != item['size']
                or digest(path) != item['sha256']):
            raise Error('Database size or checksum mismatch: ' + item['name'])
        if validate_file:
            validate_file(path, item)
    return manifest


def release_plan(directory, expected_version=None, validate_file=None):
    directory = Path(directory)
    manifest = verify(directory, validate_file)
    if expected_version is not None and manifest['version'] != expected_version:
        raise Error('Manifest version does not match Release tag')
    names = release_names(manifest)
    assets = {
        name: AssetSpec(name=name, size=(directory / name).stat().st_size,
                        sha256=digest(directory / name))
        for name in names
    }
    return ReleasePlan(version=manifest['version'], names=names, assets=assets)


def index_release_assets(assets):
    if not isinstance(assets, list):
        raise Error('Invalid Release asset list')
    indexed = {}
    for asset in assets:
        if not isinstance(asset, dict):
            raise Error('Invalid Release asset')
        name = safe_name(asset.get('name'))
        if name in indexed:
            raise Error('Duplicate Release asset')
        indexed[name] = asset
    return indexed


def validate_install_assets(manifest, assets):
    indexed = index_release_assets(assets)
    for name in release_names(manifest):
        asset = indexed.get(name)
        if not asset or asset.get('state') != 'uploaded':
            raise Error('Release asset missing or incomplete: ' + name)
    for item in manifest['files']:
        if indexed[item['name']].get('size') != item['size']:
            raise Error('Release is missing a complete database asset')
    return indexed


def audit_published_assets(assets, plan):
    indexed = index_release_assets(assets)
    if len(indexed) != len(plan.assets) or set(indexed) != set(plan.assets):
        raise Error('Remote asset set is incomplete or contains unexpected files')
    read_back = []
    for name, expected in plan.assets.items():
        asset = indexed[name]
        if asset.get('state') != 'uploaded' or asset.get('size') != expected.size:
            raise Error('Incomplete remote asset: ' + name)
        remote_digest = asset.get('digest')
        if remote_digest:
            if remote_digest != 'sha256:' + expected.sha256:
                raise Error('Remote digest mismatch: ' + name)
        else:
            read_back.append(asset)
    return read_back
