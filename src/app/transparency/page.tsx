import type { Metadata } from "next";
import { db } from "@/db";
import { transparencyReports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Transparency Reports",
  description:
    "See how your donations are making a difference. Our quarterly transparency reports detail classes taught, students reached, and impact across Bali.",
};

export default async function TransparencyPage() {
  const reports = await db
    .select()
    .from(transparencyReports)
    .where(eq(transparencyReports.published, true))
    .orderBy(desc(transparencyReports.year), desc(transparencyReports.quarter));

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-4">
            Transparency Reports
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-warmgray-600 leading-relaxed">
            We believe in full transparency. Here you can see exactly how your
            support is making a difference in the lives of children across Bali.
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="rounded-xl bg-white border border-warmgray-200 shadow-sm p-12 text-center">
            <p className="text-warmgray-500">
              Our first transparency report is coming soon. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-xl bg-white border border-warmgray-200 shadow-sm overflow-hidden"
              >
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-2xl font-bold text-warmgray-900">
                      {report.title}
                    </h2>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="rounded-lg bg-teal-50 p-4 text-center">
                      <p className="text-2xl font-bold text-teal-700">
                        {report.totalClasses}
                      </p>
                      <p className="text-xs text-teal-600 mt-1">Classes Taught</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">
                        {report.totalStudents}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">Students Reached</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700">
                        {report.totalTeachers}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">Active Teachers</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-4 text-center">
                      <p className="text-2xl font-bold text-purple-700">
                        {report.orphanageCount}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">Orphanages Served</p>
                    </div>
                  </div>

                  {/* Markdown content rendered as plain text */}
                  {report.content && (
                    <div className="prose prose-warmgray max-w-none text-warmgray-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {report.content
                        .replace(/^#+ /gm, "")
                        .replace(/\*\*/g, "")
                        .replace(/\*/g, "")
                        .replace(/^- /gm, "\u2022 ")}
                    </div>
                  )}

                  {report.publishedAt && (
                    <p className="mt-6 text-xs text-warmgray-400">
                      Published{" "}
                      {new Date(report.publishedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-warmgray-600 mb-4">
            Want to support these children?
          </p>
          <Link
            href="/donate"
            className="inline-block rounded-lg bg-amber-500 px-8 py-3.5 text-lg font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Donate Now
          </Link>
        </div>
      </div>
    </div>
  );
}
