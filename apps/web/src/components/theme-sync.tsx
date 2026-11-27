"use client";

import { useEffect } from "react";

import { applyTheme } from "@/lib/theme";

/** Keeps the theme chosen before first paint current as the hour passes and
 * when the phone switches between light and dark. */
export const ThemeSync = () => {
  useEffect(() => {
    const apply = () => applyTheme();
    apply();
    const interval = setInterval(apply, 60_000);
    const phoneScheme = matchMedia("(prefers-color-scheme: dark)");
    phoneScheme.addEventListener("change", apply);
    return () => {
      clearInterval(interval);
      phoneScheme.removeEventListener("change", apply);
    };
  }, []);

  return null;
};
