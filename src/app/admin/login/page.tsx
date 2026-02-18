import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin Login — Meant for Greatness",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  // Redirect to dashboard if already logged in (try/catch prevents
  // crashes when auth config has issues — the login page must always render)
  try {
    const session = await auth();
    if (session?.user) {
      redirect("/admin");
    }
  } catch (e) {
    // Re-throw Next.js redirect (it uses throw internally)
    if (e && typeof e === "object" && "digest" in e) throw e;
    // Swallow auth errors — show login page anyway
  }

  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-sand-900">
            Meant for Greatness
          </h1>
          <p className="mt-2 text-sm text-sand-500">Admin Panel</p>
        </div>

        <div className="rounded-xl bg-white border border-sand-200 shadow-sm p-8">
          <h2 className="text-lg font-semibold text-sand-900 text-center mb-6">
            Sign in to continue
          </h2>

          {params.error === "not-invited" && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              Access is by invitation only. Please contact an administrator.
            </div>
          )}

          {params.error === "deactivated" && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              Your account has been deactivated. Please contact an
              administrator.
            </div>
          )}

          {params.error && !["not-invited", "deactivated"].includes(params.error) && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              An error occurred. Please try again.
            </div>
          )}

          <LoginForm callbackUrl={params.callbackUrl} />
        </div>

        <p className="mt-6 text-center text-xs text-sand-400">
          Only invited members can access the admin panel.
        </p>
      </div>
    </div>
  );
}
