import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/policy'))
from resolve import parse_url, classify, validate_pointer, resolve, digest
from ingest_issue import parse_issue

MANIFEST = {'schema_version': 2, 'model_api': 1, 'obs_len': 61, 'action_len': 14,
            'robot': {'model': 'microduck', 'hw_rev': 1, 'servos': 'xl330', 'control_hz': 50},
            'kind': 'episodic', 'duration_s': 4, 'command': {'encoding': 'constant'}}
FLAMINGO = json.loads((Path(__file__).resolve().parents[1] / 'simulation/tests/fixtures/flamingo-manifest.json').read_text())
class ResolverTests(unittest.TestCase):
    def test_url_boundary(self):
        self.assertEqual(parse_url('https://huggingface.co/owner/repo/tree/v2'), ('owner/repo', 'v2'))
        for url in ['https://huggingface.co.evil.test/a/b', 'https://user@huggingface.co/a/b', 'file:///a/b', 'https://huggingface.co/datasets/repo', 'https://huggingface.co/a/b/resolve/main/policy.onnx', 'https://huggingface.co/a/b?token=x']:
            with self.assertRaises(ValueError): parse_url(url)
    def test_optional_upstream_fields_are_not_evidence(self):
        result = classify({'schema_version': 2})
        self.assertEqual(result['runtime'], 'pollen-review')
        self.assertIn('obs_len is not declared', result['unresolved'])
    def test_constant_does_not_imply_zero_or_velocity(self):
        result = classify(MANIFEST)
        self.assertEqual(result['install_route'], 'skill')
        self.assertEqual(result['simulation']['status'], 'not-covered')
        m = copy.deepcopy(MANIFEST)
        m.update(kind='perpetual', duration_s=None)
        m['command'] = {'twist': ['flag', 'side', 'unused'], 'idle': [0, 0, 0]}
        self.assertEqual(classify(m)['install_route'], 'review')

    def test_named_recipe_marks_flamingo_simulation_covered(self):
        result = classify(FLAMINGO, 'RemiFabre/microduck-flamingo-cycle', {
            'revision': '6646428394c6997106d2dc07c1588f20f6fea026',
            'manifest_sha256': 'ac9b9ae16b4f21733990710275bd934c97558c6028e060bd2b34ec1f5341d302',
            'artifact_sha256': 'df77929c39d7695092bdaf810c2075e20a9ba91abd8192b4073d3de593d56904',
        })
        self.assertEqual(result['simulation']['status'], 'covered')
        self.assertEqual(result['simulation']['runner'], 'microduck-standard-v1')
        recipe = result['simulation']['recipe']
        self.assertEqual(recipe['segments'][0]['command'], [1.0, 1.0, 0.0])
        self.assertEqual(recipe['duration_s'], 5.0)
        self.assertNotIn('unwind_s', recipe)
    def test_daemon_encodings_not_generic_skill(self):
        for encoding in ('phase', 'posture_flag'):
            m = copy.deepcopy(MANIFEST); m['command']['encoding'] = encoding
            self.assertEqual(classify(m)['install_route'], 'review')
    def test_invalid_claims_fail(self):
        for key, value in [('obs_len', 60), ('model_api', 2), ('duration_s', float('nan')), ('chain', 1)]:
            m = {**MANIFEST, key: value}
            with self.assertRaises(ValueError): classify(m)
    def test_resolve_uses_same_immutable_revision_and_checks_hashes(self):
        raw = json.dumps(MANIFEST).encode(); model = b'fake-onnx'; calls = []
        def fetch(url, *args):
            calls.append(url)
            if '/api/models/' in url:
                return json.dumps({'sha': 'a' * 40, 'siblings': [{'rfilename': 'policy.onnx'}, {'rfilename': 'manifest.json'}], 'cardData': {'license': 'apache-2.0'}}).encode()
            return raw if url.endswith('manifest.json') else model
        with patch('resolve.fetch', fetch), patch('resolve.inspect_onnx', return_value={'smoke': 'passed'}):
            result = resolve('https://huggingface.co/o/r')
            self.assertEqual(result['source']['artifact_sha256'], digest(model))
            self.assertTrue(all('/resolve/' + 'a' * 40 in url for url in calls[1:]))
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                resolve('https://huggingface.co/o/r', {'artifact_sha256': '0' * 64, 'manifest_sha256': digest(raw)})
    def test_issue_input_is_data(self):
        self.assertEqual(parse_issue('### Policy URL\n\nhttps://huggingface.co/a/b\n\n### Category\n\nexperimental\n\n### Notes\n\nhello @maintainer\n'), ('https://huggingface.co/a/b', 'experimental', 'hello @maintainer'))
        self.assertEqual(parse_issue('### Policy URL\n\nhttps://huggingface.co/a/b\n\n### Category\n\nexperimental\n'), ('https://huggingface.co/a/b', 'experimental', ''))
        with self.assertRaises(ValueError): parse_issue('### Policy URL\n\na\nb')
        with self.assertRaisesRegex(ValueError, 'Notes exceed'):
            parse_issue('### Policy URL\n\nhttps://huggingface.co/a/b\n\n### Category\n\nexperimental\n\n### Notes\n\n' + 'x' * 4001)
    def test_pointer_rejects_runtime_claims_and_unsafe_paths(self):
        p = {'id': 'test', 'source': {'repo': 'o/r', 'revision': 'a'*40, 'artifact_sha256': 'b'*64, 'manifest_sha256': 'c'*64}, 'curation': {'category': 'experimental'}}
        self.assertEqual(validate_pointer(p), p)
        for change in [{'id': '../test'}, {'verification': {'status': 'verified_hardware'}}, {'simulation': {'checks': ['pass']}}]:
            with self.assertRaises(ValueError): validate_pointer({**p, **change})
    def test_fetch_retries_transient_and_honors_retry_after(self):
        import urllib.error
        import resolve as resolve_mod
        calls = {'n': 0}
        real_opener = resolve_mod.urllib.request.build_opener
        class FakeHeaders(dict):
            def get(self, key, default=''):
                return super().get(key, default)
        def fail_once_then_ok(*args, **kwargs):
            class Ctx:
                def __enter__(self_inner):
                    if calls['n'] == 0:
                        calls['n'] += 1
                        raise urllib.error.HTTPError('url', 429, 'rate limit', FakeHeaders({'Retry-After': '1'}), None)
                    import io
                    calls['n'] += 1
                    data = b'ok'
                    class Resp:
                        def read(self_inner2, n=-1): return data
                        def __enter__(self_inner2): return self_inner2
                        def __exit__(self_inner2, *a): return False
                    return Resp()
                def __exit__(self_inner, *a): return False
            class Opener:
                def open(self_inner, req, timeout=None): return Ctx()
            return Opener()
        with patch.object(resolve_mod.urllib.request, 'build_opener', fail_once_then_ok), \
             patch('time.sleep', return_value=None) as slept:
            self.assertEqual(resolve_mod.fetch('https://huggingface.co/o/r/resolve/main/manifest.json', limit=10), b'ok')
            self.assertTrue(slept.called)
        # Permanent 404 is not retried indefinitely.
        def always_404(*args, **kwargs):
            class Opener:
                def open(self_inner, req, timeout=None):
                    raise urllib.error.HTTPError('url', 404, 'missing', FakeHeaders(), None)
            return Opener()
        with patch.object(resolve_mod.urllib.request, 'build_opener', always_404), \
             patch('time.sleep', return_value=None) as slept:
            with self.assertRaises(urllib.error.HTTPError):
                resolve_mod.fetch('https://huggingface.co/o/r/resolve/main/manifest.json', limit=10)
            slept.assert_not_called()
if __name__ == '__main__': unittest.main()
