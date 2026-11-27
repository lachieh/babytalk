// A Bubsie API for the emulator test to act as the person with the phone: sign in by magic link
// (through Mailpit at MAILPIT_URL), set up a household and babies, approve the device's code, log
// from "another device". Every call names the API it goes to.
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token: string | undefined,
  api: string
): Promise<T> {
  const response = await fetch(api, {
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

/** The ids of the messages Mailpit holds for `email`. */
export async function mailIds(email: string): Promise<Set<string>> {
  const search = (await (
    await fetch(
      `${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`
    )
  ).json()) as { messages: { ID: string }[] };
  return new Set(search.messages.map((m) => m.ID));
}

/** The token in the first magic link sent to `email` that is not one of `seen`. Leaves every
 * message in place: the Mailpit may be shared with someone using it. */
export async function magicToken(
  email: string,
  seen: Set<string> = new Set()
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const id of await mailIds(email)) {
      if (seen.has(id)) continue;
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${id}`)
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

/** Sign in by magic link (a new person the first time). Returns an access token. */
export async function signIn(email: string, api: string): Promise<string> {
  const seen = await mailIds(email);
  await gql(
    "mutation($email: String!) { requestMagicLink(email: $email) }",
    { email },
    undefined,
    api
  );
  const { verifyMagicLink } = await gql<{ verifyMagicLink: { token: string } }>(
    "mutation($token: String!) { verifyMagicLink(token: $token) { token } }",
    { token: await magicToken(email, seen) },
    undefined,
    api
  );
  return verifyMagicLink.token;
}

/** A new person with a household and the named babies, on the API at `api`. Returns their email,
 * access token and baby ids. */
export async function newFamily(
  babyNames: string[],
  api: string
): Promise<{
  email: string;
  token: string;
  babies: { id: string; name: string }[];
}> {
  const email = `device-${Math.random().toString(36).slice(2, 10)}@bubsie.test`;
  const token = await signIn(email, api);
  await gql("mutation { createHousehold { id } }", {}, token, api);
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
      token,
      api
    );
    babies.push({ id: addBaby.id, name });
  }
  return { email, token, babies };
}

export async function approve(
  code: string,
  token: string,
  api: string
): Promise<boolean> {
  const { approveDeviceCode } = await gql<{ approveDeviceCode: boolean }>(
    "mutation($code: String!) { approveDeviceCode(code: $code) }",
    { code },
    token,
    api
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
  token: string,
  api: string
): Promise<ApiEvent[]> {
  const { recentEvents } = await gql<{ recentEvents: ApiEvent[] }>(
    "query($babyId: String!) { recentEvents(babyId: $babyId, limit: 50) { id type startedAt endedAt metadata } }",
    { babyId },
    token,
    api
  );
  return recentEvents;
}
