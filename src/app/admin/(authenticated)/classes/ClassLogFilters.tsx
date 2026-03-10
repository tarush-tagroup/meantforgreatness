"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import Link from "next/link";
import CheckboxFilter from "@/components/admin/CheckboxFilter";

interface ClassLogFiltersProps {
  orphanages: { id: string; name: string }[];
  teachers: { id: string; name: string | null }[];
}

export default function ClassLogFilters({
  orphanages,
  teachers,
}: ClassLogFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orphanageId = searchParams.get("orphanageId") || "";
  const teacherId = searchParams.get("teacherId") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const sortBy = searchParams.get("sortBy") || "";

  const selectedOrphanages = orphanageId ? orphanageId.split(",") : [];
  const selectedTeachers = teacherId ? teacherId.split(",") : [];

  const hasFilters = !!(orphanageId || teacherId || dateFrom || dateTo);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const p = new URLSearchParams();
      const merged = { orphanageId, teacherId, dateFrom, dateTo, sortBy, ...overrides };
      if (merged.orphanageId) p.set("orphanageId", merged.orphanageId);
      if (merged.teacherId) p.set("teacherId", merged.teacherId);
      if (merged.dateFrom) p.set("dateFrom", merged.dateFrom);
      if (merged.dateTo) p.set("dateTo", merged.dateTo);
      if (merged.sortBy) p.set("sortBy", merged.sortBy);
      const qs = p.toString();
      return `/admin/classes${qs ? `?${qs}` : ""}`;
    },
    [orphanageId, teacherId, dateFrom, dateTo, sortBy]
  );

  return (
    <div className="mb-6 space-y-3">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <CheckboxFilter
          label="Orphanage"
          options={orphanages.map((o) => ({ value: o.id, label: o.name }))}
          selected={selectedOrphanages}
          onChange={(vals) => router.push(buildUrl({ orphanageId: vals.join(",") }))}
        />
        <CheckboxFilter
          label="Teacher"
          options={teachers.map((t) => ({ value: t.id, label: t.name || t.id }))}
          selected={selectedTeachers}
          onChange={(vals) => router.push(buildUrl({ teacherId: vals.join(",") }))}
        />

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-sand-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => router.push(buildUrl({ dateFrom: e.target.value }))}
            className="rounded-lg border border-sand-300 px-2 py-1.5 text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-sand-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => router.push(buildUrl({ dateTo: e.target.value }))}
            className="rounded-lg border border-sand-300 px-2 py-1.5 text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        {hasFilters && (
          <Link
            href={buildUrl({ orphanageId: "", teacherId: "", dateFrom: "", dateTo: "" })}
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
          { label: "Most Recent", value: "" },
          { label: "Students", value: "students" },
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
