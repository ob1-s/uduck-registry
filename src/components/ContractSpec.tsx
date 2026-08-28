import { Activity, Cpu, Gauge, Info, ChevronDown } from "lucide-react";
import type { Behavior } from "@registry/schema/behavior";

interface ContractSpecProps {
  contract: Behavior["contract"];
  compatibility: Behavior["compatibility"];
}

export function ContractSpec({ contract, compatibility }: ContractSpecProps) {
  const { observation_breakdown, action_breakdown } = contract;

  return (
    <details className="surface contract-disclosure">
      <summary className="contract-summary">
        <div>
          <h2><Cpu size={17} aria-hidden="true" /> Runtime contract</h2>
          <p>{contract.observation_dim}-dimension input · {contract.action_dim} joint targets · {contract.control_frequency_hz} Hz</p>
        </div>
        <span className="contract-summary-action"><span>Show details</span><ChevronDown size={15} aria-hidden="true" /></span>
      </summary>

      <div className="contract-content">
        <div className="contract-head-stamps">
          <span className="contract-stamp contract-stamp-sun">{contract.control_frequency_hz} Hz / {contract.decimation}×</span>
          <span className="contract-stamp">slot: {compatibility.robotd_slot}</span>
        </div>

        <div className="contract-part">
          <div className="contract-part-title">
            <span><Activity size={14} aria-hidden="true" /> Observation vector</span>
            <span>{contract.observation_dim} dimensions · normalizer baked in</span>
          </div>
          <div className="contract-grid-observation">
            <ContractTile label="Proprioception" value={`${observation_breakdown.proprioception}D`} copy="Positions, velocities, previous actions, gravity, and gyro." />
            <ContractTile label="Twist command" value={`${observation_breakdown.twist}D`} copy="Forward, lateral, and yaw velocity intent." />
            <ContractTile label="Head pose" value={`${observation_breakdown.head_pose}D`} copy="Neck and head orientation targets." />
            <ContractTile label="Body pose" value={`${observation_breakdown.body_pose}D`} copy="Six-axis torso offset command." />
          </div>
        </div>

        <div className="contract-part">
          <div className="contract-part-title">
            <span><Gauge size={14} aria-hidden="true" /> Action targets</span>
            <span>scale: {contract.action_scale}×</span>
          </div>
          <div className="contract-grid-action">
            <ContractTile label="Left leg" value={`${action_breakdown.left_leg} joints`} copy="hip yaw · hip roll · hip pitch · knee · ankle" />
            <ContractTile label="Neck & head" value={`${action_breakdown.neck_head} joints`} copy="neck pitch · head pitch · yaw · roll" />
            <ContractTile label="Right leg" value={`${action_breakdown.right_leg} joints`} copy="hip yaw · hip roll · hip pitch · knee · ankle" />
          </div>
        </div>

        <div className="contract-note">
          <Info size={14} aria-hidden="true" />
          <span><strong>Actuator model:</strong> {contract.actuator_model}. The beak motor is separate from this fixed locomotion action space.</span>
        </div>
      </div>
    </details>
  );
}

function ContractTile({ label, value, copy }: { label: string; value: string; copy: string }) {
  return (
    <div className="contract-tile">
      <div className="contract-tile-top"><span>{label}</span><strong>{value}</strong></div>
      <p>{copy}</p>
    </div>
  );
}
