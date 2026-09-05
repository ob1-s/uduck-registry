import type { CatalogEntry } from "@registry/schema/catalog";
import { formatCategory } from "./labels";
import { SOCIAL_IMAGE_PATHS } from "./site";

export type SocialImageVariant = "openGraph" | "twitter";

const motionLabels: Record<string, string> = {
  "alpha-walking": "WALK",
  "ball-kick-left": "KICK LEFT",
  "ball-kick-right": "KICK RIGHT",
  courier: "PICK · CARRY · PLACE",
  "fall-recovery": "RECOVER",
  "genesis-backlash": "WALK · BACKLASH",
  "genesis-rough": "WALK · ROUGH TERRAIN",
  "genesis-velocity": "WALK · FLAT GROUND",
  "ground-pick": "PICK UP",
  jump: "JUMP",
  "roller-crouch": "CROUCH · GLIDE",
  "roller-drive": "ROLL",
  roulade: "ROLLING AGILITY",
  "sit-stand": "SIT ↔ STAND",
};

export function shorten(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}…`;
}

export function getMotionLabel(behavior: CatalogEntry) {
  return motionLabels[behavior.id] ?? formatCategory(behavior.category).toUpperCase();
}

export function getSocialCopy(behavior: CatalogEntry) {
  return {
    title: behavior.name,
    description: shorten(`Microduck move. ${behavior.description}`, 120),
  };
}

export function getSocialImagePath(id: string, variant: SocialImageVariant) {
  return `/behaviors/${id}/${SOCIAL_IMAGE_PATHS[variant]}`;
}
