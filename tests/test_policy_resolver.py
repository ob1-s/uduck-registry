import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts/policy'))
from ingest_issue import parse_issue
from resolve import _discover_source, classify, digest, parse_artifact_url, parse_source_url, parse_url, resolve, resolve_source, select_manifest_for_artifact, validate_policy


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
POLLEN_POLICY_SET = {
    'schema_version': 2,
    'model_api': 1,
    'obs_len': 61,
    'action_len': 14,
    'robot': {'model': 'microduck', 'hw_rev': 1, 'servos': 'xl330', 'control_hz': 50},
    'policies': [
        {'file': 'alpha_walking.onnx', 'kind': 'perpetual'},
        {'file': 'alpha_stand.onnx', 'kind': 'perpetual'},
        {'file': 'roller.onnx', 'kind': 'perpetual', 'mode': 'roller', 'action_scale': 0.8},
        {'file': 'alpha_sitstand.onnx', 'name': 'sitstand', 'kind': 'scripted', 'command': {'encoding': 'posture_flag', 'slot': 'twist.vx', 'sit': 1.0, 'stand': 0.0, 'idle': [0, 0, 0]}, 'ramp_s': 2.0, 'unwind_s': 1.0},
        {'file': 'alpha_ground_pick.onnx', 'name': 'ground_pick', 'kind': 'episodic', 'duration_s': 2.8, 'command': {'encoding': 'phase', 'slots': 'twist.vx,twist.vy', 'period_s': 4.0, 'end_phase': 0.7}},
        {'file': 'roller_crouch.onnx', 'name': 'crouch', 'kind': 'episodic', 'duration_s': 3.5, 'mode': 'roller', 'action_scale': 0.8, 'command': {'encoding': 'phase', 'slots': 'twist.vx,twist.vy', 'period_s': 5.0, 'end_phase': 0.7}},
        {'file': 'roulade.onnx', 'kind': 'episodic', 'duration_s': 1.0, 'chain': True},
        {'file': 'ball_kick_left.onnx', 'name': 'kick_left', 'kind': 'episodic', 'duration_s': 0.5},
        {'file': 'ball_kick_right.onnx', 'name': 'kick_right', 'kind': 'episodic', 'duration_s': 0.5},
    ],
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
        self.assertEqual(parse_artifact_url('https://huggingface.co/owner/repo/tree/v2'), ('huggingface-model', 'owner/repo', 'v2', None))
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
        self.assertEqual(
            parse_artifact_url('https://huggingface.co/owner/repo/blob/' + 'a' * 40 + '/second.onnx'),
            ('huggingface-model', 'owner/repo', 'a' * 40, 'second.onnx'),
        )

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

    def test_non_hf_model_sources_never_receive_a_robotctl_install_route(self):
        source = {**policy_fixture()['source'], 'provider': 'github'}
        result = classify(MANIFEST, source['repo'], source)
        self.assertEqual(result['resolution'], 'ready')
        self.assertEqual(result['install_route'], 'review')
        self.assertTrue(result['install_unresolved'])

    def test_policy_set_manifest_selects_exact_per_file_runtime_facts(self):
        manifest = {
            'schema_version': 2,
            'model_api': 1,
            'obs_len': 61,
            'action_len': 14,
            'robot': {'model': 'microduck', 'hw_rev': 1, 'servos': 'xl330', 'control_hz': 50},
            'policies': [
                {'file': 'first.onnx', 'kind': 'perpetual'},
                {'file': 'second.onnx', 'kind': 'episodic', 'duration_s': 2.8, 'command': {'encoding': 'phase', 'period_s': 4.0, 'end_phase': 0.7}},
            ],
        }
        raw = json.dumps(manifest).encode()
        source = {
            **policy_fixture()['source'],
            'repo': 'owner/policy-set',
            'revision': 'a' * 40,
            'artifact_path': 'second.onnx',
            'artifact_sha256': digest(b'fake-onnx'),
            'manifest_path': 'manifest.json',
            'manifest_sha256': digest(raw),
        }

        def fetch(url, *args):
            if url.endswith('/manifest.json'):
                return raw
            if '/api/models/' in url:
                return json.dumps({'sha': 'a' * 40, 'siblings': [], 'cardData': {'license': 'apache-2.0'}}).encode()
            return b'fake-onnx'

        with patch('resolve.fetch', fetch), patch('resolve.inspect_onnx', return_value={'smoke': 'passed'}):
            result = resolve_source(source)
        self.assertTrue(result['policy_set'])
        self.assertEqual(result['manifest']['file'], 'second.onnx')
        self.assertEqual(result['manifest']['duration_s'], 2.8)
        self.assertEqual(result['manifest']['command']['period_s'], 4.0)
        self.assertNotIn('policies', result['manifest'])
        with patch('resolve.fetch', fetch):
            with self.assertRaisesRegex(ValueError, 'no unique entry'):
                resolve_source({**source, 'artifact_path': 'missing.onnx'})

    def test_official_pollen_entries_select_their_exact_policy_set_members(self):
        expected = {
            'alpha-walking': ('alpha_walking.onnx', 'perpetual', None, 'constant'),
            'ball-kick-left': ('ball_kick_left.onnx', 'episodic', 0.5, 'constant'),
            'ball-kick-right': ('ball_kick_right.onnx', 'episodic', 0.5, 'constant'),
            'ground-pick': ('alpha_ground_pick.onnx', 'episodic', 2.8, 'phase'),
            'roller-crouch': ('roller_crouch.onnx', 'episodic', 3.5, 'phase'),
            'roller-drive': ('roller.onnx', 'perpetual', None, 'constant'),
            'roulade': ('roulade.onnx', 'episodic', 1.0, 'constant'),
            'sit-stand': ('alpha_sitstand.onnx', 'scripted', None, 'posture_flag'),
        }
        policies_dir = Path(__file__).resolve().parents[1] / 'registry/policies'
        for entry_id, (artifact_path, kind, duration, encoding) in expected.items():
            policy = json.loads((policies_dir / f'{entry_id}.json').read_text())
            source = policy['source']
            self.assertEqual(source['repo'], 'pollen-robotics/microduck-policies')
            self.assertEqual(source['revision'], '088524a64e2557dc453256b6071dbb9d23888802')
            self.assertEqual(source['artifact_path'], artifact_path)
            manifest, policy_set = select_manifest_for_artifact(POLLEN_POLICY_SET, artifact_path)
            self.assertTrue(policy_set)
            self.assertEqual(manifest['file'], artifact_path)
            self.assertEqual(manifest['kind'], kind)
            self.assertEqual(manifest.get('duration_s'), duration)
            self.assertEqual((manifest.get('command') or {}).get('encoding', 'constant'), encoding)
            self.assertNotIn('policies', manifest)

    def test_multi_onnx_discovery_requires_and_honors_exact_artifact(self):
        with patch('resolve._resolve_revision', return_value='a' * 40), \
             patch('resolve._source_files', return_value=['first.onnx', 'second.onnx']), \
             patch('resolve.fetch', side_effect=lambda url, *args: b'second' if url.endswith('second.onnx') else b''):
            result = _discover_source('huggingface-model', 'owner/policy-set', 'main', 'second.onnx')
            self.assertEqual(result['artifact_path'], 'second.onnx')
            with self.assertRaisesRegex(ValueError, 'multiple ONNX'):
                _discover_source('huggingface-model', 'owner/policy-set', 'main')

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
