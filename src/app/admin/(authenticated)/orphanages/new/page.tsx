import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import OrphanageCreateForm from "./OrphanageCreateForm";

export default async function AdminOrphanageCreatePage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "orphanages:edit")) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-warmgray-500 mb-4">
        <Link
          href="/admin/orphanages"
          className="hover:text-warmgray-700 transition-colors"
        >
          Orphanages
        </Link>
        <span>/</span>
        <span className="text-warmgray-900">New</span>
      </div>

      <h1 className="text-2xl font-bold text-warmgray-900">
        Add New Orphanage
      </h1>
      <p className="mt-1 text-sm text-warmgray-500">
        Add a new orphanage to the program. You can set up class groups after
        creating it.
      </p>

      <div className="mt-6 rounded-lg border border-warmgray-200 bg-white p-6">
        <OrphanageCreateForm />
      </div>
    </div>
  );
}
