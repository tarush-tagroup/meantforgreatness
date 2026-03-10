"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CheckboxFilter from "@/components/admin/CheckboxFilter";

interface KidsFiltersProps {
  orphanageOptions: { id: string; name: string }[];
  classGroupOptions: {
    id: string;
    name: string;
    orphanageId: string;
    orphanageName: string | null;
  }[];
  allKids: { id: string; name: string }[];
}

export default function KidsFilters({
  orphanageOptions,
  classGroupOptions,
  allKids,
}: KidsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orphanageId = searchParams.get("orphanageId") || "";
  const classGroupId = searchParams.get("classGroupId") || "";
  const ageGroup = searchParams.get("ageGroup") || "";
  const sortBy = searchParams.get("sortBy") || "";
  const status = searchParams.get("status") || "";
  const q = searchParams.get("q") || "";

  const selectedOrphanages = orphanageId ? orphanageId.split(",") : [];
  const selectedClassGroups = classGroupId ? classGroupId.split(",") : [];
  const selectedAgeGroups = ageGroup ? ageGroup.split(",") : [];
  const selectedStatuses = status ? status.split(",") : [];

  const [searchQuery, setSearchQuery] = useState(q);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFilters = !!(orphanageId || ageGroup || classGroupId || sortBy || status || q);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const p = new URLSearchParams();
      const merged = {
        orphanageId,
        ageGroup,
        classGroupId,
        sortBy,
        status,
        q,
        ...overrides,
      };
      if (merged.orphanageId) p.set("orphanageId", merged.orphanageId);
      if (merged.ageGroup) p.set("ageGroup", merged.ageGroup);
      if (merged.classGroupId) p.set("classGroupId", merged.classGroupId);
      if (merged.sortBy) p.set("sortBy", merged.sortBy);
      if (merged.status) p.set("status", merged.status);
      if (merged.q) p.set("q", merged.q);
      const qs = p.toString();
      return `/admin/kids${qs ? `?${qs}` : ""}`;
    },
    [orphanageId, ageGroup, classGroupId, sortBy, status, q]
  );

  // Filtered suggestions
  const suggestions = searchQuery.trim()
    ? allKids.filter((k) =>
        k.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSearchSubmit() {
    setShowDropdown(false);
    router.push(buildUrl({ q: searchQuery.trim() }));
  }

  function handleSelectKid(kid: { id: string; name: string }) {
    setSearchQuery("");
    setShowDropdown(false);
    router.push(`/admin/kids/${kid.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchSubmit();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        handleSelectKid(suggestions[highlightIndex]);
      } else {
        handleSearchSubmit();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  // Build class group options with orphanage prefix
  const classGroupFilterOptions = classGroupOptions.map((g) => ({
    value: g.id,
    label: `${g.orphanageName || "Unknown"} — ${g.name}`,
  }));

  return (
    <div className="mb-6 space-y-3">
      {/* Search bar */}
      <div ref={searchRef} className="relative max-w-md">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightIndex(-1);
              setShowDropdown(e.target.value.trim().length > 0);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search kids by name..."
            className="w-full rounded-lg border border-sand-300 py-2 pl-9 pr-8 text-sm text-sand-700 placeholder:text-sand-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setShowDropdown(false);
                if (q) router.push(buildUrl({ q: "" }));
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-sand-400 hover:text-sand-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-sand-200 bg-white py-1 shadow-lg">
            {suggestions.map((kid, i) => (
              <button
                key={kid.id}
                type="button"
                onClick={() => handleSelectKid(kid)}
                className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                  i === highlightIndex
                    ? "bg-green-50 text-green-700"
                    : "text-sand-700 hover:bg-sand-50"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand-100 text-xs font-medium text-sand-500 mr-2.5">
                  {kid.name.charAt(0)}
                </span>
                <span className="truncate">{kid.name}</span>
              </button>
            ))}
          </div>
        )}

        {showDropdown && searchQuery.trim() && suggestions.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-sand-200 bg-white px-3 py-3 shadow-lg">
            <p className="text-sm text-sand-500">No kids found</p>
          </div>
        )}
      </div>

      {/* Checkbox filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <CheckboxFilter
          label="Orphanage"
          options={orphanageOptions.map((o) => ({ value: o.id, label: o.name }))}
          selected={selectedOrphanages}
          onChange={(vals) => router.push(buildUrl({ orphanageId: vals.join(",") }))}
        />
        <CheckboxFilter
          label="Class"
          options={classGroupFilterOptions}
          selected={selectedClassGroups}
          onChange={(vals) => router.push(buildUrl({ classGroupId: vals.join(",") }))}
        />
        <CheckboxFilter
          label="Age"
          options={[
            { value: "5-8", label: "5–8 years" },
            { value: "9-12", label: "9–12 years" },
            { value: "13+", label: "13+ years" },
          ]}
          selected={selectedAgeGroups}
          onChange={(vals) => router.push(buildUrl({ ageGroup: vals.join(",") }))}
        />
        <CheckboxFilter
          label="Status"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          selected={selectedStatuses}
          onChange={(vals) => router.push(buildUrl({ status: vals.join(",") }))}
        />

        {hasFilters && (
          <Link
            href="/admin/kids"
            className="text-xs text-sand-500 hover:text-sand-700 underline"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* Sort pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-sand-500 mr-1">Sort:</span>
        {[
          { label: "Name", value: "" },
          { label: "Age", value: "age" },
          { label: "Total Classes", value: "total_classes" },
          { label: "Recent Classes", value: "recent_classes" },
        ].map((s) => {
          const isActive = sortBy === s.value || (!sortBy && s.value === "");
          return (
            <Link
              key={s.label}
              href={buildUrl({ sortBy: s.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-green-600 text-white"
                  : "bg-sand-100 text-sand-600 hover:bg-sand-200"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
