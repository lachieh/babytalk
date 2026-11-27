#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "bz_event.h"

typedef struct {
    const char *key;
    const char *label;
    const char *meta;
} bz_variant_t;

const bz_variant_t *bz_variants(bz_type_t type, size_t *count);
const bz_variant_t *bz_infer_default(bz_type_t type, const bz_event_t *events, size_t count);

bool bz_starts_timer(bz_type_t type, const char *meta);
bool bz_takes_amount(const bz_event_t *event);
bool bz_meta_takes_amount(bz_type_t type, const char *meta);

const bz_event_t *bz_active(const bz_event_t *events, size_t count, bz_type_t type);
const bz_event_t *bz_awaiting_amount(const bz_event_t *events, size_t count, bz_type_t type, bz_ms_t now,
                                     const char (*dismissed)[BZ_ID_LEN], size_t dismissed_count);
int bz_last_amount_ml(const bz_event_t *events, size_t count, bz_type_t type);

void bz_amount_chips(int last_ml, bool oz, double out[3]);
int bz_display_to_ml(double value, bool oz);
void bz_format_volume(int ml, bool oz, char *out, size_t len);

void bz_timer_label(const bz_event_t *event, char *out, size_t len);

typedef enum { BZ_TOAST_STARTED, BZ_TOAST_SAVED, BZ_TOAST_DISCARDED } bz_toast_t;
void bz_toast_copy(const bz_event_t *event, bz_toast_t phase, bool oz, char *out, size_t len);

void bz_last_line(const bz_event_t *events, size_t count, bz_type_t type, bz_ms_t now, bool oz, char *out, size_t len);
