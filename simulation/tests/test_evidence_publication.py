import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import publish_result
from evidence import evidence_key

class PublicationTests(unittest.TestCase):
    def test_stale_inputs_rejected_and_failed_checks_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'input'; source.mkdir()
            descriptor = root / 'registry/behaviors/test.json'
            descriptor.parent.mkdir(parents=True); descriptor.write_text('{}')
            for name in ('loop.mp4', 'poster.png'): (source / name).write_bytes(b'media')
            report = {'behavior': 'test', 'execution': 'rendered', 'checks_status': 'failed',
                      'inputs_sha256': 'old', 'policy': {'sha256': 'a' * 64}, 'evidence_key': 'wrong'}
            (source / 'report.json').write_text(json.dumps(report))
            with patch.object(publish_result, 'REPO_ROOT', root), patch.object(publish_result, 'inputs_digest', return_value='current'):
                with self.assertRaisesRegex(ValueError, 'does not match'): publish_result.publish(source)
                report['inputs_sha256'] = 'current'
                report['evidence_key'] = evidence_key('current', 'a' * 64)
                (source / 'report.json').write_text(json.dumps(report))
                result = publish_result.publish(source)
                self.assertEqual(json.loads((result / 'report.json').read_text())['checks_status'], 'failed')
    def test_non_rendered_output_is_never_published(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            (source / 'report.json').write_text(json.dumps({'behavior': 'test', 'execution': 'unsupported'}))
            for name in ('loop.mp4', 'poster.png'): (source / name).write_bytes(b'media')
            with self.assertRaisesRegex(ValueError, 'completed diagnostic'): publish_result.publish(source)
