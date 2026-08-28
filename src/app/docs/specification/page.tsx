import Link from "next/link";
import { Activity, AlertTriangle, ArrowLeft, Gauge, ShieldCheck, Terminal } from "lucide-react";

export const metadata = {
  title: "Runtime contract — uDuck Registry",
  description: "The Microduck observation, action, and timing contract.",
};

const observations = [
  ["0 – 13", "14", "Joint positions", "Measured servo angles (rad) relative to the neutral pose."],
  ["14 – 27", "14", "Joint velocities", "Measured angular velocity (rad/s) from encoder derivatives."],
  ["28 – 41", "14", "Previous actions", "Targets sent on the previous control tick for temporal smoothness."],
  ["42 – 44", "3", "Projected gravity", "Gravity unit vector in the trunk frame; upright is [0, 0, -1]."],
  ["45 – 47", "3", "Angular velocity", "Trunk gyroscope vector [wx, wy, wz] in rad/s."],
  ["48 – 50", "3", "Twist command", "Operator intent: forward, lateral, and yaw velocity."],
  ["51 – 54", "4", "Head pose command", "Neck and head orientation targets."],
  ["55 – 60", "6", "Body pose command", "Torso translation and rotation offset [tx, ty, tz, roll, pitch, yaw]."],
];

export default function SpecificationPage() {
  return (
    <div className="doc-page">
      <div className="doc-wrap">
        <Link href="/" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to behaviors</Link>
        <header className="doc-header">
          <div className="doc-header-meta"><span className="doc-badge">Contract v1.0</span><small>Microduck runtime</small></div>
          <h1>The shared rhythm behind every move.</h1>
          <p>Behavior policies use one predictable interface: 61 observations in, 14 joint targets out, 50 times each second.</p>
        </header>

        <div className="doc-intro">
          <p>Keeping this shape fixed makes behaviors swappable. A policy can change from a walk to a recovery move without changing the daemon that runs it.</p>
          <p>The contract below describes the values a policy receives and the targets it returns. Normalization statistics travel inside the ONNX graph.</p>
        </div>

        <section className="surface doc-section">
          <h2><Activity size={17} aria-hidden="true" /> 01 / Observation vector</h2>
          <p>Eight groups make up the 61-dimensional input.</p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead><tr><th>Index</th><th>Dims</th><th>Component</th><th>What it carries</th></tr></thead>
              <tbody>{observations.map(([range, dims, component, description]) => <tr key={range}><td className="range">{range}</td><td>{dims}</td><td className="component">{component}</td><td className="description">{description}</td></tr>)}</tbody>
            </table>
          </div>
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
          <p>Simulation uses the BAM M6 actuator model for the XL330 Dynamixel. It accounts for the details that matter on a small, light biped.</p>
          <div className="doc-grid">
            <div className="doc-mini-card"><h3>Motor behavior</h3><ul><li>voltage control laws</li><li>back-EMF resistance</li><li>thermal voltage sag</li></ul></div>
            <div className="doc-mini-card"><h3>Contact behavior</h3><ul><li>Coulomb & viscous friction</li><li>Stribeck friction</li><li>gearbox backlash</li></ul></div>
            <div className="doc-mini-card"><h3>Variation</h3><ul><li>battery: 6.5–8.4 V</li><li>per-environment randomization</li><li>50 Hz control loop</li></ul></div>
          </div>
        </section>

        <section className="surface doc-section">
          <h2><Terminal size={17} aria-hidden="true" /> 04 / Runtime priority</h2>
          <p>When several gestures are available, the daemon resolves them in this order:</p>
          <pre className="code-block"><code>roulade 〉 kick 〉 ground_pick 〉 sit/rise 〉 stand_by_magnitude 〉 walk</code></pre>
        </section>
      </div>
    </div>
  );
}
