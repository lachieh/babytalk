"use client";

// One-off migration for the BabyTalk → Bubsie rename: move saved sessions and
// preferences to the new key names so nobody gets signed out. Runs at module
// load, before any page effect reads localStorage. Safe to delete once
// existing installs have upgraded.
const LEGACY_PREFIX = "babytalk_";

if (typeof window !== "undefined") {
  try {
    const legacyKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith(LEGACY_PREFIX)
    );
    for (const key of legacyKeys) {
      const next = `bubsie_${key.slice(LEGACY_PREFIX.length)}`;
      const value = localStorage.getItem(key);
      if (value !== null && localStorage.getItem(next) === null) {
        localStorage.setItem(next, value);
      }
      localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable (private mode, quota); nothing to migrate.
  }
}

export const LegacyStorageMigration = () => null;
