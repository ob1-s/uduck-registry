import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/policy'))
from ingest_issue import parse_issue
from resolve import classify, digest, parse_source_url, parse_url, resolve, validate_policy


MANIFEST = {
    'schema_version': 2,
    'model_api': 1,
    'obs_len': 61,
    'action_len': 14,
    'robot': {'model': 'microduck', 'hw_rev': 1, 'servos': 'xl330', 'control_hz': 50},
    'kind': 'episodic',
    'duration_s': 4,
    'action_scale': 1.0,
    'command': {'encoding': 'constant'},
}
FLAMINGO = json.loads((Path(__file__).resolve().parents[1] / 'simulation/tests/fixtures/flamingo-manifest.json').read_text())
FLAMINGO_SOURCE = {
    'provider': 'huggingface-model',
    'repo': 'RemiFabre/microduck-flamingo-cycle',
    'revision': '6646428394c6997106d2dc07c1588f20f6fea026',
    'artifact_path': 'policy.onnx',
    'artifact_sha256': 'df77929c39d7695092bdaf810c2075e20a9ba91abd8192b4073d3de593d56904',
    'manifest_path': 'manifest.json',
    'manifest_sha256': 'ac9b9ae16b4f21733990710275bd934c97558c6028e060bd2b34ec1f5341d302',
}


def policy_fixture() -> dict:
    return {
        'id': 'test-move',
        'source': {
            'provider': 'huggingface-model',
            'repo': 'owner/repo',
            'revision': 'a' * 40,
            'artifact_path': 'policy.onnx',
            'artifact_sha256': 'b' * 64,
            'manifest_path': None,
            'manifest_sha256': None,
        },
        'curation': {'category': 'experimental', 'tags': []},
    }


class ResolverTests(unittest.TestCase):
    def test_source_url_boundary(self):
        self.assertEqual(parse_source_url('https://huggingface.co/owner/repo/tree/v2'), ('huggingface-model', 'owner/repo', 'v2'))
        self.assertEqual(parse_source_url('https://huggingface.co/spaces/owner/repo/tree/v2'), ('huggingface-space', 'owner/repo', 'v2'))
        self.assertEqual(parse_source_url('https://github.com/owner/repo'), ('github', 'owner/repo', 'main'))
        self.assertEqual(parse_url('https://huggingface.co/owner/repo/tree/v2'), ('owner/repo', 'v2'))
        for url in [
            'https://huggingface.co.evil.test/a/b',
            'https://user@huggingface.co/a/b',
            'file:///a/b',
            'https://huggingface.co/datasets/repo',
            'https://huggingface.co/a/b/resolve/main/policy.onnx',
            'https://huggingface.co/a/b?token=x',
        ]:
            with self.assertRaises(ValueError): parse_source_url(url)

    def test_missing_manifest_facts_remain_review(self):
        result = classify({'schema_version': 2})
        self.assertEqual(result['resolution'], 'review')
        self.assertEqual(result['install_route'], 'review')
        self.assertIn('obs_len is not declared', result['unresolved'])
        self.assertEqual(result['simulation']['status'], 'not-covered')

    def test_constant_manifest_gets_no_recipe_without_an_authored_source(self):
        result = classify(MANIFEST)
        self.assertEqual(result['install_route'], 'skill')
        self.assertEqual(result['simulation']['status'], 'not-covered')

    def test_generic_zero_recipe_requires_explicit_source_and_contract(self):
        source = {**policy_fixture()['source'], 'repo': 'owner/episodic'}
        result = classify(MANIFEST, source['repo'], source)
        self.assertEqual(result['simulation']['status'], 'covered')
        self.assertEqual(result['simulation']['recipe']['scenario'], 'oneshot_zero')
        missing_scale = copy.deepcopy(MANIFEST)
        del missing_scale['action_scale']
        self.assertEqual(classify(missing_scale, source['repo'], source)['simulation']['status'], 'not-covered')

    def test_named_recipe_marks_flamingo_simulation_covered(self):
        result = classify(FLAMINGO, FLAMINGO_SOURCE['repo'], FLAMINGO_SOURCE)
        self.assertEqual(result['simulation']['status'], 'covered')
        recipe = result['simulation']['recipe']
        self.assertEqual(recipe['runner'], 'microduck-standard-v1')
        self.assertEqual(recipe['segments'][0]['command'], [1.0, 1.0, 0.0])
        self.assertEqual(recipe['duration_s'], 5.0)
        self.assertNotIn('unwind_s', recipe)

    def test_command_protocol_changes_close_generic_coverage(self):
        source = {**policy_fixture()['source'], 'repo': 'owner/episodic'}
        for encoding in ('phase', 'posture_flag'):
            manifest = copy.deepcopy(MANIFEST)
            manifest['command']['encoding'] = encoding
            self.assertEqual(classify(manifest, source['repo'], source)['simulation']['status'], 'not-covered')
        manifest = copy.deepcopy(MANIFEST)
        manifest['command']['twist'] = ['forward speed']
        self.assertEqual(classify(manifest, source['repo'], source)['simulation']['status'], 'not-covered')

    def test_invalid_claims_fail(self):
        for key, value in [('obs_len', 60), ('model_api', 2), ('duration_s', float('nan')), ('kind', 'unknown')]:
            manifest = copy.deepcopy(MANIFEST)
            manifest[key] = value
            with self.assertRaises(ValueError): classify(manifest)

    def test_resolve_uses_authored_revision_and_checks_hashes(self):
        raw = json.dumps(MANIFEST).encode()
        model = b'fake-onnx'
        source = {
            **policy_fixture()['source'],
            'manifest_path': 'manifest.json',
            'manifest_sha256': digest(raw),
            'artifact_sha256': digest(model),
        }
        calls = []

        def fetch(url, *args):
            calls.append(url)
            if '/api/models/' in url:
                return json.dumps({'sha': 'a' * 40, 'siblings': [], 'cardData': {'license': 'apache-2.0'}}).encode()
            return raw if url.endswith('manifest.json') else model

        with patch('resolve.fetch', fetch), patch('resolve.inspect_onnx', return_value={'smoke': 'passed'}):
            result = resolve('https://huggingface.co/owner/repo', source)
            self.assertEqual(result['source']['artifact_sha256'], digest(model))
            self.assertTrue(all('/resolve/' + 'a' * 40 in url or '/api/models/' in url for url in calls))
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                resolve('https://huggingface.co/owner/repo', {**source, 'artifact_sha256': '0' * 64})

    def test_policy_validation_rejects_runtime_claims_and_unsafe_paths(self):
        policy = policy_fixture()
        self.assertEqual(validate_policy(policy), policy)
        for change in [
            {'id': '../test'},
            {'execution': {'runner': 'x'}},
            {'source': {**policy['source'], 'artifact_path': '../policy.onnx'}},
            {'source': {**policy['source'], 'revision': 'main'}},
        ]:
            candidate = copy.deepcopy(policy)
            candidate.update(change)
            with self.assertRaises(ValueError): validate_policy(candidate)

    def test_issue_input_is_data(self):
        body = '### Policy URL\n\nhttps://huggingface.co/a/b\n\n### Category\n\nexperimental\n\n### Notes\n\nhello @maintainer\n'
        self.assertEqual(parse_issue(body), ('https://huggingface.co/a/b', 'experimental', 'hello @maintainer'))
        self.assertEqual(parse_issue('### Policy URL\n\nhttps://huggingface.co/a/b\n\n### Category\n\nexperimental\n'), ('https://huggingface.co/a/b', 'experimental', ''))
        with self.assertRaises(ValueError): parse_issue('### Policy URL\n\na\nb')
        with self.assertRaisesRegex(ValueError, 'Notes exceed'):
            parse_issue('### Policy URL\n\nhttps://huggingface.co/a/b\n\n### Category\n\nexperimental\n\n### Notes\n\n' + 'x' * 4001)

    def test_fetch_retries_transient_and_honors_retry_after(self):
        import urllib.error
        import resolve as resolve_mod
        calls = {'n': 0}
        class FakeHeaders(dict):
            def get(self, key, default=''):
                return super().get(key, default)
        def fail_once_then_ok(*args, **kwargs):
            class Ctx:
                def __enter__(self_inner):
                    if calls['n'] == 0:
                        calls['n'] += 1
                        raise urllib.error.HTTPError('url', 429, 'rate limit', FakeHeaders({'Retry-After': '1'}), None)
                    calls['n'] += 1
                    class Resp:
                        def read(self_inner2, n=-1): return b'ok'
                        def __enter__(self_inner2): return self_inner2
                        def __exit__(self_inner2, *a): return False
                    return Resp()
                def __exit__(self_inner, *a): return False
            class Opener:
                def open(self_inner, req, timeout=None): return Ctx()
            return Opener()
        with patch.object(resolve_mod.urllib.request, 'build_opener', fail_once_then_ok), patch('time.sleep', return_value=None) as slept:
            self.assertEqual(resolve_mod.fetch('https://huggingface.co/o/r/resolve/main/manifest.json', limit=10), b'ok')
            self.assertTrue(slept.called)

        def always_404(*args, **kwargs):
            class Opener:
                def open(self_inner, req, timeout=None):
                    raise urllib.error.HTTPError('url', 404, 'missing', FakeHeaders(), None)
            return Opener()
        with patch.object(resolve_mod.urllib.request, 'build_opener', always_404), patch('time.sleep', return_value=None) as slept:
            with self.assertRaises(urllib.error.HTTPError):
                resolve_mod.fetch('https://huggingface.co/o/r/resolve/main/manifest.json', limit=10)
            slept.assert_not_called()


if __name__ == '__main__':
    unittest.main()
