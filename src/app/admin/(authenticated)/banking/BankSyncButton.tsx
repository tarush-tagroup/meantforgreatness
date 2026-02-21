"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BankSyncButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/banking/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Sync failed");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to sync bank data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="rounded-lg border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700 transition-colors hover:bg-sand-50 disabled:opacity-50"
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <svg
            className="h-3 w-3 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Syncing…
        </span>
      ) : (
        "↻ Refresh"
      )}
    </button>
  );
}
