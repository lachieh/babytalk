// Times as the API carries them (ISO 8601, UTC) and as the web shows them (lib/format-elapsed.ts,
// daily-totals.ts, toast-copy.ts, use-auto-dark-mode.ts). Local time uses the C library's zone
// (TZ, set with bz_tz_apply), so the same code runs on the device and on the host.
#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "bz_event.h"

/** Before this the clock has not been set from the network (SNTP). */
#define BZ_CLOCK_VALID_AFTER 1704067200000LL /* 2024-01-01 */

/** Parse "2026-11-27T10:04:05.123Z" or "...+10:00". Returns -1 if it is not a time. */
bz_ms_t bz_parse_iso(const char *text);
/** "2026-11-27T10:04:05.123Z" (24 characters and a terminator). */
void bz_format_iso(bz_ms_t ms, char out[25]);

/** "4:05" or "1:04:05" (formatElapsed). */
void bz_format_elapsed(bz_ms_t ms, char *out, size_t len);
/** "45m", "2h", "2h 5m", or "—" under a minute (formatSleepDuration). */
void bz_format_minutes(long minutes, char *out, size_t len);
/** "just now" or "2h 5m ago". */
void bz_format_ago(bz_ms_t ms, char *out, size_t len);
/** "Under 1 min", "12 min", "1 h 5 min" (toast-copy formatDuration). */
void bz_format_duration(bz_ms_t ms, char *out, size_t len);
/** Local wall-clock time, "3:07 pm". */
void bz_format_clock(bz_ms_t ms, char *out, size_t len);
int bz_local_hour(bz_ms_t ms);

/** The web's auto dark mode window: dark from `start` o'clock until `end` (20 and 7 by default). */
bool bz_is_dark_hour(int hour, int start, int end);

typedef struct {
    const char *name;  /* IANA, as a browser would report it */
    const char *label; /* what the picker shows */
    const char *posix; /* TZ rule for the C library */
} bz_zone_t;

const bz_zone_t *bz_zones(size_t *count);
const bz_zone_t *bz_zone_find(const char *name);
/** Set the C library's zone to `name` (UTC if unknown). */
void bz_tz_apply(const char *name);
