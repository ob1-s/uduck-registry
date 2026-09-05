"""Trusted publisher: validates inert pointer data; never loads the ONNX."""
import base64
import json
import os
import re
import subprocess
from pathlib import Path
from resolve import validate_pointer

def gh(*args, payload=None, method=None):
    # `gh api` defaults to GET; `--input` only supplies the body, so every
    # mutating call must pass an explicit `--method` (POST for refs/PRs/
    # comments/dispatches, PUT for Contents API writes).
    command = ['gh', *args]
    if method is not None:
        command += ['--method', method]
    if payload is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None, text=True, capture_output=True, check=True)
    return json.loads(result.stdout) if result.stdout.strip() else None

repo = os.environ['GH_REPO']
issue = int(os.environ['ISSUE_NUMBER'])
submission = json.loads(Path('candidate/submission.json').read_text())
relative = submission['pointer']
if not re.fullmatch(r'registry/policies/[a-z0-9]+(?:-[a-z0-9]+)*\.json', relative):
    raise ValueError('Invalid candidate path')
candidate_file = Path('candidate') / relative
if candidate_file.stat().st_size > 65536:
    raise ValueError('Pointer exceeds 64 KB')
p = validate_pointer(json.loads(candidate_file.read_text()))
if relative != f"registry/policies/{p['id']}.json":
    raise ValueError('Candidate filename mismatch')
if (Path('registry/behaviors') / f"{p['id']}.json").exists():
    raise ValueError('Candidate conflicts with existing behavior')
for file in Path('registry/policies').glob('*.json'):
    old = json.loads(file.read_text())
    if old['id'] == p['id'] or old['source']['repo'].lower() == p['source']['repo'].lower():
        raise ValueError('Already registered; update existing pointer')
branch = f'bot/policy-{issue}'
existing = gh('pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,url')
if existing:
    print(f"Submission already has PR #{existing[0]['number']}")
    gh('api', f'repos/{repo}/issues/{issue}/comments', payload={'body': f"This submission already has a review PR: {existing[0]['url']}"}, method='POST')
    raise SystemExit(0)
head = gh('api', f'repos/{repo}/git/ref/heads/main')['object']['sha']
try:
    gh('api', f'repos/{repo}/git/refs', payload={'ref': 'refs/heads/' + branch, 'sha': head}, method='POST')
except subprocess.CalledProcessError:
    # Retry only a branch previously created from this exact main revision.
    if gh('api', f'repos/{repo}/git/ref/heads/{branch}')['object']['sha'] != head:
        raise
content = base64.b64encode((json.dumps(p, indent=2) + '\n').encode()).decode()
gh('api', f'repos/{repo}/contents/{relative}', payload={'message': f"Register {p['id']}", 'branch': branch, 'content': content}, method='PUT')
diagnosis = submission.get('diagnosis', {})
def quoted(value):
    return str(value).replace('`', '').replace('@', '@\u200b').replace('\n', ' ')[:1000]
manifest = diagnosis.get('manifest', {})
if not isinstance(manifest, dict):
    manifest = {}
unresolved = diagnosis.get('unresolved', [])
if not isinstance(unresolved, list):
    unresolved = []
review_notes = '\n'.join('- ' + quoted(item) for item in unresolved[:20]) or '- No unresolved package metadata reported.'
body = f"""Registers `{p['source']['repo']}` at `{p['source']['revision']}` from #{issue}.

Only the pinned source and curation overlay are authored. Build resolution rechecks the manifest and ONNX hashes.

- Artifact SHA256: `{p['source']['artifact_sha256']}`
- Manifest SHA256: `{p['source']['manifest_sha256']}`
- Manifest schema: `{quoted(manifest.get('schema_version', 'unknown'))}`
- Kind: `{quoted(manifest.get('kind', 'unknown'))}`
- Runtime assessment: `{quoted(diagnosis.get('runtime', 'needs review'))}`
- License: `{quoted(diagnosis.get('license') or 'not declared')}`
- ONNX inspection: zero-input smoke check completed; CI independently checks the pinned package again
- Hardware: no registry verification
- Registry simulation: see the explicitly dispatched CI run for its recipe, report, and measured outcome; package inspection alone is not a behavioral pass

Package review notes:
{review_notes}

Review license, command semantics, curation, and build results before merging. Bot PRs created with GITHUB_TOKEN can leave pull_request workflows awaiting approval; this bot explicitly dispatches uDuck CI on the proposed branch. Check that run before merging.

Closes #{issue}.
"""
pull = gh('api', f'repos/{repo}/pulls', payload={'title': f"Register {p['id']}", 'head': branch, 'base': 'main', 'body': body}, method='POST')

gh('api', f'repos/{repo}/actions/workflows/ci.yml/dispatches', payload={'ref': branch}, method='POST')

gh('api', f'repos/{repo}/issues/{issue}/comments', payload={'body': f"Prepared {pull['html_url']} from the pinned package. CI has been requested; the PR contains the package diagnosis and links to the checks.\n\n{review_notes}"}, method='POST')
