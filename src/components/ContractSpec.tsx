import { Cpu, ChevronDown } from "lucide-react";
import type { CatalogRuntime } from "@registry/schema/catalog";

interface ContractSpecProps {
  runtime: CatalogRuntime;
}

function value(value: number | string | null): string {
  return value == null ? "Not declared" : String(value);
}

export function ContractSpec({ runtime }: ContractSpecProps) {
  const contract = runtime.contract;
  const compatibility = runtime.compatibility;
  const declared = [contract.observation_dim, contract.action_dim, contract.control_frequency_hz]
    .every((item) => item != null);

  return (
    <details className="surface contract-disclosure">
      <summary className="contract-summary">
        <div>
          <h2><Cpu size={17} aria-hidden="true" /> Runtime facts</h2>
          <p>{declared
            ? `${contract.observation_dim}-dimension input · ${contract.action_dim} joint targets · ${contract.control_frequency_hz} Hz`
            : "The publisher has not declared a complete runtime contract."}</p>
        </div>
        <span className="contract-summary-action"><span>Show details</span><ChevronDown size={15} aria-hidden="true" /></span>
      </summary>

      <div className="contract-content">
        <div className="contract-head-stamps">
          <span className="contract-stamp contract-stamp-sun">{value(contract.control_frequency_hz)} Hz</span>
          <span className="contract-stamp">slot: {runtime.slot ?? "unknown"}</span>
          <span className="contract-stamp">model: {compatibility.robot_model ?? runtime.robot.model ?? "unknown"}</span>
        </div>

        <dl className="detail-list">
          <div><dt>Observation dimensions</dt><dd>{value(contract.observation_dim)}</dd></div>
          <div><dt>Action dimensions</dt><dd>{value(contract.action_dim)}</dd></div>
          <div><dt>Control frequency</dt><dd>{value(contract.control_frequency_hz)} Hz</dd></div>
          <div><dt>Action scale</dt><dd>{value(contract.action_scale)}</dd></div>
          <div><dt>Decimation</dt><dd>{value(contract.decimation)}</dd></div>
          <div><dt>Actuator model</dt><dd>{contract.actuator_model ?? "Not declared"}</dd></div>
          <div><dt>Command encoding</dt><dd>{runtime.command_encoding ?? "Not declared"}</dd></div>
          <div><dt>Duration</dt><dd>{runtime.duration_s == null ? "Not declared" : `${runtime.duration_s} s`}</dd></div>
          <div><dt>Unwind</dt><dd>{runtime.unwind_s == null ? "Not declared" : `${runtime.unwind_s} s`}</dd></div>
        </dl>
      </div>
    </details>
  );
}

