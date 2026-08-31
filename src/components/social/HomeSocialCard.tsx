import { DuckGeometry } from "../DuckMark";
import type { SocialImageVariant } from "@/lib/social";

interface HomeSocialCardProps {
  stats: {
    total: number;
    hardware: number;
  };
  variant: SocialImageVariant;
}

const colors = {
  background: "#08080c",
  panel: "#101018",
  cream: "#f2ecdd",
  muted: "#aaa6a0",
  orange: "#ff7a2f",
  cyan: "#2ff0e6",
  purple: "#9d87e8",
};

const decorativeDots = Array.from({ length: 42 }, (_, index) => ({
  left: `${18 + (index % 7) * 12}%`,
  top: `${12 + Math.floor(index / 7) * 14}%`,
}));

export function HomeSocialCard({ stats, variant }: HomeSocialCardProps) {
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
      <div style={{ position: "absolute", top: -130, left: -120, width: 330, height: 330, border: `18px solid ${colors.cyan}55`, borderRadius: "50%" }} />
      <div style={{ position: "absolute", top: -120, right: 80, width: 330, height: 330, border: `20px solid ${colors.purple}55`, borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: -150, right: -50, width: 300, height: 300, border: `18px solid ${colors.cyan}55`, borderRadius: "50%" }} />
      {decorativeDots.map((dot, index) => (
        <div key={index} style={{ position: "absolute", left: dot.left, top: dot.top, width: 3, height: 3, borderRadius: "50%", background: "#faf8f21a" }} />
      ))}

      <div style={{ display: "flex", flexDirection: "column", width: 690, padding: "64px 0 48px 70px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: colors.orange, fontFamily: "monospace", fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
          <span style={{ display: "flex", width: 13, height: 13, border: `3px solid ${colors.orange}`, borderRadius: "50%" }} />
          <span>UDUCK</span>
          <span style={{ color: colors.cream, fontSize: 15 }}>/ FOR MICRODUCK</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
          <div style={{ display: "flex", color: colors.cream, fontSize: isTwitter ? 71 : 68, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            uDuck Registry
          </div>
          <div style={{ display: "flex", marginTop: 22, maxWidth: 625, color: colors.cyan, fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
            Community moves for Microduck
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: "auto", color: colors.cream, fontFamily: "monospace", fontSize: 19, fontWeight: 700, letterSpacing: 1.5 }}>
          <span style={{ display: "flex", width: 12, height: 12, borderRadius: "50%", background: colors.orange }} />
          <span>{stats.total} MOVES</span>
          <span style={{ display: "flex", width: 7, height: 7, margin: "0 4px", borderRadius: "50%", background: colors.cyan }} />
          <span>{stats.hardware} HARDWARE-VERIFIED</span>
        </div>

        <div style={{ display: "flex", marginTop: 27, color: colors.muted, fontFamily: "monospace", fontSize: 17, letterSpacing: 3 }}>
          UDUCKMOVES.COM
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 330, height: 330, transform: "translateY(-4px) rotate(-5deg)" }}>
          <DuckGeometry size={300} stance="neutral" mouth="closed" colorway="cream" />
        </div>
        <div style={{ display: "flex", position: "absolute", right: 18, bottom: 18, borderRadius: 8, padding: "9px 12px", color: colors.background, background: isTwitter ? colors.purple : colors.cyan, fontFamily: "monospace", fontSize: 14, fontWeight: 800, letterSpacing: 1.3 }}>
          COMMUNITY MOVES
        </div>
      </div>
    </div>
  );
}
