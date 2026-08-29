import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BehaviorSchema, type Behavior } from "../registry/schema/behavior";

const BEHAVIORS_DIR = path.resolve(process.cwd(), "registry/behaviors");
const VENDOR_DIR = path.resolve(process.cwd(), "vendor/policies");

/** Verify vendored artifact bytes match the recorded sha256 + size. */
export function verifyVendoredArtifact(behavior: Behavior): { ok: boolean; error?: string } {
  const vendorPath = path.join(VENDOR_DIR, `${behavior.id}.onnx`);
  if (!fs.existsSync(vendorPath)) {
    return { ok: false, error: `No vendored artifact at vendor/policies/${behavior.id}.onnx` };
  }
  const buf = fs.readFileSync(vendorPath);
  if (buf.length !== behavior.artifacts.onnx.size_bytes) {
    return {
      ok: false,
      error: `Vendored artifact size mismatch: expected ${behavior.artifacts.onnx.size_bytes}, got ${buf.length}`,
    };
  }
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha256 !== behavior.artifacts.onnx.sha256) {
    return {
      ok: false,
      error: `Vendored artifact sha256 mismatch: expected ${behavior.artifacts.onnx.sha256}, got ${sha256}`,
    };
  }
  return { ok: true };
}

/**
 * Tier gate: verified tiers are NEVER inherited — they require verified bytes.
 * `verified_hardware` and `verified_simulation` must have a vendored artifact
 * whose sha256 + size match the recorded values. Tiers auto-decay otherwise.
 */
function checkIntegrity(behavior: Behavior, errors: string[], warnings: string[]) {
  const needsProof =
    behavior.verification.status === "verified_hardware" ||
    behavior.verification.status === "verified_simulation";

  if (needsProof) {
    const result = verifyVendoredArtifact(behavior);
    if (!result.ok) {
      errors.push(
        `Tier decay for '${behavior.id}' (${behavior.verification.status}): ${result.error}. ` +
          `Drop to community_experimental or re-vendor with scripts/vendor-artifacts.ts.`,
      );
    }
  } else if (behavior.artifacts.onnx.sha256) {
    // Non-verified entries may carry a hash — if present, it must be correct.
    const result = verifyVendoredArtifact(behavior);
    if (!result.ok) {
      warnings.push(`'${behavior.id}': recorded artifact hash does not match vendored bytes (${result.error})`);
    }
  } else {
    warnings.push(`'${behavior.id}': no sha256 recorded — artifact is unverified. Run scripts/vendor-artifacts.ts.`);
  }
}


export function validateAllBehaviors(): {
  valid: boolean;
  behaviors: Behavior[];
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const behaviors: Behavior[] = [];

  if (!fs.existsSync(BEHAVIORS_DIR)) {
    return { valid: false, behaviors: [], errors: [`Directory not found: ${BEHAVIORS_DIR}`], warnings: [] };
  }

  const files = fs.readdirSync(BEHAVIORS_DIR).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    return { valid: false, behaviors: [], errors: ["No behavior files found in registry/behaviors/"], warnings: [] };
  }

  const idSet = new Set<string>();

  for (const file of files) {
    const fullPath = path.join(BEHAVIORS_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(raw);
      
      const result = BehaviorSchema.safeParse(parsed);
      if (!result.success) {
        errors.push(`Validation failed for ${file}:\n${JSON.stringify(result.error.format(), null, 2)}`);
        continue;
      }

      const behavior = result.data;
      if (idSet.has(behavior.id)) {
        errors.push(`Duplicate behavior ID detected: '${behavior.id}' in file ${file}`);
      }
      idSet.add(behavior.id);

      const expectedFilename = `${behavior.id}.json`;
      if (file !== expectedFilename) {
        errors.push(`Filename mismatch: file is '${file}' but behavior.id requires '${expectedFilename}'`);
      }

      // Check observation contract invariant
      if (behavior.contract.observation_dim !== 61) {
        errors.push(`Behavior '${behavior.id}' has observation_dim ${behavior.contract.observation_dim}, expected 61`);
      }

      // Check action contract invariant
      if (behavior.contract.action_dim !== 14) {
        errors.push(`Behavior '${behavior.id}' has action_dim ${behavior.contract.action_dim}, expected 14`);
      }

      behaviors.push(behavior);

      // Tier integrity: verified tiers must always be backed by verified bytes.
      checkIntegrity(behavior, errors, warnings);

      // Trust-ladder record checks (warning-level until CI populates them).
      if (behavior.verification.status === "verified_simulation" && !behavior.sim_verification) {
        warnings.push(
          `'${behavior.id}': verified_simulation without a sim_verification record — CI will recompute the tier on next sim run.`,
        );
      }
      if (behavior.verification.status === "verified_hardware" && !behavior.hardware_attestation) {
        warnings.push(
          `'${behavior.id}': verified_hardware without a hardware_attestation PR — attestation must be a PR with committed video+logs, never a textbox.`,
        );
      }
    } catch (err: any) {
      errors.push(`Error parsing ${file}: ${err.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    behaviors,
    errors,
    warnings,
  };
}

if (process.argv[1]?.endsWith("validate-registry.ts")) {
  console.log("Validating uDuck Registry entries...");
  const { valid, behaviors, errors, warnings } = validateAllBehaviors();

  if (!valid) {
    console.error(`\x1b[31mRegistry validation failed with ${errors.length} error(s):\x1b[0m`);
    for (const err of errors) {
      console.error(err);
    }
    process.exit(1);
  }

  console.log(`\x1b[32mSuccessfully validated ${behaviors.length} registry behavior(s).\x1b[0m`);
  for (const b of behaviors) {
    console.log(`  - [${b.verification.status}] ${b.name} (${b.id})`);
  }
  if (warnings.length > 0) {
    console.log(`\x1b[33m\n${warnings.length} warning(s):\x1b[0m`);
    for (const w of warnings) {
      console.log(`  ! ${w}`);
    }
  }
}
