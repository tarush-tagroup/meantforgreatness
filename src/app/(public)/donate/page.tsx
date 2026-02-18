import type { Metadata } from "next";
import Image from "next/image";
import DonationForm from "@/components/donate/DonationForm";
import { DONATION_TIERS } from "@/lib/donation-tiers";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Fund English classes for orphan children in Bali. $75/month sponsors a class, $225/month sponsors a full program, $675/month sponsors an orphanage.",
};

export default function DonatePage() {
  return (
    <div>
      {/* Hero banner */}
      <section className="relative h-64 sm:h-80">
        <Image
          src="/images/kids-learning.jpg"
          alt="Children learning English in a Bali orphanage classroom"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="text-center text-white">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
              Change a Life Today
            </h1>
            <p className="mx-auto max-w-xl text-lg text-white/90 leading-relaxed">
              Every dollar goes directly to funding English classes for orphan
              children in Bali.
            </p>
          </div>
        </div>
      </section>

      {/* Main content: Form + Impact sidebar */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14">
            {/* Left: Donation form */}
            <div className="lg:col-span-3">
              <div className="rounded-xl bg-white border border-sand-200 shadow-sm p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-sand-900 mb-6">
                  Make a Donation
                </h2>
                <DonationForm />
              </div>
            </div>

            {/* Right: Impact sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tier cards */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-sand-900">
                  Your Impact
                </h3>
                {DONATION_TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    className={`rounded-xl p-5 border ${
                      tier.highlighted
                        ? "bg-sage-50 border-sage-300"
                        : "bg-sand-50 border-sand-200"
                    }`}
                  >
                    {tier.highlighted && (
                      <span className="inline-block rounded-full bg-sage-500 px-2.5 py-0.5 text-xs font-semibold text-white mb-2">
                        Most Popular
                      </span>
                    )}
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xl font-bold text-sand-900">
                        ${tier.monthlyAmount}
                      </span>
                      <span className="text-sm text-sand-500">/month</span>
                    </div>
                    <div className="text-xs text-sand-400 mb-1">
                      or ${tier.yearlyAmount.toLocaleString()}/year
                    </div>
                    <div className="font-semibold text-sand-800 text-sm mb-1">
                      {tier.title}
                    </div>
                    <p className="text-sand-600 text-xs leading-relaxed">
                      {tier.impact}
                    </p>
                  </div>
                ))}
              </div>

              {/* Classroom photo */}
              <div className="rounded-xl overflow-hidden">
                <Image
                  src="/images/classroom.jpg"
                  alt="English class in session at a Bali orphanage"
                  width={600}
                  height={400}
                  className="w-full h-auto"
                  sizes="(max-width: 1024px) 100vw, 400px"
                />
              </div>

              {/* The multiplier */}
              <div className="rounded-xl bg-green-50 border border-green-200 p-5">
                <h3 className="text-lg font-semibold text-green-800 mb-3">
                  The English Multiplier
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-sand-600">Without English</span>
                    <span className="font-semibold text-sand-400">
                      $100–190/mo
                    </span>
                  </div>
                  <div className="w-full bg-sand-200 rounded-full h-2">
                    <div
                      className="bg-sand-400 h-2 rounded-full"
                      style={{ width: "16%" }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-green-700">With English</span>
                    <span className="font-semibold text-green-700">
                      $500–1,150+/mo
                    </span>
                  </div>
                  <div className="w-full bg-green-100 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <p className="text-xs text-green-700 mt-2 leading-relaxed">
                    English-speaking workers in Bali earn 6-12x more. Hotel
                    receptionist: $600/mo. Tour guide: $600/mo. Resort manager:
                    $1,150/mo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact stats strip */}
      <section className="bg-green-800 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">
                6-12x
              </div>
              <div className="mt-1 text-sm text-green-200 font-medium">
                Income Multiplier
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">
                88%
              </div>
              <div className="mt-1 text-sm text-green-200 font-medium">
                Graduate Placement
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">
                3x/week
              </div>
              <div className="mt-1 text-sm text-green-200 font-medium">
                Class Frequency
              </div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white">
                100%
              </div>
              <div className="mt-1 text-sm text-green-200 font-medium">
                Goes to Classrooms
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why English + Photo grid */}
      <section className="py-12 sm:py-16 bg-sand-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Photo grid */}
            <div className="grid grid-cols-2 gap-3">
              <Image
                src="/images/waterbom-group.jpg"
                alt="Kids on a group outing"
                width={400}
                height={300}
                className="rounded-lg w-full h-48 object-cover"
                sizes="(max-width: 1024px) 50vw, 280px"
              />
              <Image
                src="/images/sekar-pengharapan.jpg"
                alt="Children at Sekar Pengharapan orphanage"
                width={400}
                height={300}
                className="rounded-lg w-full h-48 object-cover"
                sizes="(max-width: 1024px) 50vw, 280px"
              />
              <Image
                src="/images/waterbom-girls.jpg"
                alt="Girls smiling during an outing"
                width={400}
                height={300}
                className="rounded-lg w-full h-48 object-cover"
                sizes="(max-width: 1024px) 50vw, 280px"
              />
              <Image
                src="/images/waterbom-kids.jpg"
                alt="Kids enjoying a day out"
                width={400}
                height={300}
                className="rounded-lg w-full h-48 object-cover"
                sizes="(max-width: 1024px) 50vw, 280px"
              />
            </div>

            {/* Why it matters */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-sand-900 mb-6">
                Why English Changes Everything
              </h2>
              <div className="space-y-4 text-sand-600 leading-relaxed">
                <p>
                  Tourism makes up 75-80% of Bali&apos;s GDP. Every
                  high-paying career on the island — hotel receptionist, tour
                  guide, resort manager, dive instructor — requires English.
                </p>
                <p>
                  Without it, orphanage graduates enter informal labor at
                  $100-190/month. With it, they access jobs paying $500-1,150+
                  per month.{" "}
                  <span className="font-semibold text-sand-800">
                    That&apos;s a 6-12x income difference from one skill.
                  </span>
                </p>
                <p>
                  And it doesn&apos;t stop with one child. Indonesian workers
                  send 50-70% of their salary home to family. One child who
                  learns English lifts their parents, siblings, and community
                  out of poverty.
                </p>
              </div>

              {/* Proof points */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-white border border-sand-200 p-4">
                  <div className="text-2xl font-bold text-green-700 mb-1">
                    88%
                  </div>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    of Bali Children Foundation graduates found employment,
                    apprenticeships, or tertiary studies within 3 months.
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-sand-200 p-4">
                  <div className="text-2xl font-bold text-green-700 mb-1">
                    310+
                  </div>
                  <p className="text-xs text-sand-600 leading-relaxed">
                    graduates from East Bali Poverty Project — from villages
                    with 85-100% illiteracy to community leaders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-sand-900 mb-4">
              How Your Donation Works
            </h2>
            <p className="text-sand-600 leading-relaxed max-w-2xl mx-auto">
              We don&apos;t just send money — we partner with orphanages that
              take education seriously and want the best for their kids. Every
              program is built with real accountability.
            </p>
          </div>

          <div className="space-y-0 relative">
            {/* Vertical connector line */}
            <div className="absolute left-6 sm:left-8 top-6 bottom-6 w-px bg-sage-200 hidden sm:block" />

            {/* Step 1 */}
            <div className="flex gap-5 sm:gap-8 pb-8">
              <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-sage-500 flex items-center justify-center z-10">
                <span className="text-lg sm:text-xl font-bold text-white">1</span>
              </div>
              <div className="pt-1 sm:pt-3">
                <h3 className="font-semibold text-sand-900 text-lg mb-2">
                  Orphanage Partnership
                </h3>
                <p className="text-sm text-sand-600 leading-relaxed">
                  We identify and vet orphanages that are genuinely committed to
                  their children&apos;s futures. Not every orphanage qualifies —
                  we partner only with those who take education seriously, provide
                  a stable environment, and are willing to hold themselves
                  accountable to real outcomes.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-5 sm:gap-8 pb-8">
              <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-sage-500 flex items-center justify-center z-10">
                <span className="text-lg sm:text-xl font-bold text-white">2</span>
              </div>
              <div className="pt-1 sm:pt-3">
                <h3 className="font-semibold text-sand-900 text-lg mb-2">
                  Assess Every Child
                </h3>
                <p className="text-sm text-sand-600 leading-relaxed">
                  Before a single class begins, our teachers interview and assess
                  every child — understanding their current English level, age,
                  learning style, and goals. This isn&apos;t one-size-fits-all.
                  We build a tailored curriculum for each orphanage based on the
                  actual needs of their kids.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-5 sm:gap-8 pb-8">
              <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-sage-500 flex items-center justify-center z-10">
                <span className="text-lg sm:text-xl font-bold text-white">3</span>
              </div>
              <div className="pt-1 sm:pt-3">
                <h3 className="font-semibold text-sand-900 text-lg mb-2">
                  Consistent, Structured Classes
                </h3>
                <p className="text-sm text-sand-600 leading-relaxed">
                  Professional English teachers visit orphanages 3x per week,
                  teaching small groups of 3-15 kids at every level — from
                  phonics for 6-year-olds to conversational English for teens
                  preparing for careers. Consistency is what builds real fluency.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-5 sm:gap-8 pb-8">
              <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-sage-500 flex items-center justify-center z-10">
                <span className="text-lg sm:text-xl font-bold text-white">4</span>
              </div>
              <div className="pt-1 sm:pt-3">
                <h3 className="font-semibold text-sand-900 text-lg mb-2">
                  Quarterly Progress Reviews
                </h3>
                <p className="text-sm text-sand-600 leading-relaxed">
                  We monitor and track progress every quarter — level
                  assessments, class logs, and attendance records ensure kids are
                  actually learning, not just attending. Donors receive
                  transparency reports so you can see the real impact of your
                  contribution.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-5 sm:gap-8">
              <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-700 flex items-center justify-center z-10">
                <span className="text-lg sm:text-xl font-bold text-white">5</span>
              </div>
              <div className="pt-1 sm:pt-3">
                <h3 className="font-semibold text-sand-900 text-lg mb-2">
                  Futures Open Up
                </h3>
                <p className="text-sm text-sand-600 leading-relaxed">
                  Within 12-18 months, kids go from zero English to real
                  conversations — unlocking tourism careers that pay 6-12x more
                  than informal labor. One skill changes the trajectory of their
                  entire life, and their family&apos;s.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
