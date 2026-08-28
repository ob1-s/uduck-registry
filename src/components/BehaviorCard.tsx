"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { VerificationBadge } from "./VerificationBadge";
import { DuckMark } from "./DuckMark";
import type { Behavior } from "@registry/schema/behavior";

interface BehaviorCardProps {
  behavior: Behavior;
}

const categoryMarks: Record<string, string> = {
  "roller-skate": "◌",
  manipulation: "✦",
  "agility-tricks": "↗",
  recovery: "↺",
  locomotion: "⌁",
  experimental: "✳",
};

const accessoryLabels: Record<string, string> = {
  roller_skate_blades: "roller skates",
  "70mm_practice_ball": "70 mm ball",
};

export function BehaviorCard({ behavior }: BehaviorCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyToml = async () => {
    try {
      await navigator.clipboard.writeText(behavior.deployment.robotd_toml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="behavior-card">
      <div className="behavior-media">
        {behavior.media.video_url ? (
          <video
            src={behavior.media.video_url}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`${behavior.name} behavior preview`}
          />
        ) : (
          <div className="behavior-placeholder">
            <div className="behavior-placeholder-icon">
              {behavior.category === "locomotion" ? <DuckMark size={42} /> : categoryMarks[behavior.category] || "✳"}
            </div>
            <div className="behavior-placeholder-copy">
              <strong>Behavior recipe</strong>
              <span>{behavior.sources.task_id || "Microduck policy"}</span>
            </div>
          </div>
        )}
        <div className="media-badge">
          <VerificationBadge status={behavior.verification.status} size="sm" />
        </div>
        <span className="category-badge">{behavior.category.replace("-", " ")}</span>
      </div>

      <div className="behavior-body">
        <div className="behavior-title-row">
          <Link href={`/behaviors/${behavior.id}`} className="behavior-title">
            {behavior.name}
          </Link>
          <span className="behavior-version">v{behavior.version}</span>
        </div>
        <p className="behavior-description">{behavior.description}</p>

        <div className="behavior-specs" aria-label="Policy contract summary">
          <span className="spec-chip">{behavior.contract.observation_dim}D input</span>
          <span className="spec-chip">{behavior.contract.action_dim} joints</span>
          <span className="spec-chip spec-chip-accent">{behavior.contract.control_frequency_hz} Hz</span>
          <span className="spec-chip spec-chip-cool">slot:{behavior.compatibility.robotd_slot}</span>
        </div>

        <div className="behavior-byline">
          <span>by {behavior.authors.map((author) => author.name).join(", ")}</span>
          {behavior.compatibility.accessories_required.length > 0 && (
            <span className="behavior-accessory">+ {accessoryLabels[behavior.compatibility.accessories_required[0]] || behavior.compatibility.accessories_required[0]}</span>
          )}
        </div>
      </div>

      <div className="behavior-footer">
        <button
          type="button"
          className="copy-button"
          data-copied={copied}
          onClick={handleCopyToml}
          aria-label={`Copy robotd configuration for ${behavior.name}`}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          <span>{copied ? "Copied" : "Copy config"}</span>
        </button>
        <Link href={`/behaviors/${behavior.id}`} className="inspect-link">
          View recipe <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
