"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface ClassLogFiltersProps {
  orphanages: { id: string; name: string }[];
  teachers: { id: string; name: string | null }[];
  currentFilters: {
    orphanageId?: string;
    teacherId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export default function ClassLogFilters({
  orphanages,
  teachers,
  currentFilters,
}: ClassLogFiltersProps) {
  const router = useRouter();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams();
      const filters = { ...currentFilters, [key]: value || undefined };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      // Reset to page 1 when filters change
      router.push(`/admin/classes?${params.toString()}`);
    },
    [currentFilters, router]
  );

  const clearFilters = useCallback(() => {
    router.push("/admin/classes");
  }, [router]);

  const hasFilters =
    currentFilters.orphanageId ||
    currentFilters.teacherId ||
    currentFilters.dateFrom ||
    currentFilters.dateTo;

  return (
    <div className="mb-6 rounded-lg border border-sand-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-sand-500 mb-1">
            Orphanage
          </label>
          <select
            value={currentFilters.orphanageId || ""}
            onChange={(e) => updateFilter("orphanageId", e.target.value)}
            className="w-full rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-700"
          >
            <option value="">All orphanages</option>
            {orphanages.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-sand-500 mb-1">
            Teacher
          </label>
          <select
            value={currentFilters.teacherId || ""}
            onChange={(e) => updateFilter("teacherId", e.target.value)}
            className="w-full rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-700"
          >
            <option value="">All teachers</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-sand-500 mb-1">
            From
          </label>
          <input
            type="date"
            value={currentFilters.dateFrom || ""}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-sand-500 mb-1">
            To
          </label>
          <input
            type="date"
            value={currentFilters.dateTo || ""}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-700"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-600 hover:bg-sand-50"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
