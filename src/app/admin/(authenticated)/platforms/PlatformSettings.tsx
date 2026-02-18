"use client";

import { useCallback, useEffect, useState } from "react";

interface Settings {
  payment_stripe_enabled?: string;
  payment_paypal_enabled?: string;
  paypal_client_id?: string;
  paypal_client_secret?: string;
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // PayPal form state (local until saved)
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
        setPaypalClientId(data.settings?.paypal_client_id || "");
        setPaypalClientSecret(data.settings?.paypal_client_secret || "");
      }
    } catch {
      // Settings table might not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Record<string, string>) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || {});
        setMessage({ type: "success", text: "Settings saved" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error || "Failed to save settings",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const stripeEnabled = settings.payment_stripe_enabled !== "false";
  const paypalEnabled = settings.payment_paypal_enabled === "true";

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 rounded-lg bg-sand-100" />
        <div className="h-48 rounded-lg bg-sand-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stripe Card */}
      <div className="rounded-lg border border-sand-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
              <svg
                className="h-6 w-6 text-indigo-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-sand-900">Stripe</h3>
              <p className="text-sm text-sand-500">
                Credit & debit card payments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                stripeEnabled
                  ? "bg-green-50 text-green-700"
                  : "bg-sand-100 text-sand-500"
              }`}
            >
              {stripeEnabled ? "Active" : "Disabled"}
            </span>
            <button
              onClick={() =>
                updateSettings({
                  payment_stripe_enabled: stripeEnabled ? "false" : "true",
                })
              }
              disabled={saving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                stripeEnabled ? "bg-green-600" : "bg-sand-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  stripeEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-sand-50 px-4 py-3">
          <p className="text-xs text-sand-500">
            Stripe is configured via environment variables (
            <code className="text-sand-600">STRIPE_SECRET_KEY</code> and{" "}
            <code className="text-sand-600">STRIPE_WEBHOOK_SECRET</code>). No
            additional setup needed here.
          </p>
        </div>
      </div>

      {/* PayPal Card */}
      <div className="rounded-lg border border-sand-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <svg
                className="h-6 w-6 text-blue-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337zm9.854-15.3c-.024.153-.05.306-.084.461-1.008 5.18-4.397 6.832-8.746 6.832H6.234L4.47 23.588h3.312l.88-5.58a.64.64 0 0 1 .632-.545h1.332c3.904 0 6.96-1.586 7.853-6.174.332-1.707.16-3.134-.55-4.152z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-sand-900">PayPal</h3>
              <p className="text-sm text-sand-500">
                PayPal & Venmo payments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                paypalEnabled
                  ? "bg-green-50 text-green-700"
                  : "bg-sand-100 text-sand-500"
              }`}
            >
              {paypalEnabled ? "Active" : "Disabled"}
            </span>
            <button
              onClick={() =>
                updateSettings({
                  payment_paypal_enabled: paypalEnabled ? "false" : "true",
                })
              }
              disabled={saving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                paypalEnabled ? "bg-green-600" : "bg-sand-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  paypalEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* PayPal credentials */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">
              Client ID
            </label>
            <input
              type="text"
              value={paypalClientId}
              onChange={(e) => setPaypalClientId(e.target.value)}
              placeholder="PayPal Client ID"
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-700 placeholder:text-sand-300 focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sand-600 mb-1">
              Client Secret
            </label>
            <input
              type="password"
              value={paypalClientSecret}
              onChange={(e) => setPaypalClientSecret(e.target.value)}
              placeholder="PayPal Client Secret"
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-700 placeholder:text-sand-300 focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
            />
          </div>
          <button
            onClick={() =>
              updateSettings({
                paypal_client_id: paypalClientId,
                paypal_client_secret: paypalClientSecret,
              })
            }
            disabled={saving}
            className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-medium text-white hover:bg-sand-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save PayPal Credentials"}
          </button>
        </div>

        {!paypalEnabled && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs text-amber-700">
              PayPal is currently disabled. Enter your credentials and toggle it
              on when ready. The donation form will automatically show PayPal as
              a payment option.
            </p>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-sand-200 bg-sand-50 p-4">
        <h4 className="text-sm font-medium text-sand-700 mb-1">
          How it works
        </h4>
        <p className="text-xs text-sand-500 leading-relaxed">
          The donation form automatically adapts based on which platforms are
          enabled. If only Stripe is active, the form works exactly as it does
          now. If both are active, donors can choose between card payment
          (Stripe) and PayPal. At least one platform must be enabled for
          donations to work.
        </p>
      </div>
    </div>
  );
}
