import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import GenerateInvoiceButton from "./GenerateInvoiceButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!hasPermission(user.roles, "invoices:view")) redirect("/admin");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, countResult, stats] = await Promise.all([
    db
      .select()
      .from(invoices)
      .orderBy(desc(invoices.periodStart))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(invoices),
    db
      .select({
        totalInvoices: sql<number>`count(*)::int`,
        totalClasses: sql<number>`coalesce(sum(${invoices.totalClasses}), 0)::int`,
        totalAmountIdr: sql<number>`coalesce(sum(${invoices.totalAmountIdr}), 0)::bigint`,
      })
      .from(invoices),
  ]);

  const total = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const s = stats[0];

  function formatIdr(amount: number): string {
    return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Invoices</h1>
          <p className="mt-1 text-sm text-sand-500">
            Monthly invoices for class sessions across all orphanages.
          </p>
        </div>
        <GenerateInvoiceButton />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
            Total Invoices
          </p>
          <p className="mt-1 text-xl font-bold text-sand-900">
            {Number(s?.totalInvoices || 0)}
          </p>
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
            Total Classes Invoiced
          </p>
          <p className="mt-1 text-xl font-bold text-sand-900">
            {Number(s?.totalClasses || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
            Total Amount
          </p>
          <p className="mt-1 text-xl font-bold text-sand-900">
            {formatIdr(Number(s?.totalAmountIdr || 0))}
          </p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-lg border border-sand-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-sand-100">
          <h2 className="text-sm font-semibold text-sand-900">
            All Invoices{" "}
            <span className="text-sand-400 font-normal">({total})</span>
          </h2>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-sand-400">
            No invoices generated yet. Click &quot;Generate Invoice&quot; to create one
            for the previous month.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-sand-50 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2 text-right">Classes</th>
                  <th className="px-4 py-2 text-right">Amount (IDR)</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-sand-50">
                    <td className="px-4 py-2 font-medium text-sand-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-2 text-sand-600">
                      {new Date(inv.periodStart + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric" }
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-sand-700">
                      {inv.totalClasses.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-sand-900">
                      {formatIdr(inv.totalAmountIdr)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : inv.status === "sent"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-sand-100 text-sand-600"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/invoices/${inv.id}`}
                          className="text-xs font-medium text-sage-600 hover:text-sage-800"
                        >
                          View
                        </Link>
                        <a
                          href={`/api/admin/invoices/${inv.id}/pdf`}
                          className="text-xs font-medium text-green-700 hover:text-green-900"
                        >
                          PDF ↓
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-sand-100">
            <p className="text-xs text-sand-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/invoices?page=${page - 1}`}
                  className="rounded-lg border border-sand-200 px-3 py-1 text-xs font-medium text-sand-600 hover:bg-sand-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/invoices?page=${page + 1}`}
                  className="rounded-lg border border-sand-200 px-3 py-1 text-xs font-medium text-sand-600 hover:bg-sand-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
