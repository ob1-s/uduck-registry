#!/usr/bin/env tsx
import { main as submit } from "./submit";
import { validateAllBehaviors } from "./validate-registry";
import { pullArtifact } from "./lib/pull-artifact";
import { isDiscoverableBehavior, type Behavior, type VerificationStatus } from "../registry/schema/behavior";

const args = process.argv.slice(2);

const STATUS_BADGES: Record<VerificationStatus, { label: string; color: string }> = {
  verified_hardware: { label: "[HARDWARE]", color: "\x1b[32m" },
  claimed_hardware: { label: "[CLAIMED]", color: "\x1b[33m" },
  verified_simulation: { label: "[SIMULATION]", color: "\x1b[35m" },
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
  uduck list                   List all behaviors in the registry
  uduck info <id>              Show metadata, contract, and deployment for a behavior
  uduck toml <id>              Print /etc/robot/robotd.toml snippet for a behavior
  uduck pull <id> [dest]       Download the ONNX policy, verifying sha256 + size
  uduck submit <file.json>     Submit a behavior JSON to the registry via GitHub PR
  uduck validate               Run registry schema, contract, and artifact checks

Options:
  --allow-unverified           Explicitly allow pulling an artifact with no recorded sha256
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
  allowUnverified: boolean;
  error?: string;
}

export function parsePullArgs(values: string[]): PullArgs {
  const positional: string[] = [];
  let allowUnverified = false;

  for (const value of values) {
    if (value === "--allow-unverified") {
      allowUnverified = true;
    } else if (value.startsWith("--")) {
      return {
        id: undefined,
        destDir: "./policies",
        allowUnverified,
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
      allowUnverified,
      error: "Usage: uduck pull <id> [dest] [--allow-unverified]",
    };
  }

  return {
    id: positional[0],
    destDir: positional[1] || "./policies",
    allowUnverified,
  };
}

function printArtifactTrust(behavior: Behavior) {
  const artifact = behavior.artifacts.onnx;
  if (artifact.sha256) {
    console.log(`  Integrity:    sha256 pinned${artifact.size_bytes ? ` + ${artifact.size_bytes} bytes` : ""}`);
  } else {
    console.log("  Integrity:    UNVERIFIED — no sha256 recorded; pull requires --allow-unverified");
  }
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

  const { valid, behaviors: allBehaviors, errors, warnings } = validation;
  if (!valid) {
    console.error("Registry validation error:\n" + errors.join("\n"));
    return 1;
  }
  const behaviors = allBehaviors.filter(isDiscoverableBehavior);

  switch (command) {
    case "list": {
      console.log(`\n\x1b[1muDuck Registry (${behaviors.length} behaviors available):\x1b[0m\n`);
      for (const b of behaviors) {
        const badge = formatStatusBadge(b.verification.status);
        const badgeLabel = STATUS_BADGES[b.verification.status].label;
        console.log(`  ${badge}${" ".repeat(Math.max(1, 20 - badgeLabel.length))}\x1b[1m${b.id.padEnd(24)}\x1b[0m ${b.name}`);
        console.log(`  ${"".padEnd(10)} └─ ${b.description.slice(0, 80)}...`);
      }
      console.log("\nRun `uduck info <id>` for full contract and deployment specs.\n");
      break;
    }

    case "info": {
      const id = argv[1];
      if (!id) {
        console.error("Error: Please provide a behavior ID. e.g. `uduck info alpha-walking`");
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
      printArtifactTrust(b);
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
        console.error("Error: Please provide a behavior ID. e.g. `uduck pull alpha-walking`");
        return 1;
      }
      const b = findBehavior(behaviors, pullArgs.id);
      if (!b) {
        console.error(`Error: Behavior '${pullArgs.id}' not found.`);
        return 1;
      }
      if (!b.artifacts.onnx.sha256 && !pullArgs.allowUnverified) {
        console.error(
          `Error: '${pullArgs.id}' has no recorded sha256. Refusing to pull an unverified artifact.\n` +
            "If you understand the risk, rerun with --allow-unverified; the result will be marked UNVERIFIED.",
        );
        return 1;
      }
      if (!b.artifacts.onnx.sha256) {
        console.warn(`Warning: pulling '${pullArgs.id}' without a recorded sha256. Do not deploy it as trusted.`);
      }

      console.log(`Pulling ${b.artifacts.onnx.filename} for ${b.name}...`);
      try {
        const result = await pullArtifact(b, pullArgs.destDir);
        console.log(`  source:  ${result.source}`);
        console.log(`  sha256:  ${result.sha256}`);
        console.log(`  size:    ${result.size_bytes} bytes`);
        if (result.hashMatch === true) {
          console.log(`  \x1b[32m✓ hash verified\x1b[0m -> ${result.destPath}`);
        } else {
          console.warn(`  \x1b[33m⚠ artifact written without hash verification (UNVERIFIED)\x1b[0m -> ${result.destPath}`);
        }
      } catch (error) {
        console.error(`\x1b[31m${errorMessage(error)}\x1b[0m`);
        return 1;
      }
      break;
    }

    case "validate": {
      console.log(`Registry valid! ${behaviors.length} behaviors passed validation.`);
      if (warnings.length > 0) {
        console.warn(`${warnings.length} warning(s) reported; see \`pnpm validate\` for details.`);
      }
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
