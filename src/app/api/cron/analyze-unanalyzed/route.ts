import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "@/lib/timing-safe";
import { db } from "@/db";
import { classLogs, classLogPhotos, orphanages } from "@/db/schema";
import { eq, isNull, isNotNull, sql } from "drizzle-orm";
import { analyzeClassLogPhotos, validatePhotoDate } from "@/lib/ai-photo-analysis";
import { haversineDistance } from "@/lib/geocode";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/analyze-unanalyzed
 *
 * Nightly cron job that finds class logs with photos but no AI analysis
 * and runs analyzeClassLogPhotos on them. Handles cases where the
 * original fire-and-forget analysis failed or was missed.
 *
 * Limited to 5 logs per run to stay within the 60s serverless timeout
 * (each Claude Vision call takes 5-15s).
 */
const MAX_PER_RUN = 5;

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (
    !cronSecret ||
    !bearerToken ||
    !timingSafeEqual(bearerToken, cronSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find class logs that have photos but haven't been analyzed
    const unanalyzed = await db
      .select({
        id: classLogs.id,
        orphanageId: classLogs.orphanageId,
        orphanageName: orphanages.name,
        orphanageLat: orphanages.latitude,
        orphanageLon: orphanages.longitude,
        classDate: classLogs.classDate,
        classTime: classLogs.classTime,
        photoLatitude: classLogs.photoLatitude,
        photoLongitude: classLogs.photoLongitude,
        exifDateTaken: classLogs.exifDateTaken,
      })
      .from(classLogs)
      .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
      .where(
        sql`${classLogs.aiAnalyzedAt} is null and ${classLogs.photoUrl} is not null`
      )
      .limit(MAX_PER_RUN);

    if (unanalyzed.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unanalyzed class logs found",
        analyzed: 0,
      });
    }

    logger
      .info("cron:analyze", `Found ${unanalyzed.length} unanalyzed class logs`)
      .catch(() => {});

    let analyzed = 0;
    let failed = 0;

    for (const log of unanalyzed) {
      try {
        // Get photo URLs for this class log
        const photos = await db
          .select({ url: classLogPhotos.url })
          .from(classLogPhotos)
          .where(eq(classLogPhotos.classLogId, log.id));

        // Fall back to legacy photoUrl if no photos in the join table
        const photoUrls = photos.length > 0
          ? photos.map((p) => p.url)
          : [];

        if (photoUrls.length === 0) {
          // Skip — no actual photo URLs to analyze
          continue;
        }

        const orphanageName = log.orphanageName || log.orphanageId || "Unknown";

        // Run AI analysis
        const analysis = await analyzeClassLogPhotos(
          photoUrls,
          orphanageName,
          log.id
        );

        if (!analysis) {
          failed++;
          continue;
        }

        // GPS distance verification
        let gpsDistance: number | null = null;
        let gpsBasedMatch: "high" | "likely" | "uncertain" | "unlikely" | null =
          null;
        const verificationMethods: string[] = [];

        if (
          log.photoLatitude != null &&
          log.photoLongitude != null &&
          log.orphanageLat != null &&
          log.orphanageLon != null
        ) {
          gpsDistance = Math.round(
            haversineDistance(
              log.photoLatitude,
              log.photoLongitude,
              log.orphanageLat,
              log.orphanageLon
            )
          );

          if (gpsDistance <= 200) gpsBasedMatch = "high";
          else if (gpsDistance <= 500) gpsBasedMatch = "likely";
          else if (gpsDistance <= 2000) gpsBasedMatch = "uncertain";
          else gpsBasedMatch = "unlikely";

          verificationMethods.push(`GPS (${gpsDistance}m from orphanage)`);
        }

        verificationMethods.push(`AI vision (${analysis.orphanageMatch})`);

        const finalOrphanageMatch =
          gpsBasedMatch || analysis.orphanageMatch;
        const methodSummary = `Verified by: ${verificationMethods.join(" + ")}`;
        const finalConfidenceNotes = `${methodSummary}. ${analysis.confidenceNotes}`;

        // Date/time verification
        const dateValidation = validatePhotoDate(
          log.exifDateTaken || null,
          log.classDate,
          log.classTime
        );

        // Update class log with AI results
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
            aiGpsDistance: gpsDistance,
            aiDateMatch: dateValidation.dateMatch,
            aiDateNotes: dateValidation.dateNotes,
            aiTimeMatch: dateValidation.timeMatch,
            aiTimeNotes: dateValidation.timeNotes,
          })
          .where(eq(classLogs.id, log.id));

        analyzed++;
      } catch (err) {
        failed++;
        logger
          .error("cron:analyze", `Failed to analyze class log ${log.id}`, {
            error: err instanceof Error ? err.message : String(err),
          })
          .catch(() => {});
      }
    }

    const message = `Analyzed ${analyzed}/${unanalyzed.length} class logs (${failed} failed)`;
    logger.info("cron:analyze", message).catch(() => {});

    return NextResponse.json({
      success: true,
      message,
      analyzed,
      failed,
      total: unanalyzed.length,
    });
  } catch (err) {
    logger
      .error("cron:analyze", "Cron job failed", {
        error: err instanceof Error ? err.message : String(err),
      })
      .catch(() => {});

    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
