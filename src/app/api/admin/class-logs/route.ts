import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { classLogs, classLogPhotos, orphanages, users } from "@/db/schema";
import { eq, desc, and, gte, lte, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { analyzeClassLogPhotos, validatePhotoDate } from "@/lib/ai-photo-analysis";
import { haversineDistance } from "@/lib/geocode";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/with-logging";

const photoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const createSchema = z.object({
  orphanageId: z.string().min(1),
  teacherId: z.string().min(1, "Teacher is required"),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  classTime: z.string().max(20).optional(),
  studentCount: z.number().int().min(0).optional(),
  photos: z.array(photoSchema).min(1, "At least one photo is required"),
  notes: z.string().max(2000).optional(),
  photoGps: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .nullable()
    .optional(),
  exifDateTaken: z.string().nullable().optional(),
});

async function getHandler(req: NextRequest) {
  const [, authError] = await withAuth("class_logs:view_all");
  if (authError) return authError;

  const url = req.nextUrl;
  const orphanageId = url.searchParams.get("orphanageId");
  const teacherId = url.searchParams.get("teacherId");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (orphanageId) conditions.push(eq(classLogs.orphanageId, orphanageId));
  if (teacherId) conditions.push(eq(classLogs.teacherId, teacherId));
  if (dateFrom) conditions.push(gte(classLogs.classDate, dateFrom));
  if (dateTo) conditions.push(lte(classLogs.classDate, dateTo));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: classLogs.id,
      orphanageId: classLogs.orphanageId,
      orphanageName: orphanages.name,
      teacherId: classLogs.teacherId,
      teacherName: users.name,
      classDate: classLogs.classDate,
      classTime: classLogs.classTime,
      studentCount: classLogs.studentCount,
      photoUrl: classLogs.photoUrl,
      notes: classLogs.notes,
      aiKidsCount: classLogs.aiKidsCount,
      aiLocation: classLogs.aiLocation,
      aiOrphanageMatch: classLogs.aiOrphanageMatch,
      aiPrimaryPhotoUrl: classLogs.aiPrimaryPhotoUrl,
      aiAnalyzedAt: classLogs.aiAnalyzedAt,
      createdAt: classLogs.createdAt,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .where(whereClause)
    .orderBy(desc(classLogs.classDate), desc(classLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch photos for these class logs
  const logIds = rows.map((r) => r.id);
  let allPhotos: { classLogId: string; url: string; caption: string | null; sortOrder: number }[] = [];
  if (logIds.length > 0) {
    allPhotos = await db
      .select({
        classLogId: classLogPhotos.classLogId,
        url: classLogPhotos.url,
        caption: classLogPhotos.caption,
        sortOrder: classLogPhotos.sortOrder,
      })
      .from(classLogPhotos)
      .where(sql`${classLogPhotos.classLogId} IN (${sql.join(logIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(asc(classLogPhotos.sortOrder));
  }

  const photosByLog = new Map<string, typeof allPhotos>();
  for (const p of allPhotos) {
    const list = photosByLog.get(p.classLogId) || [];
    list.push(p);
    photosByLog.set(p.classLogId, list);
  }

  const classLogsWithPhotos = rows.map((row) => ({
    ...row,
    photos: photosByLog.get(row.id) || [],
  }));

  // Get total count for pagination
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(classLogs)
    .where(whereClause);

  return NextResponse.json({
    classLogs: classLogsWithPhotos,
    pagination: {
      page,
      limit,
      total: Number(countResult?.count || 0),
      totalPages: Math.ceil(Number(countResult?.count || 0) / limit),
    },
  });
}

async function postHandler(req: NextRequest) {
  const [user, authError] = await withAuth("class_logs:create");
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // Verify orphanage exists
  const [orphanage] = await db
    .select()
    .from(orphanages)
    .where(eq(orphanages.id, parsed.data.orphanageId))
    .limit(1);

  if (!orphanage) {
    return NextResponse.json(
      { error: "Orphanage not found" },
      { status: 404 }
    );
  }

  // Verify teacher exists and is active
  const [teacher] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, parsed.data.teacherId),
        sql`${users.status} = 'active'`
      )
    )
    .limit(1);

  if (!teacher) {
    return NextResponse.json(
      { error: "Teacher not found or inactive" },
      { status: 404 }
    );
  }

  const [created] = await db
    .insert(classLogs)
    .values({
      orphanageId: parsed.data.orphanageId,
      teacherId: parsed.data.teacherId,
      classDate: parsed.data.classDate,
      classTime: parsed.data.classTime || null,
      studentCount: parsed.data.studentCount ?? null,
      photoUrl: parsed.data.photos[0]?.url || null, // keep legacy field with first photo
      notes: parsed.data.notes || null,
    })
    .returning();

  // Insert photos into class_log_photos table
  if (parsed.data.photos.length > 0) {
    await db.insert(classLogPhotos).values(
      parsed.data.photos.map((p, i) => ({
        classLogId: created.id,
        url: p.url,
        caption: p.caption || null,
        sortOrder: p.sortOrder ?? i,
      }))
    );
  }

  // Trigger AI photo analysis (non-blocking — runs in background)
  const photoUrls = parsed.data.photos.map((p) => p.url);
  const photoGps = parsed.data.photoGps;
  const exifDateTaken = parsed.data.exifDateTaken;
  analyzeClassLogPhotos(photoUrls, orphanage.name, created.id)
    .then(async (analysis) => {
      if (analysis) {
        // ── Location: GPS + AI vision (do both, prefer GPS) ──
        let gpsDistance: number | null = null;
        let gpsBasedMatch: string | null = null;
        const verificationMethods: string[] = [];

        if (
          photoGps &&
          orphanage.latitude != null &&
          orphanage.longitude != null
        ) {
          gpsDistance = Math.round(
            haversineDistance(
              photoGps.latitude,
              photoGps.longitude,
              orphanage.latitude,
              orphanage.longitude
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
          exifDateTaken || null,
          parsed.data.classDate,
          parsed.data.classTime || null
        );

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
            photoLatitude: photoGps?.latitude ?? null,
            photoLongitude: photoGps?.longitude ?? null,
            aiGpsDistance: gpsDistance,
            exifDateTaken: exifDateTaken || null,
            aiDateMatch: dateValidation.dateMatch,
            aiDateNotes: dateValidation.dateNotes,
            aiTimeMatch: dateValidation.timeMatch,
            aiTimeNotes: dateValidation.timeNotes,
          })
          .where(eq(classLogs.id, created.id));
      }
    })
    .catch((err) => {
      logger.error("admin:class-logs", "Background AI analysis failed", { classLogId: created.id, error: err instanceof Error ? err.message : String(err) });
    });

  return NextResponse.json({ classLog: created }, { status: 201 });
}

export const GET = withLogging(getHandler, { source: "class-logs" });
export const POST = withLogging(postHandler, { source: "class-logs" });
