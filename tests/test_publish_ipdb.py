import importlib.util
import contextlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('publish_ipdb', Path(__file__).resolve().parents[1] / 'scripts/publish-ipdb.py')
publisher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publisher)
TAG = 'ip-db-test-1'
SHA = 'a' * 40


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        (self.directory / 'data.csv').write_text('asn\n1\n')
        publisher.snapshot.write(self.directory, TAG, [{
            'id': 'data',
            'filename': 'data.csv',
            'format': 'csv',
            'source': 'fixture.invalid',
            'columns': ['asn'],
        }])
        self.assets = [{'name': p.name, 'size': p.stat().st_size, 'digest': 'sha256:' + publisher.digest(p),
                        'state': 'uploaded', 'id': n} for n, p in enumerate(self.directory.iterdir(), 1)]
        self.calls = []
        self.upload_fails = False
        self.existing_tag = False
        self.wrong_target = False
        self.published = False
        self.confirmation_fails = False

    def remote(self, *args, **kwargs):
        self.calls.append(args)
        if args[:2] == ('release', 'upload') and self.upload_fails:
            raise publisher.PublishError('Upload failed')
        if args[:2] == ('release', 'edit'):
            self.published = True
        if args[0] == 'api':
            endpoint = args[1]
            if '/git/matching-refs/' in endpoint:
                return json.dumps([{'ref': 'refs/tags/' + TAG}] if self.existing_tag else [])
            if '/git/ref/' in endpoint:
                return json.dumps({'object': {'type': 'commit', 'sha': 'b' * 40 if self.wrong_target else SHA}})
            if '/assets?' in endpoint:
                return json.dumps(self.assets)
            if '/releases/tags/' in endpoint:
                # GitHub answers 404 here while the Release is still a draft.
                if not self.published or self.confirmation_fails:
                    raise publisher.PublishError('GitHub operation failed (api); exit=1')
                return json.dumps({'id': 1, 'tag_name': TAG, 'draft': False,
                                   'published_at': '2026-09-11T00:00:00Z'})
            if '/releases?' in endpoint:
                return json.dumps([{'id': 1, 'tag_name': TAG, 'draft': not self.published,
                                    'published_at': '2026-09-11T00:00:00Z' if self.published else None}])
            return json.dumps({'id': 1, 'tag_name': TAG, 'draft': not self.published,
                               'published_at': '2026-09-11T00:00:00Z' if self.published else None})
        return ''

    def execute(self, dry_run=False):
        with patch.object(publisher, 'gh', side_effect=self.remote), \
             patch.object(publisher.time, 'sleep'):
            publisher.publish(self.directory, 'lucking7/leveling.zone', TAG, SHA, dry_run)

    def test_draft_only_becomes_public_after_remote_verification(self):
        self.execute()
        operations = [c[:2] for c in self.calls]
        self.assertLess(operations.index(('release', 'create')), operations.index(('release', 'upload')))
        self.assertEqual(self.calls[-2][:2], ('release', 'edit'))
        self.assertTrue(self.published)

    def test_release_plan_covers_database_manifest_and_checksums(self):
        plan = publisher.snapshot.release_plan(self.directory, expected_version=TAG)
        self.assertEqual(plan.names, ('data.csv', 'manifest.json', 'SHA256SUMS'))
        for name in plan.names:
            self.assertEqual(plan.assets[name].sha256, publisher.digest(self.directory / name))

    def test_local_failure_makes_no_remote_calls(self):
        (self.directory / 'data.csv').write_text('tampered\n')
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertEqual(self.calls, [])

    def test_invalid_format_with_valid_checksums_makes_no_remote_calls(self):
        (self.directory / 'data.csv').write_text('asn\nnot-a-number\n')
        publisher.snapshot.write(self.directory, TAG, [{
            'id': 'data', 'filename': 'data.csv', 'format': 'csv',
            'source': 'fixture.invalid', 'columns': ['asn'],
        }])
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertEqual(self.calls, [])

    def test_release_plan_hashes_each_file_once(self):
        with patch.object(publisher.snapshot, 'digest', wraps=publisher.snapshot.digest) as digest:
            publisher.snapshot.release_plan(self.directory, expected_version=TAG)
        self.assertCountEqual([call.args[0].name for call in digest.call_args_list],
                              ['data.csv', 'manifest.json', 'SHA256SUMS'])

    def test_verification_retains_subprocess_timeout(self):
        with patch.object(publisher.subprocess, 'run', side_effect=subprocess.TimeoutExpired('verify', 600)) as run:
            with self.assertRaises(subprocess.TimeoutExpired): self.execute()
        self.assertEqual(run.call_args.kwargs['timeout'], 600)
        self.assertEqual(self.calls, [])

    def test_existing_tag_without_release_is_rejected(self):
        self.existing_tag = True
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertFalse(any(c[:2] == ('release', 'create') for c in self.calls))

    def test_upload_failure_does_not_publish_or_delete_old_release(self):
        self.upload_fails = True
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertFalse(self.published)
        self.assertFalse(any(c[:2] == ('release', 'delete') for c in self.calls))

    def test_missing_remote_asset_keeps_draft(self):
        self.assets.pop()
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertFalse(self.published)

    def test_unexpected_remote_asset_keeps_draft(self):
        self.assets.append({'name': 'unexpected.bin', 'size': 1, 'digest': 'sha256:' + '0' * 64,
                            'state': 'uploaded', 'id': 99})
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertFalse(self.published)

    def test_same_size_corrupt_remote_digest_keeps_draft(self):
        self.assets[0]['digest'] = 'sha256:' + '0' * 64
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertFalse(self.published)

    def test_draft_resolution_avoids_the_tags_endpoint(self):
        # GitHub does not resolve a draft through /releases/tags/, so the uploaded
        # Release must be read back from the collection endpoint before publication.
        self.execute()
        before_publish = []
        for call in self.calls:
            if call[:2] == ('release', 'edit'):
                break
            before_publish.append(call)
        self.assertEqual([c for c in before_publish if c[0] == 'api' and '/releases/tags/' in c[1]], [])
        self.assertTrue(any(c[0] == 'api' and '/releases?' in c[1] for c in before_publish))

    def test_wrong_tag_commit_keeps_draft(self):
        self.wrong_target = True
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertFalse(self.published)

    def test_failed_confirmation_reports_unknown_publication_state(self):
        self.confirmation_fails = True
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr), self.assertRaises(publisher.PublishError):
            self.execute()
        self.assertTrue(self.published)
        self.assertIn('final state may be public, draft, or unknown', stderr.getvalue())
        self.assertNotIn('Unpublished tag or draft', stderr.getvalue())

    def test_dry_run_makes_no_remote_calls(self):
        self.execute(dry_run=True)
        self.assertEqual(self.calls, [])

    def test_manifest_tag_mismatch_never_creates_release(self):
        manifest_path = self.directory / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['version'] = 'other'
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaises(publisher.PublishError): self.execute()
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main()
