import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PolicyContributionContractTests(unittest.TestCase):
    def test_issue_form_and_workflow_use_label_and_edit_retry(self):
        template = (ROOT / '.github/ISSUE_TEMPLATE/register-policy.yml').read_text()
        workflow = (ROOT / '.github/workflows/register-policy.yml').read_text()
        self.assertIn('policy-submission', template)
        self.assertNotIn('title: "[policy] "', template)
        self.assertIn('types: [opened, edited, reopened, labeled]', workflow)
        self.assertIn("contains(github.event.issue.labels.*.name, 'policy-submission')", workflow)
        self.assertNotIn('github.event.issue.title', workflow)

    def test_proposer_surfaces_diagnosis_and_contributor_context(self):
        proposer = (ROOT / 'scripts/policy/propose.py').read_text()
        self.assertIn('ONNX interface:', proposer)
        self.assertIn('Registry simulation:', proposer)
        self.assertIn('Contributor notes (untrusted reviewer context; not runtime evidence):', proposer)
        self.assertIn("replace('@', '@\\u200b')", proposer)


if __name__ == '__main__':
    unittest.main()
