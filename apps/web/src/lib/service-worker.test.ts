import type { Network, Sent } from "./testing/sw-harness";
import {
  API,
  createWorker,
  json,
  offline,
  token,
  workerSource,
} from "./testing/sw-harness";

/* The current worker (public/sw.js) in an in-memory harness. */

const legacyItem = (
  id: string,
  {
    query = "mutation LogEvent { logEvent { id } }",
    variables = {},
    user = "parent-a",
  } = {}
) => ({
  authorization: token(user, "queued"),
  body: { query, variables },
  id,
  retries: 0,
  timestamp: Date.now(),
});

const stored: Network = () => json({ data: { logEvent: { id: "x" } } });

const setUp = (network: Network = stored) => {
  const worker = createWorker({ source: workerSource("current") });
  worker.setNetwork(network);
  return worker;
};

const openPage = (worker: ReturnType<typeof setUp>, user = "parent-a") =>
  worker.message({
    authorization: token(user, "fresh"),
    type: "SET_API_URL",
    url: API,
  });

const sentIds = (sent: Sent[]) => sent.map((s) => s.body.query);

describe("service worker", () => {
  it("leaves the page's requests to the network", async () => {
    const worker = setUp(offline);
    const request = worker.pageFetch(API, {
      body: JSON.stringify({
        query: "mutation LogEvent { logEvent { id } }",
        variables: { clientMutationId: "r1" },
      }),
      method: "POST",
    });
    await expect(request).rejects.toThrow("offline");
    expect(worker.storage.stores.size).toBe(0);
  });

  it("replays the previous worker's queue once, with the person's fresh session", async () => {
    const worker = setUp();
    worker.storage.seed("bubsie-queue", "/queue", [legacyItem("a")]);
    worker.storage.seed("babytalk-queue", "/queue", [legacyItem("b")]);
    await openPage(worker);
    expect(worker.sent.map((s) => s.authorization)).toStrictEqual([
      token("parent-a", "fresh"),
      token("parent-a", "fresh"),
    ]);
    expect(worker.storage.stores.has("bubsie-queue")).toBeFalsy();
    expect(worker.storage.stores.has("babytalk-queue")).toBeFalsy();

    await openPage(worker);
    expect(worker.sent).toHaveLength(2);
  });

  it("drops requests a page keeps and resends itself, and queued queries", async () => {
    const worker = setUp();
    worker.storage.seed("bubsie-queue", "/queue", [
      legacyItem("page-owned", { variables: { clientMutationId: "r1" } }),
      legacyItem("query", { query: "query { myBabies { id } }" }),
    ]);
    await openPage(worker);
    expect(worker.sent).toStrictEqual([]);
    expect(worker.storage.stores.has("bubsie-queue")).toBeFalsy();
  });

  it("keeps the queue while offline or signed out, and replays it later", async () => {
    const worker = setUp(offline);
    worker.storage.seed("bubsie-queue", "/queue", [
      legacyItem("a"),
      legacyItem("b"),
    ]);
    await openPage(worker);
    expect(worker.storage.read("bubsie-queue")).toHaveLength(2);

    worker.setNetwork(() =>
      json({ data: null, errors: [{ message: "Not authenticated" }] })
    );
    await openPage(worker);
    expect(worker.storage.read("bubsie-queue")).toHaveLength(2);

    worker.setNetwork(stored);
    await openPage(worker);
    expect(worker.storage.stores.has("bubsie-queue")).toBeFalsy();
  });

  it("never sends a request with another person's session", async () => {
    const worker = setUp();
    worker.storage.seed("bubsie-queue", "/queue", [legacyItem("a")]);
    await openPage(worker, "parent-b");
    expect(worker.sent.map((s) => s.authorization)).toStrictEqual([
      token("parent-a", "queued"),
    ]);
  });

  it("sends each queued request once when two pages open together", async () => {
    const worker = setUp();
    worker.storage.seed("bubsie-queue", "/queue", [legacyItem("a")]);
    await Promise.all([openPage(worker), openPage(worker)]);
    expect(sentIds(worker.sent)).toHaveLength(1);
  });
});
