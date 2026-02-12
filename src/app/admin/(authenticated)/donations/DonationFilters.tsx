"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface DonationFiltersProps {
  currentFilters: {
    frequency?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export default function DonationFilters({
  currentFilters,
}: DonationFiltersProps) {
  const router = useRouter();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams();
      const filters = { ...currentFilters, [key]: value || undefined };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      router.push(`/admin/donations?${params.toString()}`);
    },
    [currentFilters, router]
  );

  const clearFilters = useCallback(() => {
    router.push("/admin/donations");
  }, [router]);

  const hasFilters =
    currentFilters.frequency ||
    currentFilters.status ||
    currentFilters.dateFrom ||
    currentFilters.dateTo;

  return (
    <div className="mb-6 rounded-lg border border-warmgray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-warmgray-500 mb-1">
            Type
          </label>
          <select
            value={currentFilters.frequency || ""}
            onChange={(e) => updateFilter("frequency", e.target.value)}
            className="w-full rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-700"
          >
            <option value="">All types</option>
            <option value="one_time">One-time</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-warmgray-500 mb-1">
            Status
          </label>
          <select
            value={currentFilters.status || ""}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="w-full rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-700"
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-warmgray-500 mb-1">
            From
          </label>
          <input
            type="date"
            value={currentFilters.dateFrom || ""}
            onChange={(e) => updateFilter("dateFrom", e.target.value)}
            className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-warmgray-500 mb-1">
            To
          </label>
          <input
            type="date"
            value={currentFilters.dateTo || ""}
            onChange={(e) => updateFilter("dateTo", e.target.value)}
            className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-700"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
