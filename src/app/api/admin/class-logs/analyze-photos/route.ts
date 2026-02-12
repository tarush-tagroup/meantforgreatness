import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { analyzeClassLogPhotos } from "@/lib/ai-photo-analysis";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { haversineDistance } from "@/lib/geocode";
import { db } from "@/db";
import { classLogs, orphanages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const analyzeSchema = z.object({
  classLogId: z.string().uuid(),
  photoUrls: z.array(z.string().url()).min(1),
  // GPS coordinates extracted from the first photo's EXIF data (optional)
  photoGps: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  const [user, authError] = await withAuth("class_logs:create");
  if (authError) return authError;

  // Rate limit: 30 AI analysis requests per hour per user
  const rateLimitResult = checkRateLimit(
    `ai-analysis:${user!.id}`,
    RATE_LIMITS.aiAnalysis
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "AI analysis rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
          ),
        },
      }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { classLogId, photoUrls, photoGps } = parsed.data;

  // Fetch the class log, orphanage name, and orphanage GPS coordinates
  const [row] = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      orphanageLat: orphanages.latitude,
      orphanageLon: orphanages.longitude,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .where(eq(classLogs.id, classLogId))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  const orphanageName = row.orphanageName || row.orphanageId;

  try {
    const analysis = await analyzeClassLogPhotos(photoUrls, orphanageName);

    if (!analysis) {
      return NextResponse.json(
        { error: "AI analysis unavailable — ANTHROPIC_API_KEY may not be set" },
        { status: 503 }
      );
    }

    // Calculate GPS-based orphanage match if both coordinates are available
    let gpsDistance: number | null = null;
    let gpsBasedMatch: "high" | "likely" | "uncertain" | "unlikely" | null = null;

    if (
      photoGps &&
      row.orphanageLat != null &&
      row.orphanageLon != null
    ) {
      gpsDistance = Math.round(
        haversineDistance(
          photoGps.latitude,
          photoGps.longitude,
          row.orphanageLat,
          row.orphanageLon
        )
      );

      // GPS-based match: within 200m = high match
      if (gpsDistance <= 200) {
        gpsBasedMatch = "high";
      } else if (gpsDistance <= 500) {
        gpsBasedMatch = "likely";
      } else if (gpsDistance <= 2000) {
        gpsBasedMatch = "uncertain";
      } else {
        gpsBasedMatch = "unlikely";
      }
    }

    // Use GPS-based match if available (more reliable), otherwise fall back to AI vision match
    const finalOrphanageMatch = gpsBasedMatch || analysis.orphanageMatch;
    const finalConfidenceNotes = gpsBasedMatch
      ? `GPS: Photo taken ${gpsDistance}m from orphanage (threshold: 200m). ${analysis.confidenceNotes}`
      : analysis.confidenceNotes;

    // Save the AI metadata to the class log
    await db
      .update(classLogs)
      .set({
        aiKidsCount: analysis.kidsCount,
        aiLocation: analysis.location,
        aiPhotoTimestamp: analysis.photoTimestamp,
        aiOrphanageMatch: finalOrphanageMatch,
        aiConfidenceNotes: finalConfidenceNotes,
        aiPrimaryPhotoUrl: analysis.primaryPhotoUrl,
        aiAnalyzedAt: new Date(),
        photoLatitude: photoGps?.latitude ?? null,
        photoLongitude: photoGps?.longitude ?? null,
        aiGpsDistance: gpsDistance,
      })
      .where(eq(classLogs.id, classLogId));

    return NextResponse.json({
      analysis: {
        ...analysis,
        orphanageMatch: finalOrphanageMatch,
        confidenceNotes: finalConfidenceNotes,
        gpsDistance,
      },
    });
  } catch (error) {
    console.error("AI photo analysis error:", error);
    return NextResponse.json(
      { error: "AI analysis failed — please try again later" },
      { status: 500 }
    );
  }
}
