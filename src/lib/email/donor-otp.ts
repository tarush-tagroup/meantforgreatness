import { Resend } from "resend";

interface SendDonorOtpEmailParams {
  to: string;
  code: string;
}

export async function sendDonorOtpEmail({
  to,
  code,
}: SendDonorOtpEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Meant for Greatness <tarush@meantforgreatness.org>",
    to,
    subject: `Your login code: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0A400C;">Your Login Code</h2>
        <p style="color: #504E47; line-height: 1.6;">
          Enter this code to access your donor portal:
        </p>
        <div style="background: #F5F5F0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0A400C;">
            ${code}
          </span>
        </div>
        <p style="color: #A8A598; font-size: 13px;">
          This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
