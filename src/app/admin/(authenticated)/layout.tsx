import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guard";
import AdminShell from "@/components/admin/AdminShell";
import { SessionProvider } from "next-auth/react";
import PostHogProvider from "@/components/PostHogProvider";

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
    <PostHogProvider
      apiKey={process.env.NEXT_PUBLIC_POSTHOG_ADMIN_KEY}
      apiHost={process.env.NEXT_PUBLIC_POSTHOG_HOST}
    >
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
    </PostHogProvider>
  );
}
