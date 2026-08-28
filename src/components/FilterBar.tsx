"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import type { BehaviorCategory, VerificationStatus } from "@registry/schema/behavior";

interface FilterBarProps {
  search: string;
  setSearch: (s: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedVerification: string;
  setSelectedVerification: (v: string) => void;
  selectedAccessory: string;
  setSelectedAccessory: (a: string) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({
  search,
  setSearch,
  selectedCategory,
  setSelectedCategory,
  selectedVerification,
  setSelectedVerification,
  selectedAccessory,
  setSelectedAccessory,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const categories = [
    { id: "all", label: "All Behaviors" },
    { id: "locomotion", label: "Locomotion" },
    { id: "roller-skate", label: "Roller Skating" },
    { id: "agility-tricks", label: "Tricks & Agility" },
    { id: "manipulation", label: "Manipulation" },
    { id: "recovery", label: "Fall Recovery" },
  ];

  const verifications = [
    { id: "all", label: "Any Verification" },
    { id: "verified_hardware", label: "Verified Real Hardware" },
    { id: "verified_simulation", label: "Simulation Tested" },
    { id: "claimed_hardware", label: "Claimed Hardware" },
  ];

  const accessories = [
    { id: "all", label: "Any Accessories" },
    { id: "none", label: "Standard Duck (No Extra Gear)" },
    { id: "roller_skate_blades", label: "Roller Blades" },
    { id: "70mm_practice_ball", label: "70mm Ball" },
  ];

  const hasActiveFilters =
    search !== "" ||
    selectedCategory !== "all" ||
    selectedVerification !== "all" ||
    selectedAccessory !== "all";

  const clearAllFilters = () => {
    setSearch("");
    setSelectedCategory("all");
    setSelectedVerification("all");
    setSelectedAccessory("all");
  };

  return (
    <div className="space-y-4">
      {/* Search Input & Dropdowns Row */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search behaviors by name, keyword, tag, author, or task ID..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Verification Status Filter */}
        <select
          value={selectedVerification}
          onChange={(e) => setSelectedVerification(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-300 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        >
          {verifications.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>

        {/* Accessory Filter */}
        <select
          value={selectedAccessory}
          onChange={(e) => setSelectedAccessory(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-mono text-slate-300 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        >
          {accessories.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category Pills & Count */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-amber-400 text-slate-950 shadow-sm font-semibold"
                    : "bg-slate-900/90 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>
            Showing <strong className="text-white">{filteredCount}</strong> of {totalCount}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-amber-400 hover:text-amber-300 underline text-[11px]"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
