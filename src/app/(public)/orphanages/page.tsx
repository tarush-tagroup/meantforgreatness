import type { Metadata } from "next";
import { getAllOrphanages } from "@/db/queries/orphanages";
import OrphanageSection from "@/components/orphanages/OrphanageSection";
import EventSection from "@/components/orphanages/EventSection";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Orphanages",
  description:
    "Meet the orphanages across Bali where we run English classes for children in need.",
};

export default async function OrphanagesPage() {
  const orphanages = await getAllOrphanages();
  const totalStudents = orphanages.reduce((sum, o) => sum + o.studentCount, 0);

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-4">
            Our Orphanages
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-sand-600 leading-relaxed">
            We currently run English classes across {orphanages.length} orphanages in Bali,
            reaching over {totalStudents} children with consistent, quality education.
          </p>
        </div>

        <div className="space-y-8">
          {orphanages.map((orphanage) => (
            <OrphanageSection key={orphanage.id} orphanage={orphanage} />
          ))}
        </div>

        <div className="mt-16 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-8 text-center">
            Events
          </h2>
          <EventSection />
        </div>

        <div className="mt-12 text-center">
          <p className="text-sand-600 mb-4">
            Want to support these children?
          </p>
          <Link
            href="/donate"
            className="inline-block rounded-lg bg-sage-500 px-8 py-3.5 text-lg font-semibold text-white hover:bg-sage-600 transition-colors"
          >
            Donate Now
          </Link>
        </div>
      </div>
    </div>
  );
}
