import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import type { Role } from "@/types/auth";
import DeactivateButton from "./DeactivateButton";
import RoleEditor from "./RoleEditor";

export default async function AdminUsersPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "users:view")) {
    redirect("/admin");
  }

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      roles: users.roles,
      status: users.status,
      invitedAt: users.invitedAt,
      activatedAt: users.activatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-warmgray-900">Users</h1>
          <p className="mt-1 text-sm text-warmgray-500">
            {allUsers.length} user{allUsers.length !== 1 && "s"}
          </p>
        </div>
        <Link
          href="/admin/users/invite"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
        >
          Invite User
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-warmgray-200 bg-white">
        <table className="min-w-full divide-y divide-warmgray-200">
          <thead className="bg-warmgray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-warmgray-500">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-warmgray-500">
                Roles
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-warmgray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-warmgray-500">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-warmgray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warmgray-200">
            {allUsers.map((u) => (
              <tr key={u.id} className="hover:bg-warmgray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {u.image ? (
                      <img
                        src={u.image}
                        alt=""
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warmgray-200 text-xs font-medium text-warmgray-600">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-warmgray-900">
                        {u.name || "—"}
                      </p>
                      <p className="text-xs text-warmgray-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleEditor
                    userId={u.id}
                    currentRoles={u.roles as Role[]}
                    isSelf={u.id === user.id}
                  />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.status === "active"
                        ? "bg-green-50 text-green-700 ring-1 ring-green-600/20"
                        : u.status === "invited"
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                          : "bg-warmgray-100 text-warmgray-500 ring-1 ring-warmgray-300/20"
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-warmgray-500">
                  {u.activatedAt
                    ? `Active since ${new Date(u.activatedAt).toLocaleDateString()}`
                    : u.invitedAt
                      ? `Invited ${new Date(u.invitedAt).toLocaleDateString()}`
                      : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== user.id && u.status !== "deactivated" && (
                    <DeactivateButton userId={u.id} userName={u.name || u.email} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
