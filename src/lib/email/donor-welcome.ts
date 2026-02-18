import { Resend } from "resend";

interface SendDonorWelcomeEmailParams {
  to: string;
  donorName: string;
  frequency: string;
  magicLoginToken: string;
}

export async function sendDonorWelcomeEmail({
  to,
  donorName,
  frequency,
  magicLoginToken,
}: SendDonorWelcomeEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://www.meantforgreatness.org";
  const portalUrl = `${baseUrl}/api/donor/auth?token=${magicLoginToken}`;

  const isRecurring = frequency === "monthly" || frequency === "yearly";
  const manageLine = isRecurring
    ? `manage your ${frequency} subscription, update your payment method,`
    : "view your giving history, start a monthly donation,";

  await resend.emails.send({
    from: "Meant for Greatness <tarush@meantforgreatness.org>",
    to,
    subject: "Thank You for Your Donation!",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0A400C;">Thank You${donorName ? `, ${donorName}` : ""}!</h2>
        <p style="color: #504E47; line-height: 1.6;">
          Your generous donation is helping provide English education to orphan children in Bali.
          Every contribution brings these kids one step closer to a brighter future.
        </p>
        ${
          isRecurring
            ? `<p style="color: #504E47; line-height: 1.6;">
                As a ${frequency} supporter, you're making a <strong>sustained impact</strong> on children's lives.
                Your recurring gift means our teachers can plan ahead and our students can count on consistent learning.
              </p>`
            : `<p style="color: #504E47; line-height: 1.6;">
                Did you know that <strong>$75/month</strong> can sponsor a weekly English class?
                Monthly giving creates lasting impact and helps our teachers plan for the future.
              </p>`
        }
        <div style="background: #F5F5F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #504E47; font-size: 14px; line-height: 1.6;">
            <strong>Your Donor Portal</strong><br/>
            You can ${manageLine} and make additional donations anytime.
          </p>
        </div>
        <a
          href="${portalUrl}"
          style="display: inline-block; background: #819067; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 8px 0 16px 0;"
        >
          Manage Your Donations
        </a>
        <p style="color: #A8A598; font-size: 13px; margin-top: 24px;">
          This link is valid for 24 hours. After that, you can log in anytime
          at <a href="${baseUrl}/donor/login" style="color: #819067;">${baseUrl}/donor/login</a>
          using your email.
        </p>
      </div>
    `,
  });
}
