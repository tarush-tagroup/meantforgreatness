import { list, del } from "@vercel/blob";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LogEntry {
  level: string;
  source: string;
  message: string;
  meta: Record<string, unknown> | null;
  timestamp: string; // ISO 8601
}

export interface LogFilter {
  level?: string;
  source?: string;
  search?: string; // text search in message (requires content fetch)
  since?: Date; // only entries after this date
  before?: Date; // only entries before this date
}

export interface LogPage {
  entries: LogEntry[];
  total: number;
  hasMore: boolean;
}

// ─── Path Encoding ──────────────────────────────────────────────────────────

const LOG_LEVELS = ["error", "warn", "info"] as const;

/** Encode source for blob path: "stripe:checkout" → "stripe--checkout" */
export function encodeSource(source: string): string {
  return source.replace(/:/g, "--");
}

/** Decode source from blob path: "stripe--checkout" → "stripe:checkout" */
export function decodeSource(encoded: string): string {
  return encoded.replace(/--/g, ":");
}

/** Extract the timestamp (ms) from a blob pathname like ".../1739347800000-a3f2c1.json" */
function extractTimestamp(pathname: string): number {
  const filename = pathname.split("/").pop() || "";
  const tsStr = filename.split("-")[0];
  return parseInt(tsStr, 10) || 0;
}

/** Get an array of YYYY-MM-DD date strings between two dates (inclusive). */
function getDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  current.setUTCHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setUTCHours(23, 59, 59, 999);

  while (current <= endDay) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ─── List Logs ──────────────────────────────────────────────────────────────

/**
 * List log entries from Vercel Blob with filtering and pagination.
 *
 * Strategy:
 * 1. Build prefix(es) from filters (date + level + source)
 * 2. Call list() for each prefix, collect blob metadata
 * 3. Sort by timestamp descending
 * 4. Apply text search if needed (requires fetching blob content)
 * 5. Paginate in-memory (offset + limit)
 */
export async function listLogs(
  filter: LogFilter = {},
  opts: { limit?: number; offset?: number } = {}
): Promise<LogPage> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;

  // Determine date range (default: last 7 days)
  const now = new Date();
  const since = filter.since ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const before = filter.before ?? now;
  const dates = getDateRange(since, before);

  // Determine which levels to query
  const levels: string[] = filter.level
    ? [filter.level]
    : [...LOG_LEVELS];

  // Build all prefixes to query
  const prefixes: string[] = [];
  for (const date of dates) {
    for (const level of levels) {
      if (filter.source) {
        prefixes.push(`logs/${date}/${level}/${encodeSource(filter.source)}/`);
      } else {
        prefixes.push(`logs/${date}/${level}/`);
      }
    }
  }

  // Fetch all blob metadata in parallel (batched to avoid too many concurrent requests)
  const allBlobs: Array<{ url: string; pathname: string; downloadUrl: string }> = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < prefixes.length; i += BATCH_SIZE) {
    const batch = prefixes.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (prefix) => {
        const blobs: Array<{ url: string; pathname: string; downloadUrl: string }> = [];
        let cursor: string | undefined;
        let hasMore = true;

        // Paginate through all blobs under this prefix (up to 1000 per list call)
        while (hasMore) {
          const result = await list({
            prefix,
            limit: 1000,
            cursor,
          });
          blobs.push(...result.blobs.map((b) => ({
            url: b.url,
            pathname: b.pathname,
            downloadUrl: b.downloadUrl,
          })));
          cursor = result.cursor;
          hasMore = result.hasMore;

          // Safety cap: don't scan more than 5000 blobs per prefix
          if (blobs.length >= 5000) break;
        }
        return blobs;
      })
    );
    allBlobs.push(...results.flat());
  }

  // Sort by timestamp descending (newest first)
  allBlobs.sort((a, b) => extractTimestamp(b.pathname) - extractTimestamp(a.pathname));

  // Filter by source if no source prefix was used (source-only filter without level)
  let filteredBlobs = allBlobs;
  if (filter.source && !filter.level) {
    const encodedSource = encodeSource(filter.source);
    filteredBlobs = allBlobs.filter((b) => b.pathname.includes(`/${encodedSource}/`));
  }

  // Filter by `since` timestamp more precisely (date-level prefix is coarse)
  if (filter.since) {
    const sinceMs = filter.since.getTime();
    filteredBlobs = filteredBlobs.filter((b) => extractTimestamp(b.pathname) >= sinceMs);
  }
  if (filter.before) {
    const beforeMs = filter.before.getTime();
    filteredBlobs = filteredBlobs.filter((b) => extractTimestamp(b.pathname) <= beforeMs);
  }

  // If text search, we need to fetch blob content to filter
  if (filter.search) {
    const searchLower = filter.search.toLowerCase();
    // Cap content fetches at 500 to avoid excessive HTTP calls
    const candidates = filteredBlobs.slice(0, 500);
    const entries = await fetchBlobContents(candidates);
    const matched = entries.filter(
      (e) => e.message.toLowerCase().includes(searchLower)
    );

    const total = matched.length;
    const page = matched.slice(offset, offset + limit);

    return {
      entries: page,
      total,
      hasMore: offset + limit < total,
    };
  }

  // No text search — paginate from blob metadata, then fetch content for current page only
  const total = filteredBlobs.length;
  const pageBlobs = filteredBlobs.slice(offset, offset + limit);
  const entries = await fetchBlobContents(pageBlobs);

  return {
    entries,
    total,
    hasMore: offset + limit < total,
  };
}

// ─── Fetch Blob Contents ────────────────────────────────────────────────────

/** Fetch and parse JSON content from multiple blobs in parallel. */
async function fetchBlobContents(
  blobs: Array<{ url: string; pathname: string; downloadUrl: string }>
): Promise<LogEntry[]> {
  const FETCH_BATCH = 20;
  const entries: LogEntry[] = [];

  for (let i = 0; i < blobs.length; i += FETCH_BATCH) {
    const batch = blobs.slice(i, i + FETCH_BATCH);
    const results = await Promise.all(
      batch.map(async (blob) => {
        try {
          const res = await fetch(blob.downloadUrl);
          if (!res.ok) return null;
          const data = await res.json();
          return data as LogEntry;
        } catch {
          return null;
        }
      })
    );
    entries.push(...results.filter((e): e is LogEntry => e !== null));
  }

  return entries;
}

// ─── List Sources ───────────────────────────────────────────────────────────

/**
 * Get all distinct source names by scanning blob pathnames from the last 7 days.
 * Extracts source from path segment — no content fetch needed.
 */
export async function listSources(): Promise<string[]> {
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dates = getDateRange(since, now);

  const sources = new Set<string>();

  // Scan all date/level prefixes
  const prefixes: string[] = [];
  for (const date of dates) {
    for (const level of LOG_LEVELS) {
      prefixes.push(`logs/${date}/${level}/`);
    }
  }

  // Fetch blob listings in parallel batches
  const BATCH_SIZE = 10;
  for (let i = 0; i < prefixes.length; i += BATCH_SIZE) {
    const batch = prefixes.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (prefix) => {
        try {
          const result = await list({ prefix, limit: 100 });
          return result.blobs.map((b) => b.pathname);
        } catch {
          return [];
        }
      })
    );

    for (const pathnames of results) {
      for (const pathname of pathnames) {
        // Path: logs/{date}/{level}/{encoded_source}/{filename}.json
        const parts = pathname.split("/");
        if (parts.length >= 4) {
          const encodedSource = parts[3];
          sources.add(decodeSource(encodedSource));
        }
      }
    }
  }

  return Array.from(sources).sort();
}

// ─── Delete Old Logs ────────────────────────────────────────────────────────

/**
 * Delete all log blobs older than the cutoff date.
 * Iterates over date prefixes and batch-deletes.
 */
export async function deleteOldLogs(
  cutoffDate: Date
): Promise<{ deletedCount: number }> {
  let deletedCount = 0;

  // Go back up to 90 days from cutoff to find old blobs
  const startDate = new Date(cutoffDate);
  startDate.setDate(startDate.getDate() - 60);
  const dates = getDateRange(startDate, cutoffDate);

  for (const date of dates) {
    const prefix = `logs/${date}/`;
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await list({ prefix, limit: 1000, cursor });
      if (result.blobs.length > 0) {
        const urls = result.blobs.map((b) => b.url);
        await del(urls);
        deletedCount += urls.length;
      }
      cursor = result.cursor;
      hasMore = result.hasMore;
    }
  }

  return { deletedCount };
}
