import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { events, eventPhotos } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  orphanageId: z.string().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const [, authError] = await withAuth("events:view");
  if (authError) return authError;

  const rows = await db.select().from(events).orderBy(desc(events.eventDate));

  const photos = await db
    .select()
    .from(eventPhotos)
    .orderBy(asc(eventPhotos.sortOrder));

  const photosByEvent = new Map<string, typeof photos>();
  for (const p of photos) {
    const list = photosByEvent.get(p.eventId) || [];
    list.push(p);
    photosByEvent.set(p.eventId, list);
  }

  const result = rows.map((row) => ({
    ...row,
    photos: photosByEvent.get(row.id) || [],
  }));

  return NextResponse.json({ events: result });
}

export async function POST(req: NextRequest) {
  const [user, authError] = await withAuth("events:manage");
  if (authError) return authError;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues?.[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(events)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      eventDate: parsed.data.eventDate || null,
      orphanageId: parsed.data.orphanageId || null,
      coverImageUrl: parsed.data.coverImageUrl || null,
      active: parsed.data.active,
      createdBy: user!.id,
    })
    .returning();

  return NextResponse.json({ event: created }, { status: 201 });
}
