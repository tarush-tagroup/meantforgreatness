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
}

/**
 * Validate the EXIF date from a photo against the user-entered class date/time.
 * Returns a match status and human-readable explanation.
 */
export function validatePhotoDate(
  exifDateTaken: string | null,
  classDate: string, // YYYY-MM-DD
  classTime: string | null // e.g. "10:00 AM" or "14:00"
): DateValidationResult {
  if (!exifDateTaken) {
    return {
      dateMatch: "no_exif",
      dateNotes: "No date metadata found in photo. Cannot verify when the photo was taken.",
    };
  }

  // Parse EXIF date: "2025-03-12T10:30:00"
  const exifDate = new Date(exifDateTaken);
  if (isNaN(exifDate.getTime())) {
    return {
      dateMatch: "no_exif",
      dateNotes: `Could not parse photo date: ${exifDateTaken}`,
    };
  }

  // Extract just the date part from EXIF
  const exifDateStr = exifDateTaken.substring(0, 10); // "2025-03-12"

  // Compare dates
  const dateMatches = exifDateStr === classDate;

  if (!dateMatches) {
    // Check if it's within 1 day (could be timezone difference)
    const exifD = new Date(exifDateStr);
    const classD = new Date(classDate);
    const diffDays = Math.abs(
      (exifD.getTime() - classD.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 1) {
      return {
        dateMatch: "match",
        dateNotes: `Photo taken ${exifDateStr}, class logged ${classDate} (within 1 day — possible timezone difference).`,
      };
    }

    return {
      dateMatch: "mismatch",
      dateNotes: `Photo was taken on ${exifDateStr} but class was logged for ${classDate} (${Math.round(diffDays)} days apart).`,
    };
  }

  // Date matches — also check time if available
  if (classTime) {
    const exifHour = exifDate.getHours();
    const classHour = parseTimeToHour(classTime);

    if (classHour !== null) {
      const hourDiff = Math.abs(exifHour - classHour);
      if (hourDiff <= 2) {
        return {
          dateMatch: "match",
          dateNotes: `Photo taken ${exifDateTaken.replace("T", " ")}, class at ${classTime} on ${classDate}. Date and time match.`,
        };
      } else {
        return {
          dateMatch: "mismatch",
          dateNotes: `Photo date matches (${exifDateStr}) but time differs: photo at ${exifDate.getHours()}:${String(exifDate.getMinutes()).padStart(2, "0")}, class at ${classTime} (${hourDiff}h apart).`,
        };
      }
    }
  }

  return {
    dateMatch: "match",
    dateNotes: `Photo date ${exifDateStr} matches class date ${classDate}.`,
  };
}

/**
 * Parse a time string to an hour (0-23).
 */
function parseTimeToHour(time: string): number | null {
  // "10:00 AM", "2:30 PM"
  const amPm = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (amPm) {
    let hour = parseInt(amPm[1]);
    const isPm = amPm[3].toLowerCase() === "pm";
    if (isPm && hour !== 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    return hour;
  }
  // "14:00"
  const h24 = time.match(/(\d{1,2}):(\d{2})/);
  if (h24) return parseInt(h24[1]);
  return null;
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
