import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { listLogs, listSources } from "@/lib/blob-logs";
import { db } from "@/db";
import { cronRuns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import LogActions from "./LogActions";

export const dynamic = "force-dynamic";

const LEVELS = ["error", "warn", "info"] as const;
const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    level?: string;
    source?: string;
    search?: string;
  }>;
}

export default async function LogsPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!hasPermission(user.roles, "logs:view")) redirect("/admin");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const levelFilter = params.level || "";
  const sourceFilter = params.source || "";
  const searchFilter = params.search || "";

  const offset = (page - 1) * PAGE_SIZE;

  // Fetch logs, sources, last ingest run, and recent jobs in parallel
  const [logPage, sources, lastIngestRun, recentJobRows] = await Promise.all([
    listLogs(
      {
        level: levelFilter || undefined,
        source: sourceFilter || undefined,
        search: searchFilter || undefined,
      },
      { limit: PAGE_SIZE, offset }
    ),
    listSources(),
    // Get the most recent ingest run from the cron_runs table
    db
      .select({
        status: cronRuns.status,
        message: cronRuns.message,
        startedAt: cronRuns.startedAt,
        finishedAt: cronRuns.finishedAt,
        itemsProcessed: cronRuns.itemsProcessed,
      })
      .from(cronRuns)
      .where(eq(cronRuns.jobName, "ingest-vercel-logs"))
      .orderBy(desc(cronRuns.startedAt))
      .limit(1)
      .then((rows) => rows[0] || null)
      .catch(() => null),
    // Get last 10 job runs across all job types
    db
      .select({
        id: cronRuns.id,
        jobName: cronRuns.jobName,
        status: cronRuns.status,
        message: cronRuns.message,
        itemsProcessed: cronRuns.itemsProcessed,
        startedAt: cronRuns.startedAt,
        finishedAt: cronRuns.finishedAt,
      })
      .from(cronRuns)
      .orderBy(desc(cronRuns.startedAt))
      .limit(10)
      .catch(() => [] as typeof cronRuns.$inferSelect[]),
  ]);

  const { entries: logs, total } = logPage;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (levelFilter) p.set("level", levelFilter);
    if (sourceFilter) p.set("source", sourceFilter);
    if (searchFilter) p.set("search", searchFilter);
    p.set("page", "1");
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `/admin/logs?${p.toString()}`;
  }

  const levelColors: Record<string, string> = {
    error: "bg-red-100 text-red-700",
    warn: "bg-amber-100 text-amber-700",
    info: "bg-blue-100 text-blue-700",
  };

  // Serialize the last run for the client component
  const lastRunData = lastIngestRun
    ? {
        status: lastIngestRun.status,
        message: lastIngestRun.message,
        startedAt: lastIngestRun.startedAt.toISOString(),
        finishedAt: lastIngestRun.finishedAt?.toISOString() || null,
        itemsProcessed: lastIngestRun.itemsProcessed,
      }
    : null;

  // Serialize recent jobs for the client component
  const recentJobsData = recentJobRows.map((job) => ({
    id: job.id,
    jobName: job.jobName,
    status: job.status,
    message: job.message,
    itemsProcessed: job.itemsProcessed,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() || null,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-warmgray-900">
          Application Logs
        </h1>
        <span className="text-sm text-warmgray-500">{total} entries</span>
      </div>

      {/* Action bar with last run status + buttons */}
      <LogActions lastRun={lastRunData} recentJobs={recentJobsData} />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        {/* Level filter */}
        <div className="flex rounded-lg bg-warmgray-100 p-1">
          <a
            href={buildUrl({ level: "", page: "1" })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !levelFilter
                ? "bg-white text-warmgray-900 shadow-sm"
                : "text-warmgray-500 hover:text-warmgray-700"
            }`}
          >
            All
          </a>
          {LEVELS.map((l) => (
            <a
              key={l}
              href={buildUrl({ level: l, page: "1" })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                levelFilter === l
                  ? "bg-white text-warmgray-900 shadow-sm"
                  : "text-warmgray-500 hover:text-warmgray-700"
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </a>
          ))}
        </div>

        {/* Source filter */}
        <form action="/admin/logs" method="GET" className="flex items-center gap-2">
          {levelFilter && <input type="hidden" name="level" value={levelFilter} />}
          {searchFilter && <input type="hidden" name="search" value={searchFilter} />}
          <select
            name="source"
            defaultValue={sourceFilter}
            className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-700 bg-white"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-warmgray-100 px-3 py-1.5 text-sm font-medium text-warmgray-700 hover:bg-warmgray-200 transition-colors"
          >
            Filter
          </button>
        </form>

        {/* Search */}
        <form action="/admin/logs" method="GET" className="flex items-center gap-2">
          {levelFilter && <input type="hidden" name="level" value={levelFilter} />}
          {sourceFilter && <input type="hidden" name="source" value={sourceFilter} />}
          <input
            type="text"
            name="search"
            placeholder="Search messages..."
            defaultValue={searchFilter}
            className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-700 bg-white placeholder:text-warmgray-400 w-64"
          />
          <button
            type="submit"
            className="rounded-lg bg-warmgray-100 px-3 py-1.5 text-sm font-medium text-warmgray-700 hover:bg-warmgray-200 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Clear filters */}
        {(levelFilter || sourceFilter || searchFilter) && (
          <Link
            href="/admin/logs"
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* Logs table */}
      <div className="overflow-x-auto rounded-lg border border-warmgray-200">
        <table className="w-full text-sm">
          <thead className="bg-warmgray-50 border-b border-warmgray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600 w-44">
                Timestamp
              </th>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600 w-20">
                Level
              </th>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600 w-36">
                Source
              </th>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600">
                Message
              </th>
              <th className="text-left px-4 py-3 font-medium text-warmgray-600 w-64">
                Meta
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warmgray-100">
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center"
                >
                  <p className="text-warmgray-400 text-base font-medium">
                    No log entries found
                  </p>
                  <p className="text-warmgray-400 text-sm mt-1">
                    {levelFilter || sourceFilter || searchFilter
                      ? "Try adjusting your filters."
                      : "Click \"Run Ingest\" above to pull Vercel runtime logs, or wait for events to flow through the system."}
                  </p>
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr key={`${log.timestamp}-${idx}`} className="hover:bg-warmgray-50">
                  <td className="px-4 py-3 text-warmgray-500 font-mono text-xs whitespace-nowrap">
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })
                      : "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        levelColors[log.level] || "bg-warmgray-100 text-warmgray-600"
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-warmgray-700 font-mono text-xs">
                    {log.source}
                  </td>
                  <td className="px-4 py-3 text-warmgray-900 max-w-md truncate">
                    {log.message}
                  </td>
                  <td className="px-4 py-3 text-warmgray-500 font-mono text-xs max-w-xs truncate">
                    {log.meta ? JSON.stringify(log.meta) : "\u2014"}
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
              <a
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50 transition-colors"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50 transition-colors"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
