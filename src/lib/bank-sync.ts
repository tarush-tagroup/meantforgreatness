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
