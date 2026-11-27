// The station at run time: the model (bz_station_t) behind a lock, persisted to the "outbox" NVS
// partition after every change, and a sync task that sends changes in order with backoff and
// reloads events (every 15 s while a timer runs, 60 s otherwise) to pick up other devices' logs.
#pragma once

#include <stdbool.h>

#include "bz_gql.h"
#include "bz_station.h"

#define STATION_BABIES_MAX 8

extern bz_station_t *station;

void station_init(void);
/** Start syncing for the paired session (loads babies, then events). Idempotent. */
void station_start(void);
/** Stop syncing; returns once the sync task has exited. Not from the LVGL task (it waits on the display). */
void station_stop(void);
/** Forget this session's events and unsent changes (unpair, reset). */
void station_forget(void);

void station_lock(void);
void station_unlock(void);
bz_ms_t station_now(void);

/* Actions from the screens (LVGL task). Each persists, wakes the sync task and returns the result. */
bz_err_t station_log(bz_type_t type, const char *meta, int minutes_ago, bool finished, int amount_ml);
bz_err_t station_stop_timer(const char *id);
bz_err_t station_discard(const char *id);
bz_err_t station_amount(const char *id, int amount_ml);
void station_undo(void);
/** Close the undo window when it is due. True if the view changed. */
bool station_tick(void);
void station_retry(void);

int station_babies(bz_baby_t *out, int max);
void station_choose_baby(const char *baby_id);
/** Name of the current baby ("" while loading). */
const char *station_baby_name(void);
/** Whether the last attempt to reach the server failed (shown as a quiet dot). */
bool station_offline(void);
