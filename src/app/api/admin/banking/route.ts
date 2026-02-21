import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { bankAccounts, bankTransactions, invoices, siteSettings } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { withLogging } from "@/lib/with-logging";

async function getHandler(req: NextRequest) {
  const [, authError] = await withAuth("banking:view");
  if (authError) return authError;

  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
  const offset = (page - 1) * limit;

  // Fetch all bank accounts
  const accounts = await db
    .select()
    .from(bankAccounts)
    .orderBy(bankAccounts.provider, bankAccounts.currency);

  // Fetch exchange rate from siteSettings
  const [rateRow] = await db
    .select()
    .from(siteSettings)
    .where(sql`${siteSettings.key} = 'usd_idr_rate'`)
    .limit(1);

  const [rateUpdatedRow] = await db
    .select()
    .from(siteSettings)
    .where(sql`${siteSettings.key} = 'exchange_rate_updated_at'`)
    .limit(1);

  const usdIdrRate = rateRow ? parseFloat(rateRow.value) : null;
  const exchangeRateUpdatedAt = rateUpdatedRow?.value || null;

  // Calculate combined balance in USD cents
  let combinedBalanceUsdCents = 0;
  for (const acct of accounts) {
    if (acct.currency === "usd") {
      combinedBalanceUsdCents += acct.balanceCents;
    } else if (acct.currency === "idr" && usdIdrRate) {
      combinedBalanceUsdCents += Math.round(acct.balanceCents / usdIdrRate);
    }
    // Other currencies: skip for now (or add more conversion logic)
  }

  // Fetch paginated transactions (all accounts, merged by date desc)
  const txns = await db
    .select({
      id: bankTransactions.id,
      bankAccountId: bankTransactions.bankAccountId,
      externalId: bankTransactions.externalId,
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
    .leftJoin(bankAccounts, sql`${bankTransactions.bankAccountId} = ${bankAccounts.id}`)
    .orderBy(desc(bankTransactions.date), desc(bankTransactions.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bankTransactions);

  const total = Number(countResult?.count || 0);

  // Runway calculation: use recent invoices as burn rate
  const recentInvoices = await db
    .select({
      totalAmountIdr: invoices.totalAmountIdr,
      periodStart: invoices.periodStart,
    })
    .from(invoices)
    .orderBy(desc(invoices.periodStart))
    .limit(3);

  let runwayLastMonth: number | null = null;
  let runwayThreeMonth: number | null = null;
  let lastMonthInvoiceIdr: number | null = null;
  let threeMonthAverageIdr: number | null = null;

  if (recentInvoices.length > 0 && usdIdrRate) {
    // Last month's invoice
    lastMonthInvoiceIdr = recentInvoices[0].totalAmountIdr;
    if (lastMonthInvoiceIdr > 0) {
      const balanceIdr = combinedBalanceUsdCents * usdIdrRate / 100;
      runwayLastMonth = Math.round((balanceIdr / lastMonthInvoiceIdr) * 10) / 10;
    }

    // Average of up to 3 months
    const totalIdr = recentInvoices.reduce((sum, inv) => sum + inv.totalAmountIdr, 0);
    threeMonthAverageIdr = Math.round(totalIdr / recentInvoices.length);
    if (threeMonthAverageIdr > 0) {
      const balanceIdr = combinedBalanceUsdCents * usdIdrRate / 100;
      runwayThreeMonth = Math.round((balanceIdr / threeMonthAverageIdr) * 10) / 10;
    }
  }

  return NextResponse.json({
    accounts,
    combinedBalanceUsdCents,
    exchangeRate: {
      usdIdr: usdIdrRate,
      updatedAt: exchangeRateUpdatedAt,
    },
    transactions: txns,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    runway: {
      lastMonthInvoiceIdr,
      threeMonthAverageIdr,
      runwayLastMonth,
      runwayThreeMonth,
    },
  });
}

export const GET = withLogging(getHandler, { source: "banking" });
