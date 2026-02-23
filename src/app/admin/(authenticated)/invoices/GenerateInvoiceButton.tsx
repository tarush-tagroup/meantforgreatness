"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function getMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];

  // Show current month and last 12 months
  for (let i = 0; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    options.push({ value, label });
  }

  return options;
}

export default function GenerateInvoiceButton() {
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const router = useRouter();
  const monthOptions = getMonthOptions();

  async function handleGenerate() {
    if (!selectedMonth) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });

      const data = await res.json();

      if (res.status === 409) {
        alert(data.error || "Invoice for that period already exists.");
        return;
      }

      if (!res.ok) {
        alert(data.error || "Failed to generate invoice");
        return;
      }

      setShowPicker(false);
      setSelectedMonth("");
      router.refresh();
    } catch {
      alert("Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="rounded-lg bg-green-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-green-800"
      >
        + Generate Invoice
      </button>

      {showPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border border-sand-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-sand-900 mb-3">
              Select Invoice Month
            </p>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-700 mb-3 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">Choose a month...</option>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPicker(false);
                  setSelectedMonth("");
                }}
                className="flex-1 rounded-lg border border-sand-200 px-3 py-2 text-xs font-medium text-sand-600 hover:bg-sand-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedMonth}
                className="flex-1 rounded-lg bg-green-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
            <p className="text-xs text-sand-400 mt-2">
              Invoice will be created as a draft. You can edit and finalize it later.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
