import Link from "next/link";
import { db } from "@/db";
import { orphanages } from "@/db/schema";
import { sql } from "drizzle-orm";
import { DONATION_TIERS } from "@/lib/donation-tiers";

export default async function Sponsorship() {
  // Fetch live stats from the database
  const [stats] = await db
    .select({
      orphanageCount: sql<number>`count(*)`,
      totalStudents: sql<number>`coalesce(sum(${orphanages.studentCount}), 0)`,
    })
    .from(orphanages);

  const orphanageCount = Number(stats?.orphanageCount || 0);
  const totalStudents = Number(stats?.totalStudents || 0);

  return (
    <section className="py-16 sm:py-20 bg-sage-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-6">
            How You Can Help
          </h2>
          <p className="text-lg text-sand-600 leading-relaxed">
            Every dollar goes directly to funding classes for these children.
            Choose a level that works for you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {DONATION_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-xl bg-white p-8 shadow-sm border flex flex-col relative ${
                tier.highlighted
                  ? "border-sage-400 ring-2 ring-sage-200"
                  : "border-sage-200"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block rounded-full bg-sage-500 px-3 py-1 text-xs font-semibold text-white">
                    Recommended
                  </span>
                </div>
              )}
              <h3 className="text-xl font-semibold text-sand-900 mb-2">
                {tier.title}
              </h3>
              <div className="text-2xl font-bold text-sage-600 mb-4">
                ${tier.monthlyAmount}/month
              </div>
              <p className="text-sand-600 text-sm leading-relaxed mb-3 flex-1">
                {tier.description}
              </p>
              <p className="text-xs text-sand-400 leading-relaxed">
                {tier.impact}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/donate"
            className="inline-block rounded-lg bg-sage-500 px-8 py-3.5 text-lg font-semibold text-white hover:bg-sage-600 transition-colors"
          >
            Make a Donation
          </Link>
        </div>

        {/* Impact stats — pulled from database */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { stat: String(orphanageCount), label: "Orphanages" },
            { stat: `${totalStudents}+`, label: "Kids" },
            { stat: "Bali", label: "Indonesia" },
            { stat: "Sept 2024", label: "Classes Since" },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-3xl sm:text-4xl font-bold text-green-700">
                {item.stat}
              </div>
              <div className="mt-1 text-sm text-sand-500 font-medium uppercase tracking-wide">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
