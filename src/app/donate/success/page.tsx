import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Thank You",
  description: "Thank you for your generous donation to Meant for Greatness.",
};

export default function DonateSuccessPage() {
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center mb-6">
            <svg
              className="h-8 w-8 text-teal-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-4">
            Thank You!
          </h1>
          <p className="text-lg text-warmgray-600 leading-relaxed">
            Your generous donation will help provide English education to orphan
            children in Bali. You&apos;re giving these kids a real shot at a
            better future.
          </p>
        </div>

        <div className="rounded-xl bg-teal-50 border border-teal-200 p-6 mb-8">
          <h2 className="font-semibold text-teal-800 mb-2">
            What happens next?
          </h2>
          <p className="text-teal-700 text-sm leading-relaxed">
            Your donation goes directly to funding English classes at our partner
            orphanages across Bali. You&apos;ll receive a confirmation email
            from Stripe with your receipt.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="rounded-lg border-2 border-warmgray-200 px-6 py-3 font-semibold text-warmgray-700 hover:bg-warmgray-50 transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/orphanages"
            className="rounded-lg bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            See Our Orphanages
          </Link>
        </div>
      </div>
    </div>
  );
}
