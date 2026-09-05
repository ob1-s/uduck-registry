import type { CatalogEntry } from "@registry/schema/catalog";
import { formatCategory } from "@/lib/labels";
import { hardwareLabel, runtimeLabel } from "@/lib/catalog";
import { getSocialCopy } from "@/lib/social";

interface BehaviorSocialCardProps {
  entry: CatalogEntry;
  variant: "openGraph" | "twitter";
}

const colors = {
  ink: "#242126",
  paper: "#f8f5ef",
  yellow: "#f4c746",
  orange: "#e76f35",
  purple: "#7063b7",
  soft: "#665e68",
};

const duckVariants = [
  { body: colors.yellow, wing: colors.orange, tilt: -4 },
  { body: colors.orange, wing: colors.yellow, tilt: 3 },
  { body: colors.purple, wing: colors.yellow, tilt: -2 },
];

const poseAngles: Record<string, number> = {
  "alpha-walking": -2,
  "ball-kick-left": -8,
  "ball-kick-right": 8,
  courier: 4,
  jump: -4,
  "max-height-jump": 5,
  roulade: -13,
  "roller-crouch": 9,
  "roller-drive": -3,
  "sit-stand": 4,
};

function stableIndex(value: string, count: number) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % count;
}

function SocialDuck({ entry }: { entry: CatalogEntry }) {
  const baseAngle = poseAngles[entry.id] ?? 0;
  const pose = duckVariants[stableIndex(entry.id, duckVariants.length)];
  return (
    <div style={{ display: "flex", position: "relative", width: 270, height: 220, transform: `rotate(${baseAngle + pose.tilt}deg)` }} aria-hidden="true">
      <div style={{ position: "absolute", left: 74, top: 53, width: 126, height: 122, borderRadius: "48% 52% 44% 47%", background: pose.body, border: `4px solid ${colors.ink}`, boxShadow: `8px 9px 0 ${colors.ink}` }} />
      <div style={{ position: "absolute", left: 93, top: 26, width: 104, height: 82, borderRadius: "54% 46% 48% 45%", background: pose.body, border: `4px solid ${colors.ink}` }} />
      <div style={{ position: "absolute", left: 176, top: 56, width: 55, height: 37, borderRadius: "50% 45% 42% 55%", background: colors.orange, border: `4px solid ${colors.ink}` }} />
      <div style={{ position: "absolute", left: 181, top: 71, width: 32, height: 5, borderRadius: 9, background: colors.ink }} />
      <div style={{ position: "absolute", left: 124, top: 57, width: 10, height: 14, borderRadius: "50%", background: colors.ink }} />
      <div style={{ position: "absolute", left: 162, top: 57, width: 10, height: 14, borderRadius: "50%", background: colors.ink }} />
      <div style={{ position: "absolute", left: 72, top: 91, width: 45, height: 64, borderRadius: "48% 52% 50% 44%", background: pose.wing, border: `4px solid ${colors.ink}`, transform: "rotate(23deg)" }} />
      <div style={{ position: "absolute", left: 91, top: 170, width: 26, height: 27, borderRadius: 14, background: colors.orange, border: `4px solid ${colors.ink}` }} />
      <div style={{ position: "absolute", left: 155, top: 170, width: 26, height: 27, borderRadius: 14, background: colors.orange, border: `4px solid ${colors.ink}` }} />
    </div>
  );
}

export function BehaviorSocialCard({ entry, variant }: BehaviorSocialCardProps) {
  const copy = getSocialCopy(entry);
  return (
    <div style={{ width: 1200, height: 630, background: colors.paper, color: colors.ink, padding: 56, display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "Arial, sans-serif" }}>
      <div style={{ width: 680, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", color: colors.purple, fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>uDuck Registry</div>
        <div style={{ display: "flex", marginTop: 24, color: colors.soft, fontSize: 22, textTransform: "uppercase", letterSpacing: 1 }}>{`${formatCategory(entry.category)} · ${runtimeLabel(entry.runtime)}`}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 62, lineHeight: 1.02, fontWeight: 800 }}>{copy.title}</div>
        <div style={{ display: "flex", marginTop: 20, color: colors.soft, fontSize: 25, lineHeight: 1.25 }}>{copy.description}</div>
        <div style={{ display: "flex", marginTop: 30, color: colors.ink, fontSize: 20 }}>{`${hardwareLabel(entry.hardware.status)} · ${entry.authors.map((author) => author.name).join(", ")}`}</div>
      </div>
      <div style={{ width: 300, height: 300, borderRadius: "50%", background: colors.yellow, border: `5px solid ${colors.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}><SocialDuck entry={entry} /></div>
      <div style={{ position: "absolute", right: 60, bottom: 30, color: colors.soft, fontSize: 18 }}>{variant === "twitter" ? "uduckmoves.com" : "uduckmoves.com/behaviors"}</div>
    </div>
  );
}

