// Runs once when the Next.js server boots. Loading the config here means a
// missing or invalid setting (e.g. BUBSIE_WEB_API_URL) stops startup with a
// clear error instead of surfacing later in the browser.
export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
};
