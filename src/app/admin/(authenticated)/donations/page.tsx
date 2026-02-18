import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { donations } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import Link from "next/link";
import DonationFilters from "./DonationFilters";

export const dynamic = "force-dynamic";

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    frequency?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "donations:view")) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = 25;
  const offset = (page - 1) * limit;

  // Build filters
  const conditions = [];
  if (params.frequency) conditions.push(eq(donations.frequency, params.frequency));
  if (params.status) conditions.push(eq(donations.status, params.status));
  if (params.dateFrom) conditions.push(gte(donations.createdAt, new Date(params.dateFrom)));
  if (params.dateTo) conditions.push(lte(donations.createdAt, new Date(params.dateTo + "T23:59:59Z")));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch donations
  const rows = await db
    .select()
    .from(donations)
    .where(whereClause)
    .orderBy(desc(donations.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(donations)
    .where(whereClause);

  const total = Number(countResult?.count || 0);
  const totalPages = Math.ceil(total / limit);

  // Fetch stats (always unfiltered)
  const [totalRaised] = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(donations)
    .where(eq(donations.status, "completed"));

  const [recurringTotal] = await db
    .select({
      total: sql<number>`COALESCE(SUM(
        CASE
          WHEN ${donations.frequency} = 'monthly' THEN ${donations.amount} * 12
          WHEN ${donations.frequency} = 'yearly' THEN ${donations.amount}
          ELSE 0
        END
      ), 0)`,
      count: sql<number>`count(*)`
    })
    .from(donations)
    .where(and(eq(donations.status, "completed"), sql`${donations.frequency} IN ('monthly', 'yearly')`));

  const [donorCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT donor_email)` })
    .from(donations)
    .where(eq(donations.status, "completed"));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-sand-900">Donations</h1>
        <p className="mt-1 text-sm text-sand-500">
          Track and manage donation activity.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-sand-200 bg-white p-5">
          <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
            Total Raised
          </p>
          <p className="mt-1 text-2xl font-bold text-sand-900">
            ${(Number(totalRaised?.total || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-sand-400">
            {Number(donorCount?.count || 0)} unique donor{Number(donorCount?.count || 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-5">
          <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
            Recurring (Annual)
          </p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            ${(Number(recurringTotal?.total || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}/yr
          </p>
          <p className="mt-1 text-xs text-sand-400">
            {Number(recurringTotal?.count || 0)} subscription{Number(recurringTotal?.count || 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-sand-200 bg-white p-5">
          <p className="text-xs font-medium text-sand-500 uppercase tracking-wider">
            Total Donations
          </p>
          <p className="mt-1 text-2xl font-bold text-sand-900">{total}</p>
          <p className="mt-1 text-xs text-sand-400">all time</p>
        </div>
      </div>

      {/* Filters */}
      <DonationFilters currentFilters={params} />

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-sand-200 bg-white p-12 text-center">
          <p className="text-sand-500">No donations found.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((donation) => (
              <div
                key={donation.id}
                className="rounded-lg border border-sand-200 bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-sand-900">
                    ${(donation.amount / 100).toFixed(2)}
                    <span className="ml-1 text-xs text-sand-400 uppercase font-normal">
                      {donation.currency}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        donation.frequency === "monthly"
                          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                          : donation.frequency === "yearly"
                          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                          : "bg-sand-100 text-sand-600"
                      }`}
                    >
                      {donation.frequency === "monthly" ? "Monthly" : donation.frequency === "yearly" ? "Yearly" : "One-time"}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        donation.status === "completed"
                          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                          : donation.status === "refunded"
                          ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                          : "bg-sage-50 text-sage-700 ring-1 ring-inset ring-sage-600/20"
                      }`}
                    >
                      {donation.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-sand-600 mt-1">
                  {donation.donorName || "Anonymous"} · {new Date(donation.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-sand-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-sand-200">
              <thead className="bg-sand-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Donor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sand-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {rows.map((donation) => (
                  <tr key={donation.id} className="hover:bg-sand-50">
                    <td className="px-4 py-3 text-sm text-sand-900 whitespace-nowrap">
                      {new Date(donation.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-sand-900">{donation.donorName || "Anonymous"}</div>
                      <div className="text-sand-500 text-xs">{donation.donorEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-sand-900">
                      ${(donation.amount / 100).toFixed(2)}
                      <span className="ml-1 text-xs text-sand-400 uppercase">
                        {donation.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          donation.frequency === "monthly"
                            ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                            : donation.frequency === "yearly"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                            : "bg-sand-100 text-sand-600"
                        }`}
                      >
                        {donation.frequency === "monthly" ? "Monthly" : donation.frequency === "yearly" ? "Yearly" : "One-time"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        donation.provider === "paypal"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-indigo-50 text-indigo-700"
                      }`}>
                        {donation.provider === "paypal" ? "PayPal" : "Stripe"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          donation.status === "completed"
                            ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                            : donation.status === "refunded"
                            ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                            : "bg-sage-50 text-sage-700 ring-1 ring-inset ring-sage-600/20"
                        }`}
                      >
                        {donation.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-sand-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildFilterUrl(params, page - 1)}
                className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-600 hover:bg-sand-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildFilterUrl(params, page + 1)}
                className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-600 hover:bg-sand-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildFilterUrl(
  params: Record<string, string | undefined>,
  page: number
) {
  const searchParams = new URLSearchParams();
  if (params.frequency) searchParams.set("frequency", params.frequency);
  if (params.status) searchParams.set("status", params.status);
  if (params.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params.dateTo) searchParams.set("dateTo", params.dateTo);
  searchParams.set("page", String(page));
  return `/admin/donations?${searchParams.toString()}`;
}
