import { getSessionUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import type { Role } from "@/types/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { orphanages, classLogs, donations, events, users } from "@/db/schema";
import { sql, eq, gte, and } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "year";

function getPeriodStart(period: Period): string {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    return monday.toISOString().slice(0, 10);
  }
  if (period === "month") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }
  // year
  return `${now.getFullYear()}-01-01`;
}

function getPeriodLabel(period: Period): string {
  if (period === "week") return "This Week";
  if (period === "month") return "This Month";
  return "This Year";
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; cp?: string; ep?: string; dp?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const period: Period = (["week", "month", "year"].includes(params.period || "")
    ? params.period
    : "month") as Period;

  const classPage = Math.max(1, parseInt(params.cp || "1", 10) || 1);
  const eventPage = Math.max(1, parseInt(params.ep || "1", 10) || 1);
  const donationPage = Math.max(1, parseInt(params.dp || "1", 10) || 1);
  const PAGE_SIZE = 25;

  const canViewOrphanages = hasPermission(user.roles, "orphanages:view");
  const canViewClasses = hasPermission(user.roles, "class_logs:view_all");
  const canViewDonations = hasPermission(user.roles, "donations:view");

  const periodStart = getPeriodStart(period);

  // ── All-time totals (always visible at the top) ──────────────────────────
  const [orphanageCount, totalStudents] = await Promise.all([
    canViewOrphanages
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(orphanages)
          .then((r) => Number(r[0]?.count || 0))
      : Promise.resolve(0),
    canViewOrphanages
      ? db
          .select({ total: sql<number>`COALESCE(SUM(student_count), 0)` })
          .from(orphanages)
          .then((r) => Number(r[0]?.total || 0))
      : Promise.resolve(0),
  ]);

  // ── Period-filtered metrics + paginated lists ────────────────────────────
  const [
    periodClasses,
    periodStudentsReported,
    periodStudentsAI,
    periodDonationStats,
    periodEventCount,
    recentClassesResult,
    classTotal,
    recentEventsResult,
    eventTotal,
    recentDonationsResult,
    donationTotal,
  ] = await Promise.all([
    // Classes count in period
    canViewClasses
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(classLogs)
          .where(gte(classLogs.classDate, periodStart))
          .then((r) => Number(r[0]?.count || 0))
      : Promise.resolve(0),

    // Students reached (reported) in period
    canViewClasses
      ? db
          .select({ total: sql<number>`COALESCE(SUM(student_count), 0)` })
          .from(classLogs)
          .where(gte(classLogs.classDate, periodStart))
          .then((r) => Number(r[0]?.total || 0))
      : Promise.resolve(0),

    // Students reached (AI-detected) in period
    canViewClasses
      ? db
          .select({ total: sql<number>`COALESCE(SUM(ai_kids_count), 0)` })
          .from(classLogs)
          .where(gte(classLogs.classDate, periodStart))
          .then((r) => Number(r[0]?.total || 0))
      : Promise.resolve(0),

    // Donation stats in period
    canViewDonations
      ? db
          .select({
            totalRaised: sql<number>`COALESCE(SUM(amount), 0)`,
            count: sql<number>`count(*)`,
          })
          .from(donations)
          .where(
            and(
              eq(donations.status, "completed"),
              gte(donations.createdAt, new Date(periodStart))
            )
          )
          .then((r) => ({
            totalRaised: Number(r[0]?.totalRaised || 0),
            count: Number(r[0]?.count || 0),
          }))
      : Promise.resolve({ totalRaised: 0, count: 0 }),

    // Events count in period
    canViewClasses
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(events)
          .where(gte(events.eventDate, periodStart))
          .then((r) => Number(r[0]?.count || 0))
      : Promise.resolve(0),

    // ── Paginated recent classes ──
    canViewClasses
      ? db
          .select({
            id: classLogs.id,
            classDate: classLogs.classDate,
            orphanageName: orphanages.name,
            teacherName: users.name,
            studentCount: classLogs.studentCount,
            aiKidsCount: classLogs.aiKidsCount,
          })
          .from(classLogs)
          .leftJoin(orphanages, eq(classLogs.orphanageId, orphanages.id))
          .leftJoin(users, eq(classLogs.teacherId, users.id))
          .where(gte(classLogs.classDate, periodStart))
          .orderBy(sql`${classLogs.classDate} DESC, ${classLogs.createdAt} DESC`)
          .limit(PAGE_SIZE)
          .offset((classPage - 1) * PAGE_SIZE)
      : Promise.resolve([]),

    canViewClasses
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(classLogs)
          .where(gte(classLogs.classDate, periodStart))
          .then((r) => Number(r[0]?.count || 0))
      : Promise.resolve(0),

    // ── Paginated recent events ──
    canViewClasses
      ? db
          .select({
            id: events.id,
            title: events.title,
            eventDate: events.eventDate,
            orphanageName: orphanages.name,
            active: events.active,
          })
          .from(events)
          .leftJoin(orphanages, eq(events.orphanageId, orphanages.id))
          .where(gte(events.eventDate, periodStart))
          .orderBy(sql`${events.eventDate} DESC, ${events.createdAt} DESC`)
          .limit(PAGE_SIZE)
          .offset((eventPage - 1) * PAGE_SIZE)
      : Promise.resolve([]),

    canViewClasses
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(events)
          .where(gte(events.eventDate, periodStart))
          .then((r) => Number(r[0]?.count || 0))
      : Promise.resolve(0),

    // ── Paginated recent donations ──
    canViewDonations
      ? db
          .select({
            id: donations.id,
            donorName: donations.donorName,
            donorEmail: donations.donorEmail,
            amount: donations.amount,
            currency: donations.currency,
            frequency: donations.frequency,
            status: donations.status,
            createdAt: donations.createdAt,
          })
          .from(donations)
          .where(
            and(
              eq(donations.status, "completed"),
              gte(donations.createdAt, new Date(periodStart))
            )
          )
          .orderBy(sql`${donations.createdAt} DESC`)
          .limit(PAGE_SIZE)
          .offset((donationPage - 1) * PAGE_SIZE)
      : Promise.resolve([]),

    canViewDonations
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(donations)
          .where(
            and(
              eq(donations.status, "completed"),
              gte(donations.createdAt, new Date(periodStart))
            )
          )
          .then((r) => Number(r[0]?.count || 0))
      : Promise.resolve(0),
  ]);

  const classTotalPages = Math.ceil(classTotal / PAGE_SIZE);
  const eventTotalPages = Math.ceil(eventTotal / PAGE_SIZE);
  const donationTotalPages = Math.ceil(donationTotal / PAGE_SIZE);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);

  // Build period-specific URL helper
  function periodUrl(p: string) {
    const params = new URLSearchParams({ period: p });
    return `/admin?${params.toString()}`;
  }

  function paginationUrl(pageParam: string, page: number) {
    const params = new URLSearchParams({ period });
    params.set(pageParam, String(page));
    return `/admin?${params.toString()}`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-warmgray-900">Dashboard</h1>
      <p className="mt-2 text-sm text-warmgray-500">
        Welcome back, {user.name || user.email}.
      </p>

      {/* Role badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        {user.roles.map((role: Role) => (
          <span
            key={role}
            className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20"
          >
            {role.replace("_", " ")}
          </span>
        ))}
      </div>

      {/* ── All-time totals ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {canViewOrphanages && (
          <StatCard
            label="Total Orphanages"
            value={String(orphanageCount)}
            href="/admin/orphanages"
          />
        )}
        {canViewOrphanages && (
          <StatCard
            label="Total Students"
            value={totalStudents.toLocaleString()}
            subtitle="Across all orphanages"
          />
        )}
      </div>

      {/* ── Period tabs ── */}
      <div className="mt-8 border-b border-warmgray-200">
        <nav className="-mb-px flex gap-6" aria-label="Time period">
          {(["week", "month", "year"] as const).map((p) => (
            <Link
              key={p}
              href={periodUrl(p)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                period === p
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-warmgray-500 hover:border-warmgray-300 hover:text-warmgray-700"
              }`}
            >
              {p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Period metrics ── */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canViewClasses && (
          <StatCard
            label={`Classes ${getPeriodLabel(period)}`}
            value={String(periodClasses)}
            href="/admin/classes"
          />
        )}
        {canViewClasses && (
          <StatCard
            label="Students Reached"
            value={periodStudentsReported.toLocaleString()}
            subtitle={
              periodStudentsAI > 0
                ? `AI verified: ${periodStudentsAI.toLocaleString()}`
                : "No AI data yet"
            }
          />
        )}
        {canViewDonations && (
          <StatCard
            label={`Donations ${getPeriodLabel(period)}`}
            value={
              periodDonationStats.count > 0
                ? formatCurrency(periodDonationStats.totalRaised)
                : "$0"
            }
            subtitle={`${periodDonationStats.count} donation${periodDonationStats.count !== 1 ? "s" : ""}`}
            href="/admin/donations"
          />
        )}
        {canViewClasses && (
          <StatCard
            label={`Events ${getPeriodLabel(period)}`}
            value={String(periodEventCount)}
            href="/admin/events"
          />
        )}
      </div>

      {/* ── Recent Classes ── */}
      {canViewClasses && recentClassesResult.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Recent Classes" href="/admin/classes" />
          <div className="rounded-lg border border-warmgray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-warmgray-200">
              <thead className="bg-warmgray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Orphanage
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    AI Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100">
                {recentClassesResult.map((c) => (
                  <tr key={c.id} className="hover:bg-warmgray-50">
                    <td className="px-4 py-2.5 text-sm text-warmgray-900 whitespace-nowrap">
                      <Link
                        href={`/admin/classes/${c.id}`}
                        className="text-teal-600 hover:text-teal-700"
                      >
                        {c.classDate}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">
                      {c.orphanageName || "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">
                      {c.teacherName || "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">
                      {c.studentCount ?? "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-400">
                      {c.aiKidsCount ?? "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {classTotalPages > 1 && (
            <Pagination
              current={classPage}
              total={classTotalPages}
              param="cp"
              buildUrl={paginationUrl}
            />
          )}
        </div>
      )}

      {/* ── Recent Events ── */}
      {canViewClasses && recentEventsResult.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Recent Events" href="/admin/events" />
          <div className="rounded-lg border border-warmgray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-warmgray-200">
              <thead className="bg-warmgray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Orphanage
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100">
                {recentEventsResult.map((e) => (
                  <tr key={e.id} className="hover:bg-warmgray-50">
                    <td className="px-4 py-2.5 text-sm text-warmgray-900 whitespace-nowrap">
                      {e.eventDate || "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="text-teal-600 hover:text-teal-700"
                      >
                        {e.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">
                      {e.orphanageName || "General"}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.active
                            ? "bg-teal-50 text-teal-700"
                            : "bg-warmgray-100 text-warmgray-500"
                        }`}
                      >
                        {e.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {eventTotalPages > 1 && (
            <Pagination
              current={eventPage}
              total={eventTotalPages}
              param="ep"
              buildUrl={paginationUrl}
            />
          )}
        </div>
      )}

      {/* ── Recent Donations ── */}
      {canViewDonations && recentDonationsResult.length > 0 && (
        <div className="mt-8">
          <SectionHeader title="Recent Donations" href="/admin/donations" />
          <div className="rounded-lg border border-warmgray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-warmgray-200">
              <thead className="bg-warmgray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Donor
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-warmgray-500 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmgray-100">
                {recentDonationsResult.map((d) => (
                  <tr key={d.id} className="hover:bg-warmgray-50">
                    <td className="px-4 py-2.5 text-sm text-warmgray-900 whitespace-nowrap">
                      {d.createdAt
                        ? new Date(d.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-warmgray-700">
                      {d.donorName || d.donorEmail}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium text-warmgray-900">
                      {formatCurrency(d.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.frequency === "monthly"
                            ? "bg-teal-50 text-teal-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {d.frequency === "monthly" ? "Monthly" : "One-time"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {donationTotalPages > 1 && (
            <Pagination
              current={donationPage}
              total={donationTotalPages}
              param="dp"
              buildUrl={paginationUrl}
            />
          )}
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-8" />
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

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
    <div
      className={`rounded-lg border border-warmgray-200 bg-white p-5 ${href ? "hover:border-teal-300 hover:shadow-sm transition-all" : ""}`}
    >
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

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold text-warmgray-900">{title}</h2>
      <Link
        href={href}
        className="text-sm font-medium text-teal-600 hover:text-teal-700"
      >
        View all &rarr;
      </Link>
    </div>
  );
}

function Pagination({
  current,
  total,
  param,
  buildUrl,
}: {
  current: number;
  total: number;
  param: string;
  buildUrl: (param: string, page: number) => string;
}) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <p className="text-xs text-warmgray-500">
        Page {current} of {total}
      </p>
      <div className="flex gap-2">
        {current > 1 && (
          <Link
            href={buildUrl(param, current - 1)}
            className="rounded-md border border-warmgray-200 bg-white px-3 py-1.5 text-xs font-medium text-warmgray-700 hover:bg-warmgray-50 transition-colors"
          >
            Previous
          </Link>
        )}
        {current < total && (
          <Link
            href={buildUrl(param, current + 1)}
            className="rounded-md border border-warmgray-200 bg-white px-3 py-1.5 text-xs font-medium text-warmgray-700 hover:bg-warmgray-50 transition-colors"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
