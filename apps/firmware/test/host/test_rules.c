#include <string.h>

#include "bz_rules.h"
#include "check.h"

static bz_event_t ev(bz_type_t type, bz_ms_t started, bz_ms_t ended, const char *meta)
{
    bz_event_t e = {.type = type, .started = started, .ended = ended};
    snprintf(e.id, sizeof e.id, "e%lld", (long long)started);
    snprintf(e.meta, sizeof e.meta, "%s", meta);
    return e;
}

#define MIN 60000LL

TEST(test_rules_infer_default)
{
    CHECK_STR(bz_infer_default(BZ_FEED, NULL, 0)->key, "breast-l");
    bz_event_t feeds[] = {
        ev(BZ_FEED, 300 * MIN, 320 * MIN, "{\"method\":\"breast\",\"side\":\"left\"}"),
        ev(BZ_FEED, 100 * MIN, 120 * MIN, "{\"method\":\"breast\",\"side\":\"right\"}"),
    };
    CHECK_STR(bz_infer_default(BZ_FEED, feeds, 2)->key, "breast-r");
    bz_event_t bottles[] = {
        ev(BZ_FEED, 300 * MIN, 320 * MIN, "{\"method\":\"formula\"}"),
        ev(BZ_FEED, 200 * MIN, 220 * MIN, "{\"method\":\"bottle\"}"),
        ev(BZ_FEED, 100 * MIN, 120 * MIN, "{\"method\":\"breast\",\"side\":\"left\"}"),
    };
    CHECK_STR(bz_infer_default(BZ_FEED, bottles, 3)->key, "formula");
    bz_event_t running[] = {ev(BZ_FEED, 400 * MIN, BZ_RUNNING, "{\"method\":\"bottle\"}"), feeds[0]};
    CHECK_STR(bz_infer_default(BZ_FEED, running, 2)->key, "breast-r");

    bz_event_t diapers[] = {
        ev(BZ_DIAPER, 3, 3, "{\"wet\":true,\"soiled\":true}"),
        ev(BZ_DIAPER, 2, 2, "{\"wet\":false,\"soiled\":true}"),
        ev(BZ_DIAPER, 1, 1, "{\"wet\":true,\"soiled\":false}"),
    };
    CHECK_STR(bz_infer_default(BZ_DIAPER, diapers, 3)->key, "wet-soiled");
    CHECK_STR(bz_infer_default(BZ_DIAPER, diapers + 1, 2)->key, "wet");
    bz_event_t sleep = ev(BZ_SLEEP, 1, 2, "{\"location\":\"held\"}");
    CHECK_STR(bz_infer_default(BZ_SLEEP, &sleep, 1)->key, "held");
    CHECK_STR(bz_infer_default(BZ_PUMP, NULL, 0)->key, "both");
}

TEST(test_rules_one_tap_and_amounts)
{
    CHECK(bz_starts_timer(BZ_FEED, "{\"method\":\"bottle\"}"));
    CHECK(!bz_starts_timer(BZ_FEED, "{\"method\":\"solid\"}"));
    CHECK(bz_starts_timer(BZ_SLEEP, "{}"));
    CHECK(!bz_starts_timer(BZ_DIAPER, "{}"));

    bz_ms_t now = 1000 * MIN;
    bz_event_t events[] = {
        ev(BZ_FEED, now - 30 * MIN, now - 5 * MIN, "{\"method\":\"bottle\"}"),
        ev(BZ_FEED, now - 90 * MIN, now - 80 * MIN, "{\"method\":\"bottle\",\"amountMl\":150}"),
        ev(BZ_FEED, now - 200 * MIN, now - 190 * MIN, "{\"method\":\"breast\",\"side\":\"left\"}"),
    };
    const bz_event_t *waiting = bz_awaiting_amount(events, 3, BZ_FEED, now, NULL, 0);
    CHECK(waiting == &events[0]);
    char dismissed[1][BZ_ID_LEN];
    strcpy(dismissed[0], events[0].id);
    CHECK(bz_awaiting_amount(events, 3, BZ_FEED, now, (const char(*)[BZ_ID_LEN])dismissed, 1) == NULL);
    CHECK(bz_awaiting_amount(events, 3, BZ_FEED, now + 20 * MIN, NULL, 0) == NULL);
    CHECK_INT(bz_last_amount_ml(events, 3, BZ_FEED), 150);

    double chips[3];
    bz_amount_chips(150, false, chips);
    CHECK(chips[0] == 120 && chips[1] == 150 && chips[2] == 180);
    bz_amount_chips(0, true, chips);
    CHECK(chips[0] == 3 && chips[1] == 4 && chips[2] == 5);
    bz_amount_chips(15, true, chips);
    CHECK(chips[0] == 0.25 && chips[1] == 0.5);
    CHECK_INT(bz_display_to_ml(4, true), 118);
    char volume[16];
    bz_format_volume(118, true, volume, sizeof volume);
    CHECK_STR(volume, "4 oz");
}

TEST(test_rules_words)
{
    char out[96];
    bz_event_t feed = ev(BZ_FEED, 0, BZ_RUNNING, "{\"method\":\"breast\",\"side\":\"left\"}");
    bz_timer_label(&feed, out, sizeof out);
    CHECK_STR(out, "Feed · Left breast");
    bz_event_t pump = ev(BZ_PUMP, 0, 65 * MIN, "{\"side\":\"both\",\"amountMl\":120}");
    bz_timer_label(&pump, out, sizeof out);
    CHECK_STR(out, "Pump · Both sides");
    bz_toast_copy(&pump, BZ_TOAST_SAVED, false, out, sizeof out);
    CHECK_STR(out, "Pump saved · 1 h 5 min · Both · 120 ml");
    bz_toast_copy(&feed, BZ_TOAST_STARTED, false, out, sizeof out);
    CHECK_STR(out, "Feed started · Left");
    bz_event_t diaper = ev(BZ_DIAPER, 0, 0, "{\"wet\":true,\"soiled\":true}");
    bz_toast_copy(&diaper, BZ_TOAST_SAVED, false, out, sizeof out);
    CHECK_STR(out, "Diaper saved · Wet and dirty");
    bz_toast_copy(&feed, BZ_TOAST_DISCARDED, false, out, sizeof out);
    CHECK_STR(out, "Feed timer discarded · Left");

    bz_ms_t now = 1000 * MIN;
    bz_event_t events[] = {
        ev(BZ_SLEEP, now - 200 * MIN, now - 45 * MIN, "{\"location\":\"crib\"}"),
        ev(BZ_FEED, now - 125 * MIN, now - 100 * MIN, "{\"method\":\"bottle\",\"amountMl\":120}"),
    };
    bz_last_line(events, 2, BZ_SLEEP, now, false, out, sizeof out);
    CHECK_STR(out, "awake 45m · slept 2h 35m");
    bz_last_line(events, 2, BZ_FEED, now, false, out, sizeof out);
    CHECK_STR(out, "2h 5m ago · 120 ml · Bottle");
    bz_last_line(events, 2, BZ_DIAPER, now, false, out, sizeof out);
    CHECK_STR(out, "");
}
