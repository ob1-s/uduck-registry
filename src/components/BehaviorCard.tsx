"use client";

import Link from "next/link";
import { ArrowUpRight, Play } from "lucide-react";
import { VerificationBadge } from "./VerificationBadge";
import { DuckMark } from "./DuckMark";
import type { Behavior } from "@registry/schema/behavior";

interface BehaviorCardProps {
  behavior: Behavior;
}

const accessoryLabels: Record<string, string> = {
  roller_skate_blades: "roller skates",
  "70mm_practice_ball": "70 mm ball",
};

export function BehaviorCard({ behavior }: BehaviorCardProps) {
  const thumb = behavior.media?.thumbnail_url;

  return (
    <article className="behavior-card" data-category={behavior.category}>
      <div className="behavior-media">
        {thumb ? (
          <>
            <img
              src={thumb}
              alt={behavior.media?.caption ?? behavior.name}
              loading="lazy"
              className="behavior-thumb"
            />
            <span className="behavior-thumb-play" aria-hidden="true">
              <Play size={11} fill="currentColor" />
            </span>
          </>
        ) : (
          <div className="behavior-placeholder" aria-hidden="true">
            <div className="behavior-placeholder-icon">
              <DuckMark size={48} accent="var(--tone)" />
            </div>
          </div>
        )}
      </div>

      <div className="behavior-body">
        <div className="behavior-title-row">
          <div className="behavior-heading">
            <VerificationBadge status={behavior.verification.status} size="sm" />
            <Link href={`/behaviors/${behavior.id}`} className="behavior-title">{behavior.name}</Link>
          </div>
        </div>
        <p className="behavior-description">{behavior.description}</p>
        <div className="behavior-byline">
          <span>{behavior.category.replace("-", " ")} · by {behavior.authors.map((author) => author.name).join(", ")}</span>
          {behavior.compatibility.accessories_required.length > 0 && (
            <span className="behavior-accessory">+ {accessoryLabels[behavior.compatibility.accessories_required[0]] || behavior.compatibility.accessories_required[0].replaceAll("_", " ")}</span>
          )}
        </div>
      </div>

      <div className="behavior-footer">
        <Link href={`/behaviors/${behavior.id}`} className="inspect-link">
          Open move <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
