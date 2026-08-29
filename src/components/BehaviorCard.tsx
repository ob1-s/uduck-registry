"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { VerificationBadge } from "./VerificationBadge";
import { MediaPreview } from "./MediaPreview";
import { formatAccessory, formatCategory } from "@/lib/labels";
import type { Behavior } from "@registry/schema/behavior";

interface BehaviorCardProps {
  behavior: Behavior;
}

export function BehaviorCard({ behavior }: BehaviorCardProps) {
  return (
    <article className="behavior-card" data-category={behavior.category} aria-labelledby={`behavior-card-title-${behavior.id}`}>
      <div className="behavior-media">
        <MediaPreview media={behavior.media} title={behavior.name} variant="card" />
      </div>

      <div className="behavior-body">
        <div className="behavior-title-row">
          <div className="behavior-heading">
            <VerificationBadge status={behavior.verification.status} size="sm" />
            <Link id={`behavior-card-title-${behavior.id}`} href={`/behaviors/${behavior.id}`} className="behavior-title">{behavior.name}</Link>
          </div>
        </div>
        <p className="behavior-description">{behavior.description}</p>
        <div className="behavior-byline">
          <span>{formatCategory(behavior.category)} · by {behavior.authors.map((author) => author.name).join(", ")}</span>
          {behavior.compatibility.accessories_required.length > 0 && (
            <span className="behavior-accessory">+ {behavior.compatibility.accessories_required.map(formatAccessory).join(", ")}</span>
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
