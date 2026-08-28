import { z } from "zod";

export const VerificationStatusSchema = z.enum([
  "verified_hardware",      // Verified on physical MicroDuck hardware (with video/telemetry proof)
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

export const BehaviorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "Must be kebab-case slug"),
  name: z.string().min(2),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, "Must follow semver"),
  description: z.string().min(10),
  details: z.string().optional(),
  category: BehaviorCategorySchema,
  tags: z.array(z.string()).min(1),
  authors: z.array(
    z.object({
      name: z.string(),
      affiliation: z.string().optional(),
      github: z.string().optional(),
      url: z.string().optional(),
    })
  ).min(1),
  license: z.string().default("Apache-2.0"),
  
  verification: z.object({
    status: VerificationStatusSchema,
    summary: z.string(),
    hardware_target: z.string(), // e.g. "MicroDuck RK3566 Dev Board, Dynamixel XL330-M077"
    sim_framework: z.string().optional(), // e.g. "mjlab (MuJoCo Warp) at 50 Hz"
    notes: z.string().optional(),
  }),

  contract: z.object({
    observation_dim: z.number().int().positive().default(61),
    observation_breakdown: z.object({
      proprioception: z.number().int().default(48),
      twist: z.number().int().default(3),
      head_pose: z.number().int().default(4),
      body_pose: z.number().int().default(6),
    }),
    action_dim: z.number().int().positive().default(14),
    action_breakdown: z.object({
      left_leg: z.number().int().default(5),
      neck_head: z.number().int().default(4),
      right_leg: z.number().int().default(5),
    }),
    control_frequency_hz: z.number().positive().default(50),
    decimation: z.number().int().positive().default(4),
    actuator_model: z.string().default("Dynamixel XL330 (BAM M6 actuator physics)"),
    action_scale: z.number().default(1.0),
  }),

  compatibility: z.object({
    robot_model: RobotModelSchema.default("microduck-standard"),
    mjcf_model: z.string(), // e.g. "robot_walk.xml" or "robot_allcollisions.xml"
    accessories_required: z.array(z.string()).default([]),
    terrain: z.array(TerrainSchema).default(["flat"]),
    robotd_slot: RobotDSlotSchema.default("walk"),
  }),

  artifacts: z.object({
    onnx: z.object({
      filename: z.string(),
      url: z.string().url(),
      size_bytes: z.number().optional(),
      sha256: z.string().optional(),
      baked_normalizer: z.boolean().default(true),
    }),
    checkpoint: z.object({
      url: z.string().url().optional(),
      framework: z.string().optional(),
    }).optional(),
    config: z.object({
      url: z.string().url().optional(),
    }).optional(),
  }),

  media: z.object({
    thumbnail_url: z.string().optional(),
    video_url: z.string().optional(),
    hero_type: z.enum(["video", "image", "badge"]).default("video"),
    caption: z.string().optional(),
  }),

  sources: z.object({
    upstream_repo: z.string().url(),
    training_code_url: z.string().url().optional(),
    task_id: z.string().optional(),
    huggingface_space: z.string().url().optional(),
    discussion_url: z.string().url().optional(),
  }),

  deployment: z.object({
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
