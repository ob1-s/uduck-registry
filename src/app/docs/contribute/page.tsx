import Link from "next/link";
import { AlertCircle, ArrowLeft, GitFork } from "lucide-react";

export const metadata = {
  title: "Add a behavior — uDuck Registry",
  description: "How to add a Microduck behavior manifest to the registry.",
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
    "status": "verified_simulation",
    "summary": "Simulated in mjlab.",
    "hardware_target": "Microduck v1"
  },
  "contract": {
    "observation_dim": 61,
    "action_dim": 14,
    "control_frequency_hz": 50
  },
  "compatibility": {
    "robot_model": "microduck-standard",
    "mjcf_model": "robot_allcollisions.xml",
    "accessories_required": [],
    "terrain": ["flat"],
    "robotd_slot": "custom"
  },
  "artifacts": { "onnx": { "filename": "my_cool_trick.onnx", "url": "https://…" } },
  "media": { "hero_type": "badge" },
  "sources": { "upstream_repo": "https://github.com/yourgithub/my_duck_repo" },
  "deployment": { "robotd_toml": "[policy]\\ncustom = \\\"/opt/robot/policies/my_cool_trick.onnx\\\"" }
}`;

export default function ContributePage() {
  return (
    <div className="doc-page">
      <div className="doc-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>
        <header className="doc-header">
          <div className="doc-header-meta"><span className="doc-badge doc-badge-lilac">Contribution guide</span><small>Bring a new move</small></div>
          <h1>Give the shelf a new trick.</h1>
          <p>Add one validated JSON manifest, keep the source link close, and tell us what the duck actually ran.</p>
        </header>

        <div className="steps">
          <section className="step"><span className="step-number">01</span><h2>Make a manifest</h2><p>Create <code>registry/behaviors/&lt;your-id&gt;.json</code>. Use a lowercase kebab-case <code>id</code> that matches the filename.</p></section>
          <section className="step"><span className="step-number">02</span><h2>Keep the contract honest</h2><p>Policies in this catalog use 61 observations, 14 joint outputs, and a 50 Hz control loop. Point to the canonical ONNX artifact rather than copying it here.</p><div className="callout"><AlertCircle size={15} aria-hidden="true" /><span>Only use <code>verified_hardware</code> when the behavior has run on a physical Microduck with evidence in the pull request. Use <code>verified_simulation</code> for a tested simulator run.</span></div></section>
          <section className="step"><span className="step-number">03</span><h2>Validate before opening a PR</h2><p>Run the registry checks from the repository root.</p><pre className="code-block"><code>pnpm validate{`\n`}pnpm test</code></pre></section>
          <section className="step"><span className="step-number">04</span><h2>Open the pull request</h2><p>Include a short description, evidence, and the upstream links. Once merged, the catalog index is regenerated automatically.</p></section>
        </div>

        <section className="surface doc-section">
          <h2><GitFork size={17} aria-hidden="true" /> Starter manifest</h2>
          <p>Copy this shape, then fill in the fields required by the full schema.</p>
          <pre className="code-block"><code>{exampleJson}</code></pre>
        </section>
      </div>
    </div>
  );
}
