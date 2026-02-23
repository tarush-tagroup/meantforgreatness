import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { bankAccounts, bankTransactions, invoices, siteSettings } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import BankSyncButton from "./BankSyncButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  if (currency === "idr") {
    return `IDR ${Math.round(amount).toLocaleString("id-ID")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function BankingPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!hasPermission(user.roles, "banking:view")) redirect("/admin");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const offset = (page - 1) * PAGE_SIZE;

  // Fetch everything in parallel
  const [accounts, rateRow, rateUpdatedRow, txns, txnCount, recentInvoices] =
    await Promise.all([
      db
        .select()
        .from(bankAccounts)
        .orderBy(bankAccounts.provider, bankAccounts.currency),
      db
        .select()
        .from(siteSettings)
        .where(sql`${siteSettings.key} = 'usd_idr_rate'`)
        .limit(1),
      db
        .select()
        .from(siteSettings)
        .where(sql`${siteSettings.key} = 'exchange_rate_updated_at'`)
        .limit(1),
      db
        .select({
          id: bankTransactions.id,
          date: bankTransactions.date,
          description: bankTransactions.description,
          amountCents: bankTransactions.amountCents,
          currency: bankTransactions.currency,
          status: bankTransactions.status,
          counterparty: bankTransactions.counterparty,
          provider: bankAccounts.provider,
          accountName: bankAccounts.name,
        })
        .from(bankTransactions)
        .leftJoin(
          bankAccounts,
          sql`${bankTransactions.bankAccountId} = ${bankAccounts.id}`
        )
        .orderBy(desc(bankTransactions.date), desc(bankTransactions.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(bankTransactions),
      // Only count final invoices for runway calculations
      db
        .select({
          totalAmountIdr: invoices.totalAmountIdr,
        })
        .from(invoices)
        .where(eq(invoices.status, "final"))
        .orderBy(desc(invoices.periodStart))
        .limit(3),
    ]);

  const usdIdrRate = rateRow[0] ? parseFloat(rateRow[0].value) : null;
  const exchangeRateUpdatedAt = rateUpdatedRow[0]?.value || null;
  const total = Number(txnCount[0]?.count || 0);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Combined balance in USD cents
  let combinedUsdCents = 0;
  for (const acct of accounts) {
    if (acct.currency === "usd") {
      combinedUsdCents += acct.balanceCents;
    } else if (acct.currency === "idr" && usdIdrRate) {
      combinedUsdCents += Math.round(acct.balanceCents / usdIdrRate);
    }
  }

  // Last synced time
  const lastSynced = accounts.length > 0
    ? accounts.reduce((latest, acct) => {
        if (!acct.lastSyncedAt) return latest;
        return acct.lastSyncedAt > latest ? acct.lastSyncedAt : latest;
      }, new Date(0))
    : null;

  // Runway calculation
  let runwayLastMonth: number | null = null;
  let runwayThreeMonth: number | null = null;
  let lastMonthIdr: number | null = null;
  let avgIdr: number | null = null;

  if (recentInvoices.length > 0 && usdIdrRate) {
    lastMonthIdr = recentInvoices[0].totalAmountIdr;
    const balanceIdr = (combinedUsdCents / 100) * usdIdrRate;

    if (lastMonthIdr > 0) {
      runwayLastMonth = Math.round((balanceIdr / lastMonthIdr) * 10) / 10;
    }

    const totalIdr = recentInvoices.reduce((s, inv) => s + inv.totalAmountIdr, 0);
    avgIdr = Math.round(totalIdr / recentInvoices.length);
    if (avgIdr > 0) {
      runwayThreeMonth = Math.round((balanceIdr / avgIdr) * 10) / 10;
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">Banking</h1>
          <p className="mt-1 text-sm text-sand-500">
            Bank balances, transactions, and runway estimate.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSynced && lastSynced.getTime() > 0 && (
            <span className="text-xs text-sand-400">
              Last synced:{" "}
              {lastSynced.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <BankSyncButton />
        </div>
      </div>

      {/* Balance Cards */}
      {accounts.length === 0 ? (
        <div className="rounded-lg border border-sand-200 bg-white p-8 text-center">
          <p className="text-sm text-sand-500">
            No bank accounts synced yet. Add your Mercury and Wise API tokens to
            Vercel environment variables, then click Refresh.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {accounts.map((acct) => (
              <div
                key={acct.id}
                className="rounded-lg border border-sand-200 bg-white p-4"
              >
                <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
                  {acct.provider === "mercury" ? "Mercury" : "Wise"} ({acct.currency.toUpperCase()})
                </p>
                <p className="mt-1 text-xl font-bold text-sand-900">
                  {formatCurrency(acct.balanceCents, acct.currency)}
                </p>
                <p className="text-xs text-sand-400 mt-1">{acct.name}</p>
              </div>
            ))}

            {/* Combined */}
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <p className="text-xs font-medium text-green-700 uppercase tracking-wider">
                Combined (USD)
              </p>
              <p className="mt-1 text-xl font-bold text-green-900">
                {formatCurrency(combinedUsdCents, "usd")}
              </p>
            </div>
          </div>

          {/* Exchange Rate */}
          {usdIdrRate && (
            <div className="rounded-lg border border-sand-200 bg-white p-4 mb-6 inline-block">
              <span className="text-sm text-sand-600">
                1 USD = <span className="font-semibold text-sand-900">{Math.round(usdIdrRate).toLocaleString("id-ID")}</span> IDR
              </span>
              {exchangeRateUpdatedAt && (
                <span className="text-xs text-sand-400 ml-3">
                  Updated:{" "}
                  {new Date(exchangeRateUpdatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}

          {/* Runway */}
          {(runwayLastMonth !== null || runwayThreeMonth !== null) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {runwayLastMonth !== null && (
                <div className="rounded-lg border border-sage-200 bg-sage-50 p-4">
                  <p className="text-xs font-medium text-sage-600 uppercase tracking-wider">
                    Runway (last month&apos;s burn)
                  </p>
                  <p className="mt-1 text-2xl font-bold text-sage-900">
                    {runwayLastMonth} months
                  </p>
                  <p className="text-xs text-sage-500 mt-1">
                    Based on IDR {lastMonthIdr?.toLocaleString("id-ID")}/month
                  </p>
                </div>
              )}
              {runwayThreeMonth !== null && (
                <div className="rounded-lg border border-sage-200 bg-sage-50 p-4">
                  <p className="text-xs font-medium text-sage-600 uppercase tracking-wider">
                    Runway (3-month avg)
                  </p>
                  <p className="mt-1 text-2xl font-bold text-sage-900">
                    {runwayThreeMonth} months
                  </p>
                  <p className="text-xs text-sage-500 mt-1">
                    Based on IDR {avgIdr?.toLocaleString("id-ID")}/month avg
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Transactions Table */}
      <div className="rounded-lg border border-sand-200 bg-white overflow-hidden mt-6">
        <div className="px-4 py-3 border-b border-sand-100">
          <h2 className="text-sm font-semibold text-sand-900">
            Transactions{" "}
            <span className="text-sand-400 font-normal">({total})</span>
          </h2>
        </div>

        {txns.length === 0 ? (
          <div className="p-8 text-center text-sm text-sand-400">
            No transactions yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-sand-50 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Bank</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Counterparty</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {txns.map((txn) => (
                  <tr key={txn.id} className="hover:bg-sand-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sand-600">
                      {new Date(txn.date + "T00:00:00").toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          txn.provider === "mercury"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {txn.provider === "mercury" ? "Mercury" : "Wise"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sand-700 max-w-[200px] truncate">
                      {txn.description || "—"}
                    </td>
                    <td className="px-4 py-2 text-sand-600 max-w-[150px] truncate">
                      {txn.counterparty || "—"}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium whitespace-nowrap ${
                        txn.amountCents >= 0
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {txn.amountCents >= 0 ? "+" : ""}
                      {formatCurrency(txn.amountCents, txn.currency)}
                    </td>
                    <td className="px-4 py-2 text-sand-500 text-xs">
                      {txn.status}
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
                  href={`/admin/banking?page=${page - 1}`}
                  className="rounded-lg border border-sand-200 px-3 py-1 text-xs font-medium text-sand-600 hover:bg-sand-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/banking?page=${page + 1}`}
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
