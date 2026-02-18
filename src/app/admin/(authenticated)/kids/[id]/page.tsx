import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { kids, orphanages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import KidEditForm from "./KidEditForm";
import DeleteKidButton from "./DeleteKidButton";

export default async function AdminKidEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "kids:edit")) {
    redirect("/admin");
  }

  const { id } = await params;

  const [kid] = await db
    .select()
    .from(kids)
    .where(eq(kids.id, id))
    .limit(1);

  if (!kid) {
    notFound();
  }

  const orphanageList = await db
    .select({ id: orphanages.id, name: orphanages.name })
    .from(orphanages)
    .orderBy(asc(orphanages.name));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-sand-500 mb-4">
        <Link
          href="/admin/kids"
          className="hover:text-sand-700 transition-colors"
        >
          Kids
        </Link>
        <span>/</span>
        <span className="text-sand-900">{kid.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sand-900">
            Edit: {kid.name}
          </h1>
          <p className="mt-1 text-sm text-sand-500">
            Age {kid.age}{kid.location ? ` · ${kid.location}` : ""}
          </p>
        </div>
        <DeleteKidButton kidId={kid.id} kidName={kid.name} />
      </div>

      <div className="mt-6 rounded-lg border border-sand-200 bg-white p-6">
        <KidEditForm kid={kid} orphanages={orphanageList} />
      </div>
    </div>
  );
}
