import type { Metadata } from "next";
import { getAllOrphanages } from "@/data/orphanages";
import OrphanageSection from "@/components/orphanages/OrphanageSection";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Orphanages",
  description:
    "Meet the 4 orphanages across Bali where we run English classes for over 100 children.",
};

export default function OrphanagesPage() {
  const orphanages = getAllOrphanages();

  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-4">
            Our Orphanages
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-warmgray-600 leading-relaxed">
            We currently run English classes across 4 orphanages in Bali,
            reaching over 100 children with consistent, quality education.
          </p>
        </div>

        <div className="space-y-8">
          {orphanages.map((orphanage) => (
            <OrphanageSection key={orphanage.id} orphanage={orphanage} />
          ))}
        </div>

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
