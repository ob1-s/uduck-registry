import { Cpu, ChevronDown, Info } from "lucide-react";
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
          <p>{contract.observation_dim}-dimension input · {contract.action_dim} joint targets · {contract.control_frequency_hz} Hz — shared across all behaviors</p>
        </div>
        <span className="contract-summary-action"><span>Show details</span><ChevronDown size={15} aria-hidden="true" /></span>
      </summary>

      <div className="contract-content">
        <div className="contract-head-stamps">
          <span className="contract-stamp contract-stamp-sun">{contract.control_frequency_hz} Hz / {contract.decimation}×</span>
          <span className="contract-stamp">slot: {compatibility.robotd_slot}</span>
          <span className="contract-stamp" title="Beak motor is separate from this fixed locomotion action space (driven via RPC, not the 50 Hz loop)">{contract.actuator_model}</span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.45rem 0.7rem",
            alignItems: "center",
            marginTop: "1rem",
            fontFamily: "var(--font-mono)",
            fontSize: "0.68rem",
            color: "var(--ink-soft)",
            lineHeight: 1.6,
          }}
        >
          <span>{contract.observation_dim}D obs · {observation_breakdown.proprioception} proprio + {observation_breakdown.twist} twist + {observation_breakdown.head_pose} head + {observation_breakdown.body_pose} body</span>
          <span style={{ color: "var(--quiet)" }}>·</span>
          <span>{contract.action_dim} joints · {action_breakdown.left_leg}L + {action_breakdown.neck_head} neck/head + {action_breakdown.right_leg}R</span>
          <span style={{ color: "var(--quiet)" }}>·</span>
          <span>scale {contract.action_scale}×</span>
          <span
            title="Beak motor (15th actuator) is driven via separate RPC/gamepad input, outside this fixed 14-joint locomotion action space."
            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--quiet)" }}
          >
            <Info size={12} aria-hidden="true" /> beak separate
          </span>
        </div>
      </div>
    </details>
  );
}
