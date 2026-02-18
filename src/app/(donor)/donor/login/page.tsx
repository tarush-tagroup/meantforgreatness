"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function DonorLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 sm:py-24">
          <div className="mx-auto max-w-md px-4 sm:px-6">
            <div className="bg-white rounded-2xl shadow-sm border border-sand-200 p-8 animate-pulse">
              <div className="h-6 bg-sand-200 rounded w-1/2 mx-auto mb-6" />
              <div className="h-8 bg-sand-200 rounded w-3/4 mx-auto mb-2" />
              <div className="h-4 bg-sand-100 rounded w-2/3 mx-auto mb-8" />
              <div className="h-12 bg-sand-100 rounded mb-4" />
              <div className="h-12 bg-sand-200 rounded" />
            </div>
          </div>
        </div>
      }
    >
      <DonorLoginForm />
    </Suspense>
  );
}

function DonorLoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const expired = searchParams.get("expired") === "true";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/donor/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      setStep("otp");
      setResendCooldown(60);
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/donor/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code. Please try again.");
        // Clear OTP fields on error
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      // Success — redirect to donor dashboard
      router.push("/donor");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    const fullCode = newOtp.join("");
    if (fullCode.length === 6) {
      handleVerifyOtp(fullCode);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);

    // Focus the next empty input or the last one
    const nextEmpty = newOtp.findIndex((d) => !d);
    otpRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();

    // Auto-submit if all 6 digits
    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    }
  }

  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-sand-200 p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/">
              <Image
                src="/logo.svg"
                alt="meantforgreatness"
                width={200}
                height={24}
                className="h-6 w-auto mx-auto mb-6"
              />
            </Link>
            <h1 className="text-2xl font-bold text-sand-900">
              {step === "email" ? "Manage Your Donations" : "Enter Your Code"}
            </h1>
            <p className="text-sand-500 mt-2 text-sm">
              {step === "email"
                ? "Enter your email to access your donor portal."
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {/* Expired token notice */}
          {expired && step === "email" && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-6">
              <p className="text-amber-800 text-sm">
                Your login link has expired. Enter your email below to get a new
                code.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-6">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Email */}
          {step === "email" && (
            <form onSubmit={handleSendOtp}>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-sand-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-sand-300 px-4 py-3 text-sand-900 placeholder:text-sand-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                autoFocus
              />
              <button
                type="submit"
                disabled={loading || !email}
                className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === "otp" && (
            <div>
              <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-sand-300 text-sand-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={loading}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleVerifyOtp(otp.join(""))}
                disabled={loading || otp.join("").length !== 6}
                className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>

              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    handleSendOtp();
                  }}
                  disabled={resendCooldown > 0 || loading}
                  className="text-green-600 hover:text-green-700 font-medium disabled:text-sand-400 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend code"}
                </button>
                <span className="mx-2 text-sand-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp(["", "", "", "", "", ""]);
                    setError("");
                  }}
                  className="text-sand-500 hover:text-sand-700"
                >
                  Change email
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-sand-100 text-center">
            <p className="text-sand-400 text-xs">
              Don&apos;t have a donor account?{" "}
              <Link
                href="/donate"
                className="text-green-600 hover:text-green-700 font-medium"
              >
                Make a donation
              </Link>{" "}
              and we&apos;ll create one for you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
