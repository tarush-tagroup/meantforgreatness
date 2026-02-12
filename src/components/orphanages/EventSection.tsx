import Image from "next/image";
import { db } from "@/db";
import { events, eventPhotos } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

// Hardcoded fallback for when there are no DB events yet
const fallbackPhotos = [
  {
    src: "/images/waterbom-group.jpg",
    alt: "Full group of about 25 kids at Waterbom Bali",
  },
  {
    src: "/images/waterbom-girls.jpg",
    alt: "Three girls with peace signs at Waterbom Bali",
  },
  {
    src: "/images/waterbom-kids.jpg",
    alt: "Group of kids smiling together at Waterbom Bali",
  },
];

export default async function EventSection() {
  // Try to fetch the most recent active event from DB
  const [latestEvent] = await db
    .select()
    .from(events)
    .where(eq(events.active, true))
    .orderBy(desc(events.eventDate))
    .limit(1);

  if (!latestEvent) {
    // No events in DB — show hardcoded fallback
    return (
      <div className="rounded-xl bg-white border border-warmgray-200 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <h3 className="text-2xl font-bold text-warmgray-900 mb-2">
            Waterbom Bali Outing
          </h3>
          <p className="text-warmgray-600 leading-relaxed mb-6">
            A fun day out at Waterbom water park with kids from Seeds of Hope and
            Chloe Orphanage. These outings give the children a chance to have fun,
            build friendships, and create lasting memories outside the classroom.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {fallbackPhotos.map((photo) => (
              <div key={photo.src} className="aspect-video relative rounded-lg overflow-hidden">
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
