"""Parse issue form data without evaluating shell, Markdown, or upstream code."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from resolve import CATEGORIES

MAX_NOTES = 4000


def parse_issue(body):
    sections = dict(re.findall(r'^### ([^\n]+)\n+([\s\S]*?)(?=^### |\Z)', body, re.M))
    url = sections.get('Policy URL', '').strip()
    category = sections.get('Category', 'experimental').strip()
    notes = sections.get('Notes', '').strip()
    if category in ('', '_No response_'):
        category = 'experimental'
    if notes == '_No response_':
        notes = ''
    if category not in CATEGORIES:
        raise ValueError('Unknown category')
    if not url or '\n' in url:
        raise ValueError('Expected one Policy URL')
    if len(notes) > MAX_NOTES:
        raise ValueError(f'Notes exceed {MAX_NOTES} characters')
    return url, category, notes


if __name__ == '__main__':
    try:
        event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        url, category, notes = parse_issue(event['issue']['body'])
        result = subprocess.run(
            [sys.executable, 'scripts/policy/resolve.py', 'register', url, '--category', category],
            capture_output=True,
            text=True,
            timeout=240,
        )
        if result.returncode:
            raise ValueError(result.stderr[:8000])
        submission = json.loads(result.stdout)
        submission['contributor'] = {'notes': notes}
        Path('submission.json').write_text(json.dumps(submission, indent=2) + '\n')
    except Exception as exc:
        Path('submission-error.txt').write_text(str(exc)[:8000])
        raise SystemExit(1)
