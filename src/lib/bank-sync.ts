import { db } from "@/db";
import { bankAccounts, bankTransactions, siteSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ─── Mercury API ────────────────────────────────────────────────────────────

interface MercuryAccount {
  id: string;
  name: string;
  currentBalance: number;
  currency: string;
  status: string;
}

interface MercuryTransaction {
  id: string;
  amount: number;
  counterpartyName: string;
  note: string;
  postedDate: string;
  status: string;
  kind: string;
}

export async function syncMercury(): Promise<number> {
  const token = process.env.MERCURY_API_TOKEN;
  if (!token) {
    logger.warn("bank-sync", "MERCURY_API_TOKEN not set, skipping Mercury sync");
    return 0;
  }

  let itemsProcessed = 0;

  // Fetch accounts
  const accountsRes = await fetch("https://api.mercury.com/api/v1/accounts", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!accountsRes.ok) {
    throw new Error(`Mercury accounts API returned ${accountsRes.status}`);
  }

  const { accounts }: { accounts: MercuryAccount[] } = await accountsRes.json();

  for (const acct of accounts) {
    if (acct.status !== "active") continue;

    // Upsert bank account
    const balanceCents = Math.round(acct.currentBalance * 100);

    await db
      .insert(bankAccounts)
      .values({
        provider: "mercury",
        externalId: acct.id,
        name: acct.name || "Mercury Account",
        currency: (acct.currency || "USD").toLowerCase(),
        balanceCents,
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: bankAccounts.externalId,
        set: {
          name: acct.name || "Mercury Account",
          balanceCents,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    // Get the bank account row
    const [dbAccount] = await db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(
        sql`${bankAccounts.provider} = 'mercury' AND ${bankAccounts.externalId} = ${acct.id}`
      )
      .limit(1);

    if (!dbAccount) continue;

    // Fetch transactions
    const txnRes = await fetch(
      `https://api.mercury.com/api/v1/account/${acct.id}/transactions?limit=500`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!txnRes.ok) {
      logger.warn("bank-sync", `Mercury transactions API returned ${txnRes.status} for account ${acct.id}`);
      continue;
    }

    const { transactions }: { transactions: MercuryTransaction[] } = await txnRes.json();

    for (const txn of transactions) {
      const amountCents = Math.round(txn.amount * 100);

      await db
        .insert(bankTransactions)
        .values({
          bankAccountId: dbAccount.id,
          externalId: `mercury-${txn.id}`,
          date: txn.postedDate || new Date().toISOString().split("T")[0],
          description: txn.note || txn.kind || null,
          amountCents,
          currency: (acct.currency || "USD").toLowerCase(),
          status: txn.status === "sent" || txn.status === "cancelled" ? "posted" : txn.status || "posted",
          counterparty: txn.counterpartyName || null,
        })
        .onConflictDoNothing({ target: bankTransactions.externalId });

      itemsProcessed++;
    }
  }

  return itemsProcessed;
}

// ─── Wise API ───────────────────────────────────────────────────────────────

interface WiseBalance {
  id: number;
  currency: string;
  amount: { value: number; currency: string };
}

interface WiseTransaction {
  referenceNumber: string;
  date: string;
  amount: { value: number; currency: string };
  details: { description: string; type: string };
  totalFees: { value: number; currency: string };
  merchant?: { name: string } | null;
}

export async function syncWise(): Promise<number> {
  const token = process.env.WISE_API_TOKEN;
  const profileId = process.env.WISE_PROFILE_ID;
  if (!token || !profileId) {
    logger.warn("bank-sync", "WISE_API_TOKEN or WISE_PROFILE_ID not set, skipping Wise sync");
    return 0;
  }

  let itemsProcessed = 0;

  // Fetch balances
  const balRes = await fetch(
    `https://api.transferwise.com/v4/profiles/${profileId}/balances?types=STANDARD`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!balRes.ok) {
    throw new Error(`Wise balances API returned ${balRes.status}`);
  }

  const balances: WiseBalance[] = await balRes.json();

  for (const bal of balances) {
    const currency = bal.currency.toLowerCase();
    const balanceCents = Math.round(bal.amount.value * 100);

    // Upsert bank account per currency
    await db
      .insert(bankAccounts)
      .values({
        provider: "wise",
        externalId: `wise-${bal.id}-${currency}`,
        name: `Wise ${bal.currency}`,
        currency,
        balanceCents,
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: bankAccounts.externalId,
        set: {
          balanceCents,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    // Get the bank account row
    const [dbAccount] = await db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(
        sql`${bankAccounts.provider} = 'wise' AND ${bankAccounts.externalId} = ${"wise-" + bal.id + "-" + currency}`
      )
      .limit(1);

    if (!dbAccount) continue;

    // Fetch transactions (last 3 months for initial sync)
    const since = new Date();
    since.setMonth(since.getMonth() - 3);
    const sinceStr = since.toISOString().split("T")[0] + "T00:00:00.000Z";
    const untilStr = new Date().toISOString();

    const txnRes = await fetch(
      `https://api.transferwise.com/v3/profiles/${profileId}/borderless-accounts/${bal.id}/statement.json?currency=${bal.currency}&intervalStart=${sinceStr}&intervalEnd=${untilStr}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!txnRes.ok) {
      logger.warn("bank-sync", `Wise transactions API returned ${txnRes.status} for balance ${bal.id}`);
      continue;
    }

    const statement = await txnRes.json();
    const transactions: WiseTransaction[] = statement.transactions || [];

    for (const txn of transactions) {
      const amountCents = Math.round(txn.amount.value * 100);

      await db
        .insert(bankTransactions)
        .values({
          bankAccountId: dbAccount.id,
          externalId: `wise-${txn.referenceNumber}`,
          date: txn.date?.split("T")[0] || new Date().toISOString().split("T")[0],
          description: txn.details?.description || txn.details?.type || null,
          amountCents,
          currency,
          status: "posted",
          counterparty: txn.merchant?.name || null,
        })
        .onConflictDoNothing({ target: bankTransactions.externalId });

      itemsProcessed++;
    }
  }

  return itemsProcessed;
}

// ─── PayPal API ──────────────────────────────────────────────────────────────

interface PayPalBalanceResponse {
  balances: {
    currency: string;
    total_balance: { currency_code: string; value: string };
    available_balance: { currency_code: string; value: string };
  }[];
}

interface PayPalTransaction {
  transaction_info: {
    transaction_id: string;
    transaction_event_code: string;
    transaction_initiation_date: string;
    transaction_amount: { currency_code: string; value: string };
    fee_amount?: { currency_code: string; value: string };
    transaction_status: string;
    transaction_subject?: string;
    transaction_note?: string;
  };
  payer_info?: {
    payer_name?: { alternate_full_name?: string };
    email_address?: string;
  };
  cart_info?: {
    item_details?: { item_name?: string }[];
  };
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const apiBase =
    process.env.PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Sync PayPal balance and recent transactions.
 * Uses PayPal Reporting API for balance and Transaction Search API for transactions.
 *
 * @param fullSync If true, fetches up to 3 years of transactions (one-time backfill).
 *                 If false (default), fetches last 31 days.
 */
export async function syncPayPal(fullSync = false): Promise<number> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    logger.warn("bank-sync", "PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set, skipping PayPal sync");
    return 0;
  }

  const apiBase =
    process.env.PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  const accessToken = await getPayPalAccessToken();
  let itemsProcessed = 0;

  // ── Fetch balance ──
  const balRes = await fetch(`${apiBase}/v1/reporting/balances?as_of_time=${new Date().toISOString()}&currency_code=USD`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });

  let balanceCents = 0;
  if (balRes.ok) {
    const balData: PayPalBalanceResponse = await balRes.json();
    const usdBalance = balData.balances?.find((b) => b.currency === "USD");
    if (usdBalance) {
      balanceCents = Math.round(parseFloat(usdBalance.available_balance.value) * 100);
    }
  } else {
    logger.warn("bank-sync", `PayPal balance API returned ${balRes.status}`);
  }

  // Upsert bank account
  await db
    .insert(bankAccounts)
    .values({
      provider: "paypal",
      externalId: "paypal-usd",
      name: "PayPal USD",
      currency: "usd",
      balanceCents,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: bankAccounts.externalId,
      set: {
        balanceCents,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  // Get the bank account row
  const [dbAccount] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(
      sql`${bankAccounts.provider} = 'paypal' AND ${bankAccounts.externalId} = 'paypal-usd'`
    )
    .limit(1);

  if (!dbAccount) return 0;

  // ── Fetch transactions ──
  // PayPal Transaction Search API allows max 31-day windows.
  // For daily sync: last 31 days. For full sync: iterate in 31-day windows up to 3 years.
  const now = new Date();
  const windowDays = 31;
  let startDate: Date;

  if (fullSync) {
    // Go back 3 years for full backfill
    startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 3);
  } else {
    // Last 31 days for regular sync
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - windowDays);
  }

  let windowStart = new Date(startDate);

  while (windowStart < now) {
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + windowDays);
    if (windowEnd > now) windowEnd.setTime(now.getTime());

    const startStr = windowStart.toISOString().replace(/\.\d{3}Z$/, "-0000");
    const endStr = windowEnd.toISOString().replace(/\.\d{3}Z$/, "-0000");

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const txnRes = await fetch(
        `${apiBase}/v1/reporting/transactions?start_date=${startStr}&end_date=${endStr}&fields=transaction_info,payer_info,cart_info&page_size=100&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
      );

      if (!txnRes.ok) {
        const errText = await txnRes.text();
        logger.warn("bank-sync", `PayPal transactions API returned ${txnRes.status}`, { body: errText.slice(0, 500) });
        hasMore = false;
        break;
      }

      const txnData = await txnRes.json();
      const transactions: PayPalTransaction[] = txnData.transaction_details || [];

      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      for (const txn of transactions) {
        const info = txn.transaction_info;
        // Skip certain internal event codes (e.g., T0400 = general withdrawal to bank)
        // We want all transaction types for completeness
        const amountCents = Math.round(parseFloat(info.transaction_amount.value) * 100);
        const currency = (info.transaction_amount.currency_code || "USD").toLowerCase();
        const txnDate = info.transaction_initiation_date?.split("T")[0] || now.toISOString().split("T")[0];

        // Build description
        const payerName = txn.payer_info?.payer_name?.alternate_full_name || null;
        const subject = info.transaction_subject || null;
        const itemName = txn.cart_info?.item_details?.[0]?.item_name || null;
        const description = subject || itemName || info.transaction_note || info.transaction_event_code;

        await db
          .insert(bankTransactions)
          .values({
            bankAccountId: dbAccount.id,
            externalId: `paypal-${info.transaction_id}`,
            date: txnDate,
            description,
            amountCents,
            currency,
            status: info.transaction_status === "S" ? "posted" : info.transaction_status === "P" ? "pending" : "posted",
            counterparty: payerName || txn.payer_info?.email_address || null,
          })
          .onConflictDoNothing({ target: bankTransactions.externalId });

        itemsProcessed++;
      }

      // Check for more pages
      const totalPages = txnData.total_pages || 1;
      if (page >= totalPages) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Move to next window
    windowStart = new Date(windowEnd);
  }

  logger.info("bank-sync", `PayPal sync complete: balance=${balanceCents}, transactions=${itemsProcessed}`);
  return itemsProcessed;
}

// ─── Exchange Rate ──────────────────────────────────────────────────────────

export async function syncExchangeRate(): Promise<void> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);

    const data = await res.json();
    const idrRate = data.rates?.IDR;

    if (!idrRate || typeof idrRate !== "number") {
      throw new Error("IDR rate not found in exchange rate response");
    }

    // Store rate in siteSettings
    await db
      .insert(siteSettings)
      .values({ key: "usd_idr_rate", value: String(idrRate) })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: String(idrRate), updatedAt: new Date() },
      });

    await db
      .insert(siteSettings)
      .values({
        key: "exchange_rate_updated_at",
        value: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value: new Date().toISOString(),
          updatedAt: new Date(),
        },
      });

    logger.info("bank-sync", `Exchange rate synced: 1 USD = ${idrRate} IDR`);
  } catch (err) {
    logger.error("bank-sync", "Failed to sync exchange rate", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
