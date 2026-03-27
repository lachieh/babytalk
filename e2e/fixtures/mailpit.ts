/**
 * Mailpit API client for intercepting emails in e2e tests.
 * Mailpit runs locally via docker-compose.test.yml on port 8025.
 * API docs: https://mailpit.axllent.org/docs/api-v1/
 */

const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:8025";

interface MailpitMessage {
  ID: string;
  MessageID: string;
  From: { Address: string; Name: string };
  To: { Address: string; Name: string }[];
  Subject: string;
  Snippet: string;
  Created: string;
}

interface MailpitMessageDetail extends MailpitMessage {
  Text: string;
  HTML: string;
}

interface MailpitSearchResponse {
  total: number;
  messages: MailpitMessage[];
}

/** Delete all messages in Mailpit (call in beforeEach) */
export async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

/** Search for messages sent to a specific email address */
export async function getMessagesForEmail(
  email: string,
  { timeout = 10_000, interval = 500 } = {}
): Promise<MailpitMessage[]> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(email)}`
    );
    const data: MailpitSearchResponse = await res.json();

    if (data.messages.length > 0) {
      return data.messages;
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `No emails received for ${email} within ${timeout}ms. Check that the API is sending emails to Mailpit.`
  );
}

/** Get the full message content (HTML + text) by ID */
export async function getMessageById(
  id: string
): Promise<MailpitMessageDetail> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch message ${id}: ${res.status}`);
  return res.json();
}

/**
 * Extract the magic link token from a Mailpit email.
 * Looks for /auth/verify?token=<uuid> in the email body.
 */
export async function extractMagicLinkToken(
  email: string
): Promise<{ token: string; url: string }> {
  const messages = await getMessagesForEmail(email);
  const detail = await getMessageById(messages[0].ID);

  const body = detail.HTML || detail.Text;
  const match = body.match(/\/auth\/verify\?token=([0-9a-f-]{36})/);

  if (!match) {
    throw new Error(
      `Could not find magic link token in email body:\n${body.slice(0, 500)}`
    );
  }

  const token = match[1];
  const urlMatch = body.match(/href="([^"]*\/auth\/verify\?token=[^"]*)"/);
  const url = urlMatch ? urlMatch[1] : `/auth/verify?token=${token}`;

  return { token, url };
}
