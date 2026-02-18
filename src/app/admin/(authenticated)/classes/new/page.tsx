import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orphanages, users } from "@/db/schema";
import { asc, sql } from "drizzle-orm";
import ClassLogForm from "../ClassLogForm";

export default async function NewClassLogPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "class_logs:create")) {
    redirect("/admin");
  }

  const orphanageOptions = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(asc(orphanages.name));

  const teacherOptions = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher_manager', 'admin']::text[]`
    )
    .orderBy(asc(users.name));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-sand-900">Log a Class</h1>
        <p className="mt-1 text-sm text-sand-500">
          Record a class session.
        </p>
      </div>

      <div className="max-w-2xl">
        <ClassLogForm
          orphanages={orphanageOptions}
          teachers={teacherOptions}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
