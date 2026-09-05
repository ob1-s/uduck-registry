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
    if old['id'] == p['id']:
        raise ValueError(f"ID already registered at registry/policies/{old['id']}.json")
    if old['source']['repo'].lower() == p['source']['repo'].lower():
        raise ValueError(
            f"Repository already registered as {old['id']}. To publish a new revision, "
            f"open a normal PR updating registry/policies/{old['id']}.json; "
            "the URL bot does not create update PRs yet."
        )
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

def quoted(value, limit=1000):
    return str(value).replace('`', '').replace('@', '@\u200b').replace('\n', ' ')[:limit]

def blockquoted(value, limit=4000):
    text = str(value or '')[:limit].replace('\r', '')
    text = (text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                .replace('`', '&#96;').replace('@', '@\u200b'))
    lines = text.splitlines() or ['No contributor notes provided.']
    return '\n'.join('> ' + (line or ' ') for line in lines)

manifest = diagnosis.get('manifest', {})
if not isinstance(manifest, dict):
    manifest = {}
unresolved = diagnosis.get('unresolved', [])
if not isinstance(unresolved, list):
    unresolved = []
review_notes = '\n'.join('- ' + quoted(item) for item in unresolved[:20]) or '- No unresolved package metadata reported.'
onnx = diagnosis.get('onnx', {})
if not isinstance(onnx, dict):
    onnx = {}
simulation = diagnosis.get('simulation', {})
if not isinstance(simulation, dict):
    simulation = {}
if simulation.get('status') == 'covered':
    recipe = simulation.get('recipe', {})
    if not isinstance(recipe, dict):
        recipe = {}
    sim_review = (
        f"**covered** — runner `{quoted(simulation.get('runner', recipe.get('runner', 'unknown')))}`, "
        f"scenario `{quoted(recipe.get('scenario', 'unknown'))}`, duration "
        f"`{quoted(recipe.get('duration_s', 'unknown'))}s`. "
        f"{quoted(simulation.get('scope') or recipe.get('provenance', {}).get('scope', ''))}"
    )
else:
    sim_reason = quoted(simulation.get('reason', 'No registry recipe reported.'))
    if manifest.get('kind') == 'episodic' and manifest.get('action_scale') is None:
        sim_reason += " Republish with Pollen's `uv run publish ... --action-scale <trained-scale>`; uDuck will not guess it."
    sim_review = f"**not-covered** — {sim_reason}"
contributor = submission.get('contributor', {})
if not isinstance(contributor, dict):
    contributor = {}
contributor_notes = blockquoted(contributor.get('notes'))
body = f"""Registers `{p['source']['repo']}` at `{p['source']['revision']}` from #{issue}.

Only the pinned source and curation overlay are authored. Build resolution rechecks the manifest and ONNX hashes.

- Artifact SHA256: `{p['source']['artifact_sha256']}`
- Manifest SHA256: `{p['source']['manifest_sha256']}`
- Manifest schema: `{quoted(manifest.get('schema_version', 'unknown'))}`
- Kind: `{quoted(manifest.get('kind', 'unknown'))}`
- Runtime assessment: `{quoted(diagnosis.get('runtime', 'needs review'))}`
- License: `{quoted(diagnosis.get('license') or 'not declared')}`
- ONNX interface: input `{quoted(onnx.get('input', 'unknown'))}` → output `{quoted(onnx.get('output', 'unknown'))}`; smoke `{quoted(onnx.get('smoke', 'unknown'))}`
- Registry simulation: {sim_review}
- Hardware: no registry verification

Package review notes:
{review_notes}

Contributor notes (untrusted reviewer context; not runtime evidence):
{contributor_notes}

Review license, command semantics, curation, and build results before merging. Bot PRs created with GITHUB_TOKEN can leave pull_request workflows awaiting approval; this bot explicitly dispatches uDuck CI on the proposed branch. Check that run before merging.

Closes #{issue}.
"""
pull = gh('api', f'repos/{repo}/pulls', payload={'title': f"Register {p['id']}", 'head': branch, 'base': 'main', 'body': body}, method='POST')

gh('api', f'repos/{repo}/actions/workflows/ci.yml/dispatches', payload={'ref': branch}, method='POST')

gh('api', f'repos/{repo}/issues/{issue}/comments', payload={'body': f"Prepared {pull['html_url']} from the pinned package. CI has been requested; the PR contains the package diagnosis and links to the checks.\n\n{review_notes}"}, method='POST')
