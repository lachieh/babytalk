#pragma once

#include <stdbool.h>
#include <stdint.h>

#include "bz_outbox.h"
#include "bz_rules.h"

#define BZ_VIEW_MAX 120
#define BZ_UNDO_MS 5000
#define BZ_DISMISSED_MAX 8

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
    bz_event_t view[BZ_VIEW_MAX];
    size_t view_count;
    bz_toast_state_t toast;
    char pending_discard[BZ_ID_LEN];
    char dismissed[BZ_DISMISSED_MAX][BZ_ID_LEN];
    size_t dismissed_count;
    uint32_t revision;
} bz_station_t;

void bz_st_init(bz_station_t *st);
void bz_st_sign_out(bz_station_t *st);
void bz_st_set_baby(bz_station_t *st, const char *baby_id);
void bz_st_loaded(bz_station_t *st, const bz_event_t *events, size_t count, bz_ms_t requested_at);
void bz_st_refresh(bz_station_t *st);

bz_err_t bz_st_log(bz_station_t *st, bz_type_t type, const char *meta, int minutes_ago, bool finished, int amount_ml,
                   bz_ms_t now, const char *new_id);
bz_err_t bz_st_stop(bz_station_t *st, const char *id, bz_ms_t now);
bz_err_t bz_st_complete_amount(bz_station_t *st, const char *id, int amount_ml, bz_ms_t now);
bz_err_t bz_st_discard(bz_station_t *st, const char *id, bz_ms_t now);
void bz_st_undo(bz_station_t *st);
bool bz_st_tick(bz_station_t *st, bz_ms_t now);

const bz_event_t *bz_st_active(const bz_station_t *st, bz_type_t type);
const bz_event_t *bz_st_awaiting_amount(const bz_station_t *st, bz_type_t type, bz_ms_t now);
