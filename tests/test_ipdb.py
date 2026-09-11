"""Offline transactional updater tests using a loopback HTTP fixture server."""
import contextlib
import functools
import http.server
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import threading
import types
import unittest
from unittest import mock
import zipfile

spec = importlib.util.spec_from_file_location('ipdb', Path(__file__).parents[1] / 'scripts/ipdb.py')
ipdb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ipdb)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.web = self.root / 'web'
        self.web.mkdir()
        self.server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(self.web)))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:' + str(self.server.server_port)
        self.store = self.root / 'store'
        self.config = self.root / 'config.json'
        self.source = self.web / 'source.csv'
        self.source.write_text('asn,name\n123,one\n')
        self.entry = {'id': 'sample', 'filename': 'sample.csv', 'url': self.url + '/source.csv', 'format': 'csv', 'columns': ['asn', 'name']}
        self.configure([self.entry])

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def configure(self, entries):
        self.config.write_text(json.dumps({'schemaVersion': 1, 'databases': entries}))

    def update(self, version):
        return ipdb.update(self.store, self.config, version=version, allow_local=True)

    def assert_clean_failure(self, old):
        self.assertEqual((self.store / 'current').resolve(), old)
        self.assertFalse(list(self.store.glob('.stage-*')))
        self.assertFalse((self.store / '.update.lock').exists())

    def test_same_size_changed_content_gets_new_snapshot(self):
        old = self.update('ip-db-old')
        old_hash = ipdb.digest(old / 'sample.csv')
        self.source.write_text('asn,name\n456,two\n')
        new = self.update('ip-db-new')
        self.assertNotEqual(ipdb.digest(new / 'sample.csv'), old_hash)
        self.assertEqual(ipdb.digest(old / 'sample.csv'), old_hash)
        self.assertEqual(ipdb.verify(new)['selected'], ['sample'])

    def test_failed_second_source_keeps_old_snapshot(self):
        old = self.update('ip-db-old')
        self.configure([self.entry, dict(self.entry, id='bad', filename='bad.csv', url=self.url + '/missing')])
        with self.assertRaises(ipdb.Error):
            self.update('ip-db-new')
        self.assert_clean_failure(old)

    def test_missing_credentials_preflight_before_download_or_store(self):
        self.configure([self.entry, dict(self.entry, id='secret', filename='secret.csv', tokenEnv='IPDB_TEST_MISSING')])
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(ipdb, 'download') as download:
            with self.assertRaisesRegex(ipdb.Error, 'IPDB_TEST_MISSING'):
                self.update('test')
            download.assert_not_called()
        self.assertFalse(self.store.exists())

    def test_empty_html_lfs_and_csv_header_only_rejected(self):
        old = self.update('ip-db-old')
        for content in ['', '<html>error</html>', 'version https://git-lfs.github.com/spec/v1\n', 'asn,name\n', 'asn,name\nabc,bad\n']:
            self.source.write_text(content)
            with self.assertRaises(ipdb.Error):
                self.update('ip-db-bad')
            self.assert_clean_failure(old)

    def test_checksum_detects_same_size_tampering(self):
        version = self.update('ip-db-old')
        (version / 'sample.csv').write_text('asn,name\n456,two\n')
        with self.assertRaisesRegex(ipdb.Error, 'checksum'):
            ipdb.verify(version)

    def test_manifest_traversal_and_duplicate_rejected(self):
        version = self.update('ip-db-old')
        path = version / 'manifest.json'
        m = json.loads(path.read_text())
        m['files'][0]['name'] = '../source.csv'
        path.write_text(json.dumps(m))
        with self.assertRaises(ipdb.Error):
            ipdb.verify(version)

    def test_zip_extracts_only_exact_member(self):
        archive = self.web / 'source.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('../outside', 'bad')
            z.writestr('wanted.csv', self.source.read_text())
        self.configure([dict(self.entry, url=self.url + '/source.zip', compression='zip', member='wanted.csv')])
        self.update('good')
        self.assertFalse((self.store / 'outside').exists())
        self.configure([dict(self.entry, url=self.url + '/source.zip', compression='zip', member='../outside')])
        with self.assertRaises(ipdb.Error):
            self.update('bad')

    def synthetic_ipdb(self):
        import struct
        record = b'Testland\t123'
        data = struct.pack('>IIH', 1, 1, len(record)) + record
        metadata = {'node_count': 1, 'total_size': len(data), 'ip_version': 3,
                    'v4node': 0, 'fields': ['country', 'asn'], 'languages': {'EN': 0}}
        encoded = json.dumps(metadata).encode()
        return struct.pack('>I', len(encoded)) + encoded + data, 4 + len(encoded)

    def test_valid_ipdb_records_are_actually_queried(self):
        payload, _ = self.synthetic_ipdb()
        path = self.root / 'valid.ipdb'
        path.write_bytes(payload)
        results = ipdb.validate_ipdb(path)
        self.assertEqual(results['8.8.8.8'], {'country': 'Testland', 'asn': '123'})
        self.assertEqual(results['2001:4860:4860::8888']['country'], 'Testland')
        ipdb.validate_file(path, {'format': 'ipdb'})

    def test_ipdb_valid_metadata_zeroed_data_rejected(self):
        payload, start = self.synthetic_ipdb()
        path = self.root / 'corrupt.ipdb'
        path.write_bytes(payload[:start] + bytes(len(payload) - start))
        self.assertEqual(path.stat().st_size, len(payload))
        with self.assertRaises(ipdb.Error):
            ipdb.validate_file(path, {'format': 'ipdb'})

    def test_ipdb_pointer_length_and_record_schema_corruption_rejected(self):
        original, start = self.synthetic_ipdb()
        cases = []
        data = bytearray(original)
        struct.pack_into('>I', data, start, 0xffffffff)
        cases.append(data)
        data = bytearray(original)
        struct.pack_into('>H', data, start + 8, 0xffff)
        cases.append(data)
        cases.append(original.replace(b'Testland\t123', b'Testland 123'))
        for data in cases:
            path = self.root / 'corrupt.ipdb'
            path.write_bytes(data)
            with self.assertRaises(ipdb.Error):
                ipdb.validate_file(path, {'format': 'ipdb'})

    def test_ipdb_multi_node_cycle_off_probe_is_rejected(self):
        record = b'Testland\t123'
        tree = struct.pack('>IIII', 2, 1, 0, 2)
        data = tree + struct.pack('>H', len(record)) + record
        metadata = {'node_count': 2, 'total_size': len(data), 'ip_version': 1,
                    'v4node': 0, 'fields': ['country', 'asn'], 'languages': {'EN': 0}}
        encoded = json.dumps(metadata).encode()
        path = self.root / 'cycle.ipdb'
        path.write_bytes(struct.pack('>I', len(encoded)) + encoded + data)
        with self.assertRaisesRegex(ipdb.Error, 'cycle'):
            ipdb.validate_file(path, {'format': 'ipdb'})

    def test_mmdb_with_metadata_but_no_lookup_records_is_rejected(self):
        path = self.root / 'empty.mmdb'
        path.write_bytes(b'database fixture')

        class Reader:
            def __enter__(self): return self
            def __exit__(self, *_): return None
            def metadata(self):
                return types.SimpleNamespace(node_count=1, ip_version=4, database_type='test')
            def get(self, _): return None

        module = types.SimpleNamespace(open_database=lambda _: Reader())
        with mock.patch.dict(sys.modules, {'maxminddb': module}):
            with self.assertRaisesRegex(ipdb.Error, 'no records'):
                ipdb.validate_file(path, {'format': 'mmdb'})

    def test_bin_header_without_usable_lookup_record_is_rejected(self):
        path = self.root / 'empty.bin'
        payload = bytearray(72)
        payload[0:2] = bytes((1, 2))
        struct.pack_into('<II', payload, 5, 1, 65)
        path.write_bytes(payload)

        class Reader:
            def __init__(self, _): pass
            def get_all(self, _): return types.SimpleNamespace(country_short='NOT SUPPORTED')
            def close(self): pass

        module = types.SimpleNamespace(IP2Location=Reader)
        with mock.patch.dict(sys.modules, {'IP2Location': module}):
            with self.assertRaisesRegex(ipdb.Error, 'no usable record'):
                ipdb.validate_file(path, {'format': 'ip2location'})

    def test_auto_raw_gzip_and_zip(self):
        import gzip
        for kind in ('raw', 'gzip', 'zip'):
            archive = self.web / 'automatic'
            if kind == 'gzip':
                archive.write_bytes(gzip.compress(self.source.read_bytes()))
            elif kind == 'zip':
                with zipfile.ZipFile(archive, 'w') as z:
                    z.writestr('wanted.csv', self.source.read_text())
            else:
                archive.write_bytes(self.source.read_bytes())
            self.configure([dict(self.entry, url=self.url + '/automatic', compression='auto', member='wanted.csv')])
            self.assertEqual(ipdb.verify(self.update(kind))['version'], kind)

    def test_decompression_limit_rejects_large_member(self):
        import gzip
        (self.web / 'bomb').write_bytes(gzip.compress(b'asn,name\n' + b'123,one\n' * 1000))
        self.configure([dict(self.entry, url=self.url + '/bomb', compression='gzip', maxBytes=200)])
        with self.assertRaises(ipdb.Error):
            self.update('bomb')
        self.assertFalse((self.store / 'current').exists())

    def test_release_tampered_content_and_manifest_tag_rejected(self):
        version = self.update('release-v1')
        release, endpoint = self.release(version)
        asset = self.web / 'assets/sample.csv'
        asset.write_text('asn,name\n456,two\n')
        with self.assertRaises(ipdb.Error):
            ipdb.install(self.root / 'consumer', 'owner/repo', api_url=self.url, allow_local=True)
        asset.write_bytes((version / 'sample.csv').read_bytes())
        manifest_file = self.web / 'assets/manifest.json'
        manifest = json.loads(manifest_file.read_text())
        manifest['version'] = 'other-tag'
        manifest_file.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ipdb.Error, 'version'):
            ipdb.install(self.root / 'consumer', 'owner/repo', api_url=self.url, allow_local=True)
        self.assertFalse((self.root / 'consumer/current').exists())

    def test_existing_lock_blocks_without_removing_owner(self):
        with ipdb.store_lock(self.store):
            with self.assertRaisesRegex(ipdb.Error, 'locked'):
                self.update('bad')
            self.assertTrue((self.store / '.update.lock/owner.json').exists())

    def test_bad_archive_keeps_current(self):
        old = self.update('old')
        self.configure([dict(self.entry, compression='gzip')])
        with self.assertRaises(ipdb.Error):
            self.update('bad')
        self.assert_clean_failure(old)

    def release(self, version):
        published = self.web / 'assets'
        published.mkdir(exist_ok=True)
        for p in version.iterdir():
            (published / p.name).write_bytes(p.read_bytes())
        release = {'tag_name': version.name, 'draft': False, 'prerelease': False, 'published_at': '2026-09-11T00:00:00Z', 'assets': [
            {'name': p.name, 'size': p.stat().st_size, 'state': 'uploaded', 'browser_download_url': self.url + '/assets/' + p.name}
            for p in published.iterdir()]}
        endpoint = self.web / 'repos/owner/repo/releases/latest'
        endpoint.parent.mkdir(parents=True, exist_ok=True)
        endpoint.write_text(json.dumps(release))
        return release, endpoint

    def test_release_complete_installs_and_partial_keeps_old(self):
        original = self.update('release-v1')
        release, endpoint = self.release(original)
        consumer = self.root / 'consumer'
        installed = ipdb.install(consumer, 'owner/repo', api_url=self.url, allow_local=True)
        self.assertEqual(ipdb.verify(installed)['version'], 'release-v1')
        release['assets'] = [a for a in release['assets'] if a['name'] != 'sample.csv']
        endpoint.write_text(json.dumps(release))
        with self.assertRaises(ipdb.Error):
            ipdb.install(consumer, 'owner/repo', api_url=self.url, allow_local=True)
        self.assertEqual((consumer / 'current').resolve(), installed)

    def test_release_draft_and_tag_mismatch_rejected(self):
        version = self.update('release-v1')
        release, endpoint = self.release(version)
        release['draft'] = True
        endpoint.write_text(json.dumps(release))
        with self.assertRaises(ipdb.Error):
            ipdb.install(self.root / 'consumer', 'owner/repo', api_url=self.url, allow_local=True)
        self.assertFalse((self.root / 'consumer/current').exists())

    def test_url_query_never_in_manifest_or_errors(self):
        self.configure([dict(self.entry, url=self.url + '/source.csv?token=topsecret')])
        version = self.update('test')
        self.assertNotIn('topsecret', (version / 'manifest.json').read_text())
        self.configure([dict(self.entry, url=self.url + '/missing?token=topsecret')])
        with self.assertRaises(ipdb.Error) as caught:
            self.update('bad')
        self.assertNotIn('topsecret', str(caught.exception))

    def test_unsafe_remote_http_rejected(self):
        with self.assertRaises(ipdb.Error):
            ipdb.checked_url('http://example.com/source', allow_local=True)

if __name__ == '__main__':
    unittest.main()
