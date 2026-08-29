"use client";

import { useMemo, useState } from "react";
import { FilterBar } from "./FilterBar";
import { BehaviorCard } from "./BehaviorCard";
import type { Behavior } from "@registry/schema/behavior";
import { DuckMark } from "./DuckMark";

interface BehaviorCatalogProps {
  initialBehaviors: Behavior[];
}

export function BehaviorCatalog({ initialBehaviors }: BehaviorCatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [verification, setVerification] = useState("all");
  const [accessory, setAccessory] = useState("all");

  const filteredBehaviors = useMemo(() => initialBehaviors.filter((behavior) => {
    if (category !== "all" && behavior.category !== category) return false;
    if (verification !== "all" && behavior.verification.status !== verification) return false;

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
      ...behavior.compatibility.accessories_required,
    ].some((value) => value.toLowerCase().includes(query));
  }), [accessory, category, initialBehaviors, search, verification]);

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setVerification("all");
    setAccessory("all");
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
          totalCount={initialBehaviors.length}
          filteredCount={filteredBehaviors.length}
        />
      </div>

      <div id="behavior-results">
        {initialBehaviors.length === 0 ? (
          <div className="empty-state" role="status">
            <div className="empty-state-mark"><DuckMark size={42} /></div>
            <h3>No moves yet</h3>
            <p>Add the first behavior record to the registry.</p>
          </div>
        ) : filteredBehaviors.length > 0 ? (
          <div className="behavior-grid">
            {filteredBehaviors.map((behavior) => <BehaviorCard key={behavior.id} behavior={behavior} />)}
          </div>
        ) : (
          <div className="empty-state" role="status">
            <div className="empty-state-mark"><DuckMark size={42} /></div>
            <h3>No moves match that search.</h3>
            <p>Try another word or clear a filter.</p>
            <button type="button" className="button-secondary" onClick={resetFilters}>Clear filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
