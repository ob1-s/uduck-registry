import fs from "node:fs";
import path from "node:path";
import { BehaviorSchema, type Behavior } from "../registry/schema/behavior";
import { assertSafeArtifactFilename, verifyArtifactBytes } from "./lib/pull-artifact";

const BEHAVIORS_DIR = path.resolve(process.cwd(), "registry/behaviors");
const VENDOR_DIR = path.resolve(process.cwd(), "vendor/policies");

/** Verify local artifact-cache bytes match the recorded sha256 + size. */
export function verifyVendoredArtifact(behavior: Behavior): { ok: boolean; error?: string } {
  try {
    assertSafeArtifactFilename(behavior.artifacts.onnx.filename);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  if (!behavior.artifacts.onnx.sha256) {
    return { ok: false, error: "No sha256 recorded for the vendored artifact" };
  }
  if (behavior.artifacts.onnx.size_bytes == null) {
    return { ok: false, error: "No size_bytes recorded for the vendored artifact" };
  }

  const vendorPath = path.join(VENDOR_DIR, `${behavior.id}.onnx`);
  if (!fs.existsSync(vendorPath)) {
    return { ok: false, error: `No vendored artifact at vendor/policies/${behavior.id}.onnx` };
  }

  try {
    const buf = fs.readFileSync(vendorPath);
    verifyArtifactBytes(
      buf,
      behavior.artifacts.onnx.sha256,
      behavior.artifacts.onnx.size_bytes,
      `Vendored artifact for '${behavior.id}'`,
    );
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  return { ok: true };
}

/**
 * Verified tiers require pinned artifact metadata. A local vendor cache is
 * optional: when present, its bytes must match; when absent, `pull` verifies
 * the canonical download before writing it.
 */
function checkIntegrity(behavior: Behavior, errors: string[], warnings: string[]) {
  const needsProof =
    behavior.verification.status === "verified_hardware" ||
    behavior.verification.status === "verified_simulation";

  if (needsProof) {
    const { sha256, size_bytes } = behavior.artifacts.onnx;
    if (!sha256 || size_bytes == null) {
      errors.push(
        `Verified '${behavior.id}' requires artifacts.onnx.sha256 and size_bytes. ` +
          `Record both values or drop it to community_experimental.`,
      );
      return;
    }

    const vendorPath = path.join(VENDOR_DIR, `${behavior.id}.onnx`);
    if (fs.existsSync(vendorPath)) {
      const result = verifyVendoredArtifact(behavior);
      if (!result.ok) {
        errors.push(
          `Artifact cache for '${behavior.id}' (${behavior.verification.status}) is invalid: ${result.error}. ` +
            `Remove the cache or re-vendor with scripts/vendor-artifacts.ts.`,
        );
      }
    }
  } else if (behavior.artifacts.onnx.sha256) {
    // Non-verified entries may carry a hash — if present, it must be correct.
    const vendorPath = path.join(VENDOR_DIR, `${behavior.id}.onnx`);
    if (fs.existsSync(vendorPath)) {
      const result = verifyVendoredArtifact(behavior);
      if (!result.ok) {
        warnings.push(`'${behavior.id}': recorded artifact hash does not match local cache (${result.error})`);
      }
    }
  } else if (behavior.verification.status !== "community_experimental") {
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

  const files = fs.readdirSync(BEHAVIORS_DIR).filter((f) => f.endsWith(".json")).sort();

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

      try {
        assertSafeArtifactFilename(behavior.artifacts.onnx.filename);
      } catch (err) {
        errors.push(`Behavior '${behavior.id}' has an unsafe artifact filename: ${(err as Error).message}`);
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

      // Tier integrity: verified tiers must always carry pinned artifact
      // metadata; a local cache is checked when contributors have one.
      checkIntegrity(behavior, errors, warnings);

      if (
        behavior.verification.status === "verified_hardware" &&
        !behavior.hardware_attestation &&
        !behavior.tags.includes("official")
      ) {
        warnings.push(
          `'${behavior.id}': verified_hardware without a hardware_attestation PR or official tag — add committed video+logs before using this tier.`,
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
