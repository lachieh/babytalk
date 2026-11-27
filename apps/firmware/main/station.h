#pragma once

#include <stdbool.h>

#include "bz_gql.h"
#include "bz_station.h"

#define STATION_BABIES_MAX 8

extern bz_station_t *station;

void station_init(void);
void station_start(void);
void station_stop(void);
void station_forget(void);
int station_sign_out(void);

void station_lock(void);
void station_unlock(void);
bz_ms_t station_now(void);

bz_err_t station_log(bz_type_t type, const char *meta, int minutes_ago, bool finished, int amount_ml);
bz_err_t station_stop_timer(const char *id);
bz_err_t station_discard(const char *id);
bz_err_t station_amount(const char *id, int amount_ml);
void station_undo(void);
bool station_tick(void);
void station_retry(void);

int station_babies(bz_baby_t *out, int max);
void station_choose_baby(const char *baby_id);
const char *station_baby_name(void);
bool station_offline(void);
