"""Content identity for the complete diagnostic inputs, independent of timestamps."""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def inputs_digest(behavior_id):
    descriptor = ROOT / 'registry/behaviors' / f'{behavior_id}.json'
    paths = [descriptor, *sorted((ROOT / 'simulation').rglob('*.py')), ROOT / 'simulation/assets.lock.json', ROOT / 'simulation/requirements.txt']
    # Tests do not influence the executable runner identity.
    paths = sorted(p for p in paths if 'tests' not in p.parts)
    h = hashlib.sha256()
    for p in paths:
        h.update(str(p.relative_to(ROOT)).encode() + b'\0' + p.read_bytes() + b'\0')
    return h.hexdigest()

def evidence_key(inputs_sha256, artifact_sha256):
    return hashlib.sha256(f'{inputs_sha256}:{artifact_sha256}'.encode()).hexdigest()
