#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bz_station.h"
#include "bz_time.h"
#include "bz_uuid.h"
#include "check.h"

static bz_station_t st;
static const bz_ms_t NOW = 1795773845000LL;

TEST(test_station_log_timer_stop_amount)
{
    bz_st_init(&st);
    bz_st_set_baby(&st, "b1");
    // No clock yet: a timer would start at 1970.
    CHECK_INT(bz_st_log(&st, BZ_SLEEP, "{\"location\":\"crib\"}", 0, false, 0, 5000, "id-0"), BZ_ERR_NO_CLOCK);

    CHECK_INT(bz_st_log(&st, BZ_FEED, "{\"method\":\"bottle\"}", 10, false, 0, NOW, "f1"), BZ_ST_OK);
    const bz_event_t *active = bz_st_active(&st, BZ_FEED);
    CHECK(active != NULL);
    CHECK_INT(active->started, NOW - 10 * 60000);
    CHECK(st.toast.shown && st.toast.phase == BZ_TOAST_STARTED && st.toast.can_undo);
    uint32_t revision = st.revision;

    CHECK_INT(bz_st_stop(&st, "f1", NOW + 60000), BZ_ST_OK);
    CHECK(st.revision > revision);
    CHECK(bz_st_active(&st, BZ_FEED) == NULL);
    // A bottle asks how much; the toast waits for the amount.
    const bz_event_t *waiting = bz_st_awaiting_amount(&st, BZ_FEED, NOW + 2 * 60000);
    CHECK(waiting && strcmp(waiting->id, "f1") == 0);
    CHECK_INT(bz_st_complete_amount(&st, "f1", 120, NOW + 2 * 60000), BZ_ST_OK);
    CHECK(bz_st_awaiting_amount(&st, BZ_FEED, NOW + 2 * 60000) == NULL);
    CHECK_INT(bz_meta_int(st.view[0].meta, "amountMl"), 120);
    CHECK(st.toast.phase == BZ_TOAST_SAVED && !st.toast.can_undo);
}

TEST(test_station_undo_and_discard)
{
    bz_st_init(&st);
    bz_st_set_baby(&st, "b1");
    bz_st_log(&st, BZ_DIAPER, "{\"wet\":true,\"soiled\":false}", 0, false, 0, NOW, "d1");
    CHECK_INT(st.view_count, 1);
    CHECK_INT(st.view[0].ended, NOW); // a change is an instant
    bz_st_undo(&st);
    CHECK_INT(st.view_count, 0);
    CHECK_INT(st.ob.outbox_count, 0); // never sent, so nothing to tell the server

    bz_st_log(&st, BZ_PUMP, "{\"side\":\"both\"}", 0, false, 0, NOW, "p1");
    CHECK_INT(bz_st_discard(&st, "p1", NOW + 1000), BZ_ST_OK);
    CHECK_INT(st.view_count, 0);
    bz_st_undo(&st); // the discard is undone
    CHECK_INT(st.view_count, 1);
    bz_st_discard(&st, "p1", NOW + 2000);
    CHECK(!bz_st_tick(&st, NOW + 3000));
    CHECK(bz_st_tick(&st, NOW + 2000 + BZ_UNDO_MS)); // the window closes: the discard is final
    CHECK_INT(st.view_count, 0);
    CHECK_INT(st.ob.hidden_count, 0);

    // "Already finished" logs a timer type as done, with its amount.
    bz_st_log(&st, BZ_FEED, "{\"method\":\"formula\"}", 15, true, 90, NOW, "f2");
    CHECK_INT(st.view[0].ended, NOW - 15 * 60000);
    CHECK_INT(bz_meta_int(st.view[0].meta, "amountMl"), 90);
}

TEST(test_uuid)
{
    uint8_t bytes[16];
    for (int i = 0; i < 16; i++) bytes[i] = (uint8_t)(0xf0 + i);
    char id[37];
    bz_uuid_format(bytes, id);
    CHECK_STR(id, "f0f1f2f3-f4f5-46f7-b8f9-fafbfcfdfeff");
}

/* A loaded running pump `p1` and `count` diaper changes waiting to send. */
static void loaded_timer_and_changes(int count)
{
    bz_st_init(&st);
    bz_st_set_baby(&st, "b1");
    bz_event_t timer = {.id = "p1", .type = BZ_PUMP, .started = NOW - 60000, .ended = BZ_RUNNING};
    strcpy(timer.meta, "{\"side\":\"both\"}");
    bz_st_loaded(&st, &timer, 1, NOW);
    char id[BZ_ID_LEN];
    for (int i = 0; i < count; i++) {
        snprintf(id, sizeof id, "d%d", i);
        CHECK_INT(bz_st_log(&st, BZ_DIAPER, "{\"wet\":true}", 0, false, 0, NOW, id), BZ_ST_OK);
    }
    bz_st_tick(&st, NOW + BZ_UNDO_MS);
}

TEST(test_station_discard_when_full)
{
    // No room to record the delete: refused, the timer still shows, nothing pretends otherwise.
    loaded_timer_and_changes(BZ_OUTBOX_MAX);
    CHECK_INT(bz_st_discard(&st, "p1", NOW + BZ_UNDO_MS), BZ_ERR_FULL);
    CHECK(bz_st_active(&st, BZ_PUMP) != NULL);
    CHECK(!(st.toast.shown && st.toast.phase == BZ_TOAST_DISCARDED));

    // The last slot is the discard's: a change made in its undo window cannot take it.
    loaded_timer_and_changes(BZ_OUTBOX_MAX - 1);
    CHECK_INT(bz_st_discard(&st, "p1", NOW + BZ_UNDO_MS), BZ_ST_OK);
    CHECK(bz_st_active(&st, BZ_PUMP) == NULL);
    CHECK_INT(bz_st_log(&st, BZ_DIAPER, "{\"wet\":true}", 0, false, 0, NOW + BZ_UNDO_MS + 1000, "late"), BZ_ERR_FULL);
    bz_st_tick(&st, NOW + 3 * BZ_UNDO_MS);
    CHECK(bz_st_active(&st, BZ_PUMP) == NULL);
    CHECK_INT(st.ob.outbox_count, BZ_OUTBOX_MAX);
    CHECK_INT(st.ob.outbox[BZ_OUTBOX_MAX - 1].op, BZ_OP_DELETE);
}

/* A finished pump loaded from the server with `notes` notes, a minute ago. */
static void loaded_pump(size_t notes)
{
    bz_st_init(&st);
    bz_st_set_baby(&st, "b1");
    char json[1200], text[1000];
    memset(text, 'n', notes);
    text[notes] = '\0';
    snprintf(json, sizeof json,
             "{\"data\":{\"recentEvents\":[{\"id\":\"p1\",\"type\":\"pump\",\"startedAt\":\"2026-11-27T10:00:00.000Z\","
             "\"endedAt\":\"2026-11-27T10:20:00.000Z\",\"metadata\":{\"side\":\"left\",\"notes\":\"%s\"}}]}}",
             text);
    static bz_event_t events[1];
    CHECK_INT(bz_parse_events(json, "recentEvents", events, 1), 1);
    bz_st_loaded(&st, events, 1, NOW);
}

TEST(test_station_metadata_too_long)
{
    bz_ms_t ended = bz_parse_iso("2026-11-27T10:20:00.000Z");
    // Metadata that does not fit is not kept half-cut, and is never edited from here.
    loaded_pump(600);
    CHECK(st.view[0].meta_lost);
    CHECK_STR(st.view[0].meta, "{}");
    CHECK(bz_st_awaiting_amount(&st, BZ_PUMP, ended + 60000) == NULL);
    CHECK_INT(bz_st_complete_amount(&st, "p1", 80, ended + 60000), BZ_ERR_TOO_LONG);
    CHECK_INT(st.ob.outbox_count, 0);

    // Metadata that fits, but not with an amount added: refused rather than sent cut.
    loaded_pump(BZ_META_LEN - 40);
    CHECK(!st.view[0].meta_lost);
    CHECK(bz_st_awaiting_amount(&st, BZ_PUMP, ended + 60000) != NULL);
    CHECK_INT(bz_st_complete_amount(&st, "p1", 80, ended + 60000), BZ_ERR_TOO_LONG);
    CHECK_INT(st.ob.outbox_count, 0);

    // A change to a cut event keeps the mark across a restart.
    loaded_pump(600);
    bz_event_t running = st.view[0];
    running.ended = BZ_RUNNING;
    bz_st_loaded(&st, &running, 1, NOW);
    CHECK_INT(bz_st_stop(&st, "p1", ended + 60000), BZ_ST_OK);
    CHECK(st.toast.shown && st.toast.phase == BZ_TOAST_SAVED); // no amount to wait for
    char *saved = bz_ob_serialize(&st.ob);
    bz_st_init(&st);
    bz_st_set_baby(&st, "b1");
    CHECK(bz_ob_adopt(&st.ob, saved));
    free(saved);
    CHECK(st.ob.outbox[0].event.meta_lost);
}
