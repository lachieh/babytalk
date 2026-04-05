import { createTransport } from "nodemailer";

import { config } from "../env";

const transport = createTransport({
  auth:
    config.smtpUser && config.smtpPass
      ? { pass: config.smtpPass, user: config.smtpUser }
      : undefined,
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
});

export const sendMagicLinkEmail = async (
  email: string,
  token: string
): Promise<void> => {
  const link = `${config.webUrl}/auth/verify?token=${token}`;

  await transport.sendMail({
    from: config.smtpFrom,
    html: `
      <h2>Sign in to Babytalk</h2>
      <p>Click the link below to sign in:</p>
      <p><a href="${link}">Sign in to Babytalk</a></p>
      <p>This link expires in 15 minutes.</p>
    `,
    subject: "Sign in to Babytalk",
    text: `Click this link to sign in: ${link}\n\nThis link expires in 15 minutes.`,
    to: email,
  });
};
