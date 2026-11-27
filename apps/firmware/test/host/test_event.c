#include "bz_event.h"
#include "check.h"

TEST(test_event_types)
{
    CHECK_INT(bz_type_from_name("pump"), BZ_PUMP);
    CHECK_INT(bz_type_from_name("growth"), BZ_TYPE_UNKNOWN);
    CHECK_STR(bz_type_name(BZ_DIAPER), "diaper");
    CHECK_STR(bz_type_label(BZ_SLEEP), "Sleep");
}

TEST(test_event_meta)
{
    const char *meta = "{\"method\":\"bottle\",\"amountMl\":120,\"notes\":\"burped\",\"wet\":true}";
    char out[BZ_META_LEN];
    CHECK(bz_meta_str(meta, "method", out, sizeof out));
    CHECK_STR(out, "bottle");
    CHECK(!bz_meta_str(meta, "side", out, sizeof out));
    CHECK_STR(out, "");
    CHECK_INT(bz_meta_int(meta, "amountMl"), 120);
    CHECK(bz_meta_bool(meta, "wet"));
    CHECK(!bz_meta_bool("not json", "wet"));

    // Setting the amount keeps fields the device does not know about.
    CHECK(bz_meta_with_int(meta, "amountMl", 90, out, sizeof out));
    CHECK_INT(bz_meta_int(out, "amountMl"), 90);
    char notes[32];
    bz_meta_str(out, "notes", notes, sizeof notes);
    CHECK_STR(notes, "burped");
}
