import { Info, Cpu, Activity, Gauge } from "lucide-react";
import type { Behavior } from "@registry/schema/behavior";

interface ContractSpecProps {
  contract: Behavior["contract"];
  compatibility: Behavior["compatibility"];
}

export function ContractSpec({ contract, compatibility }: ContractSpecProps) {
  const { observation_breakdown, action_breakdown } = contract;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-400" />
            Physical Contract & Runtime Interface
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict {contract.observation_dim}-D input vector and {contract.action_dim}-actuator joint target mapping at {contract.control_frequency_hz} Hz
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-mono text-amber-300 border border-slate-700">
            {contract.control_frequency_hz} Hz ({contract.decimation}x decimation)
          </span>
          <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-mono text-cyan-300 border border-slate-700">
            Slot: {compatibility.robotd_slot}
          </span>
        </div>
      </div>

      {/* Observation Vector (61-D) */}
      <div>
        <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
          <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            Observation Vector ({contract.observation_dim} dimensions)
          </span>
          <span className="text-slate-500">Baked Normalizer: Active</span>
        </div>

        {/* Visual Bar Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-mono">Proprioception</span>
              <span className="font-mono font-bold text-cyan-400">{observation_breakdown.proprioception}D</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Joint positions (14), velocities (14), previous actions (14), projected IMU gravity (3), gyro rate (3).
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-mono">Twist Command</span>
              <span className="font-mono font-bold text-amber-400">{observation_breakdown.twist}D</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Commanded velocities: [vx (forward/back), vy (lateral), yaw_rate].
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-mono">Head Pose</span>
              <span className="font-mono font-bold text-purple-400">{observation_breakdown.head_pose}D</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Active neck pitch, head pitch, yaw, roll command targets.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-mono">Body Pose</span>
              <span className="font-mono font-bold text-emerald-400">{observation_breakdown.body_pose}D</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Torso 6-DOF offset commands [tx, ty, tz, roll, pitch, yaw].
            </p>
          </div>
        </div>
      </div>

      {/* Action Vector (14-Actuators) */}
      <div>
        <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
          <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
            <Gauge className="h-3.5 w-3.5 text-amber-400" />
            Action Targets ({contract.action_dim} Dynamixel XL330 Servos)
          </span>
          <span className="text-slate-500">Scale: {contract.action_scale}x</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-mono">Left Leg Servos (0-4)</span>
              <span className="font-mono font-bold text-slate-200">{action_breakdown.left_leg} servos</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              hip_yaw, hip_roll, hip_pitch, knee, ankle
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-mono">Neck & Head (5-8)</span>
              <span className="font-mono font-bold text-slate-200">{action_breakdown.neck_head} servos</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              neck_pitch, head_pitch, head_yaw, head_roll
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-mono">Right Leg Servos (9-13)</span>
              <span className="font-mono font-bold text-slate-200">{action_breakdown.right_leg} servos</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              hip_yaw, hip_roll, hip_pitch, knee, ankle
            </p>
          </div>
        </div>
      </div>

      {/* Actuator & Sim2Real Fidelity */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <strong>Actuator Physics:</strong> Trained against <span className="font-mono font-medium text-white">{contract.actuator_model}</span> including back-EMF, voltage control laws, dynamic voltage sag under load, and domain-randomized Stribeck friction for zero-shot sim-to-real transfer.
        </div>
      </div>
    </div>
  );
}
