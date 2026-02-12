"use client";

import { useState } from "react";

const oneTimeAmounts = [100, 250, 500];
const monthlyAmounts = [50, 100, 500];

export default function DonationForm() {
  const [frequency, setFrequency] = useState<"one_time" | "monthly">(
    "monthly"
  );
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const amount = isCustom ? Number(customAmount) : selectedAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!amount || amount < 10) {
      setError("Please enter a valid donation amount (minimum $10).");
      return;
    }

    if (amount > 10000) {
      setError("For donations over $10,000, please contact us directly.");
      return;
    }

    setLoading(true);

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
        throw new Error(`Invalid checkout URL received: ${JSON.stringify(data.url)}`);
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Frequency toggle */}
      <div>
        <label className="block text-sm font-medium text-warmgray-700 mb-3">
          Donation Frequency
        </label>
        <div className="flex rounded-lg bg-warmgray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setFrequency("one_time");
              setSelectedAmount(100);
              setIsCustom(false);
              setCustomAmount("");
            }}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              frequency === "one_time"
                ? "bg-white text-warmgray-900 shadow-sm"
                : "text-warmgray-500 hover:text-warmgray-700"
            }`}
          >
            One-time
          </button>
          <button
            type="button"
            onClick={() => {
              setFrequency("monthly");
              setSelectedAmount(50);
              setIsCustom(false);
              setCustomAmount("");
            }}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              frequency === "monthly"
                ? "bg-white text-warmgray-900 shadow-sm"
                : "text-warmgray-500 hover:text-warmgray-700"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Amount selection */}
      <div>
        <label className="block text-sm font-medium text-warmgray-700 mb-3">
          Select Amount
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(frequency === "monthly" ? monthlyAmounts : oneTimeAmounts).map((preset) => (
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
                  ? "border-teal-600 bg-teal-50 text-teal-700"
                  : "border-warmgray-200 text-warmgray-700 hover:border-warmgray-300"
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>

        {/* Other amount */}
        <div className="mt-3">
          <div
            className={`flex items-center rounded-lg border-2 px-4 py-3 transition-colors ${
              isCustom
                ? "border-teal-600 bg-teal-50"
                : "border-warmgray-200"
            }`}
          >
            <span className="text-warmgray-500 font-medium mr-2">$</span>
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
              className="w-full bg-transparent outline-none text-warmgray-900 placeholder:text-warmgray-400"
            />
          </div>
        </div>
      </div>

      {/* Sponsorship context */}
      {amount && amount > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          {amount >= 250 ? (
            <p>
              <span className="font-semibold">Sponsor a Teacher:</span> Your
              ${amount}
              {frequency === "monthly" ? "/month" : ""} donation can fund a
              dedicated English teacher for an orphanage.
            </p>
          ) : amount >= 100 ? (
            <p>
              <span className="font-semibold">Sponsor Multiple Kids:</span>{" "}
              Your ${amount}
              {frequency === "monthly" ? "/month" : ""} donation supports
              English classes for 4-5 children.
            </p>
          ) : amount >= 25 ? (
            <p>
              <span className="font-semibold">Sponsor a Kid:</span> Your $
              {amount}
              {frequency === "monthly" ? "/month" : ""} donation covers English
              classes for a child.
            </p>
          ) : (
            <p>
              Every dollar helps provide English education to orphan children
              in Bali.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !amount || amount < 10}
        className="w-full rounded-lg bg-amber-500 px-6 py-3.5 text-lg font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Redirecting to checkout..."
          : `Donate $${amount || 0}${frequency === "monthly" ? "/month" : ""}`}
      </button>

      <p className="text-center text-xs text-warmgray-400">
        You will be redirected to Stripe for secure payment processing.
      </p>
    </form>
  );
}
