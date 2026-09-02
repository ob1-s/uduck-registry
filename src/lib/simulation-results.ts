import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Behavior } from "@registry/schema/behavior";
import type { BehaviorWithSimulation, RegistrySimulationResult } from "./simulation";

const CheckResultSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

const RegistrySimulationResultSchema = z.object({
  behavior: z.string(),
  execution: z.literal("rendered"),
  checks_status: z.enum(["passed", "failed"]),
  checks: z.array(CheckResultSchema),
  observations: z.record(z.string(), z.unknown()),
  recipe: z.object({
    runner: z.literal("microduck-standard-v1"),
    model: z.enum(["microduck-standard", "microduck-rollers"]).optional(),
    scene: z.literal("flat-v1"),
    start: z.object({ preset: z.string() }).passthrough(),
    scenario: z.string(),
  }),
  duration_s: z.number(),
  generated_at: z.string(),
});

const RESULTS_ROOT = path.resolve(process.cwd(), "public/media/registry-sim");

export function getRegistrySimulationResult(behavior: Behavior): RegistrySimulationResult | null {
  // A checked-in render is only meaningful while the descriptor opts into the
  // same registry-owned runner. This also prevents stale media from surviving
  // a later reclassification to an external/publisher environment.
  if (!behavior.simulation || behavior.simulation.runner !== "microduck-standard-v1") {
    return null;
  }

  const id = behavior.id;
  const resultDir = path.join(RESULTS_ROOT, id);
  const reportPath = path.join(resultDir, "report.json");
  const loopPath = path.join(resultDir, "loop.mp4");
  const posterPath = path.join(resultDir, "poster.png");
  if (![reportPath, loopPath, posterPath].every(fs.existsSync)) return null;

  try {
    const parsed = RegistrySimulationResultSchema.safeParse(
      JSON.parse(fs.readFileSync(reportPath, "utf8")),
    );
    if (!parsed.success || parsed.data.behavior !== id) return null;
    return {
      ...parsed.data,
      media: {
        loop_url: `/media/registry-sim/${id}/loop.mp4`,
        poster_url: `/media/registry-sim/${id}/poster.png`,
      },
    } as RegistrySimulationResult;
  } catch {
    return null;
  }
}

export function withRegistrySimulation(behavior: Behavior): BehaviorWithSimulation {
  return {
    ...behavior,
    registrySimulation: getRegistrySimulationResult(behavior) ?? undefined,
  };
}
