#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { validateAllBehaviors } from "./validate-registry";
import { pullArtifact } from "./lib/pull-artifact";

const args = process.argv.slice(2);
const command = args[0];

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
  --help, -h                   Show this help message
`);
}

async function run() {
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const { valid, behaviors, errors } = validateAllBehaviors();
  if (!valid) {
    console.error("Registry validation error:\n" + errors.join("\n"));
    process.exit(1);
  }

  switch (command) {
    case "list": {
      console.log(`\n\x1b[1muDuck Registry (${behaviors.length} behaviors available):\x1b[0m\n`);
      for (const b of behaviors) {
        const badge =
          b.verification.status === "verified_hardware"
            ? "\x1b[32m[HARDWARE]\x1b[0m"
            : b.verification.status === "claimed_hardware"
            ? "\x1b[33m[CLAIMED]\x1b[0m"
            : "\x1b[36m[SIM-ONLY]\x1b[0m";
        console.log(`  ${badge.padEnd(20)} \x1b[1m${b.id.padEnd(24)}\x1b[0m ${b.name}`);
        console.log(`  ${"".padEnd(10)} └─ ${b.description.slice(0, 80)}...`);
      }
      console.log("\nRun `uduck info <id>` for full contract and deployment specs.\n");
      break;
    }

    case "info": {
      const id = args[1];
      if (!id) {
        console.error("Error: Please provide a behavior ID. e.g. `uduck info alpha-walking`");
        process.exit(1);
      }
      const b = behaviors.find((item) => item.id === id);
      if (!b) {
        console.error(`Error: Behavior '${id}' not found in registry.`);
        process.exit(1);
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
      const id = args[1];
      if (!id) {
        console.error("Error: Please provide a behavior ID.");
        process.exit(1);
      }
      const b = behaviors.find((item) => item.id === id);
      if (!b) {
        console.error(`Error: Behavior '${id}' not found.`);
        process.exit(1);
      }
      console.log(b.deployment.robotd_toml);
      break;
    }

    case "pull": {
      const id = args[1];
      const destDir = args[2] || "./policies";
      if (!id) {
        console.error("Error: Please provide a behavior ID. e.g. `uduck pull alpha-walking`");
        process.exit(1);
      }
      const b = behaviors.find((item) => item.id === id);
      if (!b) {
        console.error(`Error: Behavior '${id}' not found.`);
        process.exit(1);
      }
      if (!b.artifacts.onnx.sha256) {
        console.error(
          `Error: '${id}' has no recorded sha256 — its artifact is unverified and will not be pulled.\n` +
            `This is expected for decayed community_experimental entries; re-vendor to fix.`,
        );
        process.exit(1);
      }
      console.log(`Pulling ${b.artifacts.onnx.filename} for ${b.name}...`);
      try {
        const result = await pullArtifact(b, destDir);
        console.log(`  source:  ${result.source}`);
        console.log(`  sha256:  ${result.sha256}`);
        console.log(`  size:    ${result.size_bytes} bytes`);
        console.log(`  \x1b[32m✓ hash verified\x1b[0m -> ${result.destPath}`);
      } catch (err: any) {
        console.error(`\x1b[31m${err.message}\x1b[0m`);
        process.exit(1);
      }
      break;
    }

    case "submit": {
      // Defer to scripts/submit.ts (shares the same validator + schema).
      const { spawnSync } = await import("node:child_process");
      const script = path.resolve(import.meta.dirname, "submit.ts");
      const res = spawnSync(process.execPath, ["--import", "tsx", script, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status ?? 1);
      break;
    }

    case "validate": {
      console.log(`Registry valid! ${behaviors.length} behaviors passed validation.`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

run();
