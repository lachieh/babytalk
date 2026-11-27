// Station logging rules, ported from the web: variants and their inferred default
// (components/log-sheet.tsx), one-tap behaviour and amount prompts (lib/daily-totals.ts,
// lib/event-time.ts), amount chips (lib/use-volume-unit.ts) and the words the web uses for timers,
// toasts and the last event (lib/format-event.ts, lib/toast-copy.ts).
// `events` are always newest first, as bz_ob_derive returns them.
#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "bz_event.h"

typedef struct {
    const char *key;
    const char *label;
    const char *meta; /* JSON */
} bz_variant_t;

const bz_variant_t *bz_variants(bz_type_t type, size_t *count);
/** The variant a tap logs, from what was logged lately. */
const bz_variant_t *bz_infer_default(bz_type_t type, const bz_event_t *events, size_t count);

/** Feeds (except solids), sleep and pumping run as timers; the rest are logged at once. */
bool bz_starts_timer(bz_type_t type, const char *meta);
/** Bottle and formula feeds, and pumping, ask how much once finished. */
bool bz_takes_amount(const bz_event_t *event);
bool bz_meta_takes_amount(bz_type_t type, const char *meta);

/** The running timer of `type`, if any. */
const bz_event_t *bz_active(const bz_event_t *events, size_t count, bz_type_t type);
/** A finished feed or pump within 15 minutes that still has no amount and was not dismissed. */
const bz_event_t *bz_awaiting_amount(const bz_event_t *events, size_t count, bz_type_t type, bz_ms_t now,
                                     const char (*dismissed)[BZ_ID_LEN], size_t dismissed_count);
/** The amount of the latest feed (or pump) that recorded one, 0 if none. */
int bz_last_amount_ml(const bz_event_t *events, size_t count, bz_type_t type);

/** Three quick amounts around the last one, in the display unit. */
void bz_amount_chips(int last_ml, bool oz, double out[3]);
int bz_display_to_ml(double value, bool oz);
/** "120 ml", "4 oz", "3.5 oz". */
void bz_format_volume(int ml, bool oz, char *out, size_t len);

/** "Feed · Left breast", "Sleep · Crib", "Pump · Both sides". */
void bz_timer_label(const bz_event_t *event, char *out, size_t len);

typedef enum { BZ_TOAST_STARTED, BZ_TOAST_SAVED, BZ_TOAST_DISCARDED } bz_toast_t;
/** "Feed started · Left", "Sleep saved · 1 h 5 min · Crib", "Pump timer discarded · Both". */
void bz_toast_copy(const bz_event_t *event, bz_toast_t phase, bool oz, char *out, size_t len);

/** The line under a tile: "2h 5m ago · Left breast", "asleep now", "awake 45m". "" if never. */
void bz_last_line(const bz_event_t *events, size_t count, bz_type_t type, bz_ms_t now, bool oz, char *out, size_t len);
