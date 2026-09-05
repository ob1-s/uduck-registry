"use client";

import { useMemo, useState } from "react";
import type { CatalogEntry } from "@registry/schema/catalog";
import { FilterBar } from "./FilterBar";
import { BehaviorCard } from "./BehaviorCard";
import { DuckMark } from "./DuckMark";
import { QuackButton } from "./QuackAction";
import { catalogSearchText } from "@/lib/catalog";
import { formatRobotdSlot } from "@/lib/labels";

interface BehaviorCatalogProps {
  entries: CatalogEntry[];
}

export function BehaviorCatalog({ entries }: BehaviorCatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [hardware, setHardware] = useState("all");
  const [accessory, setAccessory] = useState("all");
  const [slot, setSlot] = useState("all");

  const slots = useMemo(() => Array.from(new Set(
    entries.map((entry) => entry.runtime.slot).filter((value): value is string => value != null),
  ))
    .sort((a, b) => formatRobotdSlot(a).localeCompare(formatRobotdSlot(b)))
    .map((id) => ({ id, label: formatRobotdSlot(id) })), [entries]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (hardware !== "all" && entry.hardware.status !== hardware) return false;
      if (slot !== "all" && entry.runtime.slot !== slot) return false;

      const accessories = entry.runtime.compatibility.accessories_required;
      if (accessory === "none" && (accessories == null || accessories.length > 0)) return false;
      if (accessory !== "all" && accessory !== "none" && (accessories == null || !accessories.includes(accessory))) return false;

      return !query || catalogSearchText(entry).includes(query);
    });
  }, [accessory, category, entries, hardware, search, slot]);

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setHardware("all");
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
          selectedHardware={hardware}
          setSelectedHardware={setHardware}
          selectedAccessory={accessory}
          setSelectedAccessory={setAccessory}
          selectedSlot={slot}
          setSelectedSlot={setSlot}
          slots={slots}
          totalCount={entries.length}
          filteredCount={filteredEntries.length}
        />
      </div>

      <div id="behavior-results">
        {entries.length === 0 ? (
          <div className="empty-state" role="status">
            <div className="empty-state-mark"><DuckMark size={42} /></div>
            <h3>No moves yet</h3>
            <p>Add the first behavior record to the registry.</p>
          </div>
        ) : filteredEntries.length > 0 ? (
          <div className="behavior-grid">
            {filteredEntries.map((entry) => <BehaviorCard key={entry.id} entry={entry} />)}
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

