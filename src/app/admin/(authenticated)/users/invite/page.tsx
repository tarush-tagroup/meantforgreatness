import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import InviteForm from "./InviteForm";

export default async function InviteUserPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "users:invite")) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-sand-900">Invite User</h1>
      <p className="mt-1 text-sm text-sand-500">
        Send an invitation to join the admin panel.
      </p>

      <div className="mt-6 rounded-lg border border-sand-200 bg-white p-6">
        <InviteForm />
      </div>
    </div>
  );
}
