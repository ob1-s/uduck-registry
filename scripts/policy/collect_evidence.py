"""Build-local publication from this run's trusted, credential-free sim jobs."""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

if __name__ == '__main__':
    root = Path(sys.argv[1])
    for report in sorted(root.rglob('report.json')):
        data = json.loads(report.read_text())
        if data.get('execution') == 'rendered':
            subprocess.run([sys.executable, 'simulation/publish_result.py', str(report.parent)], check=True)
    target = Path('public/media/registry-sim')
    with zipfile.ZipFile('registry-evidence.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(target.glob('*/*')):
            if file.name in ('report.json', 'loop.mp4', 'poster.png'):
                archive.write(file, str(file.relative_to(target)))
