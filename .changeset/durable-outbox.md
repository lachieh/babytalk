---
"@bubsie/api": patch
"@bubsie/web": patch
---

Keep unsaved changes across tab switches and reloads, and stop offline replays losing or duplicating entries.

- Pending logs, edits, deletes, and discards are stored durably and resent after a reload.
- The service worker keeps entries when a token has expired, coordinates writes to its queue, and reports results that arrived while no page was open.
- `logEvent` returns the existing event when an identical request is retried, and `deleteEvent` succeeds when the event is already gone.
- Editing or deleting an event from an older week is sent to the server again.
- Growth measurements are stored as a calendar day, so they read the same in every timezone.
- Editing a timed bottle feed keeps its duration, and a solid feed logs instantly from the sheet.
