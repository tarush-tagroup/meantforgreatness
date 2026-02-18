"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface DonorInfo {
  id: string;
  email: string;
  name: string | null;
  hasStripeCustomer: boolean;
}

interface Donation {
  id: string;
  amount: number;
  currency: string;
  frequency: string;
  status: string;
  createdAt: string;
}

interface Kid {
  id: string;
  name: string;
  age: number;
  hobby: string | null;
  location: string | null;
  about: string | null;
  favoriteWord: string | null;
  imageUrl: string | null;
}

export default function DonorDashboard() {
  return (
    <Suspense
      fallback={
        <div className="py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-sand-200 rounded w-1/3" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 bg-sand-100 rounded-xl" />
                <div className="h-20 bg-sand-100 rounded-xl" />
                <div className="h-20 bg-sand-100 rounded-xl" />
              </div>
              <div className="h-40 bg-sand-100 rounded-xl" />
              <div className="h-60 bg-sand-100 rounded-xl" />
            </div>
          </div>
        </div>
      }
    >
      <DonorDashboardInner />
    </Suspense>
  );
}

function DonorDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "true";

  const [donor, setDonor] = useState<DonorInfo | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [expandedKid, setExpandedKid] = useState<string | null>(null);
  const [showAllKids, setShowAllKids] = useState(false);
  const [showWelcome, setShowWelcome] = useState(isWelcome);

  const fetchData = useCallback(async () => {
    try {
      const [meRes, donationsRes, kidsRes] = await Promise.all([
        fetch("/api/donor/me"),
        fetch("/api/donor/donations"),
        fetch("/api/donor/kids"),
      ]);

      if (!meRes.ok) {
        router.push("/donor/login");
        return;
      }

      const meData = await meRes.json();
      setDonor(meData.donor);

      if (donationsRes.ok) {
        const donationsData = await donationsRes.json();
        setDonations(donationsData.donations);
      }

      if (kidsRes.ok) {
        const kidsData = await kidsRes.json();
        setKids(kidsData.kids);
      }
    } catch {
      router.push("/donor/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleLogout() {
    await fetch("/api/donor/logout", { method: "POST" });
    router.push("/donor/login");
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/donor/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Error handled silently
    } finally {
      setPortalLoading(false);
    }
  }

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Compute donor state
  const hasActiveSubscription = donations.some(
    (d) =>
      (d.frequency === "monthly" || d.frequency === "yearly") &&
      d.status === "completed"
  );
  const isOneTimeOnly =
    donations.length > 0 &&
    donations.every((d) => d.frequency === "one_time");
  const totalDonated = donations
    .filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + d.amount, 0);
  const completedCount = donations.filter(
    (d) => d.status === "completed"
  ).length;
  // Find the active subscription (prefer yearly over monthly for display)
  const activeSubscription = donations.find(
    (d) => d.frequency === "yearly" && d.status === "completed"
  ) || donations.find(
    (d) => d.frequency === "monthly" && d.status === "completed"
  );
  const subscriptionAmount = activeSubscription?.amount || 0;
  const subscriptionFrequency = activeSubscription?.frequency || "monthly";

  // Kids display
  const KIDS_INITIAL_COUNT = 8;
  const visibleKids = showAllKids ? kids : kids.slice(0, KIDS_INITIAL_COUNT);

  if (loading) {
    return (
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-sand-200 rounded w-1/3" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-20 bg-sand-100 rounded-xl" />
              <div className="h-20 bg-sand-100 rounded-xl" />
              <div className="h-20 bg-sand-100 rounded-xl" />
            </div>
            <div className="h-40 bg-sand-100 rounded-xl" />
            <div className="h-60 bg-sand-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Welcome banner for new donors */}
        {showWelcome && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-5 relative">
            <button
              onClick={() => setShowWelcome(false)}
              className="absolute top-3 right-3 text-green-400 hover:text-green-600"
              aria-label="Dismiss"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-green-800">
                  Thank you for your donation!
                </h2>
                <p className="text-green-700 text-sm mt-1">
                  Your generosity helps provide English education to orphan children in Bali.
                  This is your donor portal — explore the kids you&apos;re helping, track your giving, and more.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-sand-900">
              Welcome{donor?.name ? `, ${donor.name}` : ""}
            </h1>
            <p className="text-sand-500 text-sm mt-1">{donor?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-sand-500 hover:text-sand-700 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Impact Summary */}
        {completedCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl bg-white border border-sand-200 p-4">
              <p className="text-xs font-medium text-sand-400 uppercase tracking-wider">
                Total Donated
              </p>
              <p className="text-2xl font-bold text-sand-900 mt-1">
                {formatAmount(totalDonated, "usd")}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-sand-200 p-4">
              <p className="text-xs font-medium text-sand-400 uppercase tracking-wider">
                Donations
              </p>
              <p className="text-2xl font-bold text-sand-900 mt-1">
                {completedCount}
              </p>
            </div>
            {hasActiveSubscription && (
              <div className="rounded-xl bg-white border border-sand-200 p-4 col-span-2 sm:col-span-1">
                <p className="text-xs font-medium text-sand-400 uppercase tracking-wider">
                  {subscriptionFrequency === "yearly" ? "Yearly" : "Monthly"}
                </p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  {formatAmount(subscriptionAmount, "usd")}{subscriptionFrequency === "yearly" ? "/yr" : "/mo"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Cards — 2-column grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {/* Active monthly donor card */}
          {hasActiveSubscription && donor?.hasStripeCustomer && (
            <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-700">
                  Active {subscriptionFrequency === "yearly" ? "Yearly" : "Monthly"} Donor
                </span>
              </div>
              <p className="text-green-800 text-sm leading-relaxed">
                Your {subscriptionFrequency === "yearly" ? "yearly" : "monthly"} contributions provide consistent English education
                to children in Bali.
              </p>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="mt-4 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                {portalLoading ? "Loading..." : "Manage Subscription"}
              </button>
            </div>
          )}

          {/* Increase impact — for active monthly donors */}
          {hasActiveSubscription && (
            <div className="rounded-xl bg-white border border-sand-200 p-5">
              <h3 className="font-semibold text-sand-900 mb-1">
                Increase Your Impact
              </h3>
              <p className="text-sand-600 text-sm leading-relaxed mb-4">
                You&apos;re making a difference every month. Consider a one-time
                gift to help us reach even more kids.
              </p>
              <Link
                href="/donate"
                className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Make a One-Time Gift
              </Link>
            </div>
          )}

          {/* Encourage monthly — for one-time donors */}
          {isOneTimeOnly && (
            <div className="rounded-xl bg-gradient-to-br from-sage-50 to-green-50 border border-sage-200 p-5">
              <h3 className="text-lg font-bold text-green-800 mb-2">
                Make a Lasting Impact
              </h3>
              <p className="text-sand-700 text-sm leading-relaxed mb-4">
                $50/month can sponsor a child&apos;s English education for an
                entire year. Monthly donors help us plan ahead and reach more
                kids.
              </p>
              <Link
                href="/donate"
                className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Start Monthly Giving
              </Link>
            </div>
          )}

          {/* Give again — for one-time donors */}
          {isOneTimeOnly && (
            <div className="rounded-xl bg-white border border-sand-200 p-5">
              <h3 className="font-semibold text-sand-900 mb-1">Give Again</h3>
              <p className="text-sand-600 text-sm leading-relaxed mb-4">
                Every donation helps us expand English classes to more
                orphanages across Bali.
              </p>
              <Link
                href="/donate"
                className="inline-block rounded-lg border border-sand-300 px-4 py-2 text-sm font-semibold text-sand-700 hover:bg-sand-50 transition-colors"
              >
                Make a One-Time Donation
              </Link>
            </div>
          )}

          {/* No donations yet — full width */}
          {donations.length === 0 && (
            <div className="sm:col-span-2 rounded-xl bg-gradient-to-br from-sage-50 to-green-50 border border-sage-200 p-8 text-center">
              <h3 className="text-lg font-bold text-green-800 mb-2">
                Make Your First Donation
              </h3>
              <p className="text-sand-700 text-sm leading-relaxed mb-4 max-w-md mx-auto">
                Your donation goes directly to funding English classes at orphanages
                across Bali. $50/month can sponsor a child&apos;s education for an
                entire year.
              </p>
              <Link
                href="/donate"
                className="inline-block rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Donate Now
              </Link>
            </div>
          )}
        </div>

        {/* Payment Settings */}
        {!hasActiveSubscription && donor?.hasStripeCustomer && (
          <div className="rounded-xl bg-white border border-sand-200 p-5 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sand-900">
                  Payment Settings
                </h3>
                <p className="text-sand-500 text-sm mt-0.5">
                  View receipts and manage your payment methods.
                </p>
              </div>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="rounded-lg border border-sand-300 px-4 py-2 text-sm font-semibold text-sand-700 hover:bg-sand-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {portalLoading ? "Loading..." : "Manage"}
              </button>
            </div>
          </div>
        )}

        {/* Meet the Kids */}
        {kids.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-sand-900 mb-4">
              Meet the Kids
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {visibleKids.map((kid) => (
                <div
                  key={kid.id}
                  className={`rounded-xl bg-white border overflow-hidden cursor-pointer hover:shadow-md transition-all ${
                    expandedKid === kid.id
                      ? "border-green-300 ring-2 ring-green-100"
                      : "border-sand-200"
                  }`}
                  onClick={() =>
                    setExpandedKid(expandedKid === kid.id ? null : kid.id)
                  }
                >
                  {kid.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={kid.imageUrl}
                      alt={kid.name}
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-green-50 to-sage-50 flex items-center justify-center">
                      <span className="text-4xl text-green-300">
                        {kid.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-semibold text-sand-900 text-sm">
                      {kid.name}
                    </h3>
                    <p className="text-xs text-sand-500 mt-0.5">
                      Age {kid.age}
                      {kid.location ? ` · ${kid.location}` : ""}
                    </p>
                    {kid.hobby && (
                      <p className="text-xs text-green-700 mt-1">
                        Loves {kid.hobby.toLowerCase()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Show all kids button */}
            {kids.length > KIDS_INITIAL_COUNT && !showAllKids && (
              <button
                onClick={() => setShowAllKids(true)}
                className="mt-4 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
              >
                See all {kids.length} kids &rarr;
              </button>
            )}

            {/* Expanded kid detail modal */}
            {expandedKid &&
              (() => {
                const kid = kids.find((k) => k.id === expandedKid);
                if (!kid) return null;
                return (
                  <div className="mt-4 rounded-xl bg-white border border-sand-200 p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      {kid.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={kid.imageUrl}
                          alt={kid.name}
                          className="h-24 w-24 rounded-lg object-cover shrink-0 hidden sm:block"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-sand-900 text-lg">
                              {kid.name}
                            </h3>
                            <p className="text-sm text-sand-500">
                              Age {kid.age}
                              {kid.location
                                ? ` · From ${kid.location}`
                                : ""}
                              {kid.hobby
                                ? ` · Loves ${kid.hobby.toLowerCase()}`
                                : ""}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedKid(null);
                            }}
                            className="text-sand-400 hover:text-sand-600 text-sm shrink-0 ml-2"
                          >
                            Close
                          </button>
                        </div>
                        {kid.about && (
                          <p className="text-sm text-sand-700 leading-relaxed mt-3">
                            {kid.about}
                          </p>
                        )}
                        {kid.favoriteWord && (
                          <div className="mt-3 rounded-lg bg-green-50 border border-green-100 p-3 inline-block">
                            <p className="text-xs font-semibold text-green-700 mb-0.5">
                              Favorite English Word
                            </p>
                            <p className="text-sm text-green-800 font-medium">
                              {kid.favoriteWord}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {/* Donation History */}
        {donations.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-sand-900 mb-4">
              Donation History
            </h2>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {donations.map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg bg-white border border-sand-200 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sand-900">
                      {formatAmount(d.amount, d.currency)}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-sand-500">
                    <span>{formatDate(d.createdAt)}</span>
                    <FrequencyBadge frequency={d.frequency} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-xl bg-white border border-sand-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sand-100 bg-sand-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-sand-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-sand-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-sand-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-sand-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {donations.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-sand-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-sand-700">
                        {formatDate(d.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-sand-900">
                        {formatAmount(d.amount, d.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <FrequencyBadge frequency={d.frequency} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FrequencyBadge({ frequency }: { frequency: string }) {
  if (frequency === "monthly") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
        Monthly
      </span>
    );
  }
  if (frequency === "yearly") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
        Yearly
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600 ring-1 ring-inset ring-sand-200">
      One-time
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
          Completed
        </span>
      );
    case "refunded":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
          Refunded
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600 ring-1 ring-inset ring-sand-200">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-sand-100 px-2 py-0.5 text-xs font-medium text-sand-600 ring-1 ring-inset ring-sand-200">
          {status}
        </span>
      );
  }
}
