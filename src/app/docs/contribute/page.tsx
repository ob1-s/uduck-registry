import Link from "next/link";
import { AlertCircle, ArrowLeft, GitFork } from "lucide-react";

export const metadata = {
  title: "Add a behavior — uDuck Registry",
  description: "How to add a MicroDuck behavior JSON record to the registry.",
};

const exampleJson = `{
  "id": "my-cool-trick",
  "name": "My Cool Duck Trick",
  "version": "1.0.0",
  "description": "A short explanation of the behavior.",
  "category": "agility-tricks",
  "tags": ["community", "trick"],
  "authors": [{ "name": "Your Name", "github": "yourgithub" }],
  "license": "Apache-2.0",
  "verification": {
    "status": "community_experimental",
    "summary": "Community policy with no physical deployment evidence yet.",
    "hardware_target": "MicroDuck v1"
  },
  "contract": {
    "observation_dim": 61,
    "observation_breakdown": {
      "proprioception": 48,
      "twist": 3,
      "head_pose": 4,
      "body_pose": 6
    },
    "action_dim": 14,
    "action_breakdown": {
      "left_leg": 5,
      "neck_head": 4,
      "right_leg": 5
    },
    "control_frequency_hz": 50,
    "decimation": 4,
    "actuator_model": "Dynamixel XL330 (BAM M6 actuator physics)",
    "action_scale": 1
  },
  "compatibility": {
    "robot_model": "microduck-standard",
    "accessories_required": [],
    "terrain": ["flat"],
    "robotd_slot": "walk"
  },
  "artifacts": { "onnx": { "filename": "my_cool_trick.onnx", "url": "https://huggingface.co/your-org/my-cool-trick/resolve/main/my_cool_trick.onnx", "baked_normalizer": true } },
  "media": { "hero_type": "badge" },
  "sources": { "upstream_repo": "https://github.com/yourgithub/my_duck_repo" },
  "deployment": { "robotd_toml": "[policy]\\nwalk = \\\"/opt/robot/policies/my_cool_trick.onnx\\\"" }
}`;

export default function ContributePage() {
  return (
    <div className="doc-page">
      <div className="doc-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>
        <header className="doc-header">
          <div className="doc-header-meta"><span className="doc-badge doc-badge-lilac">Contribution guide</span><small>Bring a new move</small></div>
          <h1>Give the shelf a new trick.</h1>
          <p>Add one validated behavior JSON file, keep the source link close, and tell us what the duck actually ran.</p>
        </header>

        <div className="steps">
          <section className="step"><span className="step-number">01</span><h2>Make a behavior record</h2><p>Create <code>registry/behaviors/&lt;your-id&gt;.json</code>. Use a lowercase kebab-case <code>id</code> that matches the filename.</p></section>
          <section className="step"><span className="step-number">02</span><h2>Keep the contract honest</h2><p>Policies in this catalog use 61 observations, 14 joint outputs, and a 50 Hz control loop. Point to the canonical ONNX artifact rather than copying it here.</p><div className="callout"><AlertCircle size={15} aria-hidden="true" /><span>Only use <code>verified_hardware</code> when the behavior has run on a physical MicroDuck with evidence in the pull request, or is clearly shipped by the upstream project. Use <code>claimed_hardware</code> when the author reports a hardware run that the registry has not reproduced.</span></div></section>
          <section className="step"><span className="step-number">03</span><h2>Validate before opening a PR</h2><p>Run the registry checks from the repository root.</p><pre className="code-block"><code>pnpm validate{`\n`}pnpm test{`\n`}pnpm compile{`\n`}pnpm build</code></pre></section>
          <section className="step"><span className="step-number">04</span><h2>Open the pull request</h2><p>Include a short description, evidence, and the upstream links. Regenerate the catalog index before opening the PR; CI checks that it matches.</p></section>
        </div>

        <section className="surface doc-section">
          <h2><GitFork size={17} aria-hidden="true" /> Starter behavior JSON</h2>
          <p>Copy this shape, then fill in the fields required by the full schema.</p>
          <pre className="code-block"><code>{exampleJson}</code></pre>
        </section>
      </div>
    </div>
  );
}
