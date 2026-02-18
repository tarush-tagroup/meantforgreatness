import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import PlatformSettings from "./PlatformSettings";

export default async function AdminPlatformsPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.roles, "users:view")) {
    redirect("/admin");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-sand-900">Donation Platforms</h1>
        <p className="mt-1 text-sm text-sand-500">
          Configure which payment providers are available on the donation page.
        </p>
      </div>

      <PlatformSettings />
    </div>
  );
}
