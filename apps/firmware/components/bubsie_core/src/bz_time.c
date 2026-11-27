#include "bz_time.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Days since 1970-01-01 of a civil date (Howard Hinnant's algorithm). */
static long long days_from_civil(int y, int m, int d)
{
    y -= m <= 2;
    long long era = (y >= 0 ? y : y - 399) / 400;
    int yoe = (int)(y - era * 400);
    int doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
    int doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    return era * 146097 + doe - 719468;
}

static void civil_from_days(long long z, int *y, int *m, int *d)
{
    z += 719468;
    long long era = (z >= 0 ? z : z - 146096) / 146097;
    int doe = (int)(z - era * 146097);
    int yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    int doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    int mp = (5 * doy + 2) / 153;
    *d = doy - (153 * mp + 2) / 5 + 1;
    *m = mp + (mp < 10 ? 3 : -9);
    *y = (int)(yoe + era * 400) + (*m <= 2);
}

static int digits(const char **p, int n)
{
    int value = 0;
    for (int i = 0; i < n; i++) {
        if (!isdigit((unsigned char)**p)) return -1;
        value = value * 10 + (**p - '0');
        (*p)++;
    }
    return value;
}

static bool expect(const char **p, char c)
{
    if (**p != c) return false;
    (*p)++;
    return true;
}

bz_ms_t bz_parse_iso(const char *text)
{
    if (!text) return -1;
    const char *p = text;
    int y = digits(&p, 4);
    if (y < 0 || !expect(&p, '-')) return -1;
    int mo = digits(&p, 2);
    if (mo < 1 || mo > 12 || !expect(&p, '-')) return -1;
    int d = digits(&p, 2);
    if (d < 1 || d > 31 || !(expect(&p, 'T') || expect(&p, ' '))) return -1;
    int h = digits(&p, 2);
    if (h < 0 || h > 23 || !expect(&p, ':')) return -1;
    int mi = digits(&p, 2);
    if (mi < 0 || mi > 59) return -1;
    int s = 0, ms = 0;
    if (expect(&p, ':')) {
        s = digits(&p, 2);
        if (s < 0 || s > 60) return -1;
        if (expect(&p, '.')) {
            int scale = 100;
            while (isdigit((unsigned char)*p)) {
                ms += (*p - '0') * scale;
                scale /= 10;
                p++;
            }
        }
    }
    int offset_min = 0;
    if (*p == 'Z' || *p == 'z') {
        p++;
    } else if (*p == '+' || *p == '-') {
        int sign = *p == '-' ? -1 : 1;
        p++;
        int oh = digits(&p, 2);
        expect(&p, ':');
        int om = digits(&p, 2);
        if (oh < 0 || om < 0) return -1;
        offset_min = sign * (oh * 60 + om);
    } else if (*p != '\0') {
        return -1;
    }
    long long seconds = days_from_civil(y, mo, d) * 86400LL + h * 3600 + mi * 60 + s - offset_min * 60LL;
    return seconds * 1000 + ms;
}

void bz_format_iso(bz_ms_t ms, char out[25])
{
    long long seconds = ms >= 0 ? ms / 1000 : (ms - 999) / 1000;
    int millis = (int)(ms - seconds * 1000);
    long long days = seconds >= 0 ? seconds / 86400 : (seconds - 86399) / 86400;
    int rest = (int)(seconds - days * 86400);
    int y, m, d;
    civil_from_days(days, &y, &m, &d);
    snprintf(out, 25, "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ", y, m, d, rest / 3600, rest / 60 % 60, rest % 60, millis);
}

void bz_format_elapsed(bz_ms_t ms, char *out, size_t len)
{
    long total = ms > 0 ? (long)(ms / 1000) : 0;
    long hours = total / 3600, minutes = total / 60 % 60, seconds = total % 60;
    if (hours > 0) {
        snprintf(out, len, "%ld:%02ld:%02ld", hours, minutes, seconds);
    } else {
        snprintf(out, len, "%ld:%02ld", minutes, seconds);
    }
}

void bz_format_minutes(long minutes, char *out, size_t len)
{
    if (minutes <= 0) {
        snprintf(out, len, "\xE2\x80\x94"); /* — */
        return;
    }
    long h = minutes / 60, m = minutes % 60;
    if (h == 0) {
        snprintf(out, len, "%ldm", m);
    } else if (m > 0) {
        snprintf(out, len, "%ldh %ldm", h, m);
    } else {
        snprintf(out, len, "%ldh", h);
    }
}

void bz_format_ago(bz_ms_t ms, char *out, size_t len)
{
    long minutes = (long)(ms / 60000);
    if (minutes < 1) {
        snprintf(out, len, "just now");
        return;
    }
    char span[24];
    bz_format_minutes(minutes, span, sizeof span);
    snprintf(out, len, "%s ago", span);
}

void bz_format_duration(bz_ms_t ms, char *out, size_t len)
{
    long minutes = (long)((ms + 30000) / 60000);
    if (minutes < 1) {
        snprintf(out, len, "Under 1 min");
    } else if (minutes < 60) {
        snprintf(out, len, "%ld min", minutes);
    } else if (minutes % 60 == 0) {
        snprintf(out, len, "%ld h", minutes / 60);
    } else {
        snprintf(out, len, "%ld h %ld min", minutes / 60, minutes % 60);
    }
}

static struct tm local(bz_ms_t ms)
{
    time_t t = (time_t)(ms / 1000);
    struct tm tm;
    localtime_r(&t, &tm);
    return tm;
}

void bz_format_clock(bz_ms_t ms, char *out, size_t len)
{
    struct tm tm = local(ms);
    int hour = tm.tm_hour % 12;
    snprintf(out, len, "%d:%02d %s", hour ? hour : 12, tm.tm_min, tm.tm_hour < 12 ? "am" : "pm");
}

int bz_local_hour(bz_ms_t ms) { return local(ms).tm_hour; }

bool bz_is_dark_hour(int hour, int start, int end)
{
    if (start > end) return hour >= start || hour < end;
    return hour >= start && hour < end;
}

/* The zones a family is most likely in, west to east. POSIX rules carry the current DST law. */
static const bz_zone_t ZONES[] = {
    {"Pacific/Honolulu", "Honolulu", "HST10"},
    {"America/Anchorage", "Anchorage", "AKST9AKDT,M3.2.0,M11.1.0"},
    {"America/Los_Angeles", "Los Angeles, Vancouver", "PST8PDT,M3.2.0,M11.1.0"},
    {"America/Denver", "Denver, Calgary", "MST7MDT,M3.2.0,M11.1.0"},
    {"America/Phoenix", "Phoenix", "MST7"},
    {"America/Chicago", "Chicago, Mexico City", "CST6CDT,M3.2.0,M11.1.0"},
    {"America/New_York", "New York, Toronto", "EST5EDT,M3.2.0,M11.1.0"},
    {"America/Halifax", "Halifax", "AST4ADT,M3.2.0,M11.1.0"},
    {"America/Sao_Paulo", "São Paulo", "<-03>3"},
    {"America/St_Johns", "St. John's", "NST3:30NDT,M3.2.0,M11.1.0"},
    {"Atlantic/Reykjavik", "Reykjavík", "GMT0"},
    {"UTC", "UTC", "UTC0"},
    {"Europe/London", "London, Dublin", "GMT0BST,M3.5.0/1,M10.5.0"},
    {"Europe/Paris", "Paris, Berlin, Madrid", "CET-1CEST,M3.5.0,M10.5.0/3"},
    {"Africa/Lagos", "Lagos", "WAT-1"},
    {"Africa/Johannesburg", "Johannesburg", "SAST-2"},
    {"Europe/Athens", "Athens, Helsinki", "EET-2EEST,M3.5.0/3,M10.5.0/4"},
    {"Africa/Cairo", "Cairo", "EET-2EEST,M4.5.5/0,M10.5.4/24"},
    {"Europe/Istanbul", "Istanbul", "<+03>-3"},
    {"Africa/Nairobi", "Nairobi", "EAT-3"},
    {"Asia/Dubai", "Dubai", "<+04>-4"},
    {"Asia/Karachi", "Karachi", "PKT-5"},
    {"Asia/Kolkata", "India", "IST-5:30"},
    {"Asia/Dhaka", "Dhaka", "<+06>-6"},
    {"Asia/Bangkok", "Bangkok, Jakarta", "<+07>-7"},
    {"Asia/Singapore", "Singapore, Perth", "<+08>-8"},
    {"Asia/Shanghai", "China, Hong Kong", "CST-8"},
    {"Asia/Tokyo", "Tokyo, Seoul", "JST-9"},
    {"Australia/Adelaide", "Adelaide", "ACST-9:30ACDT,M10.1.0,M4.1.0/3"},
    {"Australia/Darwin", "Darwin", "ACST-9:30"},
    {"Australia/Brisbane", "Brisbane", "AEST-10"},
    {"Australia/Sydney", "Sydney, Melbourne", "AEST-10AEDT,M10.1.0,M4.1.0/3"},
    {"Australia/Hobart", "Hobart", "AEST-10AEDT,M10.1.0,M4.1.0/3"},
    {"Pacific/Auckland", "Auckland", "NZST-12NZDT,M9.5.0,M4.1.0/3"},
};

const bz_zone_t *bz_zones(size_t *count)
{
    *count = sizeof ZONES / sizeof ZONES[0];
    return ZONES;
}

const bz_zone_t *bz_zone_find(const char *name)
{
    for (size_t i = 0; name && i < sizeof ZONES / sizeof ZONES[0]; i++) {
        if (strcmp(ZONES[i].name, name) == 0) return &ZONES[i];
    }
    return NULL;
}

void bz_tz_apply(const char *name)
{
    const bz_zone_t *zone = bz_zone_find(name);
    setenv("TZ", zone ? zone->posix : "UTC0", 1);
    tzset();
}
