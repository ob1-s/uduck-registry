import fs from "node:fs";
import path from "node:path";
import { BehaviorSchema, type Behavior, type RegistryIndex } from "@registry/schema/behavior";

const BEHAVIORS_DIR = path.resolve(process.cwd(), "registry/behaviors");

export function getAllBehaviors(): Behavior[] {
  if (!fs.existsSync(BEHAVIORS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BEHAVIORS_DIR).filter((f) => f.endsWith(".json"));
  const behaviors: Behavior[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(BEHAVIORS_DIR, file), "utf-8");
      const parsed = JSON.parse(raw);
      const res = BehaviorSchema.safeParse(parsed);
      if (res.success) {
        behaviors.push(res.data);
      } else {
        console.error(`Invalid behavior schema in ${file}:`, res.error.format());
      }
    } catch (err) {
      console.error(`Failed to read ${file}:`, err);
    }
  }

  const priorityMap: Record<string, number> = {
    verified_hardware: 1,
    claimed_hardware: 2,
    verified_simulation: 3,
    community_experimental: 4,
  };

  return behaviors.sort((a, b) => {
    const pA = priorityMap[a.verification.status] ?? 99;
    const pB = priorityMap[b.verification.status] ?? 99;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });
}

export function getBehaviorById(id: string): Behavior | null {
  const all = getAllBehaviors();
  return all.find((b) => b.id === id) || null;
}

export function getRegistryStats() {
  const all = getAllBehaviors();
  const hardware = all.filter((b) => b.verification.status === "verified_hardware").length;
  const sim = all.filter((b) => b.verification.status === "verified_simulation").length;
  const claimed = all.filter((b) => b.verification.status === "claimed_hardware").length;
  const community = all.filter((b) => b.tags.includes("community")).length;

  const categories = Array.from(new Set(all.map((b) => b.category)));
  const allTags = Array.from(new Set(all.flatMap((b) => b.tags)));

  return {
    total: all.length,
    hardware,
    sim,
    claimed,
    community,
    categories,
    allTags,
  };
}
