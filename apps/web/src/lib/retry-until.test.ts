import { retryUntil } from "./retry-until";

const page = () => {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  return { doc, win };
};

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe("retrying until it works", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tries again when the browser comes back online, then stops", async () => {
    const { win } = page();
    const outcomes = [false, true];
    const attempt = vi.fn(() => Promise.resolve(outcomes.shift() ?? true));
    retryUntil(attempt, 60_000);
    await flush();
    expect(attempt.mock.calls).toHaveLength(1);

    win.dispatchEvent(new Event("online"));
    await flush();
    expect(attempt).toHaveBeenCalledTimes(2);

    win.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("tries again when the page becomes visible", async () => {
    const { doc } = page();
    const attempt = vi.fn(() => Promise.resolve(false));
    retryUntil(attempt, 60_000);
    await flush();
    doc.dispatchEvent(new Event("visibilitychange"));
    await flush();
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("keeps trying on its own while nothing else happens", async () => {
    page();
    const attempt = vi.fn(() => Promise.resolve(false));
    retryUntil(attempt, 15_000);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(attempt).toHaveBeenCalledTimes(4);
  });

  it("never runs two attempts at once", async () => {
    const { win } = page();
    const slow = Promise.withResolvers<boolean>();
    const attempt = vi.fn(() => slow.promise);
    retryUntil(attempt, 60_000);
    win.dispatchEvent(new Event("online"));
    await flush();
    expect(attempt.mock.calls).toHaveLength(1);
  });

  it("stops when asked", async () => {
    const { win } = page();
    const attempt = vi.fn(() => Promise.resolve(false));
    const stop = retryUntil(attempt, 15_000);
    await flush();
    stop();
    win.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempt.mock.calls).toHaveLength(1);
  });
});
