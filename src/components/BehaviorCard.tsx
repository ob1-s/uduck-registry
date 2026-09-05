"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CatalogEntry } from "@registry/schema/catalog";
import { MediaPreview } from "./MediaPreview";
import { formatAccessory, formatCategory, formatRobotdSlot } from "@/lib/labels";
import { coverageLabel, hardwareLabel, primaryMedia, runtimeKindLabel, runtimeLabel } from "@/lib/catalog";

interface BehaviorCardProps {
  entry: CatalogEntry;
}

export function BehaviorCard({ entry }: BehaviorCardProps) {
  const preview = primaryMedia(entry);
  const accessories = entry.runtime.compatibility.accessories_required;
  const slot = entry.runtime.slot;

  return (
    <article className="behavior-card" data-category={entry.category} aria-labelledby={`behavior-card-title-${entry.id}`}>
      <Link href={`/behaviors/${entry.id}`} className="behavior-media" aria-label={`Open ${entry.name}`}>
        <MediaPreview media={preview} title={entry.name} variant="card" />
      </Link>

      <div className="behavior-body">
        <div className="behavior-title-row">
          <div className="behavior-heading">
            <span className="detail-chip">{runtimeLabel(entry.runtime)}</span>
            <Link id={`behavior-card-title-${entry.id}`} href={`/behaviors/${entry.id}`} className="behavior-title">{entry.name}</Link>
          </div>
        </div>
        <p className="behavior-description">{entry.description}</p>
        <div className="behavior-byline">
          <span>{formatCategory(entry.category)} · by {entry.authors.map((author) => author.name).join(", ")}</span>
          {accessories == null
            ? <span className="behavior-accessory">Setup unknown</span>
            : accessories.length > 0
              ? <span className="behavior-accessory">+ {accessories.map(formatAccessory).join(", ")}</span>
              : null}
        </div>
        <div className="behavior-facts" aria-label="Entry evidence">
          <span>{hardwareLabel(entry.hardware.status)}</span>
          <span>{coverageLabel(entry.coverage.registry_simulation.status)}</span>
          <span>{runtimeKindLabel(entry.runtime.kind)}{slot ? ` · ${formatRobotdSlot(slot)}` : ""}</span>
        </div>
      </div>

      <div className="behavior-footer">
        <Link href={`/behaviors/${entry.id}`} className="inspect-link">
          Open move <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

