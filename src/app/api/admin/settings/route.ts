import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { getAllSettings, setSetting } from "@/lib/site-settings";

/**
 * GET /api/admin/settings — returns all site settings (admin-only)
 */
export async function GET() {
  const [, authError] = await withAuth("users:view");
  if (authError) return authError;

  try {
    const settings = await getAllSettings();
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: {} });
  }
}

/**
 * PATCH /api/admin/settings — update one or more site settings (admin-only)
 * Body: { settings: { key: value, key: value, ... } }
 */
export async function PATCH(req: NextRequest) {
  const [, authError] = await withAuth("users:view");
  if (authError) return authError;

  try {
    const body = await req.json();
    const updates = body.settings as Record<string, string>;

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "Invalid request body. Expected { settings: { key: value } }" },
        { status: 400 }
      );
    }

    // Allowlisted keys to prevent arbitrary data storage
    const allowedKeys = [
      "payment_stripe_enabled",
      "payment_paypal_enabled",
      "paypal_client_id",
      "paypal_client_secret",
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) {
        return NextResponse.json(
          { error: `Setting key "${key}" is not allowed.` },
          { status: 400 }
        );
      }
      await setSetting(key, String(value));
    }

    const settings = await getAllSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
