"use client";

import Link from "next/link";
import { MediaPreview } from "./MediaPreview";
import type { ResolvedPolicy } from "../../registry/schema/policy";
import { useMemo, useState } from "react";
import { FilterBar } from "./FilterBar";
import { BehaviorCard } from "./BehaviorCard";
import type { BehaviorWithSimulation } from "@/lib/simulation";
import { DuckMark } from "./DuckMark";
import { QuackButton } from "./QuackAction";
import { formatRobotdSlot } from "@/lib/labels";

interface BehaviorCatalogProps {
  initialBehaviors: BehaviorWithSimulation[];
  policies: ResolvedPolicy[];
}

export function BehaviorCatalog({ initialBehaviors, policies }: BehaviorCatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [verification, setVerification] = useState("all");
  const [accessory, setAccessory] = useState("all");
  const [slot, setSlot] = useState("all");

  const slots = useMemo(() => Array.from(new Set(initialBehaviors.map((behavior) => behavior.compatibility.robotd_slot)))
    .sort((a, b) => formatRobotdSlot(a).localeCompare(formatRobotdSlot(b)))
    .map((id) => ({ id, label: formatRobotdSlot(id) })), [initialBehaviors]);

  const filteredBehaviors = useMemo(() => initialBehaviors.filter((behavior) => {
    if (category !== "all" && behavior.category !== category) return false;
    if (verification !== "all" && behavior.verification.status !== verification) return false;
    if (slot !== "all" && behavior.compatibility.robotd_slot !== slot) return false;

    if (accessory === "none" && behavior.compatibility.accessories_required.length > 0) return false;
    if (accessory !== "all" && accessory !== "none" && !behavior.compatibility.accessories_required.includes(accessory)) return false;

    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      behavior.name,
      behavior.id,
      behavior.description,
      ...behavior.tags,
      ...behavior.authors.map((author) => author.name),
      behavior.sources.task_id || "",
      behavior.category,
      behavior.verification.status,
      behavior.compatibility.robotd_slot,
      ...behavior.compatibility.accessories_required,
    ].some((value) => value.toLowerCase().includes(query));
  }), [accessory, category, initialBehaviors, search, slot, verification]);

  const filteredPolicies = policies.filter(policy => {
    if (category !== "all" && policy.curation.category !== category) return false;
    if (verification !== "all" && verification !== "community_experimental") return false;
    if (accessory !== "all") return false; // Unknown setup is not "no accessories".
    if (slot !== "all" && policy.resolved.manifest.slot !== slot) return false;
    const haystack = [policy.id, policy.source.repo, policy.curation.summary ?? '', policy.resolved.manifest.name, policy.resolved.manifest.description, ...policy.curation.tags].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setVerification("all");
    setAccessory("all");
    setSlot("all");
  };

  return (
    <div className="space-y-4">
      <div className="surface filter-panel">
        <FilterBar
          search={search}
          setSearch={setSearch}
          selectedCategory={category}
          setSelectedCategory={setCategory}
          selectedVerification={verification}
          setSelectedVerification={setVerification}
          selectedAccessory={accessory}
          setSelectedAccessory={setAccessory}
          selectedSlot={slot}
          setSelectedSlot={setSlot}
          slots={slots}
          totalCount={initialBehaviors.length + policies.length}
          filteredCount={filteredBehaviors.length + filteredPolicies.length}
        />
      </div>

      <div id="behavior-results">
        {initialBehaviors.length + policies.length === 0 ? (
          <div className="empty-state" role="status">
            <div className="empty-state-mark"><DuckMark size={42} /></div>
            <h3>No moves yet</h3>
            <p>Add the first behavior record to the registry.</p>
          </div>
        ) : filteredBehaviors.length + filteredPolicies.length > 0 ? (
          <div className="behavior-grid">
            {filteredPolicies.map(policy => {
              const name = typeof policy.resolved.manifest.name === 'string' ? policy.resolved.manifest.name : policy.id;
              const media = policy.media?.[0];
              return <article className="behavior-card" key={policy.id}>
                <Link className="behavior-media" href={`/policies/${policy.id}`} aria-label={`Open ${name}`}>
                  <MediaPreview media={{ hero_type: media?.type ?? 'badge', ...(media?.type === 'video' ? { video_url: media.url } : media ? { thumbnail_url: media.url } : {}) }} title={name} variant="card" />
                </Link>
                <div className="behavior-body"><span className="detail-chip">Pollen Hub package</span>
                  <h3><Link className="behavior-title" href={`/policies/${policy.id}`}>{name}</Link></h3>
                  <p className="behavior-description">{policy.curation.summary ?? String(policy.resolved.manifest.description ?? '')}</p>
                  <p className="behavior-byline">{policy.source.repo.split('/')[0]} · No registry hardware verification</p>
                </div><div className="behavior-footer"><Link className="inspect-link" href={`/policies/${policy.id}`}>Open move ↗</Link></div>
              </article>;
            })}
            {filteredBehaviors.map((behavior) => <BehaviorCard key={behavior.id} behavior={behavior} />)}
          </div>
        ) : (
          <div className="empty-state" role="status">
            <div className="empty-state-mark"><DuckMark size={42} /></div>
            <h3>No moves match that search.</h3>
            <p>Try another word or clear a filter.</p>
            <QuackButton type="button" className="button-secondary" onClick={resetFilters}>Clear filters</QuackButton>
          </div>
        )}
      </div>
    </div>
  );
}
