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

typedef int64_t bz_ms_t;

#define BZ_RUNNING 0

typedef enum { BZ_SAVED, BZ_PENDING, BZ_FAILED } bz_sync_t;

typedef struct {
    char id[BZ_ID_LEN];
    bz_type_t type;
    bz_ms_t started;
    bz_ms_t ended;
    char meta[BZ_META_LEN];
    bool meta_lost;
    bz_sync_t sync;
} bz_event_t;

const char *bz_type_name(bz_type_t type);
const char *bz_type_label(bz_type_t type);
bz_type_t bz_type_from_name(const char *name);

bool bz_meta_str(const char *meta, const char *key, char *out, size_t out_len);
bool bz_meta_bool(const char *meta, const char *key);
int bz_meta_int(const char *meta, const char *key);

bool bz_meta_with_int(const char *meta, const char *key, int value, char *out, size_t out_len);
