#!/usr/bin/env python3
"""Publish a validated database directory as a verified, then public Release."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

try:
    from scripts import ipdb_snapshot as snapshot
except ModuleNotFoundError:
    import ipdb_snapshot as snapshot

PublishError = snapshot.Error
digest = snapshot.digest


def gh(*args, binary=False):
    # Never echo gh stderr or a command containing authentication information.
    result = subprocess.run(['gh', *args], capture_output=True, timeout=1800)
    if result.returncode:
        raise PublishError(f'GitHub operation failed ({args[0]}); exit={result.returncode}')
    if binary:
        return result.stdout
    return result.stdout.decode('utf-8')


def find_release(repo, tag):
    """Resolve a Release by tag. `/releases/tags/` answers 404 while it is a draft."""
    page = 1
    while True:
        releases = json.loads(gh('api', f'repos/{repo}/releases?per_page=100&page={page}'))
        if not isinstance(releases, list):
            raise PublishError('Invalid Release listing')
        for release in releases:
            if release.get('tag_name') == tag:
                return release
        if len(releases) < 100:
            raise PublishError('Release not found after upload')
        page += 1


def confirm_published(repo, tag, attempts=3):
    for attempt in range(attempts):
        try:
            release = json.loads(gh('api', f'repos/{repo}/releases/tags/{tag}'))
            if not release.get('draft') and release.get('published_at'):
                return release
        except (PublishError, ValueError):
            pass
        if attempt + 1 < attempts:
            time.sleep(2**attempt)
    raise PublishError('Release publication could not be confirmed')


def publish(directory, repo, tag, target, dry_run=False):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        raise PublishError('Invalid repository')
    snapshot.release_version(tag)
    if not re.fullmatch(r'[a-fA-F0-9]{40}', target):
        raise PublishError('Target must be the full commit SHA')
    directory = directory.resolve(strict=True)
    verifier = Path(__file__).with_name('ipdb.py')
    result = subprocess.run([sys.executable, str(verifier), 'verify', '--directory', str(directory)],
                            capture_output=True, timeout=600)
    if result.returncode:
        raise PublishError('Local database verification failed; nothing published')
    plan = snapshot.release_plan(directory, expected_version=tag)
    names = plan.names
    if dry_run:
        print(json.dumps({'mode': 'dry-run', 'repo': repo, 'tag': tag, 'target': target,
                          'assets': names}, indent=2))
        return
    # Fail on an existing tag/release. A rerun uses a new run-attempt tag and never
    # overwrites a good published version or another run's draft.
    refs = json.loads(gh('api', f'repos/{repo}/git/matching-refs/tags/{tag}'))
    if not isinstance(refs, list) or any(ref.get('ref') == 'refs/tags/' + tag for ref in refs):
        raise PublishError('Tag already exists; choose a new immutable version')
    created = False
    tagged = False
    publication_requested = False
    try:
        gh('api', f'repos/{repo}/git/refs', '--method', 'POST',
           '-f', 'ref=refs/tags/' + tag, '-f', 'sha=' + target)
        tagged = True
        notes = ('Validated IP databases. All selected sources passed format and SHA-256 checks.\n\n'
                 'The manifest records the selected databases, file sizes and hashes.\n'
                 'Download through the install command to verify the complete version.\n')
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', suffix='.md') as file:
            file.write(notes)
            file.flush()
            gh('release', 'create', tag, '--repo', repo, '--target', target, '--draft',
               '--verify-tag', '--title', tag, '--notes-file', file.name)
        created = True
        gh('release', 'upload', tag, *[str(directory / name) for name in names], '--repo', repo)
        release = find_release(repo, tag)
        if not release.get('draft') or release.get('tag_name') != tag:
            raise PublishError('Release changed while uploading; refusing to publish')
        assets = json.loads(gh('api', f"repos/{repo}/releases/{release['id']}/assets?per_page=100"))
        for asset in snapshot.audit_published_assets(assets, plan):
            # Older GitHub installations may not expose digests. Stream a
            # read-back to a temporary file rather than trust size alone.
            with tempfile.TemporaryFile() as file:
                result = subprocess.run(['gh', 'api', f"repos/{repo}/releases/assets/{asset['id']}",
                                         '-H', 'Accept: application/octet-stream'],
                                        stdout=file, stderr=subprocess.DEVNULL, timeout=1800)
                if result.returncode:
                    raise PublishError('Remote asset read-back failed')
                file.seek(0)
                hasher = hashlib.sha256()
                for chunk in iter(lambda: file.read(1024 * 1024), b''):
                    hasher.update(chunk)
                if hasher.hexdigest() != plan.assets[asset['name']].sha256:
                    raise PublishError(f"Remote read-back mismatch: {asset['name']}")
        ref = json.loads(gh('api', f'repos/{repo}/git/ref/tags/{tag}'))
        if ref.get('object', {}).get('type') != 'commit' or ref['object'].get('sha') != target:
            raise PublishError('Release tag does not point to the requested commit')
        publication_requested = True
        gh('release', 'edit', tag, '--repo', repo, '--draft=false', '--latest')
        confirm_published(repo, tag)
        print(f'Published verified Release: https://github.com/{repo}/releases/tag/{tag}')
    except Exception:
        if publication_requested:
            print(f'Publication was attempted for {tag}, but its final state may be public, draft, '
                  'or unknown. Inspect the Release before retrying. Previous published versions '
                  'were not modified.', file=sys.stderr)
        elif tagged or created:
            print(f'Unpublished tag or draft {tag} may remain; inspect it before retrying. '
                  'Previous published versions were not modified.', file=sys.stderr)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--repo', required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--target', required=True)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        publish(args.directory, args.repo, args.tag, args.target, args.dry_run)
    except PublishError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        # No raw network exceptions, response bodies, environment or CLI stderr.
        print('Release publication failed validation or a GitHub operation. '
              'Check local files, gh authentication and the draft state.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
