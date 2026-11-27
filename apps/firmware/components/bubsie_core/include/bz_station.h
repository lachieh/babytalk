// The station's model: the current baby, its events (loaded + unsent changes), and the actions the
// web's station tiles offer (components/station-tile.tsx, lib/baby-context.tsx): one-tap or picked
// logging, stopping and discarding timers, the amount after a feed or pump, and undo.
// No I/O: the caller persists bz_ob_serialize(&st->ob) whenever `revision` moves, and sends.
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "bz_outbox.h"
#include "bz_rules.h"

#define BZ_VIEW_MAX 120
#define BZ_UNDO_MS 5000
#define BZ_DISMISSED_MAX 8

/** BZ_ERR_TOO_LONG: the metadata would not fit in BZ_META_LEN, so the change is not made. */
typedef enum { BZ_ST_OK, BZ_ERR_NO_CLOCK, BZ_ERR_FULL, BZ_ERR_NO_BABY, BZ_ERR_NOT_FOUND, BZ_ERR_TOO_LONG } bz_err_t;

typedef struct {
    bool shown;
    bz_event_t event;
    bz_toast_t phase;
    bool can_undo;
    bz_ms_t expires;
} bz_toast_state_t;

typedef struct {
    bz_outbox_t ob;
    char baby_id[BZ_ID_LEN];
    bz_event_t view[BZ_VIEW_MAX]; /* derived, newest first */
    size_t view_count;
    bz_toast_state_t toast;
    char pending_discard[BZ_ID_LEN];
    char dismissed[BZ_DISMISSED_MAX][BZ_ID_LEN]; /* amount prompts skipped */
    size_t dismissed_count;
    uint32_t revision; /* moves on every change to the outbox */
} bz_station_t;

void bz_st_init(bz_station_t *st);
void bz_st_set_baby(bz_station_t *st, const char *baby_id);
void bz_st_loaded(bz_station_t *st, const bz_event_t *events, size_t count, bz_ms_t requested_at);
/** Recompute `view` from the outbox. Every action below does this itself. */
void bz_st_refresh(bz_station_t *st);

/**
 * Log `type` with `meta`. A timer type starts running (`minutes_ago` back) unless `finished`;
 * everything else is logged at that moment. `amount_ml` > 0 is recorded with it.
 * Refuses with BZ_ERR_NO_CLOCK until the clock is set: a time from an unset clock would be wrong.
 */
bz_err_t bz_st_log(bz_station_t *st, bz_type_t type, const char *meta, int minutes_ago, bool finished, int amount_ml,
                   bz_ms_t now, const char *new_id);
bz_err_t bz_st_stop(bz_station_t *st, const char *id, bz_ms_t now);
/** `amount_ml` <= 0 skips the amount. Either way the prompt goes away. */
bz_err_t bz_st_complete_amount(bz_station_t *st, const char *id, int amount_ml, bz_ms_t now);
bz_err_t bz_st_discard(bz_station_t *st, const char *id, bz_ms_t now);
void bz_st_undo(bz_station_t *st);
/** Let time pass: the undo window closes and a discard becomes final. True if anything changed. */
bool bz_st_tick(bz_station_t *st, bz_ms_t now);

const bz_event_t *bz_st_active(const bz_station_t *st, bz_type_t type);
const bz_event_t *bz_st_awaiting_amount(const bz_station_t *st, bz_type_t type, bz_ms_t now);
