import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get a single site setting value by key.
 */
export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

/**
 * Set a site setting value (upserts).
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/**
 * Get all site settings as a key-value map.
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteSettings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

/**
 * Get which payment providers are enabled.
 */
export async function getPaymentConfig(): Promise<{
  stripeEnabled: boolean;
  paypalEnabled: boolean;
}> {
  const settings = await getAllSettings();
  return {
    stripeEnabled: settings["payment_stripe_enabled"] !== "false",
    paypalEnabled: settings["payment_paypal_enabled"] === "true",
  };
}
