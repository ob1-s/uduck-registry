"use client";

import { useState } from "react";
import Link from "next/link";
import { VerificationBadge } from "./VerificationBadge";
import { Copy, Check, ExternalLink, ArrowRight, Play, Box } from "lucide-react";
import type { Behavior } from "@registry/schema/behavior";

interface BehaviorCardProps {
  behavior: Behavior;
}

export function BehaviorCard({ behavior }: BehaviorCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyToml = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(behavior.deployment.robotd_toml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/90 hover:border-amber-400/40 transition-all duration-200 overflow-hidden amber-glow">
      <div>
        {/* Visual / Media Header */}
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-slate-800/80">
          {behavior.media.video_url ? (
            <video
              src={behavior.media.video_url}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20 text-2xl">
                {behavior.category === "roller-skate" ? "🛼" : behavior.category === "manipulation" ? "🎯" : behavior.category === "agility-tricks" ? "🤸" : "🦆"}
              </div>
              <span className="text-xs font-mono text-slate-400">
                {behavior.sources.task_id || "MuJoCo RL Policy"}
              </span>
            </div>
          )}

          {/* Verification Badge Overlay */}
          <div className="absolute top-3 left-3 z-10">
            <VerificationBadge status={behavior.verification.status} size="sm" />
          </div>

          {/* Category Tag */}
          <div className="absolute top-3 right-3 z-10">
            <span className="rounded-full bg-slate-950/80 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-300 border border-slate-800 backdrop-blur-sm">
              {behavior.category}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <Link
              href={`/behaviors/${behavior.id}`}
              className="text-base font-bold text-white group-hover:text-amber-400 transition-colors"
            >
              {behavior.name}
            </Link>
            <span className="font-mono text-xs text-slate-500">v{behavior.version}</span>
          </div>

          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
            {behavior.description}
          </p>

          {/* Quick Specs Pill Row */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] mb-4">
            <span className="rounded bg-slate-800/80 px-2 py-0.5 text-slate-300 border border-slate-750">
              61-D Obs
            </span>
            <span className="rounded bg-slate-800/80 px-2 py-0.5 text-slate-300 border border-slate-750">
              14 Servos
            </span>
            <span className="rounded bg-slate-800/80 px-2 py-0.5 text-amber-300/90 border border-slate-750">
              50 Hz
            </span>
            <span className="rounded bg-slate-800/80 px-2 py-0.5 text-cyan-300/90 border border-slate-750">
              slot:{behavior.compatibility.robotd_slot}
            </span>
          </div>

          {/* Author & Upstream */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-3">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-slate-500">By</span>
              <span className="font-medium text-slate-300 truncate">
                {behavior.authors[0]?.name}
              </span>
            </div>

            {behavior.compatibility.accessories_required.length > 0 && (
              <span className="font-mono text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                req: {behavior.compatibility.accessories_required[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/40 px-5 py-3">
        <button
          onClick={handleCopyToml}
          className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
          title="Copy /etc/robot/robotd.toml configuration"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied TOML</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-500" />
              <span>Copy TOML</span>
            </>
          )}
        </button>

        <Link
          href={`/behaviors/${behavior.id}`}
          className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
        >
          <span>Inspect</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
