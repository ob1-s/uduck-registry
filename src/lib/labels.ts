import type { BehaviorCategory, RobotDSlot } from "@registry/schema/behavior";

const categoryLabels: Record<BehaviorCategory, string> = {
  locomotion: "Locomotion",
  "roller-skate": "Roller skating",
  "agility-tricks": "Agility & tricks",
  manipulation: "Manipulation",
  recovery: "Recovery",
  experimental: "Experimental",
};

const robotdSlotLabels: Record<RobotDSlot, string> = {
  walk: "Walk",
  stand: "Stand",
  sitstand: "Sit ↔ stand",
  roulade: "Roulade",
  kick_left: "Kick left",
  kick_right: "Kick right",
  ground_pick: "Ground pick",
  roller: "Roller mode",
  custom: "Custom",
};

export function formatCategory(category: BehaviorCategory | string) {
  return categoryLabels[category] ?? category;
}

export function formatAccessory(accessory: string) {
  const labels: Record<string, string> = {
    roller_skate_blades: "roller skates",
    "70mm_practice_ball": "70 mm ball",
  };

  return labels[accessory] ?? accessory.replaceAll("_", " ");
}

export function formatRobotdSlot(slot: RobotDSlot | string | null) {
  return slot ? robotdSlotLabels[slot as RobotDSlot] ?? slot.replaceAll("_", " ") : "Unknown slot";
}
