/**
 * Decides light or dark for this moment and makes the page and the phone's
 * system bars agree: toggles `.dark` on <html> (the time-of-day schedule or
 * the bubsie_dark_mode override) and sets the one theme-color meta to the
 * surface colour the page actually paints, which is also dark whenever the
 * phone is in dark mode (globals.css `prefers-color-scheme: dark`).
 *
 * Runs before first paint as an inline <head> script via `.toString()`, so it
 * must not reference anything outside its own body.
 */
export function applyTheme(now: Date = new Date()): void {
  const LIGHT_SURFACE = "#f8f1e7";
  const DARK_SURFACE = "#0e0b05";
  const html = document.documentElement;

  let pref: string | null = null;
  let startStr: string | null = null;
  let endStr: string | null = null;
  try {
    pref = localStorage.getItem("bubsie_dark_mode");
    startStr = localStorage.getItem("bubsie_dark_start");
    endStr = localStorage.getItem("bubsie_dark_end");
  } catch {
    // Storage can be unavailable (private mode); fall back to the schedule.
  }

  let scheduledDark: boolean;
  if (pref === "on") scheduledDark = true;
  else if (pref === "off") scheduledDark = false;
  else {
    const start = startStr ? Number.parseInt(startStr, 10) : 20;
    const end = endStr ? Number.parseInt(endStr, 10) : 7;
    const hour = now.getHours();
    scheduledDark =
      start > end ? hour >= start || hour < end : hour >= start && hour < end;
  }
  html.classList.toggle("dark", scheduledDark);

  const paintsDark =
    scheduledDark || matchMedia("(prefers-color-scheme: dark)").matches;
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = paintsDark ? DARK_SURFACE : LIGHT_SURFACE;
}

export const applyThemeScript = `(${applyTheme.toString()})()`;
