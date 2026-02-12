import { Resend } from "resend";

interface SendInviteEmailParams {
  to: string;
  invitedByName: string;
  roles: string[];
}

export async function sendInviteEmail({
  to,
  invitedByName,
  roles,
}: SendInviteEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const roleLabels = roles.map((r) => r.replace("_", " ")).join(", ");
  const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://meantforgreatness.org"}/admin/login`;

  await resend.emails.send({
    from: "Meant for Greatness <tarush@meantforgreatness.org>",
    to,
    subject: "You're invited to the Meant for Greatness admin panel",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1c1917;">Welcome to Meant for Greatness</h2>
        <p style="color: #57534e; line-height: 1.6;">
          ${invitedByName} has invited you to join the admin panel as <strong>${roleLabels}</strong>.
        </p>
        <p style="color: #57534e; line-height: 1.6;">
          Click the button below to sign in with your Google account:
        </p>
        <a
          href="${loginUrl}"
          style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;"
        >
          Sign in to Admin Panel
        </a>
        <p style="color: #a8a29e; font-size: 13px; margin-top: 24px;">
          Make sure to sign in with the Google account associated with this email address (${to}).
        </p>
      </div>
    `,
  });
}
