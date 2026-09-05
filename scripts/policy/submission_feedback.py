"""Post an actionable failure from trusted code; never execute artifact content."""
import os
import subprocess
from pathlib import Path

issue = str(int(os.environ['ISSUE_NUMBER']))
error = Path('feedback/submission-error.txt')
reason = error.read_text()[:4000] if error.is_file() else 'Package resolution failed before a diagnostic was written. See the workflow run.'
# Keep publisher text inert inside a quote and avoid accidental mass mentions.
reason = reason.replace('@', '@\u200b')
body = 'The policy URL could not be registered.\n\n' + '\n'.join('> ' + line for line in reason.splitlines()) + '\n\nCheck the URL and package, edit the issue, then close and reopen it to retry. Pollen packages contain `manifest.json` schema 2 and `policy.onnx`. Custom sources can be reviewed manually.'
Path('feedback-body.md').write_text(body)
subprocess.run(['gh', 'issue', 'comment', issue, '--body-file', 'feedback-body.md'], check=True)
