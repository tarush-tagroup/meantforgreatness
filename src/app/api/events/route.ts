import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, eventPhotos } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.active, true))
    .orderBy(desc(events.eventDate));

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
