---
"@bubsie/api": patch
"@bubsie/web": patch
---

Keep unsaved changes across tab switches and reloads, and stop offline replays losing or duplicating entries.

- Pending logs, edits, deletes, and discards are stored durably and resent after a reload.
- The page now owns unsent changes and resends them when the app opens, comes back online, or becomes visible. The service worker no longer queues requests, so nothing is sent while the app is closed.
- `logEvent` accepts an optional client-generated `id` and returns the existing event when that id is sent again, and `deleteEvent` succeeds when the event is already gone.
- Editing or deleting an event from an older week is sent to the server again.
- Growth measurements are stored as a calendar day, so they read the same in every timezone.
- Editing a timed bottle feed keeps its duration, and a solid feed logs instantly from the sheet.
