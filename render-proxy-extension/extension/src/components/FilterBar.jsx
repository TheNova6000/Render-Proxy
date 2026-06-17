import React, { useCallback } from "react";
import { Search, Filter } from "lucide-react";

const FILTERS = [
  ["user", "User"],
  ["form", "Forms"],
  ["function", "Functions"],
  ["fetch", "Fetch"],
  ["state", "State"],
  ["render", "Renders"],
  ["dom", "DOM"],
  ["error", "Errors"],
  ["other", "Other"]
];

export function FilterBar({ filters, onChange, icon, search, onSearchChange, total, filtered }) {
  const toggle = useCallback(
    (key) => onChange({ ...filters, [key]: !filters[key] }),
    [filters, onChange]
  );

  return (
    <div className="filter-bar" role="toolbar" aria-label="Trace filters">
      <div className="filter-row">
        <div className="filter-title">
          {icon || <Filter size={15} />}
          <span>Filters</span>
        </div>
        <div className="filter-search">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search events…"
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            spellCheck={false}
            aria-label="Search trace events"
          />
        </div>
        <span className="filter-count" aria-live="polite">{filtered} / {total}</span>
      </div>
      <div className="filter-options">
        {FILTERS.map(([key, label]) => {
          const active = filters[key] !== false;
          return (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={active}
              className={active ? "filter-chip active" : "filter-chip"}
              onClick={() => toggle(key)}
            >
              <span className={`filter-dot ${key}`} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
