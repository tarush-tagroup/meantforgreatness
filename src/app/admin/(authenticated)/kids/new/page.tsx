import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orphanages } from "@/db/schema";
import { asc } from "drizzle-orm";
import Link from "next/link";
import KidCreateForm from "./KidCreateForm";

export default async function AdminKidCreatePage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "kids:edit")) {
    redirect("/admin");
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
        <span className="text-sand-900">New</span>
      </div>

      <h1 className="text-2xl font-bold text-sand-900">Add New Kid</h1>
      <p className="mt-1 text-sm text-sand-500">
        Add a child&apos;s profile to share their story with donors.
      </p>

      <div className="mt-6 rounded-lg border border-sand-200 bg-white p-6">
        <KidCreateForm orphanages={orphanageList} />
      </div>
    </div>
  );
}
