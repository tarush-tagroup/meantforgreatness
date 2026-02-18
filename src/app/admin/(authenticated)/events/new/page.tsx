import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orphanages } from "@/db/schema";
import { asc } from "drizzle-orm";
import EventForm from "../EventForm";

export default async function NewEventPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "events:manage")) {
    redirect("/admin");
  }

  const orphanageOptions = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(asc(orphanages.name));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-sand-900">New Event</h1>
      </div>
      <div className="max-w-2xl">
        <EventForm orphanages={orphanageOptions} />
      </div>
    </div>
  );
}
