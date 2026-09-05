"""The registration bot must issue GitHub writes with explicit HTTP methods.

`gh api` defaults to GET; `--input` only supplies a body. Every mutating bot
call therefore needs an explicit `--method` (POST for refs/PRs/comments/
dispatches, PUT for Contents API writes), or branch creation, file writes,
PR creation, and CI dispatch silently go out as GETs.
"""
import importlib
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/policy'))

POINTER = {
    'id': 'test-move',
    'source': {
        'repo': 'o/r',
        'revision': 'a' * 40,
        'artifact_sha256': 'b' * 64,
        'manifest_sha256': 'c' * 64,
    },
    'curation': {'category': 'experimental', 'tags': []},
}


class ProposeMethodTests(unittest.TestCase):
    def test_mutating_calls_carry_explicit_methods(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'candidate/registry/policies').mkdir(parents=True)
            (root / 'candidate/registry/policies/test-move.json').write_text(json.dumps(POINTER))
            (root / 'candidate/submission.json').write_text(json.dumps({
                'pointer': 'registry/policies/test-move.json',
                'diagnosis': {'manifest': {}, 'unresolved': []},
            }))
            (root / 'registry/policies').mkdir(parents=True)
            (root / 'registry/behaviors').mkdir(parents=True)

            calls = []

            class Done(Exception):
                pass

            def fake_run(command, input=None, text=None, capture_output=None, check=None):
                calls.append(command)
                if command[1] == 'pr' and command[2] == 'list':
                    return type('R', (), {'stdout': '[]'})()
                if any('git/ref/heads/main' in part for part in command):
                    return type('R', (), {'stdout': json.dumps({'object': {'sha': 'd' * 40}})})()
                if any(part == 'pulls' or part.endswith('/pulls') for part in command):
                    return type('R', (), {'stdout': json.dumps({'html_url': 'http://example/x'})})()
                return type('R', (), {'stdout': ''})()

            old_cwd = os.getcwd()
            old_env = dict(os.environ)
            os.chdir(root)
            os.environ['GH_REPO'] = 'o/repo'
            os.environ['ISSUE_NUMBER'] = '7'
            try:
                sys.modules.pop('propose', None)
                with patch('subprocess.run', side_effect=fake_run):
                    importlib.import_module('propose')
            finally:
                os.chdir(old_cwd)
                os.environ.clear()
                os.environ.update(old_env)
                sys.modules.pop('propose', None)

            api_calls = [c for c in calls if len(c) > 2 and c[1] == 'api']
            # reads stay GET (no --method flag)
            reads = [c for c in api_calls if any('git/ref/heads/main' in part for part in c)]
            self.assertTrue(reads)
            for call in reads:
                self.assertNotIn('--method', call)
            # every mutating endpoint carries its required method
            expected = {
                'git/refs': 'POST',
                'contents/registry/policies/test-move.json': 'PUT',
                'pulls': 'POST',
                'dispatches': 'POST',
                'issues/7/comments': 'POST',
            }
            for endpoint, method in expected.items():
                matches = [c for c in api_calls if any(endpoint in part for part in c)]
                self.assertTrue(matches, endpoint)
                for call in matches:
                    self.assertIn('--method', call, endpoint)
                    self.assertEqual(call[call.index('--method') + 1], method, endpoint)


if __name__ == '__main__':
    unittest.main()
