import { AlertCircle, ShieldCheck, Sparkles } from "lucide-react";
import type { VerificationStatus } from "@registry/schema/behavior";

interface VerificationBadgeProps {
  status: VerificationStatus;
  summary?: string;
  showTooltip?: boolean;
  size?: "sm" | "md";
}

const labels: Record<VerificationStatus, string> = {
  verified_hardware: "Hardware verified",
  claimed_hardware: "Hardware claimed",
  community_experimental: "Experimental",
};

export function VerificationBadge({
  status,
  summary,
  showTooltip = true,
  size = "md",
}: VerificationBadgeProps) {
  const Icon = status === "verified_hardware"
    ? ShieldCheck
    : status === "claimed_hardware"
      ? AlertCircle
      : Sparkles;
  const tone = status === "verified_hardware"
    ? "status-hardware"
    : status === "claimed_hardware"
      ? "status-claimed"
      : "status-experimental";

  return (
    <span
      className={`status-badge ${tone} ${size === "sm" ? "status-badge-sm" : ""}`}
      aria-label={summary ? `${labels[status]}: ${summary}` : labels[status]}
      title={showTooltip ? summary || labels[status] : undefined}
    >
      <Icon size={size === "sm" ? 11 : 13} aria-hidden="true" />
      <span>{labels[status]}</span>
    </span>
  );
}
