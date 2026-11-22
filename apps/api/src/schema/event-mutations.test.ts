/// <reference types="vitest/globals" />

import { randomUUID } from "node:crypto";

import { babies, db, events, households, users } from "@bubsie/db";
import { and, eq } from "drizzle-orm";
import { createYoga } from "graphql-yoga";

/* Runs the real resolvers against Postgres. Needs DATABASE_URL pointing at a
 * migrated database (CI's test job provides one). */

const databaseUrl = process.env.DATABASE_URL;

const LOG_EVENT = `
  mutation LogEvent($babyId: String!, $startedAt: String, $feedMeta: FeedMetadataInput) {
    logEvent(babyId: $babyId, type: feed, startedAt: $startedAt, feedMeta: $feedMeta) {
      id
    }
  }
`;

const DELETE_EVENT = `
  mutation DeleteEvent($id: String!) { deleteEvent(id: $id) }
`;

describe.skipIf(!databaseUrl)("event mutations", () => {
  let post: (body: string) => Promise<Response> | Response;
  const tag = randomUUID().slice(0, 8);
  let babyId = "";
  let userId = "";
  let householdId = "";

  beforeAll(async () => {
    process.env.SKIP_MIGRATIONS = "1";
    process.env.BUBSIE_API_DATABASE_URL ??= databaseUrl;
    process.env.BUBSIE_API_JWT_SECRET ??= "test-secret-test-secret";
    process.env.BUBSIE_API_WEB_URL ??= "http://localhost:3000";
    process.env.BUBSIE_API_SMTP_HOST ??= "localhost";
    process.env.BUBSIE_API_SMTP_FROM ??= "test@bubsie.test";
    const { schema } = await import("./index");
    const yoga = createYoga({
      context: () => ({ currentUser: { email: "", sub: userId }, db }),
      maskedErrors: false,
      schema,
    });
    post = (body) =>
      yoga.fetch("http://test/graphql", {
        body,
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

    const [household] = await db
      .insert(households)
      .values({ inviteCode: `test-${tag}` })
      .returning();
    householdId = household.id;
    const [user] = await db
      .insert(users)
      .values({ email: `events-${tag}@bubsie.test`, householdId })
      .returning();
    userId = user.id;
    const [baby] = await db
      .insert(babies)
      .values({ birthDate: "2026-10-01", householdId, name: "Test" })
      .returning();
    babyId = baby.id;
  });

  afterAll(async () => {
    if (!babyId) return;
    await db.delete(events).where(eq(events.babyId, babyId));
    await db.delete(babies).where(eq(babies.id, babyId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(households).where(eq(households.id, householdId));
  });

  const run = async (
    source: string,
    variableValues: Record<string, unknown>
  ) => {
    const response = await post(
      JSON.stringify({ query: source, variables: variableValues })
    );
    const result = (await response.json()) as {
      data?: Record<string, unknown>;
      errors?: { message: string }[];
    };
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data as Record<string, unknown>;
  };

  const logFeed = (startedAt: string, side = "left") =>
    run(LOG_EVENT, {
      babyId,
      feedMeta: { method: "breast", side },
      startedAt,
    }).then((data) => (data.logEvent as { id: string }).id);

  const storedAt = async (startedAt: string) => {
    const rows = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.babyId, babyId),
          eq(events.startedAt, new Date(startedAt))
        )
      );
    return rows.map((row) => row.id);
  };

  it("returns the stored event when the same create is sent again", async () => {
    const startedAt = "2026-11-21T03:00:00.123Z";
    const first = await logFeed(startedAt);
    await expect(logFeed(startedAt)).resolves.toBe(first);
    await expect(storedAt(startedAt)).resolves.toStrictEqual([first]);
  });

  it("stores one event when two copies of a create race", async () => {
    const startedAt = "2026-11-21T05:00:00.456Z";
    const [a, b] = await Promise.all([logFeed(startedAt), logFeed(startedAt)]);
    expect(a).toBe(b);
    await expect(storedAt(startedAt)).resolves.toStrictEqual([a]);
  });

  it("still stores a different log that starts at the same moment", async () => {
    const startedAt = "2026-11-21T09:00:00.789Z";
    const left = await logFeed(startedAt, "left");
    const right = await logFeed(startedAt, "right");
    expect(right).not.toBe(left);
    await expect(storedAt(startedAt)).resolves.toHaveLength(2);
  });

  it("treats deleting an event that is already gone as done", async () => {
    const id = await logFeed("2026-11-21T07:00:00.000Z");
    await run(DELETE_EVENT, { id });
    await expect(run(DELETE_EVENT, { id })).resolves.toStrictEqual({
      deleteEvent: true,
    });
  });
});
