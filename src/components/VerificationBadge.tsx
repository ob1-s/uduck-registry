import { ShieldCheck, Cpu, AlertCircle, Sparkles } from "lucide-react";
import type { VerificationStatus } from "@registry/schema/behavior";

interface VerificationBadgeProps {
  status: VerificationStatus;
  summary?: string;
  showTooltip?: boolean;
  size?: "sm" | "md";
}

export function VerificationBadge({
  status,
  summary,
  showTooltip = true,
  size = "md",
}: VerificationBadgeProps) {
  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  switch (status) {
    case "verified_hardware":
      return (
        <span
          className={`inline-flex items-center rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}
          title={summary || "Tested and verified on physical MicroDuck hardware"}
        >
          <ShieldCheck className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Verified Hardware</span>
        </span>
      );

    case "claimed_hardware":
      return (
        <span
          className={`inline-flex items-center rounded-full font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 ${sizeClasses}`}
          title={summary || "Author claims physical hardware deployment"}
        >
          <AlertCircle className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Claimed Hardware</span>
        </span>
      );

    case "verified_simulation":
      return (
        <span
          className={`inline-flex items-center rounded-full font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 ${sizeClasses}`}
          title={summary || "Tested and verified in MuJoCo / mjlab simulation"}
        >
          <Cpu className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Simulation Tested</span>
        </span>
      );

    case "community_experimental":
    default:
      return (
        <span
          className={`inline-flex items-center rounded-full font-mono font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30 ${sizeClasses}`}
          title={summary || "Community experimental behavior"}
        >
          <Sparkles className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Experimental</span>
        </span>
      );
  }
}
