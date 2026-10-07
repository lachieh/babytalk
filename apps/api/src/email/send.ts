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
      <h2>Sign in to Bubsie</h2>
      <p>Click the link below to sign in:</p>
      <p><a href="${link}">Sign in to Bubsie</a></p>
      <p>This link expires in 15 minutes.</p>
    `,
    subject: "Sign in to Bubsie",
    text: `Click this link to sign in: ${link}\n\nThis link expires in 15 minutes.`,
    to: email,
  });
};

export const sendPartnerInviteEmail = async (
  email: string,
  token: string,
  inviteCode: string
): Promise<void> => {
  const link = `${config.webUrl}/auth/verify?token=${token}&join=${inviteCode}`;

  await transport.sendMail({
    from: config.smtpFrom,
    html: `
      <h2>You've been invited to Bubsie</h2>
      <p>Your partner is using Bubsie to track feeds, sleep, and diapers. Tap below to join their family:</p>
      <p><a href="${link}">Join Bubsie</a></p>
      <p>This link expires in 24 hours.</p>
    `,
    subject: "Join your partner on Bubsie",
    text: `Your partner invited you to Bubsie! Tap this link to join: ${link}\n\nThis link expires in 24 hours.`,
    to: email,
  });
};
