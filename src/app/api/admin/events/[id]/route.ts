import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { events, eventPhotos } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  orphanageId: z.string().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  photos: z
    .array(
      z.object({
        url: z.string().url(),
        caption: z.string().max(500).nullable().optional(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("events:view");
  if (authError) return authError;

  const { id } = await context.params;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const photos = await db
    .select()
    .from(eventPhotos)
    .where(eq(eventPhotos.eventId, id))
    .orderBy(asc(eventPhotos.sortOrder));

  return NextResponse.json({ event: { ...event, photos } });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("events:manage");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const { photos, ...eventData } = parsed.data;

  // Update event fields
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (eventData.title !== undefined) updateFields.title = eventData.title;
  if (eventData.description !== undefined) updateFields.description = eventData.description;
  if (eventData.eventDate !== undefined) updateFields.eventDate = eventData.eventDate;
  if (eventData.orphanageId !== undefined) updateFields.orphanageId = eventData.orphanageId;
  if (eventData.coverImageUrl !== undefined) updateFields.coverImageUrl = eventData.coverImageUrl;
  if (eventData.active !== undefined) updateFields.active = eventData.active;

  await db.update(events).set(updateFields).where(eq(events.id, id));

  // Replace photos if provided
  if (photos) {
    await db.delete(eventPhotos).where(eq(eventPhotos.eventId, id));
    if (photos.length > 0) {
      await db.insert(eventPhotos).values(
        photos.map((p, i) => ({
          eventId: id,
          url: p.url,
          caption: p.caption || null,
          sortOrder: p.sortOrder ?? i,
        }))
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const [, authError] = await withAuth("events:manage");
  if (authError) return authError;

  const { id } = await context.params;

  const [existing] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Photos cascade delete via FK
  await db.delete(events).where(eq(events.id, id));

  return NextResponse.json({ success: true });
}
