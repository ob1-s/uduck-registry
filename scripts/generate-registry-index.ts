import fs from "node:fs";
import path from "node:path";
import { validateAllBehaviors } from "./validate-registry";
import type { RegistryIndex } from "../registry/schema/behavior";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const REGISTRY_OUT = path.join(PUBLIC_DIR, "registry.json");

export function generateRegistryIndex(): RegistryIndex {
  const { valid, behaviors, errors } = validateAllBehaviors();
  if (!valid) {
    throw new Error(`Cannot compile registry due to validation errors:\n${errors.join("\n")}`);
  }

  // Sort behaviors: verified_hardware first, then verified_simulation, then claimed_hardware, then alphabetical
  const priorityMap: Record<string, number> = {
    verified_hardware: 1,
    claimed_hardware: 2,
    verified_simulation: 3,
    community_experimental: 4,
  };

  behaviors.sort((a, b) => {
    const pA = priorityMap[a.verification.status] ?? 99;
    const pB = priorityMap[b.verification.status] ?? 99;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });

  const index: RegistryIndex = {
    version: "0.1.0",
    updated_at: new Date().toISOString(),
    count: behaviors.length,
    behaviors,
  };

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  fs.writeFileSync(REGISTRY_OUT, JSON.stringify(index, null, 2), "utf-8");
  console.log(`\x1b[32mSuccessfully compiled ${behaviors.length} behaviors into public/registry.json\x1b[0m`);
  return index;
}

if (process.argv[1]?.endsWith("generate-registry-index.ts")) {
  generateRegistryIndex();
}
