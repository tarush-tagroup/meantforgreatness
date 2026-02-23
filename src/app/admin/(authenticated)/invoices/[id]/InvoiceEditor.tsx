"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LineItem {
  id: string;
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
}: {
  invoice: Invoice;
  lineItems: LineItem[];
  miscItems: MiscItem[];
}) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [lineItems, setLineItems] = useState(initialLineItems);
  const [miscItems, setMiscItems] = useState(initialMiscItems);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editing line items
  const [editingLineItems, setEditingLineItems] = useState<Record<string, number>>({});

  // New misc item form
  const [showMiscForm, setShowMiscForm] = useState(false);
  const [miscDescription, setMiscDescription] = useState("");
  const [miscQuantity, setMiscQuantity] = useState(1);
  const [miscRate, setMiscRate] = useState(0);

  const periodLabel = new Date(
    invoice.periodStart + "T00:00:00"
  ).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  async function handleSaveLineItems() {
    const updates = Object.entries(editingLineItems).map(([id, classCount]) => ({
      id,
      classCount,
    }));

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

      // Refresh data
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
      const res = await fetch(`/api/admin/invoices/${invoice.id}/misc-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: miscDescription.trim(),
          quantity: miscQuantity,
          rateIdr: miscRate,
        }),
      });

      if (!res.ok) {
        alert("Failed to add item");
        return;
      }

      setMiscDescription("");
      setMiscQuantity(1);
      setMiscRate(0);
      setShowMiscForm(false);
      await refreshData();
    } catch {
      alert("Failed to add item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMiscItem(itemId: string) {
    if (!confirm("Delete this item?")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/misc-items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

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
    }
  }

  const hasUnsavedLineItems = Object.keys(editingLineItems).length > 0;
  const classesTotal = lineItems.reduce((s, li) => s + li.subtotalIdr, 0);
  const miscTotal = miscItems.reduce((s, mi) => s + mi.subtotalIdr, 0);

  return (
    <div>
      {/* Back + Header */}
      <div className="mb-6">
        <a
          href="/admin/invoices"
          className="text-xs font-medium text-sage-600 hover:text-sage-800"
        >
          &larr; Back to Invoices
        </a>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-sand-900">
              {invoice.invoiceNumber}
            </h1>
            <p className="mt-1 text-sm text-sand-500">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
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
              {invoice.status === "draft" ? "Mark as Final" : "Revert to Draft"}
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

      {/* Line Items Table */}
      <div className="rounded-lg border border-sand-200 bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-sand-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sand-900">
            Class Line Items{" "}
            <span className="text-sand-400 font-normal">
              ({lineItems.length})
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

        {lineItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-sand-400">
            No classes recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-sand-50 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Orphanage</th>
                  <th className="px-4 py-2 text-right">Classes</th>
                  <th className="px-4 py-2 text-right">Rate (IDR)</th>
                  <th className="px-4 py-2 text-right">Subtotal (IDR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {lineItems.map((item, index) => {
                  const editedCount = editingLineItems[item.id];
                  const currentCount =
                    editedCount !== undefined ? editedCount : item.classCount;
                  const currentSubtotal =
                    currentCount * item.ratePerClassIdr;

                  return (
                    <tr key={item.id} className="hover:bg-sand-50">
                      <td className="px-4 py-2 text-sand-500">{index + 1}</td>
                      <td className="px-4 py-2 font-medium text-sand-900">
                        {item.orphanageName}
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
                              [item.id]: val,
                            }));
                          }}
                          className="w-20 rounded border border-sand-200 px-2 py-1 text-right text-sm text-sand-700 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
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
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-sand-900">
                    Classes Subtotal
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-sand-900">
                    {lineItems.reduce(
                      (s, li) =>
                        s +
                        (editingLineItems[li.id] !== undefined
                          ? editingLineItems[li.id]
                          : li.classCount),
                      0
                    )}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-bold text-sand-900">
                    IDR{" "}
                    {formatIdr(
                      lineItems.reduce((s, li) => {
                        const count =
                          editingLineItems[li.id] !== undefined
                            ? editingLineItems[li.id]
                            : li.classCount;
                        return s + count * li.ratePerClassIdr;
                      }, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
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
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAddMiscItem}
                disabled={saving || !miscDescription.trim() || miscRate <= 0}
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
            No additional items. Click &quot;+ Add Item&quot; to add credits, fees, or other charges.
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
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {miscItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-sand-50">
                    <td className="px-4 py-2 text-sand-500">{index + 1}</td>
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
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-sand-900">
                    Additional Items Subtotal
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-sand-900">
                    IDR {formatIdr(miscTotal)}
                  </td>
                  <td />
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
              {invoice.totalClasses} classes + {miscItems.length} additional item{miscItems.length !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-2xl font-bold text-green-900">
            IDR {formatIdr(invoice.totalAmountIdr)}
          </p>
        </div>
      </div>
    </div>
  );
}
