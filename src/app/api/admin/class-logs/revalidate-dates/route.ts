import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { classLogs } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { validatePhotoDate } from "@/lib/ai-photo-analysis";
import { logger } from "@/lib/logger";

export async function POST() {
  const [, authError] = await withAuth("class_logs:view_all");
  if (authError) return authError;

  const rows = await db
    .select({
      id: classLogs.id,
      exifDateTaken: classLogs.exifDateTaken,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      aiDateMatch: classLogs.aiDateMatch,
    })
    .from(classLogs)
    .where(
      and(
        eq(classLogs.aiDateMatch, "match"),
        isNotNull(classLogs.exifDateTaken)
      )
    );

  let updatedCount = 0;

  for (const row of rows) {
    const result = validatePhotoDate(
      row.exifDateTaken,
      row.classDate,
      row.classTime
    );

    if (result.dateMatch !== row.aiDateMatch || result.timeMatch !== "no_exif") {
      await db
        .update(classLogs)
        .set({
          aiDateMatch: result.dateMatch,
          aiDateNotes: result.dateNotes,
          aiTimeMatch: result.timeMatch,
          aiTimeNotes: result.timeNotes,
        })
        .where(eq(classLogs.id, row.id));
      if (result.dateMatch !== row.aiDateMatch) updatedCount++;
    }
  }

  logger.info("admin:revalidate", "Date revalidation complete", {
    totalChecked: rows.length,
    updatedCount,
  });

  return NextResponse.json({
    totalChecked: rows.length,
    updatedCount,
    message: `Revalidated ${rows.length} records, ${updatedCount} changed from match to mismatch.`,
  });
}
