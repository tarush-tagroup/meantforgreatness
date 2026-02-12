import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { events, orphanages } from "@/db/schema";
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

  const orphanageOptions = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(asc(orphanages.name));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-warmgray-900">Edit Event</h1>
        <p className="mt-1 text-sm text-warmgray-500">{event.title}</p>
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
          }}
        />
      </div>
    </div>
  );
}
