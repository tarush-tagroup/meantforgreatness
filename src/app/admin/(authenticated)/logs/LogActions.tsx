"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JobHistoryEntry {
  id: number;
  jobName: string;
  status: string;
  message: string | null;
  itemsProcessed: number | null;
  startedAt: string;
  finishedAt: string | null;
}

interface LogActionsProps {
  lastRun: {
    status: string;
    message: string | null;
    startedAt: string;
    finishedAt: string | null;
    itemsProcessed: number | null;
  } | null;
  recentJobs: JobHistoryEntry[];
}

interface ErrorEntry {
  timestamp: string;
  source: string;
  message: string;
}

export default function LogActions({ lastRun, recentJobs }: LogActionsProps) {
  const router = useRouter();
  const [ingestLoading, setIngestLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [recentErrors, setRecentErrors] = useState<ErrorEntry[] | null>(null);

  async function triggerIngest() {
    setIngestLoading(true);
    setFeedback(null);
    setRecentErrors(null);
    try {
      const res = await fetch("/api/admin/logs/trigger-ingest", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`Ingest complete: ${data.message || "done"}`);
      } else {
        setFeedback(`Ingest failed: ${data.error || data.message || "unknown error"}`);
      }
    } catch (err) {
      setFeedback(`Ingest failed: ${err instanceof Error ? err.message : "network error"}`);
    } finally {
      setIngestLoading(false);
      router.refresh();
    }
  }

  async function checkForErrors() {
    setCheckLoading(true);
    setFeedback(null);
    setRecentErrors(null);
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `/api/admin/logs?level=error&since=${encodeURIComponent(since)}&limit=20`
      );
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Check failed: ${data.error || "unknown error"}`);
        return;
      }
      const errors: ErrorEntry[] = data.data || [];
      if (errors.length === 0) {
        setFeedback("No errors in the last hour");
        setRecentErrors([]);
      } else {
        setFeedback(`Found ${data.pagination?.total || errors.length} error${errors.length !== 1 ? "s" : ""} in the last hour`);
        setRecentErrors(errors);
      }
    } catch (err) {
      setFeedback(`Check failed: ${err instanceof Error ? err.message : "network error"}`);
    } finally {
      setCheckLoading(false);
    }
  }

  const hasErrors = recentErrors !== null && recentErrors.length > 0;
  const noErrors = recentErrors !== null && recentErrors.length === 0;

  return (
    <div className="mb-6 rounded-lg border border-warmgray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Last ingest status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                !lastRun
                  ? "bg-warmgray-300"
                  : lastRun.status === "success"
                    ? "bg-teal-500"
                    : lastRun.status === "running"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium text-warmgray-900">
              Vercel Log Ingest
            </span>
          </div>
          {lastRun ? (
            <div className="text-xs text-warmgray-500 space-y-0.5 pl-[18px]">
              <p>
                Last run:{" "}
                {new Date(lastRun.startedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
                {" · "}
                <span
                  className={
                    lastRun.status === "success"
                      ? "text-teal-600"
                      : lastRun.status === "error"
                        ? "text-red-600"
                        : "text-amber-600"
                  }
                >
                  {lastRun.status}
                </span>
              </p>
              {lastRun.message && (
                <p className="truncate max-w-lg" title={lastRun.message}>
                  {lastRun.message}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-warmgray-400 pl-[18px]">
              No ingest runs recorded yet
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={triggerIngest}
            disabled={ingestLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-warmgray-200 bg-white px-3 py-2 text-sm font-medium text-warmgray-700 hover:bg-warmgray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {ingestLoading ? (
              <>
                <Spinner />
                Running…
              </>
            ) : (
              <>
                <RefreshIcon />
                Run Ingest
              </>
            )}
          </button>
          <button
            onClick={checkForErrors}
            disabled={checkLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checkLoading ? (
              <>
                <Spinner />
                Checking…
              </>
            ) : (
              <>
                <ShieldIcon />
                Check for Errors
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            hasErrors
              ? "bg-red-50 text-red-700"
              : noErrors
                ? "bg-teal-50 text-teal-700"
                : feedback.includes("failed") || feedback.includes("Failed")
                  ? "bg-red-50 text-red-700"
                  : "bg-teal-50 text-teal-700"
          }`}
        >
          {feedback}
        </div>
      )}

      {/* Error list */}
      {hasErrors && (
        <div className="mt-3 rounded-md border border-red-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-red-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-red-700 w-36">Time</th>
                <th className="text-left px-3 py-2 font-medium text-red-700 w-32">Source</th>
                <th className="text-left px-3 py-2 font-medium text-red-700">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100 bg-white">
              {recentErrors!.map((err, i) => (
                <tr key={`${err.timestamp}-${i}`} className="hover:bg-red-50/50">
                  <td className="px-3 py-2 text-warmgray-500 font-mono whitespace-nowrap">
                    {new Date(err.timestamp).toLocaleString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </td>
                  <td className="px-3 py-2 text-warmgray-700 font-mono">
                    {err.source}
                  </td>
                  <td className="px-3 py-2 text-warmgray-900 max-w-md truncate">
                    {err.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Job History */}
      {recentJobs.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-warmgray-700 mb-2">
            Job History
          </h3>
          <div className="rounded-md border border-warmgray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-warmgray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-warmgray-600 w-36">Time</th>
                  <th className="text-left px-3 py-2 font-medium text-warmgray-600 w-40">Job</th>
                  <th className="text-left px-3 py-2 font-medium text-warmgray-600 w-20">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-warmgray-600">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100 bg-white">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-warmgray-50/50">
                    <td className="px-3 py-2 text-warmgray-500 font-mono whitespace-nowrap">
                      {new Date(job.startedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </td>
                    <td className="px-3 py-2 text-warmgray-700 font-mono">
                      {job.jobName}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          job.status === "success"
                            ? "bg-teal-100 text-teal-700"
                            : job.status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-warmgray-900 max-w-md truncate" title={job.message || ""}>
                      {job.message || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-warmgray-400"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
