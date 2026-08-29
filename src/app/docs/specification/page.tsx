import Link from "next/link";
import { Activity, AlertTriangle, ArrowLeft, Gauge, ShieldCheck, Terminal } from "lucide-react";

export const metadata = {
  title: "Runtime contract — uDuck Registry",
  description: "The Microduck observation, action, and timing contract.",
};

export default function SpecificationPage() {
  return (
    <div className="doc-page">
      <div className="doc-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>
        <header className="doc-header"><div className="doc-header-meta"><span className="doc-badge">Contract v1.0</span><small>Microduck runtime</small></div><h1>The shared rhythm behind every move.</h1><p>Behavior policies use one predictable interface: 61 observations in, 14 joint targets out, 50 times each second.</p></header>
        <div className="doc-intro"><p>Keeping this shape fixed makes behaviors swappable. Normalization is baked into the ONNX graph — no external stats.</p></div>
        <section className="surface doc-section">
          <h2><Activity size={17} aria-hidden="true" /> 01 / Observation vector</h2>
          <p>61-D input in <a href="https://github.com/pollen-robotics/microduck_rl/blob/develop/scripts/infer_policy.py#L589" target="_blank" rel="noopener noreferrer">Pollen canonical order (infer_policy.py:589)</a>: base_ang_vel 3 · projected_gravity 3 · joint_pos 14 · joint_vel 14 · last_action 14 · twist 3 + head 4 + body 6.</p>
          <div className="callout"><AlertTriangle size={15} aria-hidden="true" /><span>Populate all 61 values in this order. Use zero command values only for a neutral task input; do not truncate the vector. The normalizer is baked into the ONNX graph.</span></div>
        </section>
        <section className="surface doc-section">
          <h2><Gauge size={17} aria-hidden="true" /> 02 / Action vector</h2>
          <p>Each output is a position offset around the home pose: <code>target = home_pose + action_scale × action</code>.</p>
          <div className="doc-grid">
            <div className="doc-mini-card"><h3>Left leg · 0–4</h3><ul><li>0 · hip yaw</li><li>1 · hip roll</li><li>2 · hip pitch</li><li>3 · knee</li><li>4 · ankle</li></ul></div>
            <div className="doc-mini-card"><h3>Neck & head · 5–8</h3><ul><li>5 · neck pitch</li><li>6 · head pitch</li><li>7 · head yaw</li><li>8 · head roll</li></ul></div>
            <div className="doc-mini-card"><h3>Right leg · 9–13</h3><ul><li>9 · hip yaw</li><li>10 · hip roll</li><li>11 · hip pitch</li><li>12 · knee</li><li>13 · ankle</li></ul></div>
          </div>
          <div className="callout"><AlertTriangle size={15} aria-hidden="true" /><span><strong>The beak is separate.</strong> Its 15th motor is driven through programmatic RPC or gamepad input, outside this fixed locomotion space.</span></div>
        </section>
        <section className="surface doc-section">
          <h2><ShieldCheck size={17} aria-hidden="true" /> 03 / Actuator model & timing</h2>
          <p>50 Hz control loop using Pollen’s BAM M6 model for the XL330 Dynamixel. See <a href="https://github.com/pollen-robotics/microduck_rl" target="_blank" rel="noopener noreferrer">microduck_rl</a> for full motor, contact and randomization details.</p>
        </section>
        <section className="surface doc-section">
          <h2><Terminal size={17} aria-hidden="true" /> 04 / Runtime priority</h2>
          <p>Daemon resolves overlapping gestures as: <code>roulade 〉 kick 〉 ground_pick 〉 sit/rise 〉 stand_by_magnitude 〉 walk</code>.</p>
          <p><small>Uncited — inferred from community robotd; may diverge from Pollen upstream. Treat as advisory.</small></p>
        </section>
      </div>
    </div>
  );
}
