#!/usr/bin/env python3
"""Resolve Pollen Hub packages. Never imports publisher code or reads pickle files."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from simulation.pointer_recipes import recipe_for_policy, recipe_reason

SHA = re.compile(r"^[0-9a-f]{40}$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REPO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$")
CATEGORIES = {'locomotion', 'agility-tricks', 'manipulation', 'recovery', 'roller-skate', 'experimental'}

def digest(data):
    return hashlib.sha256(data).hexdigest()

class HubRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urllib.parse.urlsplit(newurl)
        if u.scheme != 'https' or u.username or u.password or not (
            u.hostname == 'huggingface.co' or (u.hostname or '').endswith(('.huggingface.co', '.hf.co', '.xethub.hf.co'))
        ):
            raise ValueError('Hub redirected to an unsupported host')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(url, limit=2 * 1024 * 1024):
    """Fetch Hub bytes with bounded retries for transient upstream failures.

    Retries 429/502/503/504 with exponential backoff, honoring a sane
    Retry-After (capped at 60s). Permanent failures (e.g. 404) raise at once.
    """
    import time
    last = None
    for attempt in range(5):
        try:
            with urllib.request.build_opener(HubRedirect()).open(
                urllib.request.Request(url, headers={'User-Agent': 'uduck-registry'}), timeout=60
            ) as response:
                data = response.read(limit + 1)
            if len(data) > limit:
                raise ValueError(f'Download exceeds {limit} bytes')
            return data
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (429, 502, 503, 504) or attempt == 4:
                raise
            retry_after = exc.headers.get('Retry-After', '')
            delay = min(int(retry_after), 60) if retry_after.isdigit() else 2 ** (attempt + 1)
            time.sleep(max(1, delay))
        except (urllib.error.URLError, TimeoutError) as exc:
            last = exc
            if attempt == 4:
                raise
            time.sleep(2 ** (attempt + 1))
    assert last is not None
    raise last

def parse_url(value):
    u = urllib.parse.urlsplit(value)
    if u.scheme != 'https' or u.netloc != 'huggingface.co' or u.query or u.fragment:
        raise ValueError('Submit https://huggingface.co/<owner>/<repo> (optionally /tree/<revision>). Publish raw ONNX with Pollen first; custom sources need manual review.')
    parts = u.path.strip('/').split('/')
    if len(parts) not in (2, 4) or (len(parts) == 4 and parts[2] != 'tree'):
        raise ValueError('Expected a Hub model repository URL, optionally /tree/<revision>')
    repo = '/'.join(parts[:2])
    if not REPO.fullmatch(repo) or parts[0] in ('datasets', 'spaces', 'models'):
        raise ValueError('Expected a Hugging Face model repository')
    rev = parts[3] if len(parts) == 4 else 'main'
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', rev) or rev in ('.', '..'):
        raise ValueError('Unsupported revision')
    return repo, rev

def classify(manifest, repo=None, source=None):
    """Accept upstream optional fields; missing claims remain unresolved."""
    if not isinstance(manifest, dict) or manifest.get('schema_version') != 2:
        raise ValueError('Expected Pollen manifest.json schema_version: 2')
    if 'policies' in manifest:
        raise ValueError('Multi-policy sets require per-file maintainer review; submit a single-policy package here')
    issues = []
    for key, expected in [('obs_len', 61), ('action_len', 14), ('model_api', 1)]:
        v = manifest.get(key)
        if v is None:
            issues.append(f'{key} is not declared')
        elif type(v) is not int or v != expected:
            raise ValueError(f'Unsupported {key}: {v!r} (registry supports {expected})')
    robot = manifest.get('robot', {})
    if not isinstance(robot, dict):
        raise ValueError('robot must be an object')
    for key, expected in [('model', 'microduck'), ('hw_rev', 1), ('servos', 'xl330'), ('control_hz', 50)]:
        if robot.get(key) is None:
            issues.append(f'robot.{key} is not declared')
        elif robot[key] != expected or isinstance(robot[key], bool):
            raise ValueError(f'Unsupported robot.{key}: {robot[key]!r}')
    command = manifest.get('command') or {}
    if not isinstance(command, dict):
        raise ValueError('command must be an object')
    for key in ('duration_s', 'unwind_s', 'action_scale'):
        v = manifest.get(key)
        if v is not None and (type(v) not in (int, float) or not 0 < v <= 300):
            raise ValueError(f'{key} must be a finite positive number <= 300')
    if 'chain' in manifest and type(manifest['chain']) is not bool:
        raise ValueError('chain must be boolean')
    idle = command.get('idle')
    if idle is not None and (not isinstance(idle, list) or len(idle) != 3 or any(type(v) not in (float, int) or not -3 <= v <= 3 for v in idle)):
        raise ValueError('command.idle must be three finite numbers in [-3, 3]')
    kind = manifest.get('kind')
    encoding = command.get('encoding', 'constant')
    if kind not in ('episodic', 'perpetual', 'scripted', None):
        raise ValueError(f'Unknown kind: {kind!r}')
    route = 'review'
    if encoding not in ('constant', 'phase', 'posture_flag'):
        issues.append(f'Unsupported command encoding: {encoding}')
    elif encoding != 'constant' or kind == 'scripted':
        issues.append('Daemon-driven policy: use the upstream slot workflow; no generic skill install')
    elif kind == 'episodic' and manifest.get('duration_s'):
        route = 'skill'
    elif kind == 'perpetual' and manifest.get('slot') in ('walk', 'stand'):
        route = 'slot'
    elif kind == 'perpetual':
        issues.append('Held pose requires an explicit command and hold/unwind review')
    else:
        issues.append('Missing kind or episodic duration; install needs review')
    # A constant encoding does NOT generally specify the command value. The
    # maintainer-owned recipe layer may cover a small set of documented
    # defaults or named upstream examples, but that diagnosis is independent
    # from install routing and never becomes authored pointer state.
    recipe = recipe_for_policy(repo, manifest, source) if repo else None
    if recipe:
        simulation = {
            'status': 'covered',
            'runner': recipe['runner'],
            'recipe': recipe,
            'scope': recipe['provenance']['scope'],
        }
    else:
        simulation = {
            'status': 'not-covered',
            'reason': recipe_reason(repo or '', manifest, source),
        }
    return {'runtime': 'pollen-hub' if not issues else 'pollen-review', 'install_route': route if not issues else 'review', 'unresolved': issues, 'simulation': simulation}

def inspect_onnx(data):
    import onnxruntime as ort
    import numpy as np
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
    # Bytes-only loading cannot resolve external tensor files. No custom ops.
    session = ort.InferenceSession(data, sess_options=options, providers=['CPUExecutionProvider'])
    inputs, outputs = session.get_inputs(), session.get_outputs()
    def shape_ok(shape, width):
        return len(shape) == 2 and (shape[0] == 1 or isinstance(shape[0], str) or shape[0] is None) and shape[1] == width
    if len(inputs) != 1 or len(outputs) != 1 or inputs[0].type != 'tensor(float)' or outputs[0].type != 'tensor(float)' or not shape_ok(inputs[0].shape, 61) or not shape_ok(outputs[0].shape, 14):
        raise ValueError('Expected a float ONNX with one [1,61] input and one [1,14] output')
    result = session.run(None, {inputs[0].name: np.zeros((1, 61), dtype=np.float32)})[0]
    if result.shape != (1, 14) or not np.isfinite(result).all():
        raise ValueError('ONNX zero-input smoke check returned invalid outputs')
    return {'input': inputs[0].shape, 'output': outputs[0].shape, 'smoke': 'passed', 'scope': 'Shape and finite zero-input outputs only; not behavioral or hardware evidence.'}

def resolve(url, expected=None):
    repo, revision = parse_url(url)
    metadata = json.loads(fetch(f'https://huggingface.co/api/models/{repo}/revision/{revision}'))
    revision = metadata.get('sha')
    if not isinstance(revision, str) or not SHA.fullmatch(revision):
        raise ValueError('Hub did not return an immutable commit SHA')
    files = [s['rfilename'] for s in metadata.get('siblings', [])]
    if sorted(f for f in files if f.endswith('.onnx')) != ['policy.onnx'] or 'manifest.json' not in files:
        raise ValueError('Expected exactly policy.onnx and manifest.json; publish with Pollen or request custom review')
    base = f'https://huggingface.co/{repo}/resolve/{revision}'
    raw = fetch(base + '/manifest.json')
    manifest = json.loads(raw)
    data = fetch(base + '/policy.onnx', 100 * 1024 * 1024)
    hashes = {'manifest_sha256': digest(raw), 'artifact_sha256': digest(data)}
    if expected and any(expected[k] != v for k, v in hashes.items()):
        raise ValueError('Pinned manifest or policy hash mismatch')
    diagnosis = classify(manifest, repo, {'revision': revision, **hashes})
    license_name = (metadata.get('cardData') or {}).get('license')
    if not isinstance(license_name, str) or not license_name.strip():
        diagnosis['unresolved'].append('Model card does not declare a license; maintainer review required')
    return {'source': {'repo': repo, 'revision': revision, **hashes}, 'manifest': manifest, 'license': license_name, 'onnx': inspect_onnx(data), **diagnosis}

def validate_pointer(p):
    if not isinstance(p, dict) or set(p) - {'id', 'source', 'curation', 'media'}:
        raise ValueError('Unknown pointer fields')
    if not SLUG.fullmatch(p.get('id', '')) or len(p['id']) > 100:
        raise ValueError('Invalid policy id')
    s = p.get('source', {})
    if set(s) != {'repo', 'revision', 'artifact_sha256', 'manifest_sha256'} or not REPO.fullmatch(s.get('repo', '')) or not SHA.fullmatch(s.get('revision', '')):
        raise ValueError('Source requires repo, immutable revision and both hashes')
    for key in ('artifact_sha256', 'manifest_sha256'):
        if not re.fullmatch(r'[0-9a-f]{64}', s[key]):
            raise ValueError('Invalid SHA256')
    c = p.get('curation', {})
    if set(c) - {'category', 'tags', 'summary', 'notes'} or c.get('category') not in CATEGORIES:
        raise ValueError('Invalid curation')
    if not isinstance(c.get('tags', []), list) or len(c.get('tags', [])) > 20 or any(not isinstance(t, str) or not 0 < len(t) <= 80 for t in c.get('tags', [])):
        raise ValueError('Invalid tags')
    for key in ('summary', 'notes'):
        if key in c and (not isinstance(c[key], str) or len(c[key]) > 4000):
            raise ValueError('Invalid curation text')
    media = p.get('media', [])
    if not isinstance(media, list) or len(media) > 10:
        raise ValueError('Invalid media')
    for item in media:
        u = urllib.parse.urlsplit(item.get('url', ''))
        if set(item) != {'type', 'url', 'label'} or item['type'] not in ('video', 'image') or u.scheme != 'https' or not u.hostname or u.username or u.password or not isinstance(item['label'], str):
            raise ValueError('Invalid author media')
    return p

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['resolve', 'register', 'prepare'])
    parser.add_argument('url', nargs='?')
    parser.add_argument('--id')
    parser.add_argument('--category', default='experimental', choices=sorted(CATEGORIES))
    args = parser.parse_args()
    if args.command == 'prepare':
        target = ROOT / '.generated/policies'
        target.mkdir(parents=True, exist_ok=True)
        for stale in target.glob('*.json'):
            stale.unlink()
        for file in sorted((ROOT / 'registry/policies').glob('*.json')):
            p = validate_pointer(json.loads(file.read_text()))
            if file.stem != p['id']:
                raise ValueError('Pointer filename must equal its id')
            s = p['source']
            result = resolve(f"https://huggingface.co/{s['repo']}/tree/{s['revision']}", s)
            (target / file.name).write_text(json.dumps({**p, 'resolved': result}, indent=2) + '\n')
        return
    if not args.url:
        parser.error('URL is required')
    result = resolve(args.url)
    if args.command == 'resolve':
        print(json.dumps(result, indent=2))
        return
    policy_id = args.id or re.sub(r'[^a-z0-9]+', '-', result['source']['repo'].lower()).strip('-')
    p = validate_pointer({'id': policy_id, 'source': result['source'], 'curation': {'category': args.category, 'tags': []}})
    if (ROOT / 'registry/behaviors' / f'{policy_id}.json').exists():
        raise ValueError('ID already belongs to a legacy behavior; migration requires review')
    for file in (ROOT / 'registry/policies').glob('*.json'):
        existing = json.loads(file.read_text())
        if existing['source']['repo'].lower() == p['source']['repo'].lower():
            raise ValueError(
                f"Repository already registered as {existing['id']}. To publish a new revision, "
                f"open a normal PR updating registry/policies/{existing['id']}.json; "
                "the URL bot does not create update PRs yet."
            )
    destination = ROOT / 'registry/policies' / f'{policy_id}.json'
    with destination.open('x') as output:
        output.write(json.dumps(p, indent=2) + '\n')
    print(json.dumps({'pointer': str(destination.relative_to(ROOT)), 'diagnosis': result}, indent=2))

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        raise SystemExit(str(exc))
