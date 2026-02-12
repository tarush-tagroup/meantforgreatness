import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "events:view")) {
    redirect("/admin");
  }

  const rows = await db.select().from(events).orderBy(desc(events.eventDate));
  const canManage = hasPermission(user.roles, "events:manage");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-warmgray-900">Events</h1>
          <p className="mt-1 text-sm text-warmgray-500">
            {rows.length} event{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Link
            href="/admin/events/new"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            New Event
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-warmgray-200 bg-white p-12 text-center">
          <p className="text-warmgray-500">No events yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-warmgray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-warmgray-900 truncate">
                      {event.title}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        event.active
                          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                          : "bg-warmgray-100 text-warmgray-500"
                      }`}
                    >
                      {event.active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  {event.eventDate && (
                    <p className="text-sm text-warmgray-500 mt-1">
                      {event.eventDate}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-warmgray-600 line-clamp-2">
                {event.description}
              </p>
              {canManage && (
                <div className="mt-4 pt-3 border-t border-warmgray-100">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    Edit &rarr;
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
