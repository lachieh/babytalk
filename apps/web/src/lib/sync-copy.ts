export interface SyncCounts {
  online: boolean;
  queued: number;
  failed: number;
  unstored: number;
}

const plural = (count: number) =>
  `${count} ${count === 1 ? "entry" : "entries"}`;

/** The sync pill's message, most urgent first. Entries this device could not
 * store outrank everything: closing the page would lose them, so the person
 * must not be told they will save later. */
export const syncMessage = (
  sync: SyncCounts
): { text: string; canRetry: boolean } | null => {
  if (sync.unstored > 0) {
    return {
      canRetry: false,
      text: `${plural(sync.unstored)} not stored on this device. Keep Bubsie open`,
    };
  }
  if (!sync.online) {
    return { canRetry: false, text: "Offline, will save when you're back" };
  }
  if (sync.failed > 0) {
    return { canRetry: true, text: `Couldn't save ${plural(sync.failed)}` };
  }
  if (sync.queued > 0) {
    return { canRetry: false, text: `Saving ${plural(sync.queued)}` };
  }
  return null;
};
