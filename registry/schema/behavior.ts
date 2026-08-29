import { z } from "zod";
import { isAllowedArtifactUrl } from "./allowlist";

/** Every object in the schema is strict — no coercion, no unknown keys. */
const strict = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);


/**
 * Trust ladder (lowest -> highest):
 *   community_experimental < claimed_hardware < verified_simulation < verified_hardware
 *
 * Tiers are NEVER inherited: `verified_simulation` must carry a sim_verification
 * record (recomputed on every artifact-byte change by CI), and hardware claims
 * must point at a PR with committed video+logs — never a free-text assertion.
 */
export const VerificationStatusSchema = z.enum([
  "verified_hardware",      // Verified on physical MicroDuck hardware (with attestation PR)
  "claimed_hardware",       // Author claims physical hardware deployment
  "verified_simulation",     // Verified in MuJoCo / mjlab simulation environments
  "community_experimental", // Community work-in-progress or conceptual entry
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const BehaviorCategorySchema = z.enum([
  "locomotion",
  "agility-tricks",
  "manipulation",
  "recovery",
  "roller-skate",
  "experimental",
]);
export type BehaviorCategory = z.infer<typeof BehaviorCategorySchema>;

export const RobotModelSchema = z.enum([
  "microduck-standard",
  "microduck-rollers",
  "custom-duck",
]);
export type RobotModel = z.infer<typeof RobotModelSchema>;

export const RobotDSlotSchema = z.enum([
  "walk",
  "stand",
  "sitstand",
  "roulade",
  "kick",
  "groundpick",
  "rollers",
  "custom",
]);
export type RobotDSlot = z.infer<typeof RobotDSlotSchema>;

export const TerrainSchema = z.enum(["flat", "rough", "slope", "any"]);
export type Terrain = z.infer<typeof TerrainSchema>;

export const BehaviorSchema = strict({
  id: z.string().regex(/^[a-z0-9-]+$/, "Must be kebab-case slug"),
  name: z.string().min(2),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, "Must follow semver"),
  description: z.string().min(10),
  details: z.string().optional(),
  category: BehaviorCategorySchema,
  tags: z.array(z.string()).min(1),
  authors: z.array(
    strict({
      name: z.string(),
      affiliation: z.string().optional(),
      github: z.string().optional(),
      url: z.string().optional(),
    })
  ).min(1),
  license: z.string().default("Apache-2.0"),

  verification: strict({
    status: VerificationStatusSchema,
    summary: z.string(),
    hardware_target: z.string(), // e.g. "MicroDuck RK3566 Dev Board, Dynamixel XL330-M077"
    sim_framework: z.string().optional(), // e.g. "mjlab (MuJoCo Warp) at 50 Hz"
    notes: z.string().optional(),
  }),

  /**
   * Sim-verification record. Required when status === "verified_simulation";
   * recomputed by CI on every artifact-byte change (tiers are never inherited).
   */
  sim_verification: strict({
    mujoco_version: z.string(), // exact pinned version, e.g. "3.2.4"
    mjcf_sha256: z.string().regex(/^[a-f0-9]{64}$/, "Must be a hex sha256"), // hash of the pinned MJCF
    seed: z.number().int().nonnegative(), // fixed rollout seed for determinism
    episode_length_s: z.number().positive(),
    grade: z.enum(["pass", "fail"]),
    travel_score: z.number(),
    stability_score: z.number(),
    fell: z.boolean(),
    workflow_run_url: z.string().url().optional(),
    verified_at: z.string(), // ISO timestamp of the CI run that produced this record
  }).optional(),

  /** Hardware attestation = link to the PR carrying committed video + logs. Never a textbox. */
  hardware_attestation: strict({
    pr_url: z.string().url(),
    video_url: z.string().url(),
    logs_path: z.string(),
    attested_at: z.string(),
  }).optional(),

  contract: strict({
    observation_dim: z.number().int().positive().default(61),
    observation_breakdown: strict({
      proprioception: z.number().int().default(48),
      twist: z.number().int().default(3),
      head_pose: z.number().int().default(4),
      body_pose: z.number().int().default(6),
    }),
    action_dim: z.number().int().positive().default(14),
    action_breakdown: strict({
      left_leg: z.number().int().default(5),
      neck_head: z.number().int().default(4),
      right_leg: z.number().int().default(5),
    }),
    control_frequency_hz: z.number().positive().default(50),
    decimation: z.number().int().positive().default(4),
    actuator_model: z.string().default("Dynamixel XL330 (BAM M6 actuator physics)"),
    action_scale: z.number().default(1.0),
  }),

  compatibility: strict({
    robot_model: RobotModelSchema.default("microduck-standard"),
    mjcf_model: z.string(), // e.g. "robot_walk.xml" or "robot_allcollisions.xml"
    accessories_required: z.array(z.string()).default([]),
    terrain: z.array(TerrainSchema).default(["flat"]),
    robotd_slot: RobotDSlotSchema.default("walk"),
  }),

  artifacts: strict({
    onnx: strict({
      filename: z.string(),
      // Canonical URL must be HTTPS on the host allowlist; the vendored bytes
      // in vendor/policies/<id>.onnx are the source of truth.
      url: z.string().refine(isAllowedArtifactUrl, {
        message: `Must be an https:// URL on the allowlist (huggingface.co, raw.githubusercontent.com)`,
      }),
      // Required in practice for verified_* tiers (enforced by the tier gate in
      // validate-registry.ts); optional for experimental entries with dead URLs.
      size_bytes: z.number().int().positive().optional(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/, "Must be a hex sha256").optional(),
      baked_normalizer: z.boolean().default(true),
    }),
    checkpoint: strict({
      url: z.string().url().optional(),
      framework: z.string().optional(),
    }).optional(),
    config: strict({
      url: z.string().url().optional(),
    }).optional(),
  }),

  media: strict({
    thumbnail_url: z.string().optional(),
    loop_url: z.string().optional(),
    video_url: z.string().optional(),
    hero_type: z.enum(["video", "image", "badge"]).default("video"),
    caption: z.string().optional(),
  }),

  sources: strict({
    upstream_repo: z.string().url(),
    training_code_url: z.string().url().optional(),
    task_id: z.string().optional(),
    huggingface_space: z.string().url().optional(),
    discussion_url: z.string().url().optional(),
  }),

  deployment: strict({
    robotd_toml: z.string(),
    cli_command: z.string().optional(),
    python_infer_command: z.string().optional(),
  }),
});

export type Behavior = z.infer<typeof BehaviorSchema>;

export interface RegistryIndex {
  version: string;
  updated_at: string;
  count: number;
  behaviors: Behavior[];
}
