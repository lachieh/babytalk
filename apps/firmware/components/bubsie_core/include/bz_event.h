// A logged event, as the API returns it (`id type startedAt endedAt metadata`), with the metadata
// kept as its JSON text so fields the device does not know survive an edit.
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define BZ_ID_LEN 37   /* a UUID and its terminator */
#define BZ_META_LEN 320

typedef enum {
    BZ_FEED,
    BZ_SLEEP,
    BZ_DIAPER,
    BZ_PUMP,
    BZ_NOTE,
    BZ_TYPE_COUNT,
    BZ_TYPE_UNKNOWN = BZ_TYPE_COUNT,
} bz_type_t;

/** Milliseconds since the Unix epoch, UTC. */
typedef int64_t bz_ms_t;

/** No end time: a running timer (endedAt null). */
#define BZ_RUNNING 0

typedef struct {
    char id[BZ_ID_LEN];
    bz_type_t type;
    bz_ms_t started;
    bz_ms_t ended; /* BZ_RUNNING while a timer runs */
    char meta[BZ_META_LEN];
    /* The server's metadata did not fit in `meta`, which holds "{}" instead of a cut copy. An edit
     * from here would replace what the server has, so its metadata is never changed here. */
    bool meta_lost;
    uint8_t sync; /* bz_sync_t, set on derived views only */
} bz_event_t;

typedef enum { BZ_SAVED, BZ_PENDING, BZ_FAILED } bz_sync_t;

const char *bz_type_name(bz_type_t type);  /* "feed" ... as the API spells it */
const char *bz_type_label(bz_type_t type); /* "Feed" ... as the web shows it */
bz_type_t bz_type_from_name(const char *name);

/* Metadata reads. Each parses `meta`; unknown or missing fields read as empty, false or 0. */
bool bz_meta_str(const char *meta, const char *key, char *out, size_t out_len);
bool bz_meta_bool(const char *meta, const char *key);
int bz_meta_int(const char *meta, const char *key);

/** Copy `meta` with `key` set to the integer `value`. false if `meta` is not a JSON object or the
 * result does not fit in `out_len`; `out` is then not usable. */
bool bz_meta_with_int(const char *meta, const char *key, int value, char *out, size_t out_len);
