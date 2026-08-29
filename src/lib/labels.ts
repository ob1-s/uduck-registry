import type { BehaviorCategory } from "@registry/schema/behavior";

const categoryLabels: Record<BehaviorCategory, string> = {
  locomotion: "Locomotion",
  "roller-skate": "Roller skating",
  "agility-tricks": "Agility & tricks",
  manipulation: "Manipulation",
  recovery: "Recovery",
  experimental: "Experimental",
};

export function formatCategory(category: BehaviorCategory) {
  return categoryLabels[category] ?? category;
}

export function formatAccessory(accessory: string) {
  const labels: Record<string, string> = {
    roller_skate_blades: "roller skates",
    "70mm_practice_ball": "70 mm ball",
  };

  return labels[accessory] ?? accessory.replaceAll("_", " ");
}
