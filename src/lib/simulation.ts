import type { Behavior } from "@registry/schema/behavior";

export interface RegistrySimulationCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface RegistrySimulationResult {
  behavior: string;
  evidence_key?: string;
  policy?: { url: string; sha256: string };
  execution: "rendered";
  checks_status: "passed" | "failed";
  checks: RegistrySimulationCheck[];
  observations: Record<string, unknown>;
  recipe: {
    runner: "microduck-standard-v1";
    model?: "microduck-standard" | "microduck-rollers";
    scene: "flat-v1";
    start: { preset: string; [key: string]: unknown };
    scenario: string;
  };
  duration_s: number;
  generated_at: string;
  media: {
    loop_url: string;
    poster_url: string;
  };
}

export type BehaviorWithSimulation = Behavior & {
  registrySimulation?: RegistrySimulationResult;
};

export function hasPublisherMedia(behavior: Behavior): boolean {
  return Boolean(
    behavior.media.thumbnail_url || behavior.media.loop_url || behavior.media.video_url,
  );
}

export function simulationMedia(result: RegistrySimulationResult): Behavior["media"] {
  return {
    thumbnail_url: result.media.poster_url,
    loop_url: result.media.loop_url,
    video_url: result.media.loop_url,
    hero_type: "video",
    caption: `Registry simulation — ${result.recipe.scene}, ${result.recipe.scenario}. Diagnostic render only.`,
  };
}

export function preferredMedia(
  behavior: Behavior,
  result?: RegistrySimulationResult,
): Behavior["media"] {
  if (hasPublisherMedia(behavior) || !result) return behavior.media;
  return simulationMedia(result);
}
