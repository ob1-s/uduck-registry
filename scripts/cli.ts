#!/usr/bin/env tsx
import { main as submit } from "./submit";
import { validateAllBehaviors } from "./validate-registry";
import { pullArtifact } from "./lib/pull-artifact";
import { type Behavior, type VerificationStatus } from "../registry/schema/behavior";

const args = process.argv.slice(2);

const STATUS_BADGES: Record<VerificationStatus, { label: string; color: string }> = {
  verified_hardware: { label: "[HARDWARE]", color: "\x1b[32m" },
  claimed_hardware: { label: "[CLAIMED]", color: "\x1b[33m" },
  community_experimental: { label: "[EXPERIMENTAL]", color: "\x1b[36m" },
};

export function formatStatusBadge(status: VerificationStatus): string {
  const badge = STATUS_BADGES[status];
  return `${badge.color}${badge.label}\x1b[0m`;
}

function printHelp() {
  console.log(`
\x1b[1m\x1b[33muDuck CLI\x1b[0m — Community behaviors for MicroDuck 🦆

Usage:
  pnpm cli list                List all behaviors in the registry
  pnpm cli info <id>           Show metadata, contract, and deployment for a behavior
  pnpm cli toml <id>           Print /etc/robot/robotd.toml snippet for a behavior
  pnpm cli pull <id> [dest]    Download the ONNX policy
  pnpm cli submit <file.json>  Submit a behavior JSON to the registry via GitHub PR
  pnpm cli validate            Run registry schema and descriptor checks

Options:
  --help, -h                   Show this help message
`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function findBehavior(behaviors: Behavior[], id: string | undefined): Behavior | null {
  return id ? behaviors.find((item) => item.id === id) ?? null : null;
}

export interface PullArgs {
  id: string | undefined;
  destDir: string;
  error?: string;
}

export function parsePullArgs(values: string[]): PullArgs {
  const positional: string[] = [];

  for (const value of values) {
    if (value.startsWith("--")) {
      return {
        id: undefined,
        destDir: "./policies",
        error: `Unknown pull option '${value}'.`,
      };
    } else {
      positional.push(value);
    }
  }

  if (positional.length > 2) {
    return {
      id: undefined,
      destDir: "./policies",
      error: "Usage: pnpm cli pull <id> [dest]",
    };
  }

  return {
    id: positional[0],
    destDir: positional[1] || "./policies",
  };
}

export async function run(argv: string[] = args): Promise<number> {
  const command = argv[0];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  // submit performs this same preflight itself so it can be used directly.
  // Avoid validating twice when invoked through the CLI.
  if (command === "submit") {
    return submit(argv.slice(1));
  }

  let validation: ReturnType<typeof validateAllBehaviors>;
  try {
    validation = validateAllBehaviors();
  } catch (error) {
    console.error(`\x1b[31mRegistry validation could not run: ${errorMessage(error)}\x1b[0m`);
    return 1;
  }

  const { valid, behaviors: allBehaviors, errors } = validation;
  if (!valid) {
    console.error("Registry validation error:\n" + errors.join("\n"));
    return 1;
  }
  const behaviors = allBehaviors;

  switch (command) {
    case "list": {
      console.log(`\n\x1b[1muDuck Registry (${behaviors.length} behaviors available):\x1b[0m\n`);
      for (const b of behaviors) {
        const badge = formatStatusBadge(b.verification.status);
        const badgeLabel = STATUS_BADGES[b.verification.status].label;
        console.log(`  ${badge}${" ".repeat(Math.max(1, 20 - badgeLabel.length))}\x1b[1m${b.id.padEnd(24)}\x1b[0m ${b.name}`);
        console.log(`  ${"".padEnd(10)} └─ ${b.description.slice(0, 80)}...`);
      }
      console.log("\nRun `pnpm cli info <id>` for full contract and deployment specs.\n");
      break;
    }

    case "info": {
      const id = argv[1];
      if (!id) {
        console.error("Error: Please provide a behavior ID. e.g. `pnpm cli info alpha-walking`");
        return 1;
      }
      const b = findBehavior(behaviors, id);
      if (!b) {
        console.error(`Error: Behavior '${id}' not found in registry.`);
        return 1;
      }

      console.log(`\n\x1b[1m\x1b[33m${b.name}\x1b[0m (\x1b[2m${b.id}\x1b[0m v${b.version})`);
      console.log(`Category:       ${b.category}`);
      console.log(`Verification:   ${b.verification.status} (${b.verification.summary})`);
      console.log(`Authors:        ${b.authors.map((a) => a.name).join(", ")}`);
      console.log(`License:        ${b.license}`);
      console.log(`Hardware:       ${b.verification.hardware_target}`);
      console.log(`Slot:           robotd [policy] slot '${b.compatibility.robotd_slot}'`);
      console.log(`\n\x1b[1mContract:\x1b[0m`);
      console.log(`  Observation:  ${b.contract.observation_dim}-D [proprio: 48, twist: 3, head: 4, body: 6]`);
      console.log(`  Actions:      ${b.contract.action_dim} joints (Left Leg: 5, Neck/Head: 4, Right Leg: 5)`);
      console.log(`  Rate:         ${b.contract.control_frequency_hz} Hz (${b.contract.decimation}x decimation)`);
      console.log(`  Actuator:     ${b.contract.actuator_model}`);
      console.log(`\n\x1b[1mArtifact:\x1b[0m`);
      console.log(`  ONNX:         ${b.artifacts.onnx.filename}`);
      console.log(`  URL:          ${b.artifacts.onnx.url}`);
      console.log(`\n\x1b[1mDeployment Snippet (/etc/robot/robotd.toml):\x1b[0m`);
      console.log(b.deployment.robotd_toml);
      console.log();
      break;
    }

    case "toml": {
      const id = argv[1];
      if (!id) {
        console.error("Error: Please provide a behavior ID.");
        return 1;
      }
      const b = findBehavior(behaviors, id);
      if (!b) {
        console.error(`Error: Behavior '${id}' not found.`);
        return 1;
      }
      console.log(b.deployment.robotd_toml);
      break;
    }

    case "pull": {
      const pullArgs = parsePullArgs(argv.slice(1));
      if (pullArgs.error) {
        console.error(`Error: ${pullArgs.error}`);
        return 1;
      }
      if (!pullArgs.id) {
        console.error("Error: Please provide a behavior ID. e.g. `pnpm cli pull alpha-walking`");
        return 1;
      }
      const b = findBehavior(behaviors, pullArgs.id);
      if (!b) {
        console.error(`Error: Behavior '${pullArgs.id}' not found.`);
        return 1;
      }
      console.log(`Pulling ${b.artifacts.onnx.filename} for ${b.name}...`);
      try {
        const result = await pullArtifact(b, pullArgs.destDir);
        console.log(`  downloaded -> ${result.destPath}`);
      } catch (error) {
        console.error(`\x1b[31m${errorMessage(error)}\x1b[0m`);
        return 1;
      }
      break;
    }

    case "validate": {
      console.log(`Registry valid! ${behaviors.length} behaviors passed validation.`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      return 1;
  }

  return 0;
}

if (process.argv[1]?.endsWith("cli.ts")) {
  void run().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(`\x1b[31m${errorMessage(error)}\x1b[0m`);
    process.exitCode = 1;
  });
}
