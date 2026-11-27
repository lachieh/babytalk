#include "bz_station.h"

#include <stdio.h>
#include <string.h>

#include "bz_time.h"

void bz_st_init(bz_station_t *st)
{
    memset(st, 0, sizeof *st);
    bz_ob_init(&st->ob);
}

void bz_st_refresh(bz_station_t *st)
{
    st->view_count = bz_ob_derive(&st->ob, st->baby_id, st->view, BZ_VIEW_MAX);
}

static void changed(bz_station_t *st)
{
    st->revision++;
    bz_st_refresh(st);
}

static void commit_discard(bz_station_t *st)
{
    if (!st->pending_discard[0]) return;
    bz_ob_delete(&st->ob, st->pending_discard);
    st->pending_discard[0] = '\0';
    st->revision++;
}

void bz_st_set_baby(bz_station_t *st, const char *baby_id)
{
    commit_discard(st);
    st->toast.shown = false;
    snprintf(st->baby_id, sizeof st->baby_id, "%s", baby_id ? baby_id : "");
    bz_ob_set_baby(&st->ob, st->baby_id);
    bz_st_refresh(st);
}

void bz_st_loaded(bz_station_t *st, const bz_event_t *events, size_t count, bz_ms_t requested_at)
{
    bz_ob_loaded(&st->ob, events, count, requested_at);
    bz_st_refresh(st);
}

static void show_toast(bz_station_t *st, const bz_event_t *event, bz_toast_t phase, bool can_undo, bz_ms_t now)
{
    commit_discard(st);
    st->toast = (bz_toast_state_t){
        .shown = true, .event = *event, .phase = phase, .can_undo = can_undo, .expires = now + BZ_UNDO_MS};
}

static const bz_event_t *find(const bz_station_t *st, const char *id)
{
    for (size_t i = 0; i < st->view_count; i++) {
        if (strcmp(st->view[i].id, id) == 0) return &st->view[i];
    }
    return NULL;
}

bz_err_t bz_st_log(bz_station_t *st, bz_type_t type, const char *meta, int minutes_ago, bool finished, int amount_ml,
                   bz_ms_t now, const char *new_id)
{
    if (now < BZ_CLOCK_VALID_AFTER) return BZ_ERR_NO_CLOCK;
    if (!st->baby_id[0]) return BZ_ERR_NO_BABY;
    bz_event_t event = {.type = type};
    snprintf(event.id, sizeof event.id, "%s", new_id);
    snprintf(event.meta, sizeof event.meta, "%s", meta && meta[0] ? meta : "{}");
    if (amount_ml > 0) bz_meta_with_int(event.meta, "amountMl", amount_ml, event.meta, sizeof event.meta);
    bz_ms_t at = now - (bz_ms_t)(minutes_ago > 0 ? minutes_ago : 0) * 60000;
    event.started = at;
    // lib/event-time.ts logTimes: a timer runs from `at`; anything else (or "already finished")
    // starts and ends at `at`.
    event.ended = bz_starts_timer(type, event.meta) && !finished ? BZ_RUNNING : at;
    if (!bz_ob_create(&st->ob, &event, st->baby_id)) return BZ_ERR_FULL;
    show_toast(st, &event, event.ended == BZ_RUNNING ? BZ_TOAST_STARTED : BZ_TOAST_SAVED, true, now);
    changed(st);
    return BZ_ST_OK;
}

bz_err_t bz_st_stop(bz_station_t *st, const char *id, bz_ms_t now)
{
    if (now < BZ_CLOCK_VALID_AFTER) return BZ_ERR_NO_CLOCK;
    const bz_event_t *current = find(st, id);
    if (!current) return BZ_ERR_NOT_FOUND;
    bz_event_t values = *current;
    values.ended = now < values.started ? values.started : now;
    if (!bz_ob_update(&st->ob, id, BZ_CHANGED_ENDED, &values)) return BZ_ERR_FULL;
    // Feeds and pumps that take an amount say "saved" once the amount is in.
    if (!bz_takes_amount(&values)) show_toast(st, &values, BZ_TOAST_SAVED, false, now);
    changed(st);
    return BZ_ST_OK;
}

static void dismiss(bz_station_t *st, const char *id)
{
    if (st->dismissed_count == BZ_DISMISSED_MAX) {
        memmove(st->dismissed[0], st->dismissed[1], (BZ_DISMISSED_MAX - 1) * BZ_ID_LEN);
        st->dismissed_count--;
    }
    snprintf(st->dismissed[st->dismissed_count++], BZ_ID_LEN, "%s", id);
}

bz_err_t bz_st_complete_amount(bz_station_t *st, const char *id, int amount_ml, bz_ms_t now)
{
    const bz_event_t *current = find(st, id);
    if (!current) return BZ_ERR_NOT_FOUND;
    bz_event_t saved = *current;
    if (amount_ml > 0) {
        bz_meta_with_int(current->meta, "amountMl", amount_ml, saved.meta, sizeof saved.meta);
        if (!bz_ob_update(&st->ob, id, BZ_CHANGED_META, &saved)) return BZ_ERR_FULL;
    }
    dismiss(st, id);
    show_toast(st, &saved, BZ_TOAST_SAVED, false, now);
    changed(st);
    return BZ_ST_OK;
}

bz_err_t bz_st_discard(bz_station_t *st, const char *id, bz_ms_t now)
{
    const bz_event_t *current = find(st, id);
    if (!current) return BZ_ERR_NOT_FOUND;
    bz_event_t event = *current;
    show_toast(st, &event, BZ_TOAST_DISCARDED, true, now);
    snprintf(st->pending_discard, sizeof st->pending_discard, "%s", id);
    bz_ob_hide(&st->ob, id);
    changed(st);
    return BZ_ST_OK;
}

void bz_st_undo(bz_station_t *st)
{
    if (!st->toast.shown || !st->toast.can_undo) return;
    if (st->toast.phase == BZ_TOAST_DISCARDED) {
        st->pending_discard[0] = '\0';
        bz_ob_unhide(&st->ob, st->toast.event.id);
    } else {
        bz_ob_delete(&st->ob, st->toast.event.id);
    }
    st->toast.shown = false;
    changed(st);
}

bool bz_st_tick(bz_station_t *st, bz_ms_t now)
{
    if (!st->toast.shown || now < st->toast.expires) return false;
    st->toast.shown = false;
    if (st->pending_discard[0]) {
        commit_discard(st);
        bz_st_refresh(st);
    }
    return true;
}

const bz_event_t *bz_st_active(const bz_station_t *st, bz_type_t type)
{
    return bz_active(st->view, st->view_count, type);
}

const bz_event_t *bz_st_awaiting_amount(const bz_station_t *st, bz_type_t type, bz_ms_t now)
{
    return bz_awaiting_amount(st->view, st->view_count, type, now, (const char(*)[BZ_ID_LEN])st->dismissed,
                              st->dismissed_count);
}
