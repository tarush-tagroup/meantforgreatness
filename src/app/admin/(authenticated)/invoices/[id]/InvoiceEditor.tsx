"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface LineItem {
  id: string;
  orphanageId: string;
  orphanageName: string;
  classCount: number;
  ratePerClassIdr: number;
  subtotalIdr: number;
}

interface MiscItem {
  id: string;
  description: string;
  quantity: number;
  rateIdr: number;
  subtotalIdr: number;
  receiptUrl: string | null;
}

interface Orphanage {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  fromEntity: string;
  toEntity: string;
  totalClasses: number;
  totalAmountIdr: number;
  miscTotalIdr: number;
  ratePerClassIdr: number;
  status: string;
  generatedAt: string;
}

function formatIdr(amount: number): string {
  return amount.toLocaleString("id-ID");
}

export default function InvoiceEditor({
  invoice: initialInvoice,
  lineItems: initialLineItems,
  miscItems: initialMiscItems,
  allOrphanages,
  loggedCounts: initialLoggedCounts,
}: {
  invoice: Invoice;
  lineItems: LineItem[];
  miscItems: MiscItem[];
  allOrphanages: Orphanage[];
  loggedCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [lineItems, setLineItems] = useState(initialLineItems);
  const [miscItems, setMiscItems] = useState(initialMiscItems);
  const [orphanages] = useState(allOrphanages);
  const [loggedCounts, setLoggedCounts] = useState(initialLoggedCounts);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editing line items — keyed by lineItem.id for existing, or orphanageId for new
  const [editingLineItems, setEditingLineItems] = useState<
    Record<string, number>
  >({});

  // New misc item form
  const [showMiscForm, setShowMiscForm] = useState(false);
  const [miscDescription, setMiscDescription] = useState("");
  const [miscQuantity, setMiscQuantity] = useState(1);
  const [miscRate, setMiscRate] = useState(0);
  const [miscReceiptFile, setMiscReceiptFile] = useState<File | null>(null);
  const miscReceiptInputRef = useRef<HTMLInputElement>(null);

  // Receipt upload for existing items
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);

  // Receipt viewer
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const periodLabel = new Date(
    invoice.periodStart + "T00:00:00"
  ).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Build a merged list: all orphanages, with existing line items merged in
  const mergedLineItems = orphanages.map((orp) => {
    const existing = lineItems.find((li) => li.orphanageId === orp.id);
    if (existing) {
      return { ...existing, isNew: false as const };
    }
    return {
      id: `new-${orp.id}`,
      orphanageId: orp.id,
      orphanageName: orp.name,
      classCount: 0,
      ratePerClassIdr: invoice.ratePerClassIdr,
      subtotalIdr: 0,
      isNew: true as const,
    };
  });

  async function handleSaveLineItems() {
    const updates = Object.entries(editingLineItems)
      .map(([key, classCount]) => {
        const merged = mergedLineItems.find(
          (m) => m.id === key || `new-${m.orphanageId}` === key
        );
        if (!merged) return null;

        if (merged.isNew) {
          return {
            orphanageId: merged.orphanageId,
            orphanageName: merged.orphanageName,
            classCount,
          };
        }
        return { id: merged.id, classCount };
      })
      .filter(Boolean);

    if (updates.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems: updates }),
      });

      if (!res.ok) {
        alert("Failed to save changes");
        return;
      }

      setEditingLineItems({});
      await refreshData();
    } catch {
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    const newStatus = invoice.status === "draft" ? "final" : "draft";
    const confirmMsg =
      newStatus === "final"
        ? "Mark this invoice as final? It will be included in banking calculations."
        : "Revert this invoice to draft? It will be excluded from banking calculations.";

    if (!confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        alert("Failed to update status");
        return;
      }

      await refreshData();
    } catch {
      alert("Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Failed to delete invoice");
        return;
      }

      router.push("/admin/invoices");
      router.refresh();
    } catch {
      alert("Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddMiscItem() {
    if (!miscDescription.trim() || miscRate <= 0) return;

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("description", miscDescription.trim());
      formData.append("quantity", String(miscQuantity));
      formData.append("rateIdr", String(miscRate));
      if (miscReceiptFile) {
        formData.append("receipt", miscReceiptFile);
      }

      const res = await fetch(
        `/api/admin/invoices/${invoice.id}/misc-items`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        alert("Failed to add item");
        return;
      }

      setMiscDescription("");
      setMiscQuantity(1);
      setMiscRate(0);
      setMiscReceiptFile(null);
      if (miscReceiptInputRef.current) {
        miscReceiptInputRef.current.value = "";
      }
      setShowMiscForm(false);
      await refreshData();
    } catch {
      alert("Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadReceipt(itemId: string, file: File) {
    setUploadingReceipt(itemId);
    try {
      const formData = new FormData();
      formData.append("itemId", itemId);
      formData.append("receipt", file);

      const res = await fetch(
        `/api/admin/invoices/${invoice.id}/misc-items`,
        {
          method: "PATCH",
          body: formData,
        }
      );

      if (!res.ok) {
        alert("Failed to upload receipt");
        return;
      }

      await refreshData();
    } catch {
      alert("Failed to upload receipt");
    } finally {
      setUploadingReceipt(null);
    }
  }

  async function handleDeleteMiscItem(itemId: string) {
    if (!confirm("Delete this item?")) return;

    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/invoices/${invoice.id}/misc-items`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId }),
        }
      );

      if (!res.ok) {
        alert("Failed to delete item");
        return;
      }

      await refreshData();
    } catch {
      alert("Failed to delete item");
    } finally {
      setSaving(false);
    }
  }

  async function refreshData() {
    const res = await fetch(`/api/admin/invoices/${invoice.id}`);
    if (res.ok) {
      const data = await res.json();
      setInvoice(data.invoice);
      setLineItems(data.lineItems);
      setMiscItems(data.miscItems);
      if (data.loggedCounts) setLoggedCounts(data.loggedCounts);
    }
  }

  const hasUnsavedLineItems = Object.keys(editingLineItems).length > 0;
  const miscTotal = miscItems.reduce((s, mi) => s + mi.subtotalIdr, 0);

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <Link
          href="/admin/invoices"
          className="text-xs font-medium text-sage-600 hover:text-sage-800"
        >
          &larr; Back to Invoices
        </Link>
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-sand-900">
              {invoice.invoiceNumber}
            </h1>
            <p className="mt-1 text-sm text-sand-500">{periodLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                invoice.status === "final"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {invoice.status}
            </span>
            <button
              onClick={handleToggleStatus}
              disabled={saving}
              className={`rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                invoice.status === "draft"
                  ? "bg-green-700 hover:bg-green-800"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {invoice.status === "draft"
                ? "Mark as Final"
                : "Revert to Draft"}
            </button>
            <a
              href={`/api/admin/invoices/${invoice.id}/pdf`}
              className="rounded-lg border border-green-700 px-4 py-2 text-xs font-medium text-green-700 transition-colors hover:bg-green-50"
            >
              Download PDF
            </a>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg border border-red-300 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="rounded-lg border border-sand-200 bg-white p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              From
            </p>
            <p className="mt-1 text-sm font-semibold text-sand-900">
              {invoice.fromEntity}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              To
            </p>
            <p className="mt-1 text-sm font-semibold text-sand-900">
              {invoice.toEntity}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Period
            </p>
            <p className="mt-1 text-sm text-sand-700">{periodLabel}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Generated
            </p>
            <p className="mt-1 text-sm text-sand-700">
              {new Date(invoice.generatedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Rate per Class
            </p>
            <p className="mt-1 text-sm text-sand-700">
              IDR {formatIdr(invoice.ratePerClassIdr)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
              Total Classes
            </p>
            <p className="mt-1 text-sm font-semibold text-sand-900">
              {invoice.totalClasses}
            </p>
          </div>
        </div>
      </div>

      {/* Line Items Table — shows ALL orphanages */}
      <div className="rounded-lg border border-sand-200 bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-sand-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sand-900">
            Class Line Items{" "}
            <span className="text-sand-400 font-normal">
              ({orphanages.length} orphanages)
            </span>
          </h2>
          {hasUnsavedLineItems && (
            <button
              onClick={handleSaveLineItems}
              disabled={saving}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-sand-50 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Orphanage</th>
                <th className="px-4 py-2 text-right">Logged</th>
                <th className="px-4 py-2 text-right">Billed</th>
                <th className="px-4 py-2 text-right">Rate (IDR)</th>
                <th className="px-4 py-2 text-right">Subtotal (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {mergedLineItems.map((item, index) => {
                const editKey = item.isNew
                  ? `new-${item.orphanageId}`
                  : item.id;
                const editedCount = editingLineItems[editKey];
                const currentCount =
                  editedCount !== undefined ? editedCount : item.classCount;
                const currentSubtotal =
                  currentCount * item.ratePerClassIdr;

                const loggedCount =
                  loggedCounts[item.orphanageId] || 0;
                const mismatch =
                  loggedCount !== currentCount && currentCount > 0;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-sand-50 ${
                      item.isNew && currentCount === 0
                        ? "opacity-60"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-sand-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2 font-medium text-sand-900">
                      {item.orphanageName}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`inline-block min-w-[2rem] rounded px-1.5 py-0.5 text-center text-sm ${
                          loggedCount === 0
                            ? "text-sand-400"
                            : mismatch
                              ? "bg-amber-50 font-medium text-amber-700"
                              : "text-sand-700"
                        }`}
                        title={
                          mismatch
                            ? `Logged ${loggedCount} but billing ${currentCount}`
                            : undefined
                        }
                      >
                        {loggedCount}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={currentCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditingLineItems((prev) => ({
                            ...prev,
                            [editKey]: val,
                          }));
                        }}
                        className={`w-20 rounded border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 ${
                          mismatch
                            ? "border-amber-300 text-amber-700 focus:border-amber-500 focus:ring-amber-500"
                            : "border-sand-200 text-sand-700 focus:border-green-500 focus:ring-green-500"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-sand-600">
                      {formatIdr(item.ratePerClassIdr)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-sand-900">
                      {formatIdr(currentSubtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-sand-200 bg-sand-50">
                <td
                  colSpan={2}
                  className="px-4 py-3 text-sm font-bold text-sand-900"
                >
                  Classes Subtotal
                </td>
                <td className="px-4 py-3 text-right font-bold text-sand-600">
                  {Object.values(loggedCounts).reduce(
                    (s, c) => s + c,
                    0
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold text-sand-900">
                  {mergedLineItems.reduce((s, li) => {
                    const editKey = li.isNew
                      ? `new-${li.orphanageId}`
                      : li.id;
                    const count =
                      editingLineItems[editKey] !== undefined
                        ? editingLineItems[editKey]
                        : li.classCount;
                    return s + count;
                  }, 0)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right font-bold text-sand-900">
                  IDR{" "}
                  {formatIdr(
                    mergedLineItems.reduce((s, li) => {
                      const editKey = li.isNew
                        ? `new-${li.orphanageId}`
                        : li.id;
                      const count =
                        editingLineItems[editKey] !== undefined
                          ? editingLineItems[editKey]
                          : li.classCount;
                      return s + count * li.ratePerClassIdr;
                    }, 0)
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Misc Items */}
      <div className="rounded-lg border border-sand-200 bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-sand-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sand-900">
            Additional Items{" "}
            <span className="text-sand-400 font-normal">
              ({miscItems.length})
            </span>
          </h2>
          <button
            onClick={() => setShowMiscForm(!showMiscForm)}
            className="rounded-lg border border-green-700 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
          >
            + Add Item
          </button>
        </div>

        {showMiscForm && (
          <div className="p-4 border-b border-sand-100 bg-sand-50">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-sand-600 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={miscDescription}
                  onChange={(e) => setMiscDescription(e.target.value)}
                  placeholder="e.g. Chicken meat for orphanage"
                  className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-sand-600 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={miscQuantity}
                  onChange={(e) =>
                    setMiscQuantity(parseInt(e.target.value) || 1)
                  }
                  className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-sand-600 mb-1">
                  Rate (IDR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={miscRate}
                  onChange={(e) =>
                    setMiscRate(parseInt(e.target.value) || 0)
                  }
                  className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Receipt upload */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-sand-600 mb-1">
                Receipt{" "}
                <span className="text-sand-400 font-normal">(optional)</span>
              </label>
              <input
                ref={miscReceiptInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  setMiscReceiptFile(e.target.files?.[0] || null)
                }
                className="w-full text-sm text-sand-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sand-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sand-700 hover:file:bg-sand-200"
              />
              {miscReceiptFile && (
                <p className="mt-1 text-xs text-sand-500">
                  {miscReceiptFile.name} (
                  {(miscReceiptFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAddMiscItem}
                disabled={
                  saving || !miscDescription.trim() || miscRate <= 0
                }
                className="rounded-lg bg-green-700 px-4 py-2 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
              >
                {saving ? "Adding..." : "Add Item"}
              </button>
              <button
                onClick={() => {
                  setShowMiscForm(false);
                  setMiscDescription("");
                  setMiscQuantity(1);
                  setMiscRate(0);
                  setMiscReceiptFile(null);
                  if (miscReceiptInputRef.current) {
                    miscReceiptInputRef.current.value = "";
                  }
                }}
                className="rounded-lg border border-sand-200 px-4 py-2 text-xs font-medium text-sand-600 hover:bg-sand-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {miscItems.length === 0 && !showMiscForm ? (
          <div className="p-8 text-center text-sm text-sand-400">
            No additional items. Click &quot;+ Add Item&quot; to add
            credits, fees, or other charges.
          </div>
        ) : miscItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-sand-50 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Rate (IDR)</th>
                  <th className="px-4 py-2 text-right">Subtotal (IDR)</th>
                  <th className="px-4 py-2 text-center">Receipt</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {miscItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-sand-50">
                    <td className="px-4 py-2 text-sand-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-2 font-medium text-sand-900">
                      {item.description}
                    </td>
                    <td className="px-4 py-2 text-right text-sand-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-2 text-right text-sand-600">
                      {formatIdr(item.rateIdr)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-sand-900">
                      {formatIdr(item.subtotalIdr)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {item.receiptUrl ? (
                        <button
                          onClick={() => setViewingReceipt(item.receiptUrl)}
                          className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          View
                        </button>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-sand-200 px-2 py-1 text-xs font-medium text-sand-500 hover:bg-sand-50">
                          {uploadingReceipt === item.id ? (
                            "Uploading..."
                          ) : (
                            <>
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                />
                              </svg>
                              Upload
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            disabled={uploadingReceipt === item.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadReceipt(item.id, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeleteMiscItem(item.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-sand-200 bg-sand-50">
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-sm font-bold text-sand-900"
                  >
                    Additional Items Subtotal
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-sand-900">
                    IDR {formatIdr(miscTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>

      {/* Grand Total */}
      <div className="rounded-lg border-2 border-green-200 bg-green-50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-green-900">INVOICE TOTAL</p>
            <p className="text-xs text-green-700 mt-1">
              {invoice.totalClasses} classes + {miscItems.length} additional
              item{miscItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-2xl font-bold text-green-900">
            IDR {formatIdr(invoice.totalAmountIdr)}
          </p>
        </div>
      </div>

      {/* Receipt Viewer Modal */}
      {viewingReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setViewingReceipt(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-auto rounded-xl bg-white p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewingReceipt(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-sand-600 shadow hover:text-sand-900"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            {viewingReceipt.match(/\.pdf$/i) ? (
              <iframe
                src={viewingReceipt}
                className="h-[80vh] w-full min-w-[300px] rounded-lg"
                title="Receipt PDF"
              />
            ) : (
              <Image
                src={viewingReceipt}
                alt="Receipt"
                width={800}
                height={600}
                className="max-h-[85vh] w-auto rounded-lg object-contain"
                unoptimized
              />
            )}
            <div className="mt-2 flex justify-center">
              <a
                href={viewingReceipt}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-sand-200 px-4 py-2 text-xs font-medium text-sand-600 hover:bg-sand-50"
              >
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
