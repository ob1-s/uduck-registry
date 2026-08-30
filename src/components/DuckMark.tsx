import { useId } from "react";

interface DuckMarkProps {
  size?: number;
  className?: string;
  /** colorway accent for the donut camera eye ring and feet (any CSS color) */
  accent?: string;
  mouthOpen?: boolean;
  agitated?: boolean;
  overheated?: boolean;
}

/**
 * Microduck product mark, on-model: flattened capsule shell head,
 * fat donut camera eye (colored ring + recessed pupil), hinged orange beak,
 * exposed dark mech neck/legs, colorway feet.
 */
export function DuckMark({ size = 34, className, accent = "#FFD23F", mouthOpen = false, agitated = false, overheated = false }: DuckMarkProps) {
  const heatGradientId = `duck-foot-heat-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      className={[className, mouthOpen && "duck-mark-mouth-open", agitated && "duck-mark-agitated", overheated && "duck-mark-overheated"].filter(Boolean).join(" ") || undefined}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={heatGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ef665b" stopOpacity="0" />
          <stop offset="0.58" stopColor="#ef665b" stopOpacity="0.42" />
          <stop offset="1" stopColor="#ef665b" stopOpacity="0.94" />
        </linearGradient>
      </defs>
      {/* Geometry is intentionally narrow to match the physical Microduck silhouette. */}
      {/* legs and feet */}
      <g className="duck-stomp-left">
        <rect x="17.4" y="32.5" width="2.82" height="8.5" fill="#26262f" />
        <rect className="duck-foot duck-foot-left" x="12.56" y="39.5" width="10.12" height="4.5" rx="1.98" fill={accent} />
        <rect className="duck-foot-heat duck-foot-heat-left" x="12.56" y="39.5" width="10.12" height="4.5" rx="1.98" fill={`url(#${heatGradientId})`} />
      </g>
      <g className="duck-stomp-right">
        <rect x="27.78" y="32.5" width="2.82" height="8.5" fill="#26262f" />
        <rect className="duck-foot duck-foot-right" x="25.32" y="39.5" width="10.12" height="4.5" rx="1.98" fill={accent} />
        <rect className="duck-foot-heat duck-foot-heat-right" x="25.32" y="39.5" width="10.12" height="4.5" rx="1.98" fill={`url(#${heatGradientId})`} />
      </g>
      {/* mech neck */}
      <rect x="20.66" y="23" width="6.69" height="11.5" rx="1.41" fill="#26262f" />
      <rect x="22.24" y="26.2" width="3.52" height="1.7" fill="#3d3d49" />
      <rect x="22.24" y="29.8" width="3.52" height="1.7" fill="#3d3d49" />
      {/* shell head: flattened capsule, wider than tall */}
      <rect x="7.72" y="7.5" width="32.56" height="18" rx="7.92" fill="#F2ECDD" />
      {/* face panel seam */}
      <path d="M7.72 20h32.56" stroke="#D9D1BC" strokeWidth="1.2" />
      {/* beak: two hinged lips, with a dark mouth gap revealed on click */}
      <g className="duck-beak">
        <rect className="duck-mouth-gap" x="7.28" y="26.7" width="33.44" height="2.6" rx="1.14" fill="#6D2708" />
        <rect className="duck-beak-upper" x="5.96" y="24" width="36.08" height="3.6" rx="1.58" fill="#FF7A2F" />
        <rect className="duck-beak-lower" x="5.96" y="26.4" width="36.08" height="4" rx="1.76" fill="#FF7A2F" />
        <path d="M7.28 28.1h33.44" stroke="#C2500A" strokeWidth="1.3" />
      </g>
      {/* donut camera eye: fat ring + recessed pupil */}
      <ellipse cx="29.72" cy="16.5" rx="5.63" ry="6.4" fill={accent} />
      <ellipse cx="29.72" cy="16.5" rx="2.99" ry="3.4" fill="#101018" />
      <ellipse cx="29.72" cy="16.5" rx="2.99" ry="3.4" stroke="#26262f" strokeWidth="0.8" />
    </svg>
  );
}
