import Link from "next/link";
import { Cpu, Activity, Gauge, ShieldCheck, ArrowLeft, Terminal, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "MicroDuck Contract Specification — uDuck Registry",
  description: "Comprehensive specification of the 61-D observation vector, 14-actuator action layout, and 50 Hz control loop contract for MicroDuck.",
};

export default function SpecificationPage() {
  return (
    <div className="min-h-screen py-10 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to catalog</span>
        </Link>

        {/* Title */}
        <div className="border-b border-slate-800 pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-mono text-emerald-400 border border-emerald-400/20">
              Contract Spec v1.0
            </span>
            <span className="text-xs font-mono text-slate-500">
              Ecosystem Standard: Pollen Robotics Alpha
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            MicroDuck Contract Specification
          </h1>
          <p className="text-sm text-slate-400">
            The mathematical and physical interface standard that enables hot-swappable reinforcement learning policies on MicroDuck hardware.
          </p>
        </div>

        {/* Executive Summary */}
        <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
          <p>
            To allow seamless runtime switching between walking, standing, crouching, kicking, and acrobatics, Pollen Robotics designed a unified <strong>61-dimensional observation contract</strong> and a <strong>14-actuator action contract</strong> operating at <strong>50 Hz</strong>.
          </p>
          <p>
            Any neural policy that conforms to this interface can be loaded directly by <code className="text-amber-300 font-mono">robotd</code> on the physical Rockchip RK3566 SBC without needing bespoke daemon recompilation or runtime plumbing.
          </p>
        </div>

        {/* Section 1: Observation Vector */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            1. The 61-Dimensional Observation Vector
          </h2>
          <p className="text-xs text-slate-400">
            Observation tensors are normalized at inference time using statistics baked directly into the ONNX graph by <code className="text-slate-300 font-mono">export.py</code>.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4">Index Range</th>
                  <th className="py-2.5 pr-4">Dimensions</th>
                  <th className="py-2.5 pr-4">Component</th>
                  <th className="py-2.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-2.5 text-cyan-400">0 – 13</td>
                  <td className="py-2.5">14</td>
                  <td className="py-2.5 font-semibold text-white">Joint Positions</td>
                  <td className="py-2.5 text-slate-400 font-sans">Current measured servo angles (rad) relative to neutral home pose. Reads through backlash.</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-cyan-400">14 – 27</td>
                  <td className="py-2.5">14</td>
                  <td className="py-2.5 font-semibold text-white">Joint Velocities</td>
                  <td className="py-2.5 text-slate-400 font-sans">Measured servo angular velocity (rad/s) from encoder derivatives.</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-cyan-400">28 – 41</td>
                  <td className="py-2.5">14</td>
                  <td className="py-2.5 font-semibold text-white">Previous Actions</td>
                  <td className="py-2.5 text-slate-400 font-sans">Targets dispatched on the prior control tick (t - 1) for temporal smoothness.</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-cyan-400">42 – 44</td>
                  <td className="py-2.5">3</td>
                  <td className="py-2.5 font-semibold text-white">Projected Gravity</td>
                  <td className="py-2.5 text-slate-400 font-sans">Normalized gravity unit vector [gx, gy, gz] in robot trunk frame. Upright is [0, 0, -1].</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-cyan-400">45 – 47</td>
                  <td className="py-2.5">3</td>
                  <td className="py-2.5 font-semibold text-white">Angular Velocity</td>
                  <td className="py-2.5 text-slate-400 font-sans">Trunk gyroscope angular velocity vector [wx, wy, wz] in rad/s.</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-amber-400">48 – 50</td>
                  <td className="py-2.5">3</td>
                  <td className="py-2.5 font-semibold text-white">Twist Command</td>
                  <td className="py-2.5 text-slate-400 font-sans">Operator velocity intent: [vx (forward/back), vy (lateral), yaw_rate]. Zero-padded if unused.</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-purple-400">51 – 54</td>
                  <td className="py-2.5">4</td>
                  <td className="py-2.5 font-semibold text-white">Head Pose Command</td>
                  <td className="py-2.5 text-slate-400 font-sans">Commanded head orientation targets [neck_pitch, head_pitch, head_yaw, head_roll].</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-emerald-400">55 – 60</td>
                  <td className="py-2.5">6</td>
                  <td className="py-2.5 font-semibold text-white">Body Pose Command</td>
                  <td className="py-2.5 text-slate-400 font-sans">Torso 6-DOF command offset: [tx, ty, tz, roll, pitch, yaw]. Used by standing controllers.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Action Vector */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Gauge className="h-5 w-5 text-amber-400" />
            2. The 14-Actuator Action Vector
          </h2>
          <p className="text-xs text-slate-400">
            Actions correspond to position offset targets: <code className="font-mono text-white">target = home_pose + action_scale * action</code>, dispatched to Dynamixel XL330 servos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <span className="font-semibold text-white block border-b border-slate-800 pb-1">Left Leg (Servos 0–4)</span>
              <ul className="space-y-1 text-slate-400">
                <li>0: left_hip_yaw</li>
                <li>1: left_hip_roll</li>
                <li>2: left_hip_pitch</li>
                <li>3: left_knee</li>
                <li>4: left_ankle</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <span className="font-semibold text-white block border-b border-slate-800 pb-1">Neck & Head (Servos 5–8)</span>
              <ul className="space-y-1 text-slate-400">
                <li>5: neck_pitch</li>
                <li>6: head_pitch</li>
                <li>7: head_yaw</li>
                <li>8: head_roll</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <span className="font-semibold text-white block border-b border-slate-800 pb-1">Right Leg (Servos 9–13)</span>
              <ul className="space-y-1 text-slate-400">
                <li>9: right_hip_yaw</li>
                <li>10: right_hip_roll</li>
                <li>11: right_hip_pitch</li>
                <li>12: right_knee</li>
                <li>13: right_ankle</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 text-xs text-slate-400 leading-relaxed font-sans">
            <strong>Note on Motor 15:</strong> The beak/mouth gripper is an uncoupled 15th motor driven directly via programmatic RPC or gamepad buttons, keeping the locomotion action space strictly fixed at 14 degrees of freedom.
          </div>
        </div>

        {/* Section 3: Actuator Physics & Sim2Real */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            3. BAM Actuator Physics & 50 Hz Timing
          </h2>
          <div className="text-xs text-slate-300 leading-relaxed space-y-3">
            <p>
              MicroDuck policies train in MuJoCo using the <strong>BAM M6 Actuator Model</strong>. Because tiny ~800g bipedal robots have low mechanical inertia, ideal PD actuators fail miserably in the real world.
            </p>
            <p>
              BAM models the XL330 Dynamixel down to:
            </p>
            <ul className="list-disc pl-5 space-y-1 font-mono text-slate-400 text-[11px]">
              <li>Firmware voltage control laws and H-bridge PWM limits</li>
              <li>Motor back-EMF resistance and thermal voltage sag</li>
              <li>Coulomb, viscous, and load-dependent Stribeck friction</li>
              <li>Gearbox backlash play (±1° in backlash variants)</li>
              <li>Per-environment battery voltage randomization (6.5V to 8.4V)</li>
            </ul>
          </div>
        </div>

        {/* Section 4: Hot-Swapping Priority Chain */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="h-5 w-5 text-amber-400" />
            4. Runtime Daemon Priority Chain
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Inside Pollen&apos;s <code className="font-mono text-amber-300">robotd</code> daemon, active policies are prioritized according to safety and gesture lifecycle:
          </p>
          <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-emerald-400">
            roulade (somersault) &gt; kick &gt; ground_pick &gt; sit/rise &gt; stand_by_magnitude &gt; walk
          </div>
        </div>
      </div>
    </div>
  );
}
