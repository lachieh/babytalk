import { createTransport } from "nodemailer";

const transport = createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
});

const from = process.env.SMTP_FROM || "noreply@babytalk.dev";

export async function sendMagicLinkEmail(
  email: string,
  token: string,
): Promise<void> {
  const webUrl = process.env.WEB_URL || "http://localhost:3000";
  const link = `${webUrl}/auth/verify?token=${token}`;

  await transport.sendMail({
    from,
    to: email,
    subject: "Sign in to Babytalk",
    text: `Click this link to sign in: ${link}\n\nThis link expires in 15 minutes.`,
    html: `
      <h2>Sign in to Babytalk</h2>
      <p>Click the link below to sign in:</p>
      <p><a href="${link}">Sign in to Babytalk</a></p>
      <p>This link expires in 15 minutes.</p>
    `,
  });
}
