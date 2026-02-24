import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@/lib/logger";
import { db } from "@/db";
import { anthropicUsage } from "@/db/schema";

export interface PhotoAnalysisResult {
  kidsCount: number;
  location: string | null;
  photoTimestamp: string | null;
  orphanageMatch: "high" | "likely" | "uncertain" | "unlikely";
  confidenceNotes: string;
}

export interface ClassLogPhotoAnalysis {
  primaryPhotoUrl: string;
  kidsCount: number;
  location: string | null;
  photoTimestamp: string | null;
  orphanageMatch: "high" | "likely" | "uncertain" | "unlikely";
  confidenceNotes: string;
}

export interface DateValidationResult {
  dateMatch: "match" | "mismatch" | "no_exif";
  dateNotes: string;
  timeMatch: "match" | "mismatch" | "no_time" | "no_exif";
  timeNotes: string;
}

/**
 * Validate the EXIF date from a photo against the user-entered class date/time.
 * Returns separate match statuses for date and time.
 */
export function validatePhotoDate(
  exifDateTaken: string | null,
  classDate: string, // YYYY-MM-DD
  classTime: string | null // e.g. "09.00-10.00 am", "06:00 PM", "17.00-18.00"
): DateValidationResult {
  if (!exifDateTaken) {
    return {
      dateMatch: "no_exif",
      dateNotes: "No date metadata found in photo.",
      timeMatch: "no_exif",
      timeNotes: "No time metadata found in photo.",
    };
  }

  // Parse EXIF date: "2025-03-12T10:30:00"
  const exifDate = new Date(exifDateTaken);
  if (isNaN(exifDate.getTime())) {
    return {
      dateMatch: "no_exif",
      dateNotes: `Could not parse photo date: ${exifDateTaken}`,
      timeMatch: "no_exif",
      timeNotes: `Could not parse photo time: ${exifDateTaken}`,
    };
  }

  const exifDateStr = exifDateTaken.substring(0, 10); // "2025-03-12"
  const exifHour = exifDate.getHours();
  const exifMin = exifDate.getMinutes();
  const exifTimeStr = `${exifHour}:${String(exifMin).padStart(2, "0")}`;

  // ── Date validation ──
  let dateMatch: "match" | "mismatch" = "match";
  let dateNotes: string;

  const dateMatches = exifDateStr === classDate;

  if (dateMatches) {
    dateNotes = `Photo date ${exifDateStr} matches class date.`;
  } else {
    const exifD = new Date(exifDateStr);
    const classD = new Date(classDate);
    const diffDays = Math.abs(
      (exifD.getTime() - classD.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 1) {
      dateMatch = "match";
      dateNotes = `Photo taken ${exifDateStr}, class ${classDate} (within 1 day — timezone difference).`;
    } else {
      dateMatch = "mismatch";
      dateNotes = `Photo taken on ${exifDateStr}, class was ${classDate} (${Math.round(diffDays)} days apart).`;
    }
  }

  // ── Time validation ──
  let timeMatch: "match" | "mismatch" | "no_time" = "no_time";
  let timeNotes = "No class time entered.";

  if (classTime) {
    const range = parseTimeRange(classTime);

    if (!range) {
      timeMatch = "no_time";
      timeNotes = `Could not parse class time: "${classTime}".`;
    } else {
      const exifMinutes = exifHour * 60 + exifMin;
      const rangeStartMin = range.startHour * 60;
      const rangeEndMin = range.endHour * 60;
      const tolerance = 90; // ±90 minutes

      if (
        exifMinutes >= rangeStartMin - tolerance &&
        exifMinutes <= rangeEndMin + tolerance
      ) {
        timeMatch = "match";
        timeNotes = `Photo at ${exifTimeStr}, class ${classTime}. Within range.`;
      } else {
        timeMatch = "mismatch";
        const diffMin = exifMinutes < rangeStartMin - tolerance
          ? rangeStartMin - exifMinutes
          : exifMinutes - rangeEndMin;
        const diffH = Math.floor(diffMin / 60);
        const diffM = diffMin % 60;
        const diffStr = diffH > 0
          ? `${diffH}h${diffM > 0 ? ` ${diffM}m` : ""}`
          : `${diffM}m`;
        timeNotes = `Photo at ${exifTimeStr}, class ${classTime} (${diffStr} outside range).`;
      }
    }
  }

  return { dateMatch, dateNotes, timeMatch, timeNotes };
}

/**
 * Parse a class time string into a start/end hour range.
 * Handles many real-world formats:
 *   "09.00-10.00 am"  → { startHour: 9, endHour: 10 }
 *   "20.00-21.00 pm"  → { startHour: 20, endHour: 21 }
 *   "3.00 pm - 6.00 pm" → { startHour: 15, endHour: 18 }
 *   "06:00 PM"         → { startHour: 18, endHour: 18 }
 *   "17.00-18.00"      → { startHour: 17, endHour: 18 }
 *   "14:00"            → { startHour: 14, endHour: 14 }
 */
function parseTimeRange(
  time: string
): { startHour: number; endHour: number } | null {
  // Normalize: replace dots with colons for consistent parsing
  const normalized = time.replace(/\./g, ":");

  // Check if there's a range separator (hyphen with optional spaces)
  const rangeParts = normalized.split(/\s*-\s*/);

  if (rangeParts.length === 2) {
    // Range format: "09:00-10:00 am" or "3:00 pm - 6:00 pm" or "17:00-18:00"
    const startStr = rangeParts[0].trim();
    let endStr = rangeParts[1].trim();

    // Detect trailing am/pm on the end part
    const trailingAmPm = endStr.match(/\s*(am|pm)\s*$/i);
    const suffix = trailingAmPm ? trailingAmPm[1].toLowerCase() : null;
    if (trailingAmPm) {
      endStr = endStr.replace(/\s*(am|pm)\s*$/i, "").trim();
    }

    // Also check if start part has its own am/pm
    const startAmPm = startStr.match(/\s*(am|pm)\s*$/i);
    const startSuffix = startAmPm ? startAmPm[1].toLowerCase() : null;
    const cleanStart = startAmPm
      ? startStr.replace(/\s*(am|pm)\s*$/i, "").trim()
      : startStr;

    const startHour = parseSingleTime(cleanStart, startSuffix || suffix);
    const endHour = parseSingleTime(endStr, suffix);

    if (startHour !== null && endHour !== null) {
      return { startHour, endHour };
    }
    // If only one parsed, try the other as-is
    if (startHour !== null) return { startHour, endHour: startHour };
    if (endHour !== null) return { startHour: endHour, endHour };
    return null;
  }

  // Single time: "06:00 PM", "14:00", "10:00 am"
  const singleStr = normalized.trim();
  const singleAmPm = singleStr.match(/\s*(am|pm)\s*$/i);
  const singleSuffix = singleAmPm ? singleAmPm[1].toLowerCase() : null;
  const cleanSingle = singleAmPm
    ? singleStr.replace(/\s*(am|pm)\s*$/i, "").trim()
    : singleStr;

  const hour = parseSingleTime(cleanSingle, singleSuffix);
  if (hour !== null) return { startHour: hour, endHour: hour };

  return null;
}

/**
 * Parse a single time value (no am/pm suffix — that's passed separately).
 * "09:00" → 9, "3:30" → 3, "17:00" → 17
 * With suffix "pm": "3:00" → 15, "12:00" → 12
 * With suffix "am": "12:00" → 0, "9:00" → 9
 */
function parseSingleTime(
  timeStr: string,
  amPm: string | null
): number | null {
  const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;

  let hour = parseInt(match[1]);
  if (isNaN(hour) || hour < 0 || hour > 23) return null;

  if (amPm) {
    // 12-hour conversion — but only if hour ≤ 12
    if (hour <= 12) {
      if (amPm === "pm" && hour !== 12) hour += 12;
      if (amPm === "am" && hour === 12) hour = 0;
    }
    // If hour > 12, it's already 24h format; ignore am/pm (e.g. "20.00-21.00 pm")
  }

  return hour;
}

/** Token usage from a single API call */
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Calculate cost in USD cents from token usage.
 * Pricing for Claude Sonnet: $3/1M input, $15/1M output.
 */
function calculateCostCents(usage: TokenUsage): number {
  const inputCost = (usage.inputTokens / 1_000_000) * 300; // $3 = 300 cents
  const outputCost = (usage.outputTokens / 1_000_000) * 1500; // $15 = 1500 cents
  return Math.round(inputCost + outputCost);
}

/**
 * Analyze a single class log photo using Claude Vision API.
 * Extracts: kid count, location hints, timestamp, and whether it looks like it's at the named orphanage.
 * Also returns token usage for cost tracking.
 */
async function analyzePhoto(
  client: Anthropic,
  photoUrl: string,
  orphanageName: string
): Promise<{ result: PhotoAnalysisResult; usage: TokenUsage }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: photoUrl,
            },
          },
          {
            type: "text",
            text: `Analyze this classroom photo from an orphanage called "${orphanageName}" in Bali, Indonesia. Please extract the following information:

1. **Kids count**: How many children/students can you see in the photo? Give your best count. If you can't see any children, return 0.
2. **Location**: Describe any visible location cues (signage, building features, landscape, indoor/outdoor). Return null if no location cues are visible.
3. **Photo timestamp**: If there are any visible clocks, date displays, or EXIF-like indicators of when the photo was taken, note them. Return null if no time indicators.
4. **Orphanage match**: Based on visual cues, does this look like it could be at an orphanage/school called "${orphanageName}"? Consider:
   - Are there children in a classroom setting?
   - Does the setting look like a Balinese orphanage/school?
   - Any visible signage matching the name?
   Rate as: "high" (strong match), "likely" (reasonable match), "uncertain" (unclear), "unlikely" (doesn't match)

Respond ONLY in this exact JSON format (no markdown, no backticks):
{"kidsCount": <number>, "location": <string or null>, "photoTimestamp": <string or null>, "orphanageMatch": "<high|likely|uncertain|unlikely>", "confidenceNotes": "<brief notes about your confidence in each assessment>"}`,
          },
        ],
      },
    ],
  });

  const usage: TokenUsage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      result: {
        kidsCount: 0,
        location: null,
        photoTimestamp: null,
        orphanageMatch: "uncertain",
        confidenceNotes: "AI analysis returned no text response",
      },
      usage,
    };
  }

  try {
    const parsed = JSON.parse(textBlock.text.trim());
    return {
      result: {
        kidsCount: typeof parsed.kidsCount === "number" ? parsed.kidsCount : 0,
        location: parsed.location || null,
        photoTimestamp: parsed.photoTimestamp || null,
        orphanageMatch: ["high", "likely", "uncertain", "unlikely"].includes(
          parsed.orphanageMatch
        )
          ? parsed.orphanageMatch
          : "uncertain",
        confidenceNotes:
          parsed.confidenceNotes || "No additional confidence notes",
      },
      usage,
    };
  } catch {
    return {
      result: {
        kidsCount: 0,
        location: null,
        photoTimestamp: null,
        orphanageMatch: "uncertain",
        confidenceNotes: `AI analysis response could not be parsed: ${textBlock.text.substring(0, 200)}`,
      },
      usage,
    };
  }
}

/**
 * Analyze all photos for a class log. Returns aggregated metadata using the
 * photo with the most kids detected as the primary source.
 * Also records token usage to the anthropic_usage table.
 */
export async function analyzeClassLogPhotos(
  photoUrls: string[],
  orphanageName: string,
  classLogId?: string
): Promise<ClassLogPhotoAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn("ai:photos", "ANTHROPIC_API_KEY not set — skipping AI photo analysis");
    return null;
  }

  if (photoUrls.length === 0) return null;

  const client = new Anthropic({ apiKey });

  // Analyze all photos in parallel
  const results = await Promise.allSettled(
    photoUrls.map((url) => analyzePhoto(client, url, orphanageName))
  );

  const successfulResults: { url: string; result: PhotoAnalysisResult; usage: TokenUsage }[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      successfulResults.push({ url: photoUrls[i], result: r.value.result, usage: r.value.usage });
      totalInputTokens += r.value.usage.inputTokens;
      totalOutputTokens += r.value.usage.outputTokens;
    }
  }

  // Record aggregated usage (fire-and-forget)
  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    const totalCostCents = calculateCostCents({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
    db.insert(anthropicUsage)
      .values({
        useCase: "photo_analysis",
        model: "claude-sonnet-4-20250514",
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        costCents: totalCostCents,
        classLogId: classLogId || null,
        metadata: { photoCount: photoUrls.length, successCount: successfulResults.length },
      })
      .catch((err) => {
        console.error("[ai-photo-analysis] Failed to record usage:", err);
      });
  }

  if (successfulResults.length === 0) {
    return null;
  }

  // Pick the photo with the most kids as the primary photo
  const primary = successfulResults.reduce((best, current) =>
    current.result.kidsCount > best.result.kidsCount ? current : best
  );

  return {
    primaryPhotoUrl: primary.url,
    kidsCount: primary.result.kidsCount,
    location: primary.result.location,
    photoTimestamp: primary.result.photoTimestamp,
    orphanageMatch: primary.result.orphanageMatch,
    confidenceNotes: primary.result.confidenceNotes,
  };
}
