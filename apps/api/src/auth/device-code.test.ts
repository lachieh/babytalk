/// <reference types="vitest/globals" />

import { randomInt, randomUUID } from "node:crypto";

import { db, deviceCodes, refreshSessions, users } from "@bubsie/db";
import { eq, inArray } from "drizzle-orm";

/* Runs the real resolvers against Postgres. Needs DATABASE_URL pointing at a
 * migrated database (CI's test job provides one). */

const databaseUrl = process.env.DATABASE_URL;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const freshCode = () =>
  Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    ""
  );

interface GraphQLResult<T> {
  data?: T;
  errors?: { extensions?: { code?: string }; message: string }[];
}

describe.skipIf(!databaseUrl)("device codes", () => {
  let gql: <T>(
    query: string,
    variables: Record<string, unknown>,
    user?: string
  ) => Promise<GraphQLResult<T>>;
  const codes: string[] = [];
  let userId: string;

  const request = async (code?: string) => {
    const result = await gql<{ requestDeviceCode: { code: string } }>(
      `mutation ($code: String) { requestDeviceCode(code: $code) { code } }`,
      { code }
    );
    if (result.data?.requestDeviceCode) {
      codes.push(result.data.requestDeviceCode.code);
    }
    return result;
  };

  const pending = async () => {
    const code = freshCode();
    await request(code);
    return code;
  };

  const redirectRaw = (code: string, webUrl: string) =>
    gql<{ redirectDeviceCode: boolean }>(
      `mutation ($code: String!, $webUrl: String!) {
        redirectDeviceCode(code: $code, webUrl: $webUrl)
      }`,
      { code, webUrl }
    );

  const redirect = async (code: string, webUrl: string) => {
    const result = await redirectRaw(code, webUrl);
    expect(result.errors).toBeUndefined();
    return result.data?.redirectDeviceCode;
  };

  const approve = async (code: string) => {
    const result = await gql<{ approveDeviceCode: boolean }>(
      `mutation ($code: String!) { approveDeviceCode(code: $code) }`,
      { code },
      userId
    );
    expect(result.errors).toBeUndefined();
    return result.data?.approveDeviceCode;
  };

  const poll = async (code: string) => {
    const result = await gql<{
      pollDeviceCode: {
        refreshToken: string | null;
        status: string;
        token: string | null;
        webUrl: string | null;
      };
    }>(
      `mutation ($code: String!) {
        pollDeviceCode(code: $code) { status token refreshToken webUrl }
      }`,
      { code }
    );
    expect(result.errors).toBeUndefined();
    return result.data?.pollDeviceCode;
  };

  const confirm = async (code: string) => {
    const result = await gql<{ confirmDeviceCodeRedirect: boolean }>(
      `mutation ($code: String!) { confirmDeviceCodeRedirect(code: $code) }`,
      { code }
    );
    expect(result.errors).toBeUndefined();
    return result.data?.confirmDeviceCodeRedirect;
  };

  const redirectQuery = async (code: string) => {
    const result = await gql<{
      deviceCodeRedirect: { confirmed: boolean; webUrl: string } | null;
    }>(
      `query ($code: String!) {
        deviceCodeRedirect(code: $code) { webUrl confirmed }
      }`,
      { code }
    );
    expect(result.errors).toBeUndefined();
    return result.data?.deviceCodeRedirect;
  };

  const expire = (code: string) =>
    db
      .update(deviceCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(deviceCodes.code, code));

  beforeAll(async () => {
    process.env.SKIP_MIGRATIONS = "1";
    process.env.BUBSIE_API_DATABASE_URL ??= databaseUrl;
    process.env.BUBSIE_API_JWT_SECRET ??= "test-secret-test-secret";
    process.env.BUBSIE_API_WEB_URL ??= "http://localhost:3000";
    process.env.BUBSIE_API_SMTP_HOST ??= "localhost";
    process.env.BUBSIE_API_SMTP_FROM ??= "test@bubsie.test";
    const { createApiYoga } = await import("../yoga");
    const yoga = createApiYoga(({ request: req }) => {
      const sub = req.headers.get("x-user");
      return Promise.resolve({
        currentUser: sub ? { email: "", sub } : null,
        db,
      });
    });
    gql = async (query, variables, user) => {
      const res = await yoga.fetch("http://test/graphql", {
        body: JSON.stringify({ query, variables }),
        headers: {
          "Content-Type": "application/json",
          ...(user ? { "x-user": user } : {}),
        },
        method: "POST",
      });
      return res.json();
    };

    const [user] = await db
      .insert(users)
      .values({ email: `device-${randomUUID().slice(0, 8)}@bubsie.test` })
      .returning();
    userId = user.id;
  });

  afterAll(async () => {
    if (codes.length > 0) {
      await db.delete(deviceCodes).where(inArray(deviceCodes.code, codes));
    }
    await db.delete(refreshSessions).where(eq(refreshSessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  describe("requestDeviceCode", () => {
    it("generates a code when none is given", async () => {
      const result = await request();

      expect(result.data?.requestDeviceCode.code).toMatch(
        /^[A-HJ-NP-Z2-9]{8}$/
      );
    });

    it("registers the code a device brings, normalised", async () => {
      const code = freshCode();
      const result = await request(
        `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`
      );

      expect(result.data?.requestDeviceCode.code).toBe(code);
      const polled = await poll(code);
      expect(polled?.status).toBe("pending");
    });

    it.each(["ABC", "ABCDEFGHJ", "ABCDEFG1", "ABCDEFGO", "ABCD!FGH"])(
      "rejects the malformed code %s",
      async (code) => {
        const result = await request(code);

        expect(result.data?.requestDeviceCode).toBeNull();
        expect(result.errors?.[0]?.extensions?.code).toBe("REFUSED");
      }
    );

    it("rejects a code that already exists with CODE_TAKEN", async () => {
      const code = await pending();
      const result = await request(code);

      expect(result.data?.requestDeviceCode).toBeNull();
      expect(result.errors?.[0]?.extensions?.code).toBe("CODE_TAKEN");
    });
  });

  describe("redirectDeviceCode", () => {
    it("redirects a pending code to the given origin", async () => {
      const code = await pending();

      await expect(
        redirect(code, "https://bubsie.example.com:8443/some/path?x=1")
      ).resolves.toBeTruthy();
      await expect(redirectQuery(code)).resolves.toStrictEqual({
        confirmed: false,
        webUrl: "https://bubsie.example.com:8443",
      });
    });

    it("accepts http", async () => {
      const code = await pending();

      await expect(
        redirect(code, "http://192.168.1.20:3000")
      ).resolves.toBeTruthy();
    });

    it.each([
      "ftp://bubsie.example.com",
      "mailto:parent@bubsie.test",
      "not a url",
    ])("rejects the address %s", async (webUrl) => {
      const code = await pending();
      const result = await redirectRaw(code, webUrl);

      expect(result.errors?.[0]?.extensions?.code).toBe("REFUSED");
      await expect(redirectQuery(code)).resolves.toBeNull();
    });

    it("refuses an approved code", async () => {
      const code = await pending();
      await approve(code);

      await expect(
        redirect(code, "https://bubsie.example.com")
      ).resolves.toBeFalsy();
    });

    it("refuses a consumed code", async () => {
      const code = await pending();
      await approve(code);
      await poll(code);

      await expect(
        redirect(code, "https://bubsie.example.com")
      ).resolves.toBeFalsy();
    });

    it("refuses an expired code", async () => {
      const code = await pending();
      await expire(code);

      await expect(
        redirect(code, "https://bubsie.example.com")
      ).resolves.toBeFalsy();
    });

    it("refuses a code that is already redirected", async () => {
      const code = await pending();
      await redirect(code, "https://first.example.com");

      await expect(
        redirect(code, "https://second.example.com")
      ).resolves.toBeFalsy();
      const kept = await redirectQuery(code);
      expect(kept?.webUrl).toBe("https://first.example.com");
    });

    it("refuses an unknown code", async () => {
      await expect(
        redirect(freshCode(), "https://bubsie.example.com")
      ).resolves.toBeFalsy();
    });
  });

  describe("a redirected code", () => {
    it("polls as redirected, without tokens, until it expires", async () => {
      const code = await pending();
      await redirect(code, "https://bubsie.example.com");

      await expect(poll(code)).resolves.toStrictEqual({
        refreshToken: null,
        status: "redirected",
        token: null,
        webUrl: "https://bubsie.example.com",
      });

      await expire(code);

      const expired = await poll(code);
      expect(expired?.status).toBe("expired");
    });

    it("cannot be approved, and never yields tokens", async () => {
      const code = await pending();
      await redirect(code, "https://bubsie.example.com");

      await expect(approve(code)).resolves.toBeFalsy();
      const polled = await poll(code);
      expect(polled?.status).toBe("redirected");
      expect(polled?.token).toBeNull();
      expect(polled?.refreshToken).toBeNull();
    });

    it("is confirmed once the device has registered elsewhere", async () => {
      const code = await pending();
      await redirect(code, "https://bubsie.example.com");

      await expect(confirm(code)).resolves.toBeTruthy();
      await expect(redirectQuery(code)).resolves.toStrictEqual({
        confirmed: true,
        webUrl: "https://bubsie.example.com",
      });
    });

    it("cannot be confirmed after it expires", async () => {
      const code = await pending();
      await redirect(code, "https://bubsie.example.com");
      await expire(code);

      await expect(confirm(code)).resolves.toBeFalsy();
      await expect(redirectQuery(code)).resolves.toBeNull();
    });
  });

  it("confirms only redirected codes", async () => {
    const code = await pending();

    await expect(confirm(code)).resolves.toBeFalsy();
    await expect(redirectQuery(code)).resolves.toBeNull();
  });

  it("still issues tokens for an approved code", async () => {
    const code = await pending();

    await expect(approve(code)).resolves.toBeTruthy();
    const polled = await poll(code);
    expect(polled?.status).toBe("approved");
    expect(polled?.token).toStrictEqual(expect.any(String));
    expect(polled?.webUrl).toBeNull();
  });
});
