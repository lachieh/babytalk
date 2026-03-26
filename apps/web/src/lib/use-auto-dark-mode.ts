"use client";

import { useEffect } from "react";

const DEFAULT_DARK_START = 20;
const DEFAULT_DARK_END = 7;

const isDarkHour = (hour: number, start: number, end: number): boolean => {
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
};

/**
 * Toggles `.dark` class on <html> based on time of day.
 * Checks every minute. Uses localStorage for user overrides.
 */
export const useAutoDarkMode = () => {
  useEffect(() => {
    const apply = () => {
      const pref = localStorage.getItem("babytalk_dark_mode") ?? "auto";
      const html = document.documentElement;

      if (pref === "on") {
        html.classList.add("dark");
        return;
      }
      if (pref === "off") {
        html.classList.remove("dark");
        return;
      }

      const startStr = localStorage.getItem("babytalk_dark_start");
      const endStr = localStorage.getItem("babytalk_dark_end");
      const start = startStr
        ? Number.parseInt(startStr, 10)
        : DEFAULT_DARK_START;
      const end = endStr ? Number.parseInt(endStr, 10) : DEFAULT_DARK_END;
      const hour = new Date().getHours();

      html.classList.toggle("dark", isDarkHour(hour, start, end));
    };

    apply();

    const interval = setInterval(apply, 60_000);
    return () => clearInterval(interval);
  }, []);
};
