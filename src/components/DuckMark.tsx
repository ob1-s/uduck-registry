import { useId } from "react";

export type DuckStance = "neutral" | "left-balance" | "right-balance" | "ready" | "tiny-hop";
export type DuckMouth = "closed" | "slightly-open" | "open";
export type DuckColorway = "cream" | "graphite" | "lavender" | "sky";

type DuckPalette = { shell: string; seam: string; trim: string; trimShadow: string; accent: string };

const defaultDuckPalette: DuckPalette = {
  shell: "#F2ECDD",
  seam: "#D9D1BC",
  trim: "#FF7A2F",
  trimShadow: "#C2500A",
  accent: "#FFD23F",
};

const duckColorways: Record<DuckColorway, DuckPalette> = {
  cream: { shell: "#F7E6CB", seam: "#D9D1BC", trim: "#FF7A2F", trimShadow: "#C2500A", accent: "#FFD23F" },
  graphite: { shell: "#6C6A68", seam: "#575552", trim: "#FFD23F", trimShadow: "#D39D00", accent: "#FFD23F" },
  lavender: { shell: "#BFA9CF", seam: "#A894B7", trim: "#FFD23F", trimShadow: "#D39D00", accent: "#FFD23F" },
  sky: { shell: "#A9DBE8", seam: "#8FC3D1", trim: "#FF7A2F", trimShadow: "#C2500A", accent: "#FFD23F" },
};

const duckStanceTransforms: Record<DuckStance, { left?: string; right?: string; leftFoot?: string; rightFoot?: string }> = {
  neutral: {},
  "left-balance": {
    right: "rotate(-70 29.2 33)",
    rightFoot: "rotate(60 30.38 44.25)",
  },
  "right-balance": {
    left: "rotate(70 18.8 33)",
    leftFoot: "rotate(-60 17.62 44.25)",
  },
  ready: {
    left: "rotate(8 18.8 33)",
    right: "rotate(-8 29.2 33)",
  },
  "tiny-hop": { left: "translate(0 -1.5)", right: "translate(0 -1.5)" },
};

interface DuckGeometryProps {
  size?: number;
  className?: string;
  accent?: string;
  agitated?: boolean;
  includeHeat?: boolean;
  heatGradientId?: string;
  stance?: DuckStance;
  mouth?: DuckMouth;
  colorway?: DuckColorway;
}

/** Shared Microduck geometry used by the interactive mark and static social artwork. */
export function DuckGeometry({
  size = 34,
  className,
  accent = "#FFD23F",
  agitated = false,
  includeHeat = false,
  heatGradientId = "duck-foot-heat-static",
  stance = "neutral",
  mouth = "closed",
  colorway,
}: DuckGeometryProps) {
  const transforms = duckStanceTransforms[stance];
  const palette = colorway ? duckColorways[colorway] : defaultDuckPalette;
  const accentColor = accent ?? palette.accent;
  const leftBalance = stance === "right-balance";
  const rightBalance = stance === "left-balance";
  const leftLegHeight = leftBalance ? 11 : 8.5;
  const rightLegHeight = rightBalance ? 11 : 8.5;
  const leftFootY = leftBalance ? 42 : 39.5;
  const rightFootY = rightBalance ? 42 : 39.5;
  const mouthGapOpacity = mouth === "closed" ? 0.25 : 1;
  const lowerBeakY = mouth === "open" ? 29.25 : mouth === "slightly-open" ? 28.15 : 26.4;

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {includeHeat && (
        <defs>
          <linearGradient id={heatGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ef665b" stopOpacity="0" />
            <stop offset="0.58" stopColor="#ef665b" stopOpacity="0.42" />
            <stop offset="1" stopColor="#ef665b" stopOpacity="0.94" />
          </linearGradient>
        </defs>
      )}
      {/* legs and feet */}
      <g className={agitated ? "duck-stomp-left" : undefined} transform={transforms.left}>
        <rect x="17.4" y="32.5" width="2.82" height={leftLegHeight} fill="#26262f" />
        <rect className="duck-foot duck-foot-left" x="12.56" y={leftFootY} width="10.12" height="4.5" rx="1.98" fill={accentColor} transform={transforms.leftFoot} />
        {includeHeat && <rect className="duck-foot-heat duck-foot-heat-left" x="12.56" y={leftFootY} width="10.12" height="4.5" rx="1.98" fill={`url(#${heatGradientId})`} transform={transforms.leftFoot} />}
      </g>
      <g className={agitated ? "duck-stomp-right" : undefined} transform={transforms.right}>
        <rect x="27.78" y="32.5" width="2.82" height={rightLegHeight} fill="#26262f" />
        <rect className="duck-foot duck-foot-right" x="25.32" y={rightFootY} width="10.12" height="4.5" rx="1.98" fill={accentColor} transform={transforms.rightFoot} />
        {includeHeat && <rect className="duck-foot-heat duck-foot-heat-right" x="25.32" y={rightFootY} width="10.12" height="4.5" rx="1.98" fill={`url(#${heatGradientId})`} transform={transforms.rightFoot} />}
      </g>
      {/* mech neck */}
      <rect x="20.66" y="23" width="6.69" height="11.5" rx="1.41" fill="#26262f" />
      <rect x="22.24" y="26.2" width="3.52" height="1.7" fill="#3d3d49" />
      <rect x="22.24" y="29.8" width="3.52" height="1.7" fill="#3d3d49" />
      {/* shell head: flattened capsule, wider than tall */}
      <rect x="7.72" y="7.5" width="32.56" height="18" rx="7.92" fill={palette.shell} />
      {/* face panel seam */}
      <path d="M7.72 20h32.56" stroke={palette.seam} strokeWidth="1.2" />
      {/* beak: two hinged lips, with a dark mouth gap revealed when open */}
      <g className="duck-beak">
        <rect className="duck-mouth-gap" x="7.28" y="26.7" width="33.44" height={mouth === "closed" ? 2.6 : lowerBeakY - 26.7} rx="1.14" fill="#6D2708" fillOpacity={mouthGapOpacity} />
        <rect className="duck-beak-upper" x="5.96" y="24" width="36.08" height="3.6" rx="1.58" fill={palette.trim} />
        <rect className="duck-beak-lower" x="5.96" y={lowerBeakY} width="36.08" height="4" rx="1.76" fill={palette.trim} />
        <path d={`M7.28 ${lowerBeakY + 1.7}h33.44`} stroke={palette.trimShadow} strokeWidth="1.3" />
      </g>
      {/* donut camera eye: fat ring + recessed pupil */}
      <ellipse cx="29.72" cy="16.5" rx="5.63" ry="6.4" fill={accentColor} />
      <ellipse cx="29.72" cy="16.5" rx="2.99" ry="3.4" fill="#101018" />
      <ellipse cx="29.72" cy="16.5" rx="2.99" ry="3.4" stroke="#26262f" strokeWidth="0.8" />
    </svg>
  );
}

interface DuckMarkProps {
  size?: number;
  className?: string;
  accent?: string;
  mouth?: DuckMouth;
  agitated?: boolean;
  overheated?: boolean;
}

export function DuckMark({
  size = 34,
  className,
  accent = "#FFD23F",
  mouth,
  agitated = false,
  overheated = false,
}: DuckMarkProps) {
  const heatGradientId = `duck-foot-heat-${useId().replace(/:/g, "")}`;
  const mouthState = mouth ?? "closed";
  const stateClassName = [
    className,
    mouthState === "slightly-open" && "duck-mark-mouth-slightly-open",
    mouthState === "open" && "duck-mark-mouth-open",
    agitated && "duck-mark-agitated",
    overheated && "duck-mark-overheated",
  ].filter(Boolean).join(" ") || undefined;

  return (
    <DuckGeometry
      size={size}
      className={stateClassName}
      accent={accent}
      agitated={agitated}
      includeHeat
      heatGradientId={heatGradientId}
      mouth="closed"
    />
  );
}
