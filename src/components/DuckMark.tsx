interface DuckMarkProps {
  size?: number;
  className?: string;
  /** colorway accent for the donut camera eye ring and feet (any CSS color) */
  accent?: string;
  mouthOpen?: boolean;
  agitated?: boolean;
}

/**
 * MicroDuck product mark, on-model: flattened capsule shell head,
 * fat donut camera eye (colored ring + recessed pupil), hinged orange beak,
 * exposed dark mech neck/legs, colorway feet.
 */
export function DuckMark({ size = 34, className, accent = "#FFD23F", mouthOpen = false, agitated = false }: DuckMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={[className, mouthOpen && "duck-mark-mouth-open", agitated && "duck-mark-agitated"].filter(Boolean).join(" ") || undefined}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* legs and feet */}
      <g className="duck-stomp-left">
        <rect x="16.5" y="32.5" width="3.2" height="8.5" fill="#26262f" />
        <rect x="11" y="39.5" width="11.5" height="4.5" rx="2.25" fill={accent} />
      </g>
      <g className="duck-stomp-right">
        <rect x="28.3" y="32.5" width="3.2" height="8.5" fill="#26262f" />
        <rect x="25.5" y="39.5" width="11.5" height="4.5" rx="2.25" fill={accent} />
      </g>
      {/* mech neck */}
      <rect x="20.2" y="23" width="7.6" height="11.5" rx="1.6" fill="#26262f" />
      <rect x="22" y="26.2" width="4" height="1.7" fill="#3d3d49" />
      <rect x="22" y="29.8" width="4" height="1.7" fill="#3d3d49" />
      {/* shell head: flattened capsule, wider than tall */}
      <rect x="5.5" y="7.5" width="37" height="18" rx="9" fill="#F2ECDD" />
      {/* face panel seam */}
      <path d="M5.5 20h37" stroke="#D9D1BC" strokeWidth="1.2" />
      {/* beak: two hinged lips, with a dark mouth gap revealed on click */}
      <g className="duck-beak">
        <rect className="duck-mouth-gap" x="5" y="26.7" width="38" height="2.6" rx="1.3" fill="#6D2708" />
        <rect className="duck-beak-upper" x="3.5" y="24" width="41" height="3.6" rx="1.8" fill="#FF7A2F" />
        <rect className="duck-beak-lower" x="3.5" y="26.4" width="41" height="4" rx="2" fill="#FF7A2F" />
        <path d="M5 28.1h38" stroke="#C2500A" strokeWidth="1.3" />
      </g>
      {/* donut camera eye: fat ring + recessed pupil */}
      <circle cx="30.5" cy="16.5" r="6.4" fill={accent} />
      <circle cx="30.5" cy="16.5" r="3.4" fill="#101018" />
      <circle cx="30.5" cy="16.5" r="3.4" stroke="#26262f" strokeWidth="0.8" />
    </svg>
  );
}
