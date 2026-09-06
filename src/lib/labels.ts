import type { PolicyCategory } from "@registry/schema/policy";

const categoryLabels: Record<PolicyCategory, string> = {
  locomotion: "Locomotion",
  "roller-skate": "Roller skating",
  "agility-tricks": "Agility & tricks",
  manipulation: "Manipulation",
  recovery: "Recovery",
  experimental: "Experimental",
};

const robotdSlotLabels: Record<string, string> = {
  walk: "Walk",
  stand: "Stand",
  sitstand: "Sit ↔ stand",
  roulade: "Roulade",
  kick_left: "Kick left",
  kick_right: "Kick right",
  ground_pick: "Ground pick",
  roller: "Roller mode",
};

export function formatCategory(category: PolicyCategory | string) {
  return (categoryLabels as Record<string, string>)[category] ?? category;
}

export function formatAccessory(accessory: string) {
  const labels: Record<string, string> = {
    roller_skate_blades: "roller skates",
    "70mm_practice_ball": "70 mm ball",
  };

  return labels[accessory] ?? accessory.replaceAll("_", " ");
}

export function formatRobotdSlot(slot: string | null) {
  return slot ? robotdSlotLabels[slot] ?? slot.replaceAll("_", " ") : "Unknown slot";
}
