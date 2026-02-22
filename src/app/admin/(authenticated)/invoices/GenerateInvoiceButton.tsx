"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateInvoiceButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    if (
      !confirm(
        "Generate an invoice for the previous month? This will calculate class counts from all orphanages."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

      router.refresh();
    } catch {
      alert("Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="rounded-lg bg-green-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-50"
    >
      {loading ? "Generating…" : "+ Generate Invoice"}
    </button>
  );
}
