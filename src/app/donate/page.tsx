import type { Metadata } from "next";
import DonationForm from "@/components/donate/DonationForm";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support English education for orphan children in Bali. Sponsor a kid, multiple kids, or a teacher.",
};

export default function DonatePage() {
  return (
    <div className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-warmgray-900 mb-4">
            Make a Donation
          </h1>
          <p className="text-lg text-warmgray-600 leading-relaxed">
            Your donation directly funds English classes for orphan children in
            Bali. Every contribution makes a real difference.
          </p>
        </div>

        <div className="rounded-xl bg-white border border-warmgray-200 shadow-sm p-6 sm:p-8">
          <DonationForm />
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-sm">
          <div>
            <div className="font-semibold text-warmgray-800 mb-1">
              $50/month
            </div>
            <div className="text-warmgray-500">Sponsors a child</div>
          </div>
          <div>
            <div className="font-semibold text-warmgray-800 mb-1">
              $100/month
            </div>
            <div className="text-warmgray-500">Sponsors multiple children</div>
          </div>
          <div>
            <div className="font-semibold text-warmgray-800 mb-1">
              $500/month
            </div>
            <div className="text-warmgray-500">Sponsors a teacher</div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-warmgray-500">
          <p>
            White Light Ventures, Inc is a registered 501(c)(3) nonprofit organization. All donations
            are tax-deductible to the extent allowed by law.
          </p>
        </div>
      </div>
    </div>
  );
}
