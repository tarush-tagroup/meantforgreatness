"use client";

import { useEffect, useState } from "react";
import {
  MONTHLY_PRESETS,
  YEARLY_PRESETS,
  ONE_TIME_PRESETS,
  DEFAULT_MONTHLY_AMOUNT,
  DEFAULT_YEARLY_AMOUNT,
  DEFAULT_ONE_TIME_AMOUNT,
  getSponsorshipMessage,
  type DonationFrequency,
} from "@/lib/donation-tiers";

interface PaymentConfig {
  stripeEnabled: boolean;
  paypalEnabled: boolean;
}

export default function DonationForm() {
  const [frequency, setFrequency] = useState<DonationFrequency>("monthly");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(
    DEFAULT_MONTHLY_AMOUNT
  );
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<
    "stripe" | "paypal" | null
  >(null);
  const [error, setError] = useState("");
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({
    stripeEnabled: true,
    paypalEnabled: false,
  });

  // Fetch payment config on mount
  useEffect(() => {
    fetch("/api/payment-config")
      .then((res) => res.json())
      .then((data) => setPaymentConfig(data))
      .catch(() => {
        // Default to Stripe-only
      });
  }, []);

  const amount = isCustom ? Number(customAmount) : selectedAmount;

  function handleFrequencyChange(newFrequency: DonationFrequency) {
    setFrequency(newFrequency);
    setIsCustom(false);
    setCustomAmount("");
    if (newFrequency === "monthly") setSelectedAmount(DEFAULT_MONTHLY_AMOUNT);
    else if (newFrequency === "yearly")
      setSelectedAmount(DEFAULT_YEARLY_AMOUNT);
    else setSelectedAmount(DEFAULT_ONE_TIME_AMOUNT);
  }

  function validateAmount(): boolean {
    setError("");
    if (!amount || amount < 10) {
      setError("Please enter a valid donation amount (minimum $10).");
      return false;
    }
    if (amount > 10000) {
      setError("For donations over $10,000, please contact us directly.");
      return false;
    }
    return true;
  }

  async function handleStripeCheckout(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validateAmount()) return;

    setLoading(true);
    setLoadingProvider("stripe");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, frequency }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (!data.url || typeof data.url !== "string") {
        throw new Error(
          `Invalid checkout URL received: ${JSON.stringify(data.url)}`
        );
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
      setLoadingProvider(null);
    }
  }

  async function handlePayPalCheckout() {
    if (!validateAmount()) return;

    setLoading(true);
    setLoadingProvider("paypal");

    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, frequency }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (!data.approvalUrl) {
        throw new Error("No PayPal approval URL received");
      }

      window.location.href = data.approvalUrl;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
      setLoadingProvider(null);
    }
  }

  const presets =
    frequency === "monthly"
      ? MONTHLY_PRESETS
      : frequency === "yearly"
        ? YEARLY_PRESETS
        : ONE_TIME_PRESETS;

  const sponsorship =
    amount && amount > 0 ? getSponsorshipMessage(amount, frequency) : null;

  const frequencyLabel =
    frequency === "monthly" ? "/month" : frequency === "yearly" ? "/year" : "";

  const { stripeEnabled, paypalEnabled } = paymentConfig;
  const bothEnabled = stripeEnabled && paypalEnabled;
  const neitherEnabled = !stripeEnabled && !paypalEnabled;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // If only Stripe: use Stripe; if only PayPal: use PayPal; if both: do nothing (buttons handle it)
        if (stripeEnabled && !paypalEnabled) handleStripeCheckout();
        else if (paypalEnabled && !stripeEnabled) handlePayPalCheckout();
      }}
      className="space-y-8"
    >
      {/* Frequency toggle */}
      <div>
        <label className="block text-sm font-medium text-sand-700 mb-3">
          Donation Frequency
        </label>
        <div className="flex rounded-lg bg-sand-100 p-1">
          <button
            type="button"
            onClick={() => handleFrequencyChange("one_time")}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              frequency === "one_time"
                ? "bg-white text-sand-900 shadow-sm"
                : "text-sand-500 hover:text-sand-700"
            }`}
          >
            One-time
          </button>
          <button
            type="button"
            onClick={() => handleFrequencyChange("monthly")}
            className={`relative flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              frequency === "monthly"
                ? "bg-white text-sand-900 shadow-sm"
                : "text-sand-500 hover:text-sand-700"
            }`}
          >
            Monthly
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-green-700 px-2 py-0.5 text-[10px] font-semibold text-white leading-none">
              Recommended
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleFrequencyChange("yearly")}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              frequency === "yearly"
                ? "bg-white text-sand-900 shadow-sm"
                : "text-sand-500 hover:text-sand-700"
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      {/* Amount selection */}
      <div>
        <label className="block text-sm font-medium text-sand-700 mb-3">
          Select Amount
        </label>
        <div className="grid grid-cols-3 gap-3">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setSelectedAmount(preset);
                setIsCustom(false);
                setCustomAmount("");
              }}
              className={`rounded-lg border-2 py-3 text-center font-semibold transition-colors ${
                !isCustom && selectedAmount === preset
                  ? "border-green-600 bg-green-50 text-green-700"
                  : "border-sand-200 text-sand-700 hover:border-sand-300"
              }`}
            >
              ${preset.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Other amount */}
        <div className="mt-3">
          <div
            className={`flex items-center rounded-lg border-2 px-4 py-3 transition-colors ${
              isCustom ? "border-green-600 bg-green-50" : "border-sand-200"
            }`}
          >
            <span className="text-sand-500 font-medium mr-2">$</span>
            <input
              type="number"
              min="10"
              max="10000"
              step="1"
              placeholder="Other amount (min $10)"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setIsCustom(true);
                setSelectedAmount(null);
              }}
              onFocus={() => {
                setIsCustom(true);
                setSelectedAmount(null);
              }}
              className="w-full bg-transparent outline-none text-sand-900 placeholder:text-sand-400"
            />
          </div>
        </div>
      </div>

      {/* Sponsorship context */}
      {sponsorship && (
        <div className="rounded-lg bg-sage-50 border border-sage-200 p-4 text-sm text-sage-800">
          <p>
            <span className="font-semibold">{sponsorship.label}:</span>{" "}
            {sponsorship.message}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Payment buttons */}
      {neitherEnabled ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700 text-center">
          Donations are temporarily unavailable. Please check back soon.
        </div>
      ) : bothEnabled ? (
        /* Both providers enabled — show two buttons */
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleStripeCheckout()}
            disabled={loading || !amount || amount < 10}
            className="w-full rounded-lg bg-sage-500 px-6 py-3.5 text-lg font-semibold text-white hover:bg-sage-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingProvider === "stripe" ? (
              "Redirecting to checkout..."
            ) : (
              <>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4H3V5zm0 6h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8zm4 3a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H7z" />
                </svg>
                Pay with Card — ${(amount || 0).toLocaleString()}
                {frequencyLabel}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handlePayPalCheckout}
            disabled={loading || !amount || amount < 10}
            className="w-full rounded-lg bg-[#0070BA] px-6 py-3.5 text-lg font-semibold text-white hover:bg-[#005EA6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingProvider === "paypal" ? (
              "Redirecting to PayPal..."
            ) : (
              <>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.603c-.564 0-1.04.408-1.13.964L7.076 21.337z" />
                </svg>
                Pay with PayPal — ${(amount || 0).toLocaleString()}
                {frequencyLabel}
              </>
            )}
          </button>
        </div>
      ) : (
        /* Single provider */
        <button
          type="submit"
          disabled={loading || !amount || amount < 10}
          className={`w-full rounded-lg px-6 py-3.5 text-lg font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            paypalEnabled
              ? "bg-[#0070BA] hover:bg-[#005EA6]"
              : "bg-sage-500 hover:bg-sage-600"
          }`}
        >
          {loading
            ? `Redirecting to ${paypalEnabled ? "PayPal" : "checkout"}...`
            : `Donate $${(amount || 0).toLocaleString()}${frequencyLabel}`}
        </button>
      )}

      <p className="text-center text-xs text-sand-400">
        {bothEnabled
          ? "You will be redirected to your chosen payment provider for secure processing."
          : paypalEnabled
            ? "You will be redirected to PayPal for secure payment processing."
            : "You will be redirected to Stripe for secure payment processing."}
      </p>
    </form>
  );
}
