import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { invoices, classLogs } from "@/db/schema";
import { desc, eq, and, gte, lte, sql } from "drizzle-orm";
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
    // Only count final invoices in stats
    db
      .select({
        totalInvoices: sql<number>`count(*)::int`,
        totalClasses: sql<number>`coalesce(sum(${invoices.totalClasses}), 0)::int`,
        totalAmountIdr: sql<number>`coalesce(sum(${invoices.totalAmountIdr}), 0)::bigint`,
      })
      .from(invoices)
      .where(eq(invoices.status, "final")),
  ]);

  // For displayed invoices, get logged class counts from DB per period
  // Find the overall min/max date range, then query class_logs grouped by month
  const loggedCountsByPeriod: Record<string, number> = {};
  if (rows.length > 0) {
    const minStart = rows.reduce(
      (min, r) => (r.periodStart < min ? r.periodStart : min),
      rows[0].periodStart
    );
    const maxEnd = rows.reduce(
      (max, r) => (r.periodEnd > max ? r.periodEnd : max),
      rows[0].periodEnd
    );

    const loggedRows = await db
      .select({
        month: sql<string>`to_char(${classLogs.classDate}::date, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(classLogs)
      .where(
        and(
          gte(classLogs.classDate, minStart),
          lte(classLogs.classDate, maxEnd)
        )
      )
      .groupBy(sql`to_char(${classLogs.classDate}::date, 'YYYY-MM')`);

    for (const row of loggedRows) {
      loggedCountsByPeriod[row.month] = row.count;
    }
  }

  // Helper: extract YYYY-MM from periodStart
  function getPeriodKey(periodStart: string): string {
    return periodStart.substring(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
  }

  const total = Number(countResult[0]?.count || 0);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const s = stats[0];

  // Also compute total logged for the stats card (across all final invoice periods)
  const totalLoggedForFinal = rows
    .filter((r) => r.status === "final")
    .reduce((sum, r) => sum + (loggedCountsByPeriod[getPeriodKey(r.periodStart)] || 0), 0);

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

      {/* Stats Cards — final invoices only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="rounded-lg border border-sand-200 bg-white p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-sand-500 uppercase tracking-wider">
            Final Invoices
          </p>
          <p className="mt-1 text-base sm:text-xl font-bold text-sand-900">
            {Number(s?.totalInvoices || 0)}
          </p>
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-sand-500 uppercase tracking-wider">
            Classes Logged
          </p>
          <p className="mt-1 text-base sm:text-xl font-bold text-sand-600">
            {totalLoggedForFinal.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-sand-500 uppercase tracking-wider">
            Classes Billed
          </p>
          <p className="mt-1 text-base sm:text-xl font-bold text-sand-900">
            {Number(s?.totalClasses || 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-sand-500 uppercase tracking-wider">
            Total Amount
          </p>
          <p className="mt-1 text-base sm:text-xl font-bold text-sand-900 truncate">
            {formatIdr(Number(s?.totalAmountIdr || 0))}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-sand-200 bg-white p-8 text-center text-sm text-sand-400">
          No invoices generated yet. Click &quot;Generate Invoice&quot; to create one.
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 md:hidden">
            {rows.map((inv) => {
              const logged = loggedCountsByPeriod[getPeriodKey(inv.periodStart)] || 0;
              const mismatch = logged !== inv.totalClasses && inv.totalClasses > 0;
              return (
                <Link
                  key={inv.id}
                  href={`/admin/invoices/${inv.id}`}
                  className="block rounded-lg border border-sand-200 bg-white p-3 hover:bg-sand-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-sand-900">
                          {inv.invoiceNumber}
                        </span>
                        <span
                          className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            inv.status === "final"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-sand-500 mt-0.5">
                        {new Date(inv.periodStart + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "long", year: "numeric" }
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        <span className={mismatch ? "text-amber-600 font-medium" : "text-sand-500"}>
                          Logged: {logged}
                        </span>
                        <span className="text-sand-500">
                          Billed: {inv.totalClasses}
                        </span>
                        {mismatch && (
                          <span className="text-amber-500 text-[10px]">
                            &#9888;
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-sand-900">
                        {formatIdr(inv.totalAmountIdr)}
                      </span>
                      <svg className="w-4 h-4 text-sand-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table layout */}
          <div className="hidden md:block rounded-lg border border-sand-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-sand-100">
              <h2 className="text-sm font-semibold text-sand-900">
                All Invoices{" "}
                <span className="text-sand-400 font-normal">({total})</span>
              </h2>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-sand-50 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2 text-right">Logged</th>
                  <th className="px-4 py-2 text-right">Billed</th>
                  <th className="px-4 py-2 text-right">Amount (IDR)</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((inv) => {
                  const logged = loggedCountsByPeriod[getPeriodKey(inv.periodStart)] || 0;
                  const mismatch = logged !== inv.totalClasses && inv.totalClasses > 0;
                  return (
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
                      <td className="px-4 py-2 text-right">
                        <span
                          className={
                            logged === 0
                              ? "text-sand-400"
                              : mismatch
                                ? "font-medium text-amber-700"
                                : "text-sand-700"
                          }
                        >
                          {logged}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right ${
                        mismatch
                          ? "font-medium text-amber-700"
                          : "text-sand-700"
                      }`}>
                        {inv.totalClasses.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-sand-900">
                        {formatIdr(inv.totalAmountIdr)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            inv.status === "final"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
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
                            PDF &darr;
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-sand-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/invoices?page=${page - 1}`}
                className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-medium text-sand-600 hover:bg-sand-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/invoices?page=${page + 1}`}
                className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-medium text-sand-600 hover:bg-sand-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
