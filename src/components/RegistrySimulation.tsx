import { Activity, CheckCircle2, ChevronDown, CircleX } from "lucide-react";
import { MediaPreview } from "./MediaPreview";
import { simulationMedia, type RegistrySimulationResult } from "@/lib/simulation";

interface RegistrySimulationProps {
  result: RegistrySimulationResult;
  title: string;
  hasPublisherMedia: boolean;
}

function observationLabel(value: unknown): string {
  if (typeof value === "boolean") return value ? "observed" : "not observed";
  if (typeof value === "number") return String(value);
  return "not measured";
}

function SimulationFacts({ result }: { result: RegistrySimulationResult }) {
  const observationCandidates: Array<[string, unknown]> = [
    ["Initial foot contact", result.observations.initial_foot_contact],
    ["Takeoff after support", result.observations.takeoff_after_support],
    ["Touchdown after takeoff", result.observations.touchdown_after_takeoff],
    ["Maximum trunk height (m)", result.observations.max_trunk_height_m],
    ["Final tilt (deg)", result.observations.final_tilt_deg],
  ];
  const observations = observationCandidates.filter(([, value]) => value != null);

  return (
    <div className="registry-simulation-grid">
      <dl className="detail-list">
        {observations.map(([label, value]) => (
          <div key={String(label)}><dt>{label}</dt><dd className="mono-value">{observationLabel(value)}</dd></div>
        ))}
      </dl>
      <div className="registry-checks" aria-label="Registry simulation checks">
        {result.checks.map((check) => (
          <div className="registry-check" key={check.check}>
            {check.passed
              ? <CheckCircle2 size={14} aria-hidden="true" />
              : <CircleX size={14} aria-hidden="true" />}
            <span><strong>{check.check.replaceAll("_", " ")}</strong><small>{check.detail}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RegistrySimulation({ result, title, hasPublisherMedia }: RegistrySimulationProps) {
  const simulationDescription = "Registry-owned diagnostic render; it does not validate hardware or reproduce a publisher environment.";

  if (hasPublisherMedia) {
    return (
      <section className="surface detail-card registry-simulation registry-simulation-secondary">
        <details className="registry-simulation-disclosure">
          <summary className="registry-simulation-summary">
            <span className="registry-simulation-summary-copy">
              <span className="registry-simulation-summary-title"><Activity size={16} aria-hidden="true" /> Registry simulation</span>
              <span className="registry-simulation-summary-note">Optional diagnostic render · {result.recipe.scene}</span>
            </span>
            <span className="registry-simulation-summary-action"><span>Show render</span><ChevronDown size={14} aria-hidden="true" /></span>
          </summary>
          <div className="registry-simulation-content">
            <p className="registry-simulation-note">{simulationDescription}</p>
            <figure className="registry-simulation-figure">
              <div className="media-frame registry-simulation-frame">
                <MediaPreview media={simulationMedia(result)} title={`${title} registry simulation`} variant="detail" />
              </div>
              <figcaption className="media-caption">Generated with {result.recipe.runner}; start: {result.recipe.start.preset}; scenario: {result.recipe.scenario}.</figcaption>
            </figure>
            <SimulationFacts result={result} />
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="surface detail-card registry-simulation registry-simulation-primary">
      <div className="registry-simulation-head">
        <div>
          <h2><Activity size={17} aria-hidden="true" /> Registry simulation</h2>
          <p>Registry diagnostic preview · not hardware validation or publisher-environment reproduction.</p>
        </div>
        <span className="detail-chip">shown above</span>
      </div>
      <details className="registry-simulation-diagnostics">
        <summary className="registry-simulation-diagnostics-summary">
          <span>Show diagnostic details</span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="registry-simulation-diagnostics-content">
          <SimulationFacts result={result} />
        </div>
      </details>
    </section>
  );
}
