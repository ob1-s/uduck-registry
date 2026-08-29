"use client";

import { Search, X } from "lucide-react";

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

const categories = [
  { id: "all", label: "Any category" },
  { id: "locomotion", label: "Locomotion" },
  { id: "roller-skate", label: "Roller skating" },
  { id: "agility-tricks", label: "Agility & tricks" },
  { id: "manipulation", label: "Manipulation" },
  { id: "recovery", label: "Recovery" },
  { id: "experimental", label: "Experimental" },
];

const verifications = [
  { id: "all", label: "Any status" },
  { id: "verified_hardware", label: "Hardware verified" },
  { id: "verified_simulation", label: "Simulation verified" },
  { id: "claimed_hardware", label: "Hardware claimed" },
  { id: "community_experimental", label: "Experimental" },
];

const accessories = [
  { id: "all", label: "Any setup" },
  { id: "none", label: "Standard duck" },
  { id: "roller_skate_blades", label: "Roller skates" },
  { id: "70mm_practice_ball", label: "70 mm ball" },
];

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
  const hasActiveFilters =
    search.trim() !== "" ||
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
    <div className="filter-bar">
      <label className="search-field filter-search">
        <span className="sr-only">Search behaviors</span>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search moves, tasks, or authors"
          aria-label="Search behaviors by name, tag, author, or task"
          aria-controls="behavior-results"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch("")} type="button" aria-label="Clear search">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </label>

      <fieldset className="filter-compact-row" aria-label="Filter behaviors">
        <legend className="sr-only">Filter behaviors</legend>
        <label htmlFor="category-filter">
          <span className="sr-only">Category</span>
          <select id="category-filter" className="filter-select" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="Filter by category">
            {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label htmlFor="verification-filter">
          <span className="sr-only">Verification status</span>
          <select id="verification-filter" className="filter-select" value={selectedVerification} onChange={(event) => setSelectedVerification(event.target.value)} aria-label="Filter by verification status">
            {verifications.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label htmlFor="accessory-filter">
          <span className="sr-only">Required accessories</span>
          <select id="accessory-filter" className="filter-select" value={selectedAccessory} onChange={(event) => setSelectedAccessory(event.target.value)} aria-label="Filter by required accessories">
            {accessories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div className="filter-count" aria-live="polite">
          <strong>{filteredCount}</strong> of {totalCount}
          {hasActiveFilters && <button type="button" className="reset-link" onClick={clearAllFilters}>Reset</button>}
        </div>
      </fieldset>
    </div>
  );
}
