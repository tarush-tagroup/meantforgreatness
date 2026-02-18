/**
 * Single source of truth for all donation tier data.
 * Used by: Sponsorship.tsx (homepage), donate/page.tsx, DonationForm.tsx
 *
 * Cost basis:
 * - 1 class session = 300,000 IDR
 * - 1 class/week × 4 weeks = 1,200,000 IDR/month ≈ $75/month
 * - Full program (3x/week) = 3,600,000 IDR/month ≈ $225/month
 * - 1 orphanage = 2-3 full programs ≈ $450-$675/month
 * - Each class has 3-15 students
 */

export type DonationFrequency = "one_time" | "monthly" | "yearly";

export interface DonationTier {
  id: string;
  title: string;
  monthlyAmount: number;
  yearlyAmount: number;
  oneTimeAmount: number;
  description: string;
  oneTimeDescription: string;
  yearlyDescription: string;
  impact: string;
  highlighted: boolean;
}

export const DONATION_TIERS: DonationTier[] = [
  {
    id: "class",
    title: "Sponsor a Class",
    monthlyAmount: 75,
    yearlyAmount: 900,
    oneTimeAmount: 150,
    description:
      "Fund one English class per week — one-third of the full program. Covers one weekly session for a group of kids.",
    oneTimeDescription:
      "Fund 2 months of weekly English classes — 8 sessions for a group of kids.",
    yearlyDescription:
      "Commit to a full year of weekly English classes for a group of kids — 48 sessions of structured education.",
    impact:
      "One weekly class for a group of kids. Over a year, that's 48 classes — a third of the full program.",
    highlighted: false,
  },
  {
    id: "program",
    title: "Sponsor a Full Program",
    monthlyAmount: 225,
    yearlyAmount: 2700,
    oneTimeAmount: 500,
    description:
      "Fund the complete 3x/week English program for 5-15 kids — the full curriculum that builds real fluency.",
    oneTimeDescription:
      "Fund over 2 months of the full 3x/week English program — 24+ classes that take 5-15 kids from basics to real conversations.",
    yearlyDescription:
      "Commit to a full year of the complete 3x/week English program for 5-15 kids — 144 classes that build real fluency.",
    impact:
      "The complete 3x/week program for 5-15 kids for a full year — enough frequency to go from zero English to real conversations.",
    highlighted: true,
  },
  {
    id: "orphanage",
    title: "Sponsor an Orphanage",
    monthlyAmount: 675,
    yearlyAmount: 8100,
    oneTimeAmount: 1500,
    description:
      "Fund all English programs at an entire orphanage — typically 20-50 kids. On the smaller side, this could even cover 2 orphanages.",
    oneTimeDescription:
      "Fund over 2 months of English education for an entire orphanage — every class, every level, every child.",
    yearlyDescription:
      "Commit to a full year of English education for an entire orphanage — every class, every level, 20-50 kids.",
    impact:
      "Every child at an orphanage — typically 20-50 kids — gets English education. For smaller orphanages, this could cover two.",
    highlighted: false,
  },
];

export const MONTHLY_PRESETS = DONATION_TIERS.map((t) => t.monthlyAmount);
export const YEARLY_PRESETS = DONATION_TIERS.map((t) => t.yearlyAmount);
export const ONE_TIME_PRESETS = DONATION_TIERS.map((t) => t.oneTimeAmount);
export const DEFAULT_MONTHLY_AMOUNT = 75;
export const DEFAULT_YEARLY_AMOUNT = 900;
export const DEFAULT_ONE_TIME_AMOUNT = 150;

/**
 * Get the contextual sponsorship message for a given donation amount and frequency.
 */
export function getSponsorshipMessage(
  amount: number,
  frequency: DonationFrequency
): { label: string; message: string } | null {
  if (frequency === "monthly") {
    if (amount >= 675) {
      return {
        label: "Sponsor an Orphanage",
        message: `Your $${amount}/month funds all English classes at an entire orphanage — typically 20-50 kids. For smaller orphanages, this could cover two.`,
      };
    }
    if (amount >= 225) {
      return {
        label: "Sponsor a Full Program",
        message: `Your $${amount}/month funds the complete 3x/week English program for 5-15 kids — the kind of consistency that builds real fluency.`,
      };
    }
    if (amount >= 75) {
      return {
        label: "Sponsor a Class",
        message: `Your $${amount}/month funds one English class per week — one-third of the full program for a group of kids.`,
      };
    }
    if (amount > 0) {
      return {
        label: "Every Dollar Teaches",
        message:
          "Every dollar goes directly to funding English classes for orphan children in Bali.",
      };
    }
  } else if (frequency === "yearly") {
    if (amount >= 8100) {
      return {
        label: "Sponsor an Orphanage for a Year",
        message: `Your $${amount.toLocaleString()}/year funds a full year of English education for an entire orphanage — every class, every level, 20-50 kids.`,
      };
    }
    if (amount >= 2700) {
      return {
        label: "Sponsor a Full Program for a Year",
        message: `Your $${amount.toLocaleString()}/year funds a full year of the complete 3x/week English program for 5-15 kids — 144 classes that build real fluency.`,
      };
    }
    if (amount >= 900) {
      return {
        label: "Sponsor a Class for a Year",
        message: `Your $${amount.toLocaleString()}/year funds a full year of weekly English classes — 48 sessions for a group of kids.`,
      };
    }
    if (amount > 0) {
      return {
        label: "Every Dollar Teaches",
        message:
          "Every dollar goes directly to funding English classes for orphan children in Bali.",
      };
    }
  } else {
    // One-time — frame around total impact of the gift
    if (amount >= 1500) {
      return {
        label: "Transform an Orphanage",
        message: `Your $${amount.toLocaleString()} gift funds over 2 months of English education for an entire orphanage — every class, every level, 20-50 kids.`,
      };
    }
    if (amount >= 500) {
      return {
        label: "Fund a Full Program",
        message: `Your $${amount} gift funds over 2 months of the complete 3x/week English program — 24+ classes for 5-15 kids.`,
      };
    }
    if (amount >= 150) {
      return {
        label: "Fund a Class",
        message: `Your $${amount} gift funds ${Math.floor(amount / 75)} months of weekly English classes — that's ${Math.floor(amount / 75) * 4} sessions for a group of kids.`,
      };
    }
    if (amount >= 75) {
      return {
        label: "Fund a Month of Classes",
        message: `Your $${amount} gift funds one month of weekly English classes for a group of kids — 4 sessions of structured English education.`,
      };
    }
    if (amount > 0) {
      return {
        label: "Every Dollar Teaches",
        message:
          "Every dollar goes directly to funding English classes for orphan children in Bali.",
      };
    }
  }
  return null;
}
