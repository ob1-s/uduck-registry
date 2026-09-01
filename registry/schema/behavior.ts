import { z } from "zod";
import {
  GITHUB_USERNAME_PATTERN,
  ID_PATTERN,
  isAllowedArtifactUrl,
  isAllowedMediaUrl,
  isHttpsUrl,
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

/** Verification labels describe the evidence available for each behavior. */
export const VerificationStatusSchema = z.enum([
  "verified_hardware",      // Verified on physical Microduck hardware or shipped upstream
  "claimed_hardware",       // Author claims physical hardware deployment
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
    hardware_target: NonEmptyStringSchema, // e.g. "Microduck RK3566 Dev Board, Dynamixel XL330-M077"
    notes: NonEmptyStringSchema.optional(),
  }),

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
    accessories_required: z.array(NonEmptyStringSchema),
    terrain: z.array(TerrainSchema).min(1),
    robotd_slot: RobotDSlotSchema,
  }),

  artifacts: strict({
    onnx: strict({
      filename: z.string().regex(ONNX_FILENAME_PATTERN, "Must be a safe .onnx filename"),
      // Canonical URL must be HTTPS on the host allowlist.
      url: z.string().refine(isAllowedArtifactUrl, {
        message: `Must be an https:// URL on the allowlist (huggingface.co, raw.githubusercontent.com)`,
      }),
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
  }),

  // Optional CI simulation-check configuration. When omitted, the command
  // profile is derived from compatibility.robotd_slot.
  simulation: strict({
    profile: z.enum([
      "velocity",
      "standing",
      "sitstand",
      "oneshot_phase",
      "oneshot_zero",
      "oneshot_trigger",
    ]).optional(),
    duration_s: z.number().min(1).max(30).optional(),
    trigger_s: z.number().min(0).max(5).optional(),
    period_s: z.number().positive().max(30).optional(),
    end_phase: z.number().positive().max(1).optional(),
    hold_s: z.number().min(0).max(30).optional(),
    allow_fall: z.boolean().optional(),
    expect_tracking: z.boolean().optional(),
    segments: z.array(strict({
      duration_s: z.number().positive().max(30),
      vx: z.number(),
      vy: z.number(),
      wz: z.number(),
    })).min(1).max(12).optional(),
  }).optional(),
});

export const BehaviorSchema = BehaviorInputSchema;

export type Behavior = z.infer<typeof BehaviorSchema>;

export interface RegistryIndex {
  version: string;
  updated_at: string;
  count: number;
  behaviors: Behavior[];
}
