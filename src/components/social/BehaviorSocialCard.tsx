import type { Behavior } from "@registry/schema/behavior";
import { DuckGeometry, type DuckColorway, type DuckMouth, type DuckStance } from "../DuckMark";
import { formatCategory } from "@/lib/labels";
import { getMotionLabel, getSocialCopy, getVerificationLabel, type SocialImageVariant } from "@/lib/social";

interface BehaviorSocialCardProps {
  behavior: Behavior;
  variant: SocialImageVariant;
}

const colors = {
  background: "#08080c",
  panel: "#101018",
  cream: "#f2ecdd",
  muted: "#aaa6a0",
  orange: "#ff7a2f",
  yellow: "#ffd23f",
  cyan: "#2ff0e6",
  magenta: "#ff2fa8",
  purple: "#9d87e8",
};

const decorativeDots = Array.from({ length: 42 }, (_, index) => ({
  left: `${18 + (index % 7) * 12}%`,
  top: `${12 + Math.floor(index / 7) * 14}%`,
}));

function statusColor(behavior: Behavior) {
  if (behavior.verification.status === "verified_hardware") return colors.orange;
  if (behavior.verification.status === "claimed_hardware") return colors.yellow;
  return colors.magenta;
}

const poseAngles: Record<string, number> = {
  "ball-kick-left": -10,
  "ball-kick-right": 10,
  courier: -3,
  "fall-recovery": 8,
  jump: -8,
  "roller-crouch": -4,
  roulade: -26,
};

const duckVariants: Array<{ angle: number; y: number; stance: DuckStance; mouth: DuckMouth; colorway: DuckColorway }> = [
  { angle: -5, y: 2, stance: "neutral", mouth: "closed", colorway: "cream" },
  { angle: -2, y: 0, stance: "left-balance", mouth: "slightly-open", colorway: "sky" },
  { angle: 4, y: 0, stance: "right-balance", mouth: "closed", colorway: "graphite" },
  { angle: -5, y: -1, stance: "ready", mouth: "open", colorway: "lavender" },
  { angle: 8, y: 1, stance: "tiny-hop", mouth: "slightly-open", colorway: "cream" },
  { angle: -4, y: -1, stance: "left-balance", mouth: "open", colorway: "graphite" },
  { angle: 5, y: -1, stance: "right-balance", mouth: "slightly-open", colorway: "sky" },
  { angle: -3, y: 1, stance: "ready", mouth: "closed", colorway: "lavender" },
];

function stableIndex(value: string, length: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function SocialDuck({ behavior }: { behavior: Behavior }) {
  const baseAngle = poseAngles[behavior.id] ?? 0;
  const pose = duckVariants[stableIndex(behavior.id, duckVariants.length)];

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        width: 330,
        height: 330,
        transform: `translateY(${pose.y}px) rotate(${baseAngle + pose.angle}deg)`,
      }}
    >
      <DuckGeometry size={270} stance={pose.stance} mouth={pose.mouth} colorway={pose.colorway} />
    </div>
  );
}

export function BehaviorSocialCard({ behavior, variant }: BehaviorSocialCardProps) {
  const copy = getSocialCopy(behavior);
  const status = getVerificationLabel(behavior).toUpperCase();
  const category = formatCategory(behavior.category).toUpperCase();
  const motion = getMotionLabel(behavior);
  const author = behavior.authors.map((item) => item.name).join(", ").toUpperCase();
  const accent = statusColor(behavior);
  const isTwitter = variant === "twitter";

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: 1200,
        height: 630,
        overflow: "hidden",
        color: colors.cream,
        background: colors.background,
        fontFamily: "Arial",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 10, height: "100%", background: colors.orange }} />
      <div style={{ position: "absolute", top: -120, right: 100, width: 330, height: 330, border: `20px solid ${colors.purple}55`, borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: -120, left: 570, width: 250, height: 250, border: `18px solid ${colors.cyan}55`, borderRadius: "50%" }} />
      {decorativeDots.map((dot, index) => (
        <div key={index} style={{ position: "absolute", left: dot.left, top: dot.top, width: 3, height: 3, borderRadius: "50%", background: "#faf8f21a" }} />
      ))}

      <div style={{ display: "flex", flexDirection: "column", width: 690, padding: "54px 0 45px 70px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: colors.orange, fontFamily: "monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
          <span style={{ display: "flex", width: 13, height: 13, border: `3px solid ${colors.orange}`, borderRadius: "50%" }} />
          <span>uDuck</span>
          <span style={{ color: colors.cream, fontSize: 15 }}>/ REGISTRY</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 34, fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 1.5 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${accent}99`, borderRadius: 999, padding: "8px 13px", color: accent }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
            {status}
          </span>
          <span style={{ color: colors.muted, letterSpacing: 2 }}>{category}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, maxWidth: 640, color: colors.cream, fontSize: isTwitter ? 64 : 57, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1.5, textTransform: "uppercase" }}>
          {copy.title}
        </div>

        <div style={{ display: "flex", marginTop: 20, color: colors.orange, fontFamily: "monospace", fontSize: 21, fontWeight: 700, letterSpacing: 2.5 }}>
          {motion}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: "auto", color: colors.muted, fontFamily: "monospace", fontSize: 14, letterSpacing: 1.3 }}>
          <span style={{ color: colors.orange }}>BY</span>
          <span>{author}</span>
          <span style={{ color: colors.orange }}>·</span>
          <span>uduckmoves.com</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 54,
          right: 58,
          alignItems: "center",
          justifyContent: "center",
          width: 405,
          height: 522,
          overflow: "hidden",
          border: `1px solid ${colors.cream}22`,
          borderRadius: "36px 36px 36px 12px",
          background: colors.panel,
          boxShadow: `10px 10px 0 ${colors.orange}26`,
        }}
      >
        <SocialDuck behavior={behavior} />
        <div style={{ display: "flex", position: "absolute", right: 18, bottom: 18, borderRadius: 8, padding: "9px 12px", color: colors.background, background: isTwitter ? colors.magenta : colors.cyan, fontFamily: "monospace", fontSize: 14, fontWeight: 800, letterSpacing: 1.3 }}>
          {isTwitter ? "VIEW THE MOVE" : "MICRODUCK MOVE"}
        </div>
      </div>

    </div>
  );
}
