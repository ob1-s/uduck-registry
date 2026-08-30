import fs from "node:fs";
import path from "node:path";
import { BehaviorSchema, type Behavior } from "../registry/schema/behavior";

const BEHAVIORS_DIR = path.resolve(process.cwd(), "registry/behaviors");

export function validateAllBehaviors(): {
  valid: boolean;
  behaviors: Behavior[];
  errors: string[];
} {
  const errors: string[] = [];
  const behaviors: Behavior[] = [];

  if (!fs.existsSync(BEHAVIORS_DIR)) {
    return { valid: false, behaviors: [], errors: [`Directory not found: ${BEHAVIORS_DIR}`] };
  }

  const files = fs.readdirSync(BEHAVIORS_DIR).filter((f) => f.endsWith(".json")).sort();

  if (files.length === 0) {
    return { valid: false, behaviors: [], errors: ["No behavior files found in registry/behaviors/"] };
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

      behaviors.push(behavior);
    } catch (err: any) {
      errors.push(`Error parsing ${file}: ${err.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    behaviors,
    errors,
  };
}

if (process.argv[1]?.endsWith("validate-registry.ts")) {
  console.log("Validating uDuck Registry entries...");
  const { valid, behaviors, errors } = validateAllBehaviors();

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
}
