import { runInNewContext } from "node:vm";

import { applyThemeScript } from "./theme";

interface Page {
  dark: boolean;
  themeColors: string[];
}

/** Runs the inline <head> script the way the browser does: as standalone
 * source, with only the page's globals in reach. */
const loadPage = ({
  hour,
  phoneDark = false,
  storage = {},
}: {
  hour: number;
  phoneDark?: boolean;
  storage?: Record<string, string>;
}): Page => {
  const classes = new Set<string>();
  const metas: { content: string; name: string }[] = [];
  const page = {
    Date: class extends Date {
      constructor() {
        super(2026, 10, 27, hour, 30);
      }
    },
    document: {
      createElement: () => ({ content: "", name: "" }),
      documentElement: {
        classList: {
          toggle: (name: string, on: boolean) =>
            on ? classes.add(name) : classes.delete(name),
        },
      },
      head: { append: (meta: (typeof metas)[number]) => metas.push(meta) },
      querySelector: () =>
        metas.find((meta) => meta.name === "theme-color") ?? null,
    },
    localStorage: { getItem: (key: string) => storage[key] ?? null },
    matchMedia: (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && phoneDark,
    }),
  };

  runInNewContext(applyThemeScript, page);

  return {
    dark: classes.has("dark"),
    themeColors: metas.map((meta) => meta.content),
  };
};

const CREAM = "#f8f1e7";
const NIGHT = "#0e0b05";

describe("system bar colour before first paint", () => {
  it("is cream on a light phone by day", () => {
    expect(loadPage({ hour: 14 })).toStrictEqual({
      dark: false,
      themeColors: [CREAM],
    });
  });

  it("goes dark on the evening schedule", () => {
    expect(loadPage({ hour: 22 })).toStrictEqual({
      dark: true,
      themeColors: [NIGHT],
    });
  });

  it("matches the dark page when the phone is in dark mode by day", () => {
    expect(loadPage({ hour: 14, phoneDark: true })).toStrictEqual({
      dark: false,
      themeColors: [NIGHT],
    });
  });

  it("follows the dark mode override", () => {
    expect(
      loadPage({ hour: 14, storage: { bubsie_dark_mode: "on" } })
    ).toStrictEqual({ dark: true, themeColors: [NIGHT] });
    expect(
      loadPage({ hour: 22, storage: { bubsie_dark_mode: "off" } })
    ).toStrictEqual({ dark: false, themeColors: [CREAM] });
  });

  it("follows a custom schedule", () => {
    const storage = { bubsie_dark_end: "9", bubsie_dark_start: "18" };
    expect(loadPage({ hour: 8, storage }).dark).toBeTruthy();
    expect(loadPage({ hour: 12, storage }).dark).toBeFalsy();
  });
});
