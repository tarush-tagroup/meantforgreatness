import Anthropic from "@anthropic-ai/sdk";

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

/**
 * Analyze a single class log photo using Claude Vision API.
 * Extracts: kid count, location hints, timestamp, and whether it looks like it's at the named orphanage.
 */
async function analyzePhoto(
  client: Anthropic,
  photoUrl: string,
  orphanageName: string
): Promise<PhotoAnalysisResult> {
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

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      kidsCount: 0,
      location: null,
      photoTimestamp: null,
      orphanageMatch: "uncertain",
      confidenceNotes: "AI analysis returned no text response",
    };
  }

  try {
    const result = JSON.parse(textBlock.text.trim());
    return {
      kidsCount: typeof result.kidsCount === "number" ? result.kidsCount : 0,
      location: result.location || null,
      photoTimestamp: result.photoTimestamp || null,
      orphanageMatch: ["high", "likely", "uncertain", "unlikely"].includes(
        result.orphanageMatch
      )
        ? result.orphanageMatch
        : "uncertain",
      confidenceNotes:
        result.confidenceNotes || "No additional confidence notes",
    };
  } catch {
    return {
      kidsCount: 0,
      location: null,
      photoTimestamp: null,
      orphanageMatch: "uncertain",
      confidenceNotes: `AI analysis response could not be parsed: ${textBlock.text.substring(0, 200)}`,
    };
  }
}

/**
 * Analyze all photos for a class log. Returns aggregated metadata using the
 * photo with the most kids detected as the primary source.
 */
export async function analyzeClassLogPhotos(
  photoUrls: string[],
  orphanageName: string
): Promise<ClassLogPhotoAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — skipping AI photo analysis");
    return null;
  }

  if (photoUrls.length === 0) return null;

  const client = new Anthropic({ apiKey });

  // Analyze all photos in parallel
  const results = await Promise.allSettled(
    photoUrls.map((url) => analyzePhoto(client, url, orphanageName))
  );

  const successfulResults: { url: string; result: PhotoAnalysisResult }[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      successfulResults.push({ url: photoUrls[i], result: r.value });
    }
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
