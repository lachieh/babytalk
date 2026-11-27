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
