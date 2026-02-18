import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { events, eventPhotos, orphanages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import EventForm from "../EventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "events:manage")) {
    redirect("/admin");
  }

  const { id } = await params;

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .limit(1);

  if (!event) {
    notFound();
  }

  // Fetch existing photos for this event
  const photos = await db
    .select({
      url: eventPhotos.url,
      caption: eventPhotos.caption,
    })
    .from(eventPhotos)
    .where(eq(eventPhotos.eventId, id))
    .orderBy(asc(eventPhotos.sortOrder));

  const orphanageOptions = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(asc(orphanages.name));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-sand-900">Edit Event</h1>
        <p className="mt-1 text-sm text-sand-500">{event.title}</p>
      </div>
      <div className="max-w-2xl">
        <EventForm
          orphanages={orphanageOptions}
          initialData={{
            id: event.id,
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            orphanageId: event.orphanageId,
            coverImageUrl: event.coverImageUrl,
            active: event.active,
            photos: (() => {
              const photoList = photos.map((p) => ({
                url: p.url,
                caption: p.caption || "",
              }));
              // Include cover image as first photo if it's not already in the event_photos list
              if (
                event.coverImageUrl &&
                !photoList.some((p) => p.url === event.coverImageUrl)
              ) {
                photoList.unshift({ url: event.coverImageUrl, caption: "" });
              }
              return photoList;
            })(),
          }}
        />
      </div>
    </div>
  );
}
