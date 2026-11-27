#include <stdlib.h>
#include <time.h>

#include "bz_time.h"
#include "check.h"

TEST(test_time_iso)
{
    CHECK_INT(bz_parse_iso("1970-01-01T00:00:00.000Z"), 0);
    CHECK_INT(bz_parse_iso("2026-11-27T10:04:05.123Z"), 1795773845123LL);
    CHECK_INT(bz_parse_iso("2026-11-27T20:04:05.123+10:00"), 1795773845123LL);
    CHECK_INT(bz_parse_iso("2026-11-27T10:04:05Z"), 1795773845000LL);
    CHECK_INT(bz_parse_iso("2024-02-29T23:59:59.999Z"), 1709251199999LL);
    CHECK_INT(bz_parse_iso("yesterday"), -1);
    CHECK_INT(bz_parse_iso("2026-13-01T00:00:00Z"), -1);
    char out[25];
    bz_format_iso(1795773845123LL, out);
    CHECK_STR(out, "2026-11-27T10:04:05.123Z");
    bz_format_iso(1709251199999LL, out);
    CHECK_STR(out, "2024-02-29T23:59:59.999Z");
}

TEST(test_time_formats)
{
    char out[32];
    bz_format_elapsed(0, out, sizeof out);
    CHECK_STR(out, "0:00");
    bz_format_elapsed(65 * 1000, out, sizeof out);
    CHECK_STR(out, "1:05");
    bz_format_elapsed((3600 + 4 * 60 + 5) * 1000LL, out, sizeof out);
    CHECK_STR(out, "1:04:05");
    bz_format_elapsed(-5000, out, sizeof out);
    CHECK_STR(out, "0:00");

    bz_format_minutes(0, out, sizeof out);
    CHECK_STR(out, "\xE2\x80\x94");
    bz_format_minutes(45, out, sizeof out);
    CHECK_STR(out, "45m");
    bz_format_minutes(120, out, sizeof out);
    CHECK_STR(out, "2h");
    bz_format_minutes(125, out, sizeof out);
    CHECK_STR(out, "2h 5m");

    bz_format_ago(30 * 1000, out, sizeof out);
    CHECK_STR(out, "just now");
    bz_format_ago(125 * 60000LL, out, sizeof out);
    CHECK_STR(out, "2h 5m ago");

    bz_format_duration(20 * 1000, out, sizeof out);
    CHECK_STR(out, "Under 1 min");
    bz_format_duration(12 * 60000 + 31000, out, sizeof out);
    CHECK_STR(out, "13 min");
    bz_format_duration(65 * 60000, out, sizeof out);
    CHECK_STR(out, "1 h 5 min");
    bz_format_duration(120 * 60000, out, sizeof out);
    CHECK_STR(out, "2 h");
}

TEST(test_time_zones)
{
    bz_ms_t at = 1795773845123LL;
    char out[16];
    bz_tz_apply("Australia/Sydney");
    bz_format_clock(at, out, sizeof out);
    CHECK_STR(out, "9:04 pm");
    CHECK_INT(bz_local_hour(at), 21);
    bz_tz_apply("America/Los_Angeles");
    bz_format_clock(at, out, sizeof out);
    CHECK_STR(out, "2:04 am");
    bz_tz_apply("Asia/Kolkata");
    bz_format_clock(at, out, sizeof out);
    CHECK_STR(out, "3:34 pm");
    bz_tz_apply("Mars/Olympus");
    bz_format_clock(at, out, sizeof out);
    CHECK_STR(out, "10:04 am");
    bz_format_clock(at - 10 * 3600000LL, out, sizeof out);
    CHECK_STR(out, "12:04 am");
    size_t count;
    const bz_zone_t *zones = bz_zones(&count);
    CHECK(count > 20);
    for (size_t i = 0; i < count; i++) CHECK(bz_zone_find(zones[i].name) == &zones[i]);
    bz_tz_apply("UTC");
}

TEST(test_time_dark_hours)
{
    CHECK(bz_is_dark_hour(20, 20, 7));
    CHECK(bz_is_dark_hour(3, 20, 7));
    CHECK(!bz_is_dark_hour(7, 20, 7));
    CHECK(!bz_is_dark_hour(12, 20, 7));
    CHECK(bz_is_dark_hour(13, 13, 14));
    CHECK(!bz_is_dark_hour(14, 13, 14));
}
