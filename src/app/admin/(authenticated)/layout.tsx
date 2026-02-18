import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import AdminShell from "@/components/admin/AdminShell";
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
      <AdminShell
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
          roles: user.roles,
        }}
      >
        {children}
      </AdminShell>
    </SessionProvider>
  );
}
