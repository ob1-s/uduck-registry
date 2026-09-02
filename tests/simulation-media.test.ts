import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Behavior } from "@registry/schema/behavior";
import { preferredMedia, type RegistrySimulationResult } from "../src/lib/simulation";

const behavior = JSON.parse(
  fs.readFileSync(path.resolve("registry/behaviors/alpha-walking.json"), "utf8"),
) as Behavior;

const result: RegistrySimulationResult = {
  behavior: behavior.id,
  execution: "rendered",
  checks_status: "passed",
  checks: [],
  observations: {},
  recipe: {
    runner: "microduck-standard-v1",
    scene: "flat-v1",
    start: { preset: "standing_pose" },
    scenario: "velocity",
  },
  duration_s: 6,
  generated_at: "2026-09-01T00:00:00Z",
  media: {
    loop_url: "/media/registry-sim/alpha-walking/loop.mp4",
    poster_url: "/media/registry-sim/alpha-walking/poster.png",
  },
};

describe("registry simulation media selection", () => {
  it("never replaces publisher media", () => {
    expect(preferredMedia(behavior, result)).toBe(behavior.media);
  });

  it("uses a reviewed registry render when publisher media is absent", () => {
    const withoutPublisherMedia: Behavior = {
      ...behavior,
      media: { hero_type: "badge" },
    };
    expect(preferredMedia(withoutPublisherMedia, result)).toMatchObject({
      loop_url: result.media.loop_url,
      thumbnail_url: result.media.poster_url,
      hero_type: "video",
    });
  });
});
