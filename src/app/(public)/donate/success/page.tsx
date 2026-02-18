import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { donors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createDonorSession, setDonorCookie } from "@/lib/donor-auth";
import { logger } from "@/lib/logger";

export const metadata: Metadata = {
  title: "Thank You",
  description: "Thank you for your generous donation to Meant for Greatness.",
};

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function DonateSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

  // Try to auto-login the donor and redirect to their portal
  let shouldRedirect = false;

  if (session_id) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const email = session.customer_email || session.customer_details?.email;

      if (email) {
        // Look up the donor — may have just been created by the webhook
        let donor = await findDonor(email);

        if (!donor) {
          // Webhook might not have fired yet — wait 2 seconds and retry
          await new Promise((r) => setTimeout(r, 2000));
          donor = await findDonor(email);
        }

        if (donor) {
          // Create session and set cookie
          const sessionToken = createDonorSession(donor.id, donor.email);
          await setDonorCookie(sessionToken);

          // Update last login
          await db
            .update(donors)
            .set({ lastLoginAt: new Date() })
            .where(eq(donors.id, donor.id));

          logger.info("donor:auth", "Post-donation auto-login", {
            email: donor.email,
          });

          shouldRedirect = true;
        }
      }
    } catch (err) {
      // Log and fall through to the static page
      logger.warn("checkout:success", "Auto-login failed, showing static page", {
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }

  // Redirect outside the try/catch (Next.js redirect throws internally)
  if (shouldRedirect) {
    redirect("/donor?welcome=true");
  }

  // Fallback: static thank-you page (no session_id or auto-login failed)
  return (
    <div className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <svg
              className="h-8 w-8 text-green-600"
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
          <h1 className="text-3xl sm:text-4xl font-bold text-sand-900 mb-4">
            Thank You!
          </h1>
          <p className="text-lg text-sand-600 leading-relaxed">
            Your generous donation will help provide English education to orphan
            children in Bali. You&apos;re giving these kids a real shot at a
            better future.
          </p>
        </div>

        <div className="rounded-xl bg-green-50 border border-green-200 p-6 mb-8">
          <h2 className="font-semibold text-green-800 mb-2">
            What happens next?
          </h2>
          <p className="text-green-700 text-sm leading-relaxed">
            Your donation goes directly to funding English classes at our partner
            orphanages across Bali. You&apos;ll receive a confirmation email
            from Stripe with your receipt.
          </p>
        </div>

        <div className="rounded-xl bg-sage-50 border border-sage-200 p-6 mb-8">
          <h2 className="font-semibold text-green-800 mb-2">
            Manage Your Donations
          </h2>
          <p className="text-sand-700 text-sm leading-relaxed">
            Check your email for a link to your personal donor portal where you
            can view your donation history, meet the kids, and manage your
            giving.
          </p>
          <Link
            href="/donor/login"
            className="inline-block mt-3 text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
          >
            Go to Donor Portal &rarr;
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="rounded-lg border-2 border-sand-200 px-6 py-3 font-semibold text-sand-700 hover:bg-sand-50 transition-colors"
          >
            Back to Home
          </Link>
          <Link
            href="/orphanages"
            className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 transition-colors"
          >
            See Our Orphanages
          </Link>
        </div>
      </div>
    </div>
  );
}

async function findDonor(email: string) {
  const [donor] = await db
    .select({ id: donors.id, email: donors.email })
    .from(donors)
    .where(eq(donors.email, email.toLowerCase()))
    .limit(1);
  return donor || null;
}
