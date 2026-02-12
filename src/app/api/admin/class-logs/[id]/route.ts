import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { classLogs, classLogPhotos, orphanages, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { analyzeClassLogPhotos } from "@/lib/ai-photo-analysis";
import { logger } from "@/lib/logger";

const photoSchema = z.object({
  url: z.string().url(),
  caption: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  orphanageId: z.string().min(1).optional(),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  classTime: z.string().max(20).nullable().optional(),
  studentCount: z.number().int().min(0).nullable().optional(),
  photos: z.array(photoSchema).min(1, "At least one photo is required").optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("class_logs:view_all");
  if (authError) return authError;

  const { id } = await context.params;

  const [row] = await db
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
      aiPhotoTimestamp: classLogs.aiPhotoTimestamp,
      aiOrphanageMatch: classLogs.aiOrphanageMatch,
      aiConfidenceNotes: classLogs.aiConfidenceNotes,
      aiPrimaryPhotoUrl: classLogs.aiPrimaryPhotoUrl,
      aiAnalyzedAt: classLogs.aiAnalyzedAt,
      createdAt: classLogs.createdAt,
    })
    .from(classLogs)
    .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
    .leftJoin(users, eq(classLogs.teacherId, users.id))
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  // Fetch photos for this class log
  const photos = await db
    .select({
      id: classLogPhotos.id,
      url: classLogPhotos.url,
      caption: classLogPhotos.caption,
      sortOrder: classLogPhotos.sortOrder,
    })
    .from(classLogPhotos)
    .where(eq(classLogPhotos.classLogId, id))
    .orderBy(asc(classLogPhotos.sortOrder));

  return NextResponse.json({ classLog: { ...row, photos } });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [user, authError] = await withAuth("class_logs:edit_own");
  if (authError) return authError;

  const { id } = await context.params;

  // Fetch existing log
  const [existing] = await db
    .select()
    .from(classLogs)
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  // Ownership check: teacher can only edit their own logs
  const isOwner = existing.teacherId === user!.id;
  const canEditAll = hasPermission(user!.roles, "class_logs:edit_all");

  if (!isOwner && !canEditAll) {
    return NextResponse.json(
      { error: "You can only edit your own class logs" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // If orphanageId is being changed, verify it exists
  if (parsed.data.orphanageId && parsed.data.orphanageId !== existing.orphanageId) {
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
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.orphanageId !== undefined) updateData.orphanageId = parsed.data.orphanageId;
  if (parsed.data.classDate !== undefined) updateData.classDate = parsed.data.classDate;
  if (parsed.data.classTime !== undefined) updateData.classTime = parsed.data.classTime;
  if (parsed.data.studentCount !== undefined) updateData.studentCount = parsed.data.studentCount;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  // Replace photos if provided
  let photosChanged = false;
  if (parsed.data.photos) {
    photosChanged = true;
    updateData.photoUrl = parsed.data.photos[0]?.url || null; // keep legacy field
    // Clear AI metadata — will be re-generated
    updateData.aiKidsCount = null;
    updateData.aiLocation = null;
    updateData.aiPhotoTimestamp = null;
    updateData.aiOrphanageMatch = null;
    updateData.aiConfidenceNotes = null;
    updateData.aiPrimaryPhotoUrl = null;
    updateData.aiAnalyzedAt = null;

    await db.delete(classLogPhotos).where(eq(classLogPhotos.classLogId, id));
    if (parsed.data.photos.length > 0) {
      await db.insert(classLogPhotos).values(
        parsed.data.photos.map((p, i) => ({
          classLogId: id,
          url: p.url,
          caption: p.caption || null,
          sortOrder: p.sortOrder ?? i,
        }))
      );
    }
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(classLogs).set(updateData).where(eq(classLogs.id, id));
  }

  // Re-run AI analysis if photos were changed (non-blocking)
  if (photosChanged && parsed.data.photos && parsed.data.photos.length > 0) {
    // Get orphanage name for analysis
    const effectiveOrphanageId = parsed.data.orphanageId || existing.orphanageId;
    const [orphanageRow] = await db
      .select({ name: orphanages.name })
      .from(orphanages)
      .where(eq(orphanages.id, effectiveOrphanageId))
      .limit(1);

    const orphanageName = orphanageRow?.name || effectiveOrphanageId;
    const photoUrls = parsed.data.photos.map((p) => p.url);

    analyzeClassLogPhotos(photoUrls, orphanageName)
      .then(async (analysis) => {
        if (analysis) {
          await db
            .update(classLogs)
            .set({
              aiKidsCount: analysis.kidsCount,
              aiLocation: analysis.location,
              aiPhotoTimestamp: analysis.photoTimestamp,
              aiOrphanageMatch: analysis.orphanageMatch,
              aiConfidenceNotes: analysis.confidenceNotes,
              aiPrimaryPhotoUrl: analysis.primaryPhotoUrl,
              aiAnalyzedAt: new Date(),
            })
            .where(eq(classLogs.id, id));
        }
      })
      .catch((err) => {
        logger.error("admin:class-logs", "Background AI re-analysis failed", { classLogId: id, error: err instanceof Error ? err.message : String(err) });
      });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [user, authError] = await withAuth("class_logs:delete_own");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(classLogs)
    .where(eq(classLogs.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { error: "Class log not found" },
      { status: 404 }
    );
  }

  // Ownership check
  const isOwner = existing.teacherId === user!.id;
  const canDeleteAll = hasPermission(user!.roles, "class_logs:delete_all");

  if (!isOwner && !canDeleteAll) {
    return NextResponse.json(
      { error: "You can only delete your own class logs" },
      { status: 403 }
    );
  }

  // Photos cascade delete via FK
  await db.delete(classLogs).where(eq(classLogs.id, id));

  return NextResponse.json({ success: true });
}
