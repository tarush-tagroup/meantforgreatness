import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { analyzeClassLogPhotos, validatePhotoDate } from "@/lib/ai-photo-analysis";
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
  // EXIF date extracted from photo metadata (optional)
  exifDateTaken: z.string().nullable().optional(),
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

  const { classLogId, photoUrls, photoGps, exifDateTaken } = parsed.data;

  // Fetch the class log, orphanage name, orphanage GPS, and user-entered date/time
  const [row] = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      orphanageLat: orphanages.latitude,
      orphanageLon: orphanages.longitude,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
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

    // ── Location verification: GPS + AI vision (do both, prefer GPS) ──
    let gpsDistance: number | null = null;
    let gpsBasedMatch: "high" | "likely" | "uncertain" | "unlikely" | null = null;
    const verificationMethods: string[] = [];

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

      if (gpsDistance <= 200) gpsBasedMatch = "high";
      else if (gpsDistance <= 500) gpsBasedMatch = "likely";
      else if (gpsDistance <= 2000) gpsBasedMatch = "uncertain";
      else gpsBasedMatch = "unlikely";

      verificationMethods.push(`GPS (${gpsDistance}m from orphanage)`);
    }

    // AI vision is always run
    verificationMethods.push(`AI vision (${analysis.orphanageMatch})`);

    // Final match: prioritize GPS if available, otherwise use AI vision
    const finalOrphanageMatch = gpsBasedMatch || analysis.orphanageMatch;
    const methodSummary = `Verified by: ${verificationMethods.join(" + ")}`;
    const finalConfidenceNotes = `${methodSummary}. ${analysis.confidenceNotes}`;

    // ── Date verification: EXIF metadata vs user-entered date ──
    const dateValidation = validatePhotoDate(
      exifDateTaken || null,
      row.classDate,
      row.classTime
    );

    // Save all metadata to the class log
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
        exifDateTaken: exifDateTaken || null,
        aiDateMatch: dateValidation.dateMatch,
        aiDateNotes: dateValidation.dateNotes,
      })
      .where(eq(classLogs.id, classLogId));

    return NextResponse.json({
      analysis: {
        ...analysis,
        orphanageMatch: finalOrphanageMatch,
        confidenceNotes: finalConfidenceNotes,
        gpsDistance,
        dateMatch: dateValidation.dateMatch,
        dateNotes: dateValidation.dateNotes,
        verificationMethods,
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
