import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import type { Role } from "@/types/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { orphanages, classLogs, donations, users } from "@/db/schema";
import { sql, eq, gte } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  const canViewOrphanages = hasPermission(user.roles, "orphanages:view");
  const canViewClasses = hasPermission(user.roles, "class_logs:view_all");
  const canViewDonations = hasPermission(user.roles, "donations:view");

  // Build date for "this month" filter
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // Run all stat queries in parallel (only for permitted sections)
  const [
    orphanageCount,
    classesThisMonth,
    totalStudents,
    donationStats,
    activeTeachers,
    recentClasses,
  ] = await Promise.all([
    // Orphanage count
    canViewOrphanages
      ? db.select({ count: sql<number>`count(*)` }).from(orphanages).then(r => Number(r[0]?.count || 0))
      : Promise.resolve(0),

    // Classes this month
    canViewClasses
      ? db.select({ count: sql<number>`count(*)` })
          .from(classLogs)
          .where(gte(classLogs.classDate, firstOfMonth))
          .then(r => Number(r[0]?.count || 0))
      : Promise.resolve(0),

    // Total students reached (sum of student counts across all class logs)
    canViewClasses
      ? db.select({ total: sql<number>`COALESCE(SUM(student_count), 0)` })
          .from(classLogs)
          .then(r => Number(r[0]?.total || 0))
      : Promise.resolve(0),

    // Donation stats
    canViewDonations
      ? db.select({
          totalRaised: sql<number>`COALESCE(SUM(amount), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(donations)
        .where(eq(donations.status, "completed"))
        .then(r => ({
          totalRaised: Number(r[0]?.totalRaised || 0),
          count: Number(r[0]?.count || 0),
        }))
      : Promise.resolve({ totalRaised: 0, count: 0 }),

    // Active teachers
    canViewClasses
      ? db.select({ count: sql<number>`count(*)` })
          .from(users)
          .where(
            sql`${users.status} = 'active' AND ${users.roles} && ARRAY['teacher', 'teacher_manager']::text[]`
          )
          .then(r => Number(r[0]?.count || 0))
      : Promise.resolve(0),

    // Recent class logs (last 5)
    canViewClasses
      ? db.select({
          id: classLogs.id,
          classDate: classLogs.classDate,
          orphanageName: orphanages.name,
          teacherName: users.name,
          studentCount: classLogs.studentCount,
        })
        .from(classLogs)
        .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
        .leftJoin(users, eq(classLogs.teacherId, users.id))
        .orderBy(sql`${classLogs.classDate} DESC, ${classLogs.createdAt} DESC`)
        .limit(5)
      : Promise.resolve([]),
  ]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

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

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canViewOrphanages && (
          <StatCard
            label="Orphanages"
            value={String(orphanageCount)}
            href="/admin/orphanages"
          />
        )}
        {canViewClasses && (
          <StatCard
            label="Classes This Month"
            value={String(classesThisMonth)}
            href="/admin/classes"
          />
        )}
        {canViewClasses && (
          <StatCard
            label="Students Reached"
            value={totalStudents.toLocaleString()}
            subtitle={`${activeTeachers} active teacher${activeTeachers !== 1 ? "s" : ""}`}
          />
        )}
        {canViewDonations && (
          <StatCard
            label="Total Donations"
            value={donationStats.count > 0 ? formatCurrency(donationStats.totalRaised) : "$0"}
            subtitle={`${donationStats.count} donation${donationStats.count !== 1 ? "s" : ""}`}
            href="/admin/donations"
          />
        )}
      </div>

      {/* Recent classes */}
      {canViewClasses && recentClasses.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-warmgray-900">Recent Classes</h2>
            <Link
              href="/admin/classes"
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="rounded-lg border border-warmgray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-warmgray-200">
              <thead className="bg-warmgray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">Orphanage</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">Teacher</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100">
                {recentClasses.map((c) => (
                  <tr key={c.id} className="hover:bg-warmgray-50">
                    <td className="px-4 py-2.5 text-sm text-warmgray-900 whitespace-nowrap">
                      <Link href={`/admin/classes/${c.id}`} className="text-teal-600 hover:text-teal-700">
                        {c.classDate}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">{c.orphanageName || "\u2014"}</td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">{c.teacherName || "\u2014"}</td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">{c.studentCount ?? "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  href,
}: {
  label: string;
  value: string;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <div className={`rounded-lg border border-warmgray-200 bg-white p-5 ${href ? "hover:border-teal-300 hover:shadow-sm transition-all" : ""}`}>
      <p className="text-sm font-medium text-warmgray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-warmgray-900">{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-warmgray-400">{subtitle}</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
