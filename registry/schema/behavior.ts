import { z } from "zod";
import {
  GITHUB_USERNAME_PATTERN,
  ID_PATTERN,
  isAllowedArtifactUrl,
  isAllowedMediaUrl,
  isHttpsUrl,
  MJCF_FILENAME_PATTERN,
  ONNX_FILENAME_PATTERN,
} from "./allowlist";

/** Every object in the schema is strict — no coercion, no unknown keys. */
const strict = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);

const NonEmptyStringSchema = z.string().min(1);
const HttpsUrlSchema = z.string().url().refine(isHttpsUrl, {
  message: "Must be a valid https:// URL without embedded credentials",
});
const MediaUrlSchema = z.string().refine(isAllowedMediaUrl, {
  message: "Must be a valid https:// URL or a safe local asset path",
});
const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, "Must follow semver");
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "Must be a lowercase hex sha256");


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
  "kick_left",
  "kick_right",
  "ground_pick",
  "roller",
  "custom",
]);
export type RobotDSlot = z.infer<typeof RobotDSlotSchema>;

export const TerrainSchema = z.enum(["flat", "rough", "slope", "any"]);
export type Terrain = z.infer<typeof TerrainSchema>;

export const SimVerificationSchema = strict({
  mujoco_version: NonEmptyStringSchema,
  mjcf_sha256: Sha256Schema,
  seed: z.number().int().nonnegative(),
  episode_length_s: z.number().positive(),
  grade: z.enum(["pass", "fail"]),
  travel_score: z.number().finite(),
  stability_score: z.number().finite(),
  fell: z.boolean(),
  workflow_run_url: HttpsUrlSchema.optional(),
  verified_at: z.string().datetime({ offset: true }),
});

export const HardwareAttestationSchema = strict({
  pr_url: HttpsUrlSchema,
  video_url: HttpsUrlSchema,
  logs_path: NonEmptyStringSchema,
  attested_at: z.string().datetime({ offset: true }),
});

const BehaviorInputSchema = strict({
  id: z.string().regex(ID_PATTERN, "Must be a lowercase kebab-case slug"),
  name: z.string().min(2),
  version: SemverSchema,
  description: z.string().min(10),
  details: z.string().optional(),
  category: BehaviorCategorySchema,
  tags: z.array(NonEmptyStringSchema).min(1),
  authors: z.array(
    strict({
      name: NonEmptyStringSchema,
      affiliation: NonEmptyStringSchema.optional(),
      github: z.string().regex(GITHUB_USERNAME_PATTERN, "Must be a GitHub username").optional(),
      url: HttpsUrlSchema.optional(),
    })
  ).min(1),
  license: NonEmptyStringSchema,

  verification: strict({
    status: VerificationStatusSchema,
    summary: NonEmptyStringSchema,
    hardware_target: NonEmptyStringSchema, // e.g. "MicroDuck RK3566 Dev Board, Dynamixel XL330-M077"
    sim_framework: NonEmptyStringSchema.optional(), // e.g. "mjlab (MuJoCo Warp) at 50 Hz"
    notes: NonEmptyStringSchema.optional(),
  }),

  /**
   * Sim-verification record. Required when status === "verified_simulation";
   * recomputed by CI on every artifact-byte change (tiers are never inherited).
   */
  sim_verification: SimVerificationSchema.optional(),

  /** Hardware attestation = link to the PR carrying committed video + logs. Never a textbox. */
  hardware_attestation: HardwareAttestationSchema.optional(),

  contract: strict({
    observation_dim: z.literal(61),
    observation_breakdown: strict({
      proprioception: z.literal(48),
      twist: z.literal(3),
      head_pose: z.literal(4),
      body_pose: z.literal(6),
    }),
    action_dim: z.literal(14),
    action_breakdown: strict({
      left_leg: z.literal(5),
      neck_head: z.literal(4),
      right_leg: z.literal(5),
    }),
    control_frequency_hz: z.literal(50),
    decimation: z.number().int().positive(),
    actuator_model: NonEmptyStringSchema,
    action_scale: z.number().finite(),
  }),

  compatibility: strict({
    robot_model: RobotModelSchema,
    mjcf_model: z.string().regex(MJCF_FILENAME_PATTERN, "Must be an MJCF filename"),
    accessories_required: z.array(NonEmptyStringSchema),
    terrain: z.array(TerrainSchema).min(1),
    robotd_slot: RobotDSlotSchema,
  }),

  artifacts: strict({
    onnx: strict({
      filename: z.string().regex(ONNX_FILENAME_PATTERN, "Must be a safe .onnx filename"),
      // Canonical URL must be HTTPS on the host allowlist. Hash and size pin
      // the bytes pulled from that URL; a local vendor cache is optional.
      url: z.string().refine(isAllowedArtifactUrl, {
        message: `Must be an https:// URL on the allowlist (huggingface.co, raw.githubusercontent.com)`,
      }),
      // Required in practice for verified_* tiers (enforced by the tier gate in
      // validate-registry.ts); optional for experimental entries with dead URLs.
      size_bytes: z.number().int().positive().optional(),
      sha256: Sha256Schema.optional(),
      baked_normalizer: z.boolean(),
    }),
    checkpoint: strict({
      url: HttpsUrlSchema.optional(),
      framework: NonEmptyStringSchema.optional(),
    }).optional(),
    config: strict({
      url: HttpsUrlSchema.optional(),
    }).optional(),
  }),

  media: strict({
    thumbnail_url: MediaUrlSchema.optional(),
    loop_url: MediaUrlSchema.optional(),
    video_url: MediaUrlSchema.optional(),
    hero_type: z.enum(["video", "image", "badge"]),
    caption: NonEmptyStringSchema.optional(),
  }),

  sources: strict({
    upstream_repo: HttpsUrlSchema,
    training_code_url: HttpsUrlSchema.optional(),
    task_id: NonEmptyStringSchema.optional(),
    huggingface_space: HttpsUrlSchema.optional(),
    discussion_url: HttpsUrlSchema.optional(),
  }),

  deployment: strict({
    robotd_toml: NonEmptyStringSchema,
    cli_command: NonEmptyStringSchema.optional(),
    python_infer_command: NonEmptyStringSchema.optional(),
  }),
});

export const BehaviorSchema = BehaviorInputSchema.superRefine((behavior, ctx) => {
  if (behavior.verification.status === "verified_simulation") {
    if (!behavior.sim_verification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sim_verification"],
        message: "verified_simulation requires a sim_verification record",
      });
    } else if (behavior.sim_verification.grade !== "pass") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sim_verification", "grade"],
        message: "verified_simulation requires a passing sim_verification record",
      });
    }
  }
});

export type Behavior = z.infer<typeof BehaviorSchema>;

export interface RegistryIndex {
  version: string;
  updated_at: string;
  count: number;
  behaviors: Behavior[];
}
