/** Run `attempt` until it resolves `true`: now, whenever the browser comes
 * back online or the page becomes visible, and every `everyMs` meanwhile.
 * Never two attempts at once. Returns a function that stops it. */
export const retryUntil = (
  attempt: () => Promise<boolean>,
  everyMs: number
): (() => void) => {
  let finished = false;
  let running = false;
  let cleanUp: (() => void) | null = null;
  const stop = () => {
    finished = true;
    cleanUp?.();
  };

  const tryOnce = async () => {
    if (finished || running) return;
    running = true;
    try {
      if (await attempt()) stop();
    } catch {
      /* the next trigger tries again */
    } finally {
      running = false;
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") void tryOnce();
  };
  const timer = setInterval(() => void tryOnce(), everyMs);
  window.addEventListener("online", tryOnce);
  document.addEventListener("visibilitychange", onVisible);

  cleanUp = () => {
    clearInterval(timer);
    window.removeEventListener("online", tryOnce);
    document.removeEventListener("visibilitychange", onVisible);
  };

  void tryOnce();
  return stop;
};
