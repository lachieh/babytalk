"use client";

import { useEffect } from "react";

const LIGHT_COLOR = "#ede8df";
const DARK_COLOR = "#262420";

function setThemeColor(color: string): void {
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])'
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = color;
}

/**
 * Keeps the browser/OS chrome (Android Chrome toolbar, theme-color consumers)
 * in sync with the time-based .dark class on <html>. iOS PWA status bar
 * relies on `apple-mobile-web-app-status-bar-style` set in layout metadata.
 */
export const ThemeColorSync = () => {
  useEffect(() => {
    const apply = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setThemeColor(isDark ? DARK_COLOR : LIGHT_COLOR);
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
};
