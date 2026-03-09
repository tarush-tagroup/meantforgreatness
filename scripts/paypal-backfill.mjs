import { neon } from "@neondatabase/serverless";

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const apiBase = "https://api-m.paypal.com";
const DATABASE_URL = process.env.DATABASE_URL;

if (!clientId || !clientSecret || !DATABASE_URL) {
  console.error("Missing PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, or DATABASE_URL");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function getAccessToken() {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function main() {
  const accessToken = await getAccessToken();
  console.log("Auth OK");

  // 1. Fetch balance
  const balRes = await fetch(
    `${apiBase}/v1/reporting/balances?as_of_time=${new Date().toISOString()}&currency_code=USD`,
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
  );

  let balanceCents = 0;
  if (balRes.ok) {
    const balData = await balRes.json();
    const usd = balData.balances?.find((b) => b.currency === "USD");
    if (usd) {
      balanceCents = Math.round(parseFloat(usd.available_balance.value) * 100);
    }
    console.log("Balance:", usd?.available_balance?.value ?? "N/A", "USD");
  } else {
    console.log("Balance API failed:", balRes.status);
  }

  // 2. Upsert bank account
  await sql`
    INSERT INTO bank_accounts (id, provider, external_id, name, currency, balance_cents, last_synced_at, created_at, updated_at)
    VALUES (gen_random_uuid(), 'paypal', 'paypal-usd', 'PayPal USD', 'usd', ${balanceCents}, now(), now(), now())
    ON CONFLICT (external_id) DO UPDATE SET
      balance_cents = ${balanceCents},
      last_synced_at = now(),
      updated_at = now()
  `;
  console.log("Bank account upserted");

  // 3. Get bank account ID
  const rows = await sql`
    SELECT id FROM bank_accounts WHERE provider = 'paypal' AND external_id = 'paypal-usd' LIMIT 1
  `;
  if (rows.length === 0) {
    console.error("Could not find bank account");
    process.exit(1);
  }
  const bankAccountId = rows[0].id;
  console.log("Bank account ID:", bankAccountId);

  // 4. Fetch transactions — iterate in 31-day windows going back 3 years
  const now = new Date();
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - 3);
  startDate.setDate(startDate.getDate() + 35); // Stay within PayPal's 3-year limit

  let windowStart = new Date(startDate);
  let totalProcessed = 0;
  let totalSkipped = 0;

  while (windowStart < now) {
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 31);
    if (windowEnd > now) windowEnd.setTime(now.getTime());

    const startStr = windowStart.toISOString().replace(/\.\d{3}Z$/, "-0000");
    const endStr = windowEnd.toISOString().replace(/\.\d{3}Z$/, "-0000");

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `${apiBase}/v1/reporting/transactions?start_date=${startStr}&end_date=${endStr}&fields=transaction_info,payer_info,cart_info&page_size=100&page=${page}`;
      const txnRes = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });

      if (!txnRes.ok) {
        console.log(`Transactions API error for ${startStr} to ${endStr}: ${txnRes.status}`);
        hasMore = false;
        break;
      }

      const txnData = await txnRes.json();
      const transactions = txnData.transaction_details || [];

      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      for (const txn of transactions) {
        const info = txn.transaction_info;
        const amountCents = Math.round(parseFloat(info.transaction_amount.value) * 100);
        const currency = (info.transaction_amount.currency_code || "USD").toLowerCase();
        const txnDate = info.transaction_initiation_date?.split("T")[0] || now.toISOString().split("T")[0];
        const payerName = txn.payer_info?.payer_name?.alternate_full_name || null;
        const subject = info.transaction_subject || null;
        const itemName = txn.cart_info?.item_details?.[0]?.item_name || null;
        const description = subject || itemName || info.transaction_note || info.transaction_event_code;
        const externalId = `paypal-${info.transaction_id}`;
        const status = info.transaction_status === "S" ? "posted" : info.transaction_status === "P" ? "pending" : "posted";
        const counterparty = payerName || txn.payer_info?.email_address || null;

        try {
          await sql`
            INSERT INTO bank_transactions (id, bank_account_id, external_id, date, description, amount_cents, currency, status, counterparty, created_at)
            VALUES (gen_random_uuid(), ${bankAccountId}, ${externalId}, ${txnDate}, ${description}, ${amountCents}, ${currency}, ${status}, ${counterparty}, now())
            ON CONFLICT (external_id) DO NOTHING
          `;
          totalProcessed++;
        } catch (err) {
          console.log(`  Insert error for ${externalId}:`, err.message?.slice(0, 200));
          totalSkipped++;
        }
      }

      const totalPages = txnData.total_pages || 1;
      if (page >= totalPages) {
        hasMore = false;
      } else {
        page++;
      }
    }

    const windowLabel = windowStart.toISOString().split("T")[0];
    if (totalProcessed % 50 === 0 || windowEnd >= now) {
      console.log(`Progress: ${windowLabel} — ${totalProcessed} inserted, ${totalSkipped} skipped`);
    }
    windowStart = new Date(windowEnd);
  }

  console.log(`\nBackfill complete! ${totalProcessed} transactions inserted, ${totalSkipped} skipped.`);
}

main().catch((e) => console.error("Error:", e.message));
