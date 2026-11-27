// A Bubsie API for the emulator test to act as the person with the phone: sign in by magic link
// (through Mailpit), set up a household and babies, approve the device's code, log from "another
// device". Points at BUBSIE_API (default http://localhost:4417/graphql) and MAILPIT_URL.
const API = process.env.BUBSIE_API ?? "http://localhost:4417/graphql";
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string
): Promise<T> {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length)
    throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data as T;
}

async function magicToken(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = (await (
      await fetch(
        `${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`
      )
    ).json()) as {
      messages: { ID: string }[];
    };
    if (search.messages.length > 0) {
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${search.messages[0]!.ID}`)
      ).json()) as { Text: string; HTML: string };
      const match = `${message.Text}\n${message.HTML}`.match(
        /token=([0-9a-f-]{36})/
      );
      if (match) return match[1]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no magic link for ${email}`);
}

/** A new person with a household and the named babies. Returns their access token and baby ids. */
export async function newFamily(
  babyNames: string[]
): Promise<{ token: string; babies: { id: string; name: string }[] }> {
  const email = `device-${Math.random().toString(36).slice(2, 10)}@bubsie.test`;
  await gql("mutation($email: String!) { requestMagicLink(email: $email) }", {
    email,
  });
  const { verifyMagicLink } = await gql<{ verifyMagicLink: { token: string } }>(
    "mutation($token: String!) { verifyMagicLink(token: $token) { token } }",
    { token: await magicToken(email) }
  );
  const token = verifyMagicLink.token;
  await gql("mutation { createHousehold { id } }", {}, token);
  const babies = [];
  for (const name of babyNames) {
    const { addBaby } = await gql<{ addBaby: { id: string } }>(
      "mutation($name: String!, $birthDate: String!) { addBaby(name: $name, birthDate: $birthDate) { id } }",
      {
        name,
        birthDate: new Date(Date.now() - 40 * 86_400_000)
          .toISOString()
          .slice(0, 10),
      },
      token
    );
    babies.push({ id: addBaby.id, name });
  }
  return { token, babies };
}

export async function approve(code: string, token: string): Promise<boolean> {
  const { approveDeviceCode } = await gql<{ approveDeviceCode: boolean }>(
    "mutation($code: String!) { approveDeviceCode(code: $code) }",
    { code },
    token
  );
  return approveDeviceCode;
}

export interface ApiEvent {
  id: string;
  type: string;
  startedAt: string;
  endedAt: string | null;
  metadata: string;
}

export async function recentEvents(
  babyId: string,
  token: string
): Promise<ApiEvent[]> {
  const { recentEvents } = await gql<{ recentEvents: ApiEvent[] }>(
    "query($babyId: String!) { recentEvents(babyId: $babyId, limit: 50) { id type startedAt endedAt metadata } }",
    { babyId },
    token
  );
  return recentEvents;
}
