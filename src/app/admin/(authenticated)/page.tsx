import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import type { Role } from "@/types/auth";
import { hasPermission } from "@/lib/permissions";

export default async function AdminDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  return (
    <div>
      <h1 className="text-2xl font-bold text-warmgray-900">Dashboard</h1>
      <p className="mt-2 text-sm text-warmgray-500">
        Welcome back, {user.name || user.email}.
      </p>

      {/* Role badges */}
      <div className="mt-4 flex flex-wrap gap-2">
        {user.roles.map((role: Role) => (
          <span
            key={role}
            className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20"
          >
            {role.replace("_", " ")}
          </span>
        ))}
      </div>

      {/* Placeholder stat cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {hasPermission(user.roles, "orphanages:view") && (
          <StatCard label="Orphanages" value="—" />
        )}
        {hasPermission(user.roles, "class_logs:view_all") && (
          <StatCard label="Classes This Month" value="—" />
        )}
        {hasPermission(user.roles, "class_logs:view_all") && (
          <StatCard label="Students Reached" value="—" />
        )}
        {hasPermission(user.roles, "donations:view") && (
          <StatCard label="Total Donations" value="—" />
        )}
      </div>

      <div className="mt-8 rounded-lg border border-warmgray-200 bg-white p-6 text-center text-sm text-warmgray-500">
        Dashboard statistics will be populated once data is migrated to the
        database.
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-warmgray-200 bg-white p-5">
      <p className="text-sm font-medium text-warmgray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-warmgray-900">{value}</p>
    </div>
  );
}
