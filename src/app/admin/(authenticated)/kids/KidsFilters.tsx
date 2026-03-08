"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import Link from "next/link";

interface KidsFiltersProps {
  orphanageOptions: { id: string; name: string }[];
  classGroupOptions: {
    id: string;
    name: string;
    orphanageId: string;
    orphanageName: string | null;
  }[];
}

export default function KidsFilters({
  orphanageOptions,
  classGroupOptions,
}: KidsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orphanageId = searchParams.get("orphanageId") || "";
  const classGroupId = searchParams.get("classGroupId") || "";
  const ageGroup = searchParams.get("ageGroup") || "";

  const hasFilters = !!(orphanageId || ageGroup || classGroupId);

  const buildUrl = useCallback(
    (overrides: Record<string, string>) => {
      const p = new URLSearchParams();
      const merged = {
        orphanageId,
        ageGroup,
        classGroupId,
        ...overrides,
      };
      if (merged.orphanageId) p.set("orphanageId", merged.orphanageId);
      if (merged.ageGroup) p.set("ageGroup", merged.ageGroup);
      if (merged.classGroupId) p.set("classGroupId", merged.classGroupId);
      const qs = p.toString();
      return `/admin/kids${qs ? `?${qs}` : ""}`;
    },
    [orphanageId, ageGroup, classGroupId]
  );

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div>
        <select
          value={orphanageId}
          onChange={(e) => router.push(buildUrl({ orphanageId: e.target.value }))}
          className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="">All Orphanages</option>
          {orphanageOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <select
          value={classGroupId}
          onChange={(e) => router.push(buildUrl({ classGroupId: e.target.value }))}
          className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="">All Classes</option>
          {orphanageOptions.map((o) => {
            const groupsForOrphanage = classGroupOptions.filter(
              (g) => g.orphanageId === o.id
            );
            if (groupsForOrphanage.length === 0) return null;
            return (
              <optgroup key={o.id} label={o.name}>
                {groupsForOrphanage.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {/* Age group pills */}
      <div className="flex items-center gap-1">
        {[
          { label: "All Ages", value: "" },
          { label: "5-8", value: "5-8" },
          { label: "9-12", value: "9-12" },
          { label: "13+", value: "13+" },
        ].map((ag) => {
          const isActive = ageGroup === ag.value;
          return (
            <Link
              key={ag.label}
              href={buildUrl({ ageGroup: ag.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-green-600 text-white"
                  : "bg-sand-100 text-sand-600 hover:bg-sand-200"
              }`}
            >
              {ag.label}
            </Link>
          );
        })}
      </div>

      {hasFilters && (
        <Link
          href="/admin/kids"
          className="text-xs text-sand-500 hover:text-sand-700 underline"
        >
          Clear filters
        </Link>
      )}
    </div>
  );
}
