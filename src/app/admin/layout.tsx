import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import Sidebar from "@/components/admin/Sidebar";
import { SessionProvider } from "next-auth/react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <SessionProvider>
      <div className="flex h-screen bg-warmgray-50">
        <Sidebar
          user={{
            name: user.name,
            email: user.email,
            image: user.image,
            roles: user.roles,
          }}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}
