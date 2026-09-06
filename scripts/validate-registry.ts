import fs from "node:fs";
import path from "node:path";
import { PolicySchema, type Policy } from "../registry/schema/policy";

const POLICIES_DIR = path.resolve(process.cwd(), "registry/policies");

export function validatePolicies(): {
  valid: boolean;
  policies: Policy[];
  errors: string[];
} {
  const errors: string[] = [];
  const policies: Policy[] = [];
  const ids = new Set<string>();
  const sources = new Set<string>();

  if (!fs.existsSync(POLICIES_DIR)) {
    return { valid: false, policies, errors: [`Directory not found: ${POLICIES_DIR}`] };
  }

  const files = fs.readdirSync(POLICIES_DIR).filter((file) => file.endsWith(".json")).sort();
  if (files.length === 0) {
    return { valid: false, policies, errors: ["No policy files found in registry/policies/"] };
  }

  for (const file of files) {
    const fullPath = path.join(POLICIES_DIR, file);
    try {
      const result = PolicySchema.safeParse(JSON.parse(fs.readFileSync(fullPath, "utf-8")));
      if (!result.success) {
        errors.push(`Validation failed for ${file}:\n${JSON.stringify(result.error.format(), null, 2)}`);
        continue;
      }

      const policy = result.data;
      if (ids.has(policy.id)) errors.push(`Duplicate policy ID detected: '${policy.id}'`);
      ids.add(policy.id);
      if (file !== `${policy.id}.json`) errors.push(`Filename mismatch: file is '${file}' but policy.id requires '${policy.id}.json'`);

      const sourceKey = `${policy.source.provider}:${policy.source.repo.toLowerCase()}:${policy.source.revision}:${policy.source.artifact_path}`;
      if (sources.has(sourceKey)) errors.push(`Duplicate immutable source detected: '${policy.source.repo}/${policy.source.artifact_path}'`);
      sources.add(sourceKey);
      policies.push(policy);
    } catch (error) {
      errors.push(`Error parsing ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const obsoleteDirectory = path.resolve(process.cwd(), "registry", "behaviors");
  if (fs.existsSync(obsoleteDirectory)) errors.push("registry/policies must be the only authored registry directory");

  return { valid: errors.length === 0, policies, errors };
}

if (process.argv[1]?.endsWith("validate-registry.ts")) {
  console.log("Validating uDuck Registry policies...");
  const { valid, policies, errors } = validatePolicies();

  if (!valid) {
    console.error(`\x1b[31mRegistry validation failed with ${errors.length} error(s):\x1b[0m`);
    for (const error of errors) console.error(error);
    process.exit(1);
  }

  console.log(`\x1b[32mSuccessfully validated ${policies.length} authored policy(ies).\x1b[0m`);
  for (const policy of policies) console.log(`  - ${policy.id} (${policy.source.provider}:${policy.source.repo})`);
}
