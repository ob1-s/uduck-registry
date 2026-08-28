interface DuckMarkProps {
  size?: number;
  className?: string;
}

export function DuckMark({ size = 34, className }: DuckMarkProps) {
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
      <ellipse cx="21.5" cy="28" rx="13.5" ry="9.5" fill="#F8C85D" />
      <circle cx="32.5" cy="18.5" r="8.5" fill="#FFD978" />
      <path d="M38.7 19.4c2.8-.1 5.1.7 6.1 2.1.9 1.2-1.2 2.9-3.2 3.1l-5.3-.2 2.4-5Z" fill="#ED9850" />
      <circle cx="34.4" cy="16.5" r="1.3" fill="#1D2B25" />
      <path d="M14.8 26.7c2.3-2.2 5.9-2.6 8.7-.8 1.3.9 2.2 2.1 2.6 3.6-3.1 1.3-6.9 1.4-10.1.2-.8-.3-1.3-1.5-1.2-3Z" fill="#EAB34B" />
      <path d="M8 38.5c5.1 2.3 15.3 2.8 24.9.4" stroke="#4F8297" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.5 42c4.2 1.1 9.5 1.2 13.8.2" stroke="#A9CAD0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
