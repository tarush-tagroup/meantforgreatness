import Image from "next/image";
import { db } from "@/db";
import { events, eventPhotos } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export default async function EventSection() {
  // Fetch the most recent active event from DB
  const [latestEvent] = await db
    .select()
    .from(events)
    .where(eq(events.active, true))
    .orderBy(desc(events.eventDate))
    .limit(1);

  if (!latestEvent) {
    return (
      <div className="rounded-xl bg-white border border-warmgray-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 text-center text-warmgray-500">
          <p>No events to display yet. Check back soon!</p>
        </div>
      </div>
    );
  }

  // Fetch photos for this event
  const photos = await db
    .select()
    .from(eventPhotos)
    .where(eq(eventPhotos.eventId, latestEvent.id))
    .orderBy(asc(eventPhotos.sortOrder));

  // Collect all image sources: cover image + event photos
  const allPhotos: { src: string; alt: string }[] = [];

  if (latestEvent.coverImageUrl) {
    allPhotos.push({
      src: latestEvent.coverImageUrl,
      alt: latestEvent.title,
    });
  }

  for (const photo of photos) {
    allPhotos.push({
      src: photo.url,
      alt: photo.caption || latestEvent.title,
    });
  }

  return (
    <div className="rounded-xl bg-white border border-warmgray-200 shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        <h3 className="text-2xl font-bold text-warmgray-900 mb-2">
          {latestEvent.title}
        </h3>
        <p className="text-warmgray-600 leading-relaxed mb-6">
          {latestEvent.description}
        </p>
        {allPhotos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {allPhotos.slice(0, 6).map((photo, i) => (
              <div key={i} className="aspect-video relative rounded-lg overflow-hidden">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
