/// <reference types="vitest/globals" />

import { randomUUID } from "node:crypto";

import { babies, db, events, households, users } from "@bubsie/db";
import { eq, inArray } from "drizzle-orm";

/* Runs the real resolvers against Postgres. Needs DATABASE_URL pointing at a
 * migrated database (CI's test job provides one). */

const databaseUrl = process.env.DATABASE_URL;

const LOG_EVENT = `
  mutation LogEvent(
    $id: String
    $babyId: String!
    $startedAt: String
    $feedMeta: FeedMetadataInput
  ) {
    logEvent(
      id: $id
      babyId: $babyId
      type: feed
      startedAt: $startedAt
      feedMeta: $feedMeta
    ) {
      id endedAt metadata
    }
  }
`;

const UPDATE_EVENT = `
  mutation UpdateEvent($id: String!, $endedAt: String) {
    updateEvent(id: $id, endedAt: $endedAt) { id }
  }
`;

const DELETE_EVENT = `
  mutation DeleteEvent($id: String!) { deleteEvent(id: $id) }
`;

interface Family {
  babyId: string;
  householdId: string;
  parent: string;
  partner: string;
}

describe.skipIf(!databaseUrl)("event mutations", () => {
  let post: (body: string, user: string) => Promise<Response> | Response;
  const families: Family[] = [];
  let home: Family;
  let neighbours: Family;

  const createFamily = async (tag: string): Promise<Family> => {
    const [household] = await db
      .insert(households)
      .values({ inviteCode: `test-${tag}` })
      .returning();
    const [parent, partner] = await db
      .insert(users)
      .values([
        { email: `parent-${tag}@bubsie.test`, householdId: household.id },
        { email: `partner-${tag}@bubsie.test`, householdId: household.id },
      ])
      .returning();
    const [baby] = await db
      .insert(babies)
      .values({
        birthDate: "2026-10-01",
        householdId: household.id,
        name: "Test",
      })
      .returning();
    const family = {
      babyId: baby.id,
      householdId: household.id,
      parent: parent.id,
      partner: partner.id,
    };
    families.push(family);
    return family;
  };

  beforeAll(async () => {
    process.env.SKIP_MIGRATIONS = "1";
    process.env.BUBSIE_API_DATABASE_URL ??= databaseUrl;
    process.env.BUBSIE_API_JWT_SECRET ??= "test-secret-test-secret";
    process.env.BUBSIE_API_WEB_URL ??= "http://localhost:3000";
    process.env.BUBSIE_API_SMTP_HOST ??= "localhost";
    process.env.BUBSIE_API_SMTP_FROM ??= "test@bubsie.test";
    // The server's own Yoga setup, with the session taken from a test header.
    const { createApiYoga } = await import("../yoga");
    const yoga = createApiYoga(({ request }) => {
      const sub = request.headers.get("x-user");
      return Promise.resolve({
        currentUser: sub ? { email: "", sub } : null,
        db,
      });
    });
    post = (body, user) =>
      yoga.fetch("http://test/graphql", {
        body,
        headers: { "Content-Type": "application/json", "x-user": user },
        method: "POST",
      });

    const tag = randomUUID().slice(0, 8);
    home = await createFamily(`${tag}-home`);
    neighbours = await createFamily(`${tag}-next-door`);
  });

  afterAll(async () => {
    for (const family of families) {
      await db.delete(events).where(eq(events.babyId, family.babyId));
      await db.delete(babies).where(eq(babies.id, family.babyId));
      await db
        .delete(users)
        .where(inArray(users.id, [family.parent, family.partner]));
      await db.delete(households).where(eq(households.id, family.householdId));
    }
  });

  const errorsOf = async (
    source: string,
    variables: Record<string, unknown>,
    user: string | null = home.parent
  ) => {
    const response = await post(
      JSON.stringify({ query: source, variables }),
      user ?? ""
    );
    const result = (await response.json()) as {
      errors?: { message: string; extensions?: { code?: string } }[];
    };
    return { errors: result.errors ?? [], status: response.status };
  };

  const run = async (
    source: string,
    variables: Record<string, unknown>,
    user = home.parent
  ) => {
    const response = await post(
      JSON.stringify({ query: source, variables }),
      user
    );
    const result = (await response.json()) as {
      data?: Record<string, unknown>;
      errors?: { message: string }[];
    };
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data as Record<string, unknown>;
  };

  const logFeed = ({
    babyId = home.babyId,
    id,
    side = "left",
    user = home.parent,
  }: {
    babyId?: string;
    id?: string;
    side?: string;
    user?: string;
  }) =>
    run(
      LOG_EVENT,
      {
        babyId,
        feedMeta: { method: "breast", side },
        id,
        startedAt: "2026-11-21T03:00:00.123Z",
      },
      user
    ).then(
      (data) =>
        data.logEvent as {
          endedAt: string | null;
          id: string;
          metadata: string;
        }
    );

  const rowsWithId = (id: string) =>
    db.select().from(events).where(eq(events.id, id));

  it("stores a create under the id the client chose", async () => {
    const id = randomUUID();
    await expect(logFeed({ id })).resolves.toMatchObject({ id });
    await expect(rowsWithId(id)).resolves.toHaveLength(1);
  });

  it("returns the stored event when a create is resent after someone edited it", async () => {
    const id = randomUUID();
    await logFeed({ id });
    const endedAt = "2026-11-21T03:20:00.000Z";
    await run(UPDATE_EVENT, { endedAt, id }, home.partner);

    const resent = await logFeed({ id });
    expect(resent.id).toBe(id);
    expect(Date.parse(resent.endedAt ?? "")).toBe(Date.parse(endedAt));
    await expect(rowsWithId(id)).resolves.toHaveLength(1);
  });

  it("stores one event when two copies of a create race", async () => {
    const id = randomUUID();
    const copies = await Promise.all([logFeed({ id }), logFeed({ id })]);
    expect(copies.map((c) => c.id)).toStrictEqual([id, id]);
    await expect(rowsWithId(id)).resolves.toHaveLength(1);
  });

  it("keeps two separate creates with the same details apart", async () => {
    const first = await logFeed({ id: randomUUID() });
    const second = await logFeed({ id: randomUUID() });
    expect(second.id).not.toBe(first.id);
  });

  it("still stores a create from a client that sends no id", async () => {
    const a = await logFeed({});
    const b = await logFeed({});
    expect(a.id).not.toBe(b.id);
  });

  it("refuses another household's id without revealing that event", async () => {
    const id = randomUUID();
    await logFeed({ id, side: "right" });
    const attempt = logFeed({
      babyId: neighbours.babyId,
      id,
      user: neighbours.parent,
    });
    await expect(attempt).rejects.toThrow("Event could not be saved");
    const [row] = await rowsWithId(id);
    expect(row.babyId).toBe(home.babyId);
  });

  it("refuses an id logged by someone else, even in the same household", async () => {
    const id = randomUUID();
    await logFeed({ id });
    await expect(logFeed({ id, user: home.partner })).rejects.toThrow(
      "Event could not be saved"
    );
  });

  it("refuses an id that is not a UUID", async () => {
    await expect(logFeed({ id: "local-123" })).rejects.toThrow(
      "Event id must be a UUID"
    );
  });

  it("treats deleting an event that is already gone as done", async () => {
    const { id } = await logFeed({ id: randomUUID() });
    await run(DELETE_EVENT, { id });
    await expect(run(DELETE_EVENT, { id })).resolves.toStrictEqual({
      deleteEvent: true,
    });
  });

  describe("how a client can tell a refusal from a failure", () => {
    it("marks a refusal, so the client knows a resend will not help", async () => {
      const { errors } = await errorsOf(LOG_EVENT, {
        babyId: home.babyId,
        feedMeta: { method: "breast", side: "left" },
        id: "local-123",
      });
      expect(errors[0]).toMatchObject({
        extensions: { code: "REFUSED" },
        message: "Event id must be a UUID",
      });
    });

    it("marks a missing session, so the client refreshes it", async () => {
      const { errors } = await errorsOf(
        DELETE_EVENT,
        { id: randomUUID() },
        null
      );
      expect(errors[0]?.extensions?.code).toBe("UNAUTHENTICATED");
    });

    it("marks a malformed request as a refusal", async () => {
      const { errors } = await errorsOf(
        "mutation { logEvent(babyId: 1) { id } }",
        {}
      );
      expect(errors[0]?.extensions?.code).toBe("GRAPHQL_VALIDATION_FAILED");
    });

    it("refuses a refresh token it does not recognise, explicitly", async () => {
      const { errors } = await errorsOf(
        "mutation($t: String!) { refreshToken(refreshToken: $t) { token } }",
        { t: "not-a-real-refresh-token" },
        null
      );
      expect(errors[0]?.extensions?.code).toBe("REFUSED");
    });

    it("hides an unexpected error's details and does not call it a refusal", async () => {
      const { errors } = await errorsOf(DELETE_EVENT, { id: "not-a-uuid" });
      expect(errors[0]?.message).toBe("Unexpected error.");
      expect(errors[0]?.extensions?.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
});
