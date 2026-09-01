#!/usr/bin/env tsx
import { ID_PATTERN } from "../registry/schema/allowlist";
import { BehaviorCategorySchema, type Behavior, type BehaviorCategory } from "../registry/schema/behavior";

const SUPPORTED_KEYS = new Set(["id", "name", "category", "author", "description", "license"]);

export interface ScaffoldOptions {
  id: string;
  name: string;
  category: BehaviorCategory;
  author: string;
  description: string;
  license: string;
}

function titleFromId(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function usage(): string {
  return [
    "Usage: pnpm --silent new-behavior id=<id> [name=<name>] [category=<category>] [author=<name>] [description=<text>] [license=<value>]",
    "",
    "Writes a descriptor scaffold to stdout. Redirect it to registry/behaviors/<id>.json,",
    "then replace the TODO values before running pnpm check.",
  ].join("\n");
}

export function parseScaffoldArgs(values: string[]): ScaffoldOptions {
  const parsed = new Map<string, string>();

  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator <= 0) {
      throw new Error(`Expected key=value, got '${value}'.\n\n${usage()}`);
    }

    const key = value.slice(0, separator);
    const rawValue = value.slice(separator + 1).trim();
    if (!SUPPORTED_KEYS.has(key)) {
      throw new Error(`Unknown scaffold field '${key}'. Supported fields: ${[...SUPPORTED_KEYS].join(", ")}.`);
    }
    if (!rawValue) throw new Error(`Scaffold field '${key}' cannot be empty.`);
    if (parsed.has(key)) throw new Error(`Scaffold field '${key}' was provided more than once.`);
    parsed.set(key, rawValue);
  }

  const id = parsed.get("id");
  if (!id) throw new Error(`Missing required field 'id'.\n\n${usage()}`);
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid id '${id}': use lowercase kebab-case.`);

  const category = parsed.get("category") ?? "experimental";
  const categoryResult = BehaviorCategorySchema.safeParse(category);
  if (!categoryResult.success) {
    throw new Error(`Invalid category '${category}'. Use one of: locomotion, agility-tricks, manipulation, recovery, roller-skate, experimental.`);
  }

  return {
    id,
    name: parsed.get("name") ?? titleFromId(id),
    category: categoryResult.data,
    author: parsed.get("author") ?? "Your Name",
    description: parsed.get("description") ?? "TODO: describe what this behavior does.",
    license: parsed.get("license") ?? "TODO: confirm the policy license.",
  };
}

export function createBehaviorScaffold(options: ScaffoldOptions): Behavior {
  return {
    id: options.id,
    name: options.name,
    version: "0.1.0",
    description: options.description,
    category: options.category,
    tags: [options.category],
    authors: [{ name: options.author }],
    license: options.license,
    verification: {
      status: "community_experimental",
      summary: "Community behavior; physical deployment evidence has not been reviewed by the registry.",
      hardware_target: "Microduck standard setup",
      notes: "TODO: describe evidence, limitations, and simulation or hardware status.",
    },
    contract: {
      observation_dim: 61,
      observation_breakdown: {
        proprioception: 48,
        twist: 3,
        head_pose: 4,
        body_pose: 6,
      },
      action_dim: 14,
      action_breakdown: {
        left_leg: 5,
        neck_head: 4,
        right_leg: 5,
      },
      control_frequency_hz: 50,
      decimation: 4,
      actuator_model: "Dynamixel XL330 (BAM M6 actuator physics)",
      action_scale: 1,
    },
    compatibility: {
      robot_model: "microduck-standard",
      accessories_required: [],
      terrain: ["flat"],
      robotd_slot: "walk",
    },
    artifacts: {
      onnx: {
        filename: `${options.id}.onnx`,
        url: `https://huggingface.co/your-org/your-policy/resolve/main/${options.id}.onnx`,
        baked_normalizer: false,
      },
    },
    media: {
      hero_type: "badge",
    },
    sources: {
      upstream_repo: "https://github.com/your-org/your-policy",
    },
    deployment: {
      robotd_toml: `[policy]\nwalk = "/opt/robot/policies/${options.id}.onnx"`,
    },
  };
}

export function main(argv = process.argv.slice(2)): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  try {
    console.log(JSON.stringify(createBehaviorScaffold(parseScaffoldArgs(argv)), null, 2));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1]?.endsWith("new-behavior.ts")) {
  process.exitCode = main();
}
