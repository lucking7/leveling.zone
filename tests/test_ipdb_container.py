import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ENTRY = Path(__file__).resolve().parents[1] / 'scripts/docker-entrypoint.sh'


class EntrypointTests(unittest.TestCase):
    def invoke(self, python_status, command=('npm', 'start'), auto='1'):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            for name, body in [('python', f'exit {python_status}'), ('npm', 'echo APP_STARTED')]:
                p = root / name
                p.write_text('#!/bin/sh\n' + body + '\n')
                p.chmod(0o755)
            env = dict(os.environ, PATH=str(root) + ':' + os.environ['PATH'], IPDB_AUTO_INSTALL=auto)
            return subprocess.run(['sh', str(ENTRY), *command], cwd=root, env=env,
                                  capture_output=True, text=True)

    def test_failed_database_install_prevents_app_start(self):
        result = self.invoke(42)
        self.assertEqual(result.returncode, 42)
        self.assertNotIn('APP_STARTED', result.stdout)

    def test_explicit_command_is_honored(self):
        result = self.invoke(42, ('echo', 'UPDATER_COMMAND'))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), 'UPDATER_COMMAND')

    def test_prepared_external_store_can_disable_auto_install(self):
        result = self.invoke(42, auto='0')
        self.assertEqual(result.returncode, 0)
        self.assertIn('APP_STARTED', result.stdout)

    def test_successful_install_and_verification_start_app(self):
        result = self.invoke(0)
        self.assertEqual(result.returncode, 0)
        self.assertIn('APP_STARTED', result.stdout)


if __name__ == '__main__':
    unittest.main()
