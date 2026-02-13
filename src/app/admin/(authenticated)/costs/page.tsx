import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { anthropicUsage } from "@/db/schema";
import { sql, gte, eq, and, desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "year";
const PAGE_SIZE = 25;

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.getFullYear(), now.getMonth(), diff);
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function getPeriodLabel(period: Period): string {
  if (period === "week") return "This Week";
  if (period === "month") return "This Month";
  return "This Year";
}

function formatCents(cents: number): string {
  if (cents < 100) return `${cents}\u00A2`;
  return `$${(cents / 100).toFixed(2)}`;
}

interface PageProps {
  searchParams: Promise<{
    period?: string;
    page?: string;
  }>;
}

export default async function CostsPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!hasPermission(user.roles, "costs:view")) redirect("/admin");

  const params = await searchParams;
  const period: Period = (["week", "month", "year"].includes(params.period || "")
    ? params.period
    : "month") as Period;
  const page = Math.max(1, parseInt(params.page || "1"));
  const offset = (page - 1) * PAGE_SIZE;
  const periodStart = getPeriodStart(period);

  // Fetch all metrics in parallel
  const [
    allTimeTotals,
    periodTotals,
    allTimePhotoCount,
    allTimeMonitorCount,
    periodPhotoCount,
    periodMonitorCount,
    recentJobs,
    totalJobs,
  ] = await Promise.all([
    // All-time total spend
    db
      .select({
        totalCents: sql<number>`coalesce(sum(${anthropicUsage.costCents}), 0)`,
        totalInput: sql<number>`coalesce(sum(${anthropicUsage.inputTokens}), 0)`,
        totalOutput: sql<number>`coalesce(sum(${anthropicUsage.outputTokens}), 0)`,
      })
      .from(anthropicUsage)
      .then((rows) => rows[0]),
    // Period spend
    db
      .select({
        totalCents: sql<number>`coalesce(sum(${anthropicUsage.costCents}), 0)`,
      })
      .from(anthropicUsage)
      .where(gte(anthropicUsage.createdAt, periodStart))
      .then((rows) => rows[0]),
    // All-time photo analysis count
    db
      .select({ count: sql<number>`count(*)` })
      .from(anthropicUsage)
      .where(eq(anthropicUsage.useCase, "photo_analysis"))
      .then((rows) => rows[0]?.count ?? 0),
    // All-time monitor count
    db
      .select({ count: sql<number>`count(*)` })
      .from(anthropicUsage)
      .where(eq(anthropicUsage.useCase, "monitor"))
      .then((rows) => rows[0]?.count ?? 0),
    // Period photo analysis count
    db
      .select({ count: sql<number>`count(*)` })
      .from(anthropicUsage)
      .where(
        and(
          eq(anthropicUsage.useCase, "photo_analysis"),
          gte(anthropicUsage.createdAt, periodStart)
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
    // Period monitor count
    db
      .select({ count: sql<number>`count(*)` })
      .from(anthropicUsage)
      .where(
        and(
          eq(anthropicUsage.useCase, "monitor"),
          gte(anthropicUsage.createdAt, periodStart)
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
    // Recent jobs (paginated)
    db
      .select({
        id: anthropicUsage.id,
        useCase: anthropicUsage.useCase,
        model: anthropicUsage.model,
        inputTokens: anthropicUsage.inputTokens,
        outputTokens: anthropicUsage.outputTokens,
        costCents: anthropicUsage.costCents,
        createdAt: anthropicUsage.createdAt,
      })
      .from(anthropicUsage)
      .orderBy(desc(anthropicUsage.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    // Total count for pagination
    db
      .select({ count: sql<number>`count(*)` })
      .from(anthropicUsage)
      .then((rows) => rows[0]?.count ?? 0),
  ]);

  const totalPages = Math.ceil(Number(totalJobs) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    p.set("period", period);
    p.set("page", "1");
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/admin/costs?${p.toString()}`;
  }

  const useCaseLabels: Record<string, string> = {
    photo_analysis: "Photo Analysis",
    monitor: "Monitor",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-warmgray-900">API Costs</h1>
        <span className="text-sm text-warmgray-500">
          {Number(totalJobs)} total jobs
        </span>
      </div>

      {/* All-time totals */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-warmgray-200 bg-white p-5 h-full">
          <p className="text-sm font-medium text-warmgray-500">Total Spend</p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">
            {formatCents(allTimeTotals.totalCents)}
          </p>
          <p className="mt-0.5 text-xs text-warmgray-400">
            {Number(allTimeTotals.totalInput).toLocaleString()} input / {Number(allTimeTotals.totalOutput).toLocaleString()} output tokens
          </p>
        </div>
        <div className="rounded-lg border border-warmgray-200 bg-white p-5 h-full">
          <p className="text-sm font-medium text-warmgray-500">Photo Analysis Tasks</p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">
            {Number(allTimePhotoCount)}
          </p>
          <p className="mt-0.5 text-xs text-warmgray-400">All time</p>
        </div>
        <div className="rounded-lg border border-warmgray-200 bg-white p-5 h-full">
          <p className="text-sm font-medium text-warmgray-500">Monitor Tasks</p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">
            {Number(allTimeMonitorCount)}
          </p>
          <p className="mt-0.5 text-xs text-warmgray-400">All time</p>
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex rounded-lg bg-warmgray-100 p-1 mb-4 w-fit">
        {(["week", "month", "year"] as Period[]).map((p) => (
          <a
            key={p}
            href={buildUrl({ period: p, page: "1" })}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              period === p
                ? "bg-white text-warmgray-900 shadow-sm"
                : "text-warmgray-500 hover:text-warmgray-700"
            }`}
          >
            {p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
          </a>
        ))}
      </div>

      {/* Period-filtered metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-warmgray-200 bg-white p-5 h-full">
          <p className="text-sm font-medium text-warmgray-500">
            Spend {getPeriodLabel(period)}
          </p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">
            {formatCents(periodTotals.totalCents)}
          </p>
          <p className="mt-0.5 text-xs text-warmgray-400">{"\u00A0"}</p>
        </div>
        <div className="rounded-lg border border-warmgray-200 bg-white p-5 h-full">
          <p className="text-sm font-medium text-warmgray-500">
            Photo Analysis {getPeriodLabel(period)}
          </p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">
            {Number(periodPhotoCount)}
          </p>
          <p className="mt-0.5 text-xs text-warmgray-400">{"\u00A0"}</p>
        </div>
        <div className="rounded-lg border border-warmgray-200 bg-white p-5 h-full">
          <p className="text-sm font-medium text-warmgray-500">
            Monitor {getPeriodLabel(period)}
          </p>
          <p className="mt-1 text-2xl font-bold text-warmgray-900">
            {Number(periodMonitorCount)}
          </p>
          <p className="mt-0.5 text-xs text-warmgray-400">{"\u00A0"}</p>
        </div>
      </div>

      {/* Job list table */}
      <div className="overflow-x-auto rounded-lg border border-warmgray-200">
        <table className="w-full text-sm">
          <thead className="bg-warmgray-50 border-b border-warmgray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600 w-44">
                Date
              </th>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600 w-36">
                Use Case
              </th>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600 w-48">
                Model
              </th>
              <th className="text-right px-4 py-3 font-medium text-warmgray-600 w-28">
                Input Tokens
              </th>
              <th className="text-right px-4 py-3 font-medium text-warmgray-600 w-28">
                Output Tokens
              </th>
              <th className="text-right px-4 py-3 font-medium text-warmgray-600 w-24">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warmgray-100">
            {recentJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <p className="text-warmgray-400 text-base font-medium">
                    No API usage recorded yet
                  </p>
                  <p className="text-warmgray-400 text-sm mt-1">
                    Usage will appear here when AI photo analysis runs or the monitor fires.
                  </p>
                </td>
              </tr>
            ) : (
              recentJobs.map((job) => (
                <tr key={job.id} className="hover:bg-warmgray-50">
                  <td className="px-4 py-3 text-warmgray-500 font-mono text-xs whitespace-nowrap">
                    {job.createdAt
                      ? new Date(job.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        job.useCase === "photo_analysis"
                          ? "bg-blue-100 text-blue-700"
                          : job.useCase === "monitor"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-warmgray-100 text-warmgray-600"
                      }`}
                    >
                      {useCaseLabels[job.useCase] || job.useCase}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-warmgray-700 font-mono text-xs">
                    {job.model}
                  </td>
                  <td className="px-4 py-3 text-right text-warmgray-700 font-mono text-xs">
                    {job.inputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-warmgray-700 font-mono text-xs">
                    {job.outputTokens.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-warmgray-900 font-medium text-xs">
                    {formatCents(job.costCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-warmgray-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50 transition-colors"
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
