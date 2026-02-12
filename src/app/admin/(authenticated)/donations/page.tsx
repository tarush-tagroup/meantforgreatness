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

  const [monthlyTotal] = await db
    .select({ total: sql<number>`COALESCE(SUM(amount), 0)`, count: sql<number>`count(*)` })
    .from(donations)
    .where(and(eq(donations.status, "completed"), eq(donations.frequency, "monthly")));

  const [donorCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT donor_email)` })
    .from(donations)
    .where(eq(donations.status, "completed"));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-warmgray-900">Donations</h1>
        <p className="mt-1 text-sm text-warmgray-500">
          Track and manage donation activity.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-warmgray-200 bg-white p-5">
          <p className="text-xs font-medium text-warmgray-500 uppercase tracking-wider">
            Total Raised
          </p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">
            ${(Number(totalRaised?.total || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-warmgray-400">
            {Number(donorCount?.count || 0)} unique donor{Number(donorCount?.count || 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-warmgray-200 bg-white p-5">
          <p className="text-xs font-medium text-warmgray-500 uppercase tracking-wider">
            Monthly Recurring
          </p>
          <p className="mt-1 text-2xl font-bold text-teal-700">
            ${(Number(monthlyTotal?.total || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-warmgray-400">
            {Number(monthlyTotal?.count || 0)} subscription{Number(monthlyTotal?.count || 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-warmgray-200 bg-white p-5">
          <p className="text-xs font-medium text-warmgray-500 uppercase tracking-wider">
            Total Donations
          </p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">{total}</p>
          <p className="mt-1 text-xs text-warmgray-400">all time</p>
        </div>
      </div>

      {/* Filters */}
      <DonationFilters currentFilters={params} />

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-warmgray-200 bg-white p-12 text-center">
          <p className="text-warmgray-500">No donations found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-warmgray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-warmgray-200">
            <thead className="bg-warmgray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Donor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warmgray-100">
              {rows.map((donation) => (
                <tr key={donation.id} className="hover:bg-warmgray-50">
                  <td className="px-4 py-3 text-sm text-warmgray-900 whitespace-nowrap">
                    {new Date(donation.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="text-warmgray-900">{donation.donorName || "Anonymous"}</div>
                    <div className="text-warmgray-500 text-xs">{donation.donorEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-warmgray-900">
                    ${(donation.amount / 100).toFixed(2)}
                    <span className="ml-1 text-xs text-warmgray-400 uppercase">
                      {donation.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        donation.frequency === "monthly"
                          ? "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20"
                          : "bg-warmgray-100 text-warmgray-600"
                      }`}
                    >
                      {donation.frequency === "monthly" ? "Monthly" : "One-time"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        donation.status === "completed"
                          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                          : donation.status === "refunded"
                          ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                          : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
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
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-warmgray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildFilterUrl(params, page - 1)}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildFilterUrl(params, page + 1)}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50"
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
