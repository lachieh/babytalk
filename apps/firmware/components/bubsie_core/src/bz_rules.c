#include "bz_rules.h"

#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

#include "bz_time.h"

static const bz_variant_t FEED[] = {
    {"breast-l", "Breast · Left", "{\"method\":\"breast\",\"side\":\"left\"}"},
    {"breast-r", "Breast · Right", "{\"method\":\"breast\",\"side\":\"right\"}"},
    {"bottle", "Bottle", "{\"method\":\"bottle\"}"},
    {"formula", "Formula", "{\"method\":\"formula\"}"},
    {"solid", "Solid", "{\"method\":\"solid\"}"},
};
static const bz_variant_t DIAPER[] = {
    {"wet", "Wet", "{\"wet\":true,\"soiled\":false}"},
    {"soiled", "Soiled", "{\"wet\":false,\"soiled\":true}"},
    {"wet-soiled", "Wet + Soiled", "{\"wet\":true,\"soiled\":true}"},
};
static const bz_variant_t SLEEP[] = {
    {"crib", "Crib", "{\"location\":\"crib\"}"},
    {"bassinet", "Bassinet", "{\"location\":\"bassinet\"}"},
    {"held", "Held", "{\"location\":\"held\"}"},
    {"carrier", "Carrier", "{\"location\":\"carrier\"}"},
};
static const bz_variant_t PUMP[] = {
    {"both", "Both sides", "{\"side\":\"both\"}"},
    {"left", "Left", "{\"side\":\"left\"}"},
    {"right", "Right", "{\"side\":\"right\"}"},
};
static const bz_variant_t NOTE[] = {{"note", "Note", "{}"}};

#define N(a) (sizeof(a) / sizeof((a)[0]))

const bz_variant_t *bz_variants(bz_type_t type, size_t *count)
{
    switch (type) {
    case BZ_FEED: *count = N(FEED); return FEED;
    case BZ_DIAPER: *count = N(DIAPER); return DIAPER;
    case BZ_SLEEP: *count = N(SLEEP); return SLEEP;
    case BZ_PUMP: *count = N(PUMP); return PUMP;
    default: *count = N(NOTE); return NOTE;
    }
}

static const bz_variant_t *variant_find(bz_type_t type, const char *key)
{
    size_t count;
    const bz_variant_t *variants = bz_variants(type, &count);
    for (size_t i = 0; key && i < count; i++) {
        if (strcmp(variants[i].key, key) == 0) return &variants[i];
    }
    return &variants[0];
}

static const char *infer_feed(const bz_event_t *events, size_t count)
{
    int breast = 0, other = 0, seen = 0;
    char last_side[16] = "", last_other[16] = "";
    for (size_t i = 0; i < count && seen < 5; i++) {
        if (events[i].type != BZ_FEED || events[i].ended == BZ_RUNNING) continue;
        seen++;
        char method[16], side[16];
        bz_meta_str(events[i].meta, "method", method, sizeof method);
        if (strcmp(method, "bottle") == 0 || strcmp(method, "formula") == 0) {
            other++;
            if (!last_other[0]) strcpy(last_other, method);
        } else if (strcmp(method, "breast") == 0) {
            breast++;
        }
        if (!last_side[0] && bz_meta_str(events[i].meta, "side", side, sizeof side) && side[0]) strcpy(last_side, side);
    }
    if (seen == 0) return "breast-l";
    if (other > breast) return strcmp(last_other, "formula") == 0 ? "formula" : "bottle";
    return strcmp(last_side[0] ? last_side : "left", "left") == 0 ? "breast-r" : "breast-l";
}

static const char *infer_diaper(const bz_event_t *events, size_t count)
{
    int seen = 0, soiled = 0;
    for (size_t i = 0; i < count && seen < 5; i++) {
        if (events[i].type != BZ_DIAPER) continue;
        seen++;
        if (bz_meta_bool(events[i].meta, "soiled")) soiled++;
    }
    return soiled * 2 > seen ? "wet-soiled" : "wet";
}

const bz_variant_t *bz_infer_default(bz_type_t type, const bz_event_t *events, size_t count)
{
    if (type == BZ_FEED) return variant_find(type, infer_feed(events, count));
    if (type == BZ_DIAPER) return variant_find(type, infer_diaper(events, count));
    if (type == BZ_SLEEP) {
        for (size_t i = 0; i < count; i++) {
            if (events[i].type != BZ_SLEEP) continue;
            char location[16];
            bz_meta_str(events[i].meta, "location", location, sizeof location);
            return variant_find(type, location[0] ? location : "crib");
        }
        return variant_find(type, "crib");
    }
    return variant_find(type, NULL);
}

bool bz_starts_timer(bz_type_t type, const char *meta)
{
    if (type == BZ_SLEEP || type == BZ_PUMP) return true;
    if (type != BZ_FEED) return false;
    char method[16];
    bz_meta_str(meta, "method", method, sizeof method);
    return strcmp(method, "solid") != 0;
}

bool bz_meta_takes_amount(bz_type_t type, const char *meta)
{
    if (type == BZ_PUMP) return true;
    if (type != BZ_FEED) return false;
    char method[16];
    bz_meta_str(meta, "method", method, sizeof method);
    return strcmp(method, "bottle") == 0 || strcmp(method, "formula") == 0;
}

bool bz_takes_amount(const bz_event_t *event)
{
    return !event->meta_lost && bz_meta_takes_amount(event->type, event->meta);
}

const bz_event_t *bz_active(const bz_event_t *events, size_t count, bz_type_t type)
{
    if (type == BZ_DIAPER || type == BZ_NOTE) return NULL;
    for (size_t i = 0; i < count; i++) {
        if (events[i].type == type && events[i].ended == BZ_RUNNING) return &events[i];
    }
    return NULL;
}

#define AMOUNT_PROMPT_WINDOW_MS (15 * 60000LL)

const bz_event_t *bz_awaiting_amount(const bz_event_t *events, size_t count, bz_type_t type, bz_ms_t now,
                                     const char (*dismissed)[BZ_ID_LEN], size_t dismissed_count)
{
    const bz_event_t *best = NULL;
    for (size_t i = 0; i < count; i++) {
        const bz_event_t *e = &events[i];
        if (e->type != type || e->ended == BZ_RUNNING || e->ended == e->started) continue;
        if (!bz_takes_amount(e) || bz_meta_int(e->meta, "amountMl") > 0) continue;
        bool skipped = false;
        for (size_t d = 0; d < dismissed_count; d++) skipped |= strcmp(dismissed[d], e->id) == 0;
        if (skipped) continue;
        bz_ms_t since = now - e->ended;
        if (since < 0 || since > AMOUNT_PROMPT_WINDOW_MS) continue;
        if (!best || e->ended > best->ended) best = e;
    }
    return best;
}

int bz_last_amount_ml(const bz_event_t *events, size_t count, bz_type_t type)
{
    const bz_event_t *latest = NULL;
    for (size_t i = 0; i < count; i++) {
        if (events[i].type != type || bz_meta_int(events[i].meta, "amountMl") <= 0) continue;
        if (!latest || events[i].started > latest->started) latest = &events[i];
    }
    return latest ? bz_meta_int(latest->meta, "amountMl") : 0;
}

#define ML_PER_OZ 29.5735

static double ml_to_display(int ml, bool oz)
{
    return oz ? round(ml / ML_PER_OZ * 10) / 10 : round(ml * 10.0) / 10;
}

int bz_display_to_ml(double value, bool oz) { return (int)lround(oz ? value * ML_PER_OZ : value); }

void bz_amount_chips(int last_ml, bool oz, double out[3])
{
    double step = oz ? 1 : 30, snap = oz ? 0.5 : 10, typical = oz ? 4 : 120;
    double snapped = last_ml > 0 ? round(ml_to_display(last_ml, oz) / snap) * snap : typical;
    double middle = snapped > snap ? snapped : snap;
    out[0] = middle - step > 0 ? middle - step : middle / 2;
    out[1] = middle;
    out[2] = middle + step;
}

void bz_format_volume(int ml, bool oz, char *out, size_t len)
{
    snprintf(out, len, "%g %s", ml_to_display(ml, oz), oz ? "oz" : "ml");
}

static void capitalize(char *s)
{
    if (s[0]) s[0] = (char)toupper((unsigned char)s[0]);
}

static void join(char *out, size_t len, const char *part)
{
    if (!part || !part[0]) return;
    if (out[0]) strncat(out, " · ", len - strlen(out) - 1);
    strncat(out, part, len - strlen(out) - 1);
}

static void timer_detail(const bz_event_t *e, char *out, size_t len)
{
    char side[16], value[16];
    out[0] = '\0';
    bz_meta_str(e->meta, "side", side, sizeof side);
    if (e->type == BZ_FEED) {
        bz_meta_str(e->meta, "method", value, sizeof value);
        if (strcmp(value, "breast") == 0) {
            capitalize(side);
            snprintf(out, len, side[0] ? "%s breast" : "Breast", side);
        } else {
            capitalize(value);
            snprintf(out, len, "%s", value);
        }
    } else if (e->type == BZ_SLEEP) {
        bz_meta_str(e->meta, "location", value, sizeof value);
        capitalize(value);
        snprintf(out, len, "%s", value);
    } else if (e->type == BZ_PUMP) {
        if (strcmp(side, "both") == 0) {
            snprintf(out, len, "Both sides");
        } else {
            capitalize(side);
            snprintf(out, len, "%s", side);
        }
    }
}

void bz_timer_label(const bz_event_t *event, char *out, size_t len)
{
    char detail[32];
    timer_detail(event, detail, sizeof detail);
    snprintf(out, len, "%s", bz_type_label(event->type));
    join(out, len, detail);
}

void bz_toast_copy(const bz_event_t *e, bz_toast_t phase, bool oz, char *out, size_t len)
{
    const char *name = bz_type_label(e->type);
    if (phase == BZ_TOAST_DISCARDED) {
        snprintf(out, len, "%s timer discarded", name);
    } else {
        snprintf(out, len, "%s %s", name, phase == BZ_TOAST_STARTED ? "started" : "saved");
    }
    char part[40];
    if (phase == BZ_TOAST_SAVED && e->ended != BZ_RUNNING && e->ended > e->started) {
        bz_format_duration(e->ended - e->started, part, sizeof part);
        join(out, len, part);
    }
    int amount = bz_meta_int(e->meta, "amountMl");
    char volume[24] = "";
    if (amount > 0) bz_format_volume(amount, oz, volume, sizeof volume);
    switch (e->type) {
    case BZ_FEED: {
        char method[16];
        bz_meta_str(e->meta, "method", method, sizeof method);
        bz_meta_str(e->meta, strcmp(method, "breast") == 0 ? "side" : "method", part, sizeof part);
        capitalize(part);
        join(out, len, part);
        join(out, len, volume);
        break;
    }
    case BZ_PUMP:
        bz_meta_str(e->meta, "side", part, sizeof part);
        capitalize(part);
        join(out, len, part);
        join(out, len, volume);
        break;
    case BZ_SLEEP:
        bz_meta_str(e->meta, "location", part, sizeof part);
        capitalize(part);
        join(out, len, part);
        break;
    case BZ_DIAPER: {
        bool wet = bz_meta_bool(e->meta, "wet"), soiled = bz_meta_bool(e->meta, "soiled");
        join(out, len, wet && soiled ? "Wet and dirty" : wet ? "Wet" : soiled ? "Dirty" : "Dry");
        break;
    }
    default: break;
    }
}

static const bz_event_t *latest_started(const bz_event_t *events, size_t count, bz_type_t type, bz_ms_t now)
{
    const bz_event_t *latest = NULL;
    for (size_t i = 0; i < count; i++) {
        if (events[i].type != type || events[i].started > now) continue;
        if (!latest || events[i].started > latest->started) latest = &events[i];
    }
    return latest;
}

void bz_last_line(const bz_event_t *events, size_t count, bz_type_t type, bz_ms_t now, bool oz, char *out, size_t len)
{
    out[0] = '\0';
    const bz_event_t *e = latest_started(events, count, type, now);
    if (!e) return;
    char ago[32], detail[48] = "";
    bz_format_ago(now - e->started, ago, sizeof ago);
    int amount = bz_meta_int(e->meta, "amountMl");
    switch (type) {
    case BZ_SLEEP: {
        if (e->ended == BZ_RUNNING) {
            snprintf(out, len, "asleep now");
            return;
        }
        char awake[24], slept[24];
        long since = (long)((now - e->ended) / 60000);
        bz_format_minutes(since, awake, sizeof awake);
        if (since < 1) {
            snprintf(out, len, "just woke");
        } else {
            snprintf(out, len, "awake %s", awake);
        }
        long minutes = (long)((e->ended - e->started) / 60000);
        if (minutes > 0) {
            bz_format_minutes(minutes, slept, sizeof slept);
            snprintf(detail, sizeof detail, "slept %s", slept);
            join(out, len, detail);
        }
        return;
    }
    case BZ_FEED:
    case BZ_PUMP:
        if (amount > 0) bz_format_volume(amount, oz, detail, sizeof detail);
        {
            char how[32];
            timer_detail(e, how, sizeof how);
            join(detail, sizeof detail, how);
        }
        snprintf(out, len, "%s", e->ended == BZ_RUNNING ? (type == BZ_FEED ? "feeding now" : "pumping now") : ago);
        join(out, len, detail);
        return;
    case BZ_DIAPER: {
        bool wet = bz_meta_bool(e->meta, "wet"), soiled = bz_meta_bool(e->meta, "soiled");
        snprintf(out, len, "%s", ago);
        join(out, len, wet && soiled ? "Wet + Soiled" : wet ? "Wet" : soiled ? "Soiled" : "");
        return;
    }
    default:
        snprintf(out, len, "%s", ago);
        return;
    }
}
