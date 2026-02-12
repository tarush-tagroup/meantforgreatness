/**
 * One-off script to trigger AI photo analysis for class logs.
 * Re-runs analysis on ALL logs (not just unanalyzed) to pick up new date/GPS validation.
 *
 * Usage: npx tsx --env-file=.env.local scripts/trigger-ai-analysis.ts
 * Or with explicit env: ANTHROPIC_API_KEY=... DATABASE_URL=... npx tsx scripts/trigger-ai-analysis.ts
 */

import { db } from "../src/db";
import { classLogs, classLogPhotos, orphanages } from "../src/db/schema";
import { eq, asc } from "drizzle-orm";
import { analyzeClassLogPhotos, validatePhotoDate } from "../src/lib/ai-photo-analysis";
import { haversineDistance } from "../src/lib/geocode";

async function main() {
  const forceAll = process.argv.includes("--all");
  console.log(forceAll
    ? "Re-running AI analysis on ALL class logs..."
    : "Finding class logs needing analysis..."
  );

  // Get all class logs (or just unanalyzed if not --all)
  const logsToAnalyze = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      orphanageLat: orphanages.latitude,
      orphanageLon: orphanages.longitude,
      photoLatitude: classLogs.photoLatitude,
      photoLongitude: classLogs.photoLongitude,
      exifDateTaken: classLogs.exifDateTaken,
      aiAnalyzedAt: classLogs.aiAnalyzedAt,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id));

  const filtered = forceAll
    ? logsToAnalyze
    : logsToAnalyze.filter((l) => !l.aiAnalyzedAt);

  if (filtered.length === 0) {
    console.log("No class logs to analyze. Use --all to re-run on all logs.");
    process.exit(0);
  }

  console.log(`Found ${filtered.length} class log(s) to analyze.\n`);

  for (const log of filtered) {
    console.log(`Analyzing class log ${log.id} (${log.orphanageName})...`);

    // Get photos for this class log
    const photos = await db
      .select({ url: classLogPhotos.url })
      .from(classLogPhotos)
      .where(eq(classLogPhotos.classLogId, log.id))
      .orderBy(asc(classLogPhotos.sortOrder));

    const photoUrls = photos.map((p) => p.url);

    if (photoUrls.length === 0) {
      console.log("  No photos found. Skipping.");
      continue;
    }

    console.log(`  Found ${photoUrls.length} photo(s). Calling Claude Vision API...`);

    try {
      const analysis = await analyzeClassLogPhotos(
        photoUrls,
        log.orphanageName || log.orphanageId
      );

      if (!analysis) {
        console.log("  Analysis returned null (ANTHROPIC_API_KEY may not be set).");
        continue;
      }

      // ── Location: GPS + AI vision (do both, prefer GPS) ──
      let gpsDistance: number | null = null;
      let gpsBasedMatch: string | null = null;
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

      const finalMatch = gpsBasedMatch || analysis.orphanageMatch;
      const methodSummary = `Verified by: ${verificationMethods.join(" + ")}`;
      const finalNotes = `${methodSummary}. ${analysis.confidenceNotes}`;

      // ── Date: EXIF metadata vs user-entered date ──
      const dateValidation = validatePhotoDate(
        log.exifDateTaken || null,
        log.classDate,
        log.classTime
      );

      // Save results to DB
      await db
        .update(classLogs)
        .set({
          aiKidsCount: analysis.kidsCount,
          aiLocation: analysis.location,
          aiPhotoTimestamp: analysis.photoTimestamp,
          aiOrphanageMatch: finalMatch,
          aiConfidenceNotes: finalNotes,
          aiPrimaryPhotoUrl: analysis.primaryPhotoUrl,
          aiAnalyzedAt: new Date(),
          aiGpsDistance: gpsDistance,
          aiDateMatch: dateValidation.dateMatch,
          aiDateNotes: dateValidation.dateNotes,
        })
        .where(eq(classLogs.id, log.id));

      console.log(`  ✓ Analysis complete:`);
      console.log(`    Kids count: ${analysis.kidsCount}`);
      console.log(`    Location match: ${finalMatch} (${verificationMethods.join(" + ")})`);
      console.log(`    Date match: ${dateValidation.dateMatch} — ${dateValidation.dateNotes}`);
      console.log(`    AI notes: ${analysis.confidenceNotes}`);
    } catch (error) {
      console.error(`  ✗ Analysis failed:`, error);
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
