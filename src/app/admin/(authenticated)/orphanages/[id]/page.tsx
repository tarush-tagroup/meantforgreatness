import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { orphanages, classGroups } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import OrphanageEditForm from "./OrphanageEditForm";
import ClassGroupManager from "./ClassGroupManager";

export default async function AdminOrphanageEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "orphanages:edit")) {
    redirect("/admin");
  }

  const { id } = await params;

  const [orphanage] = await db
    .select()
    .from(orphanages)
    .where(eq(orphanages.id, id))
    .limit(1);

  if (!orphanage) {
    notFound();
  }

  const groups = await db
    .select()
    .from(classGroups)
    .where(eq(classGroups.orphanageId, id))
    .orderBy(asc(classGroups.sortOrder));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-sand-900">
        Edit: {orphanage.name}
      </h1>
      <p className="mt-1 text-sm text-sand-500">{orphanage.location}</p>

      <div className="mt-6 space-y-8">
        <div className="rounded-lg border border-sand-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-sand-900 mb-4">
            Orphanage Details
          </h2>
          <OrphanageEditForm orphanage={orphanage} />
        </div>

        <div className="rounded-lg border border-sand-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-sand-900 mb-4">
            Class Groups
          </h2>
          <ClassGroupManager
            orphanageId={orphanage.id}
            initialGroups={groups.map((g) => ({
              id: g.id,
              name: g.name,
              studentCount: g.studentCount,
              ageRange: g.ageRange || "",
              sortOrder: g.sortOrder,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
