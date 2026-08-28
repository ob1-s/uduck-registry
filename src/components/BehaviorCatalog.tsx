"use client";

import { useState, useMemo } from "react";
import { FilterBar } from "./FilterBar";
import { BehaviorCard } from "./BehaviorCard";
import type { Behavior } from "@registry/schema/behavior";
import { Sparkles, Terminal } from "lucide-react";

interface BehaviorCatalogProps {
  initialBehaviors: Behavior[];
}

export function BehaviorCatalog({ initialBehaviors }: BehaviorCatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [verification, setVerification] = useState("all");
  const [accessory, setAccessory] = useState("all");

  const filteredBehaviors = useMemo(() => {
    return initialBehaviors.filter((b) => {
      // Category filter
      if (category !== "all" && b.category !== category) {
        return false;
      }

      // Verification filter
      if (verification !== "all" && b.verification.status !== verification) {
        return false;
      }

      // Accessory filter
      if (accessory === "none") {
        if (b.compatibility.accessories_required.length > 0) return false;
      } else if (accessory !== "all") {
        if (!b.compatibility.accessories_required.includes(accessory)) return false;
      }

      // Search query filter
      if (search.trim() !== "") {
        const q = search.toLowerCase();
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesId = b.id.toLowerCase().includes(q);
        const matchesDesc = b.description.toLowerCase().includes(q);
        const matchesTags = b.tags.some((t) => t.toLowerCase().includes(q));
        const matchesAuthor = b.authors.some((a) => a.name.toLowerCase().includes(q));
        const matchesTaskId = b.sources.task_id?.toLowerCase().includes(q);

        if (!matchesName && !matchesId && !matchesDesc && !matchesTags && !matchesAuthor && !matchesTaskId) {
          return false;
        }
      }

      return true;
    });
  }, [initialBehaviors, search, category, verification, accessory]);

  return (
    <div className="space-y-8">
      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 backdrop-blur-sm">
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

      {/* Behaviors Grid */}
      {filteredBehaviors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBehaviors.map((b) => (
            <BehaviorCard key={b.id} behavior={b} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-2xl">
            🦆
          </div>
          <h3 className="text-base font-semibold text-white">No matching behaviors found</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search terms or resetting the category and verification filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("all");
              setVerification("all");
              setAccessory("all");
            }}
            className="mt-4 rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
