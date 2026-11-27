#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "bz_event.h"
#include "bz_gql.h"

#define BZ_SERVER_MAX 100 /* recentEvents limit, as the web asks for */
#define BZ_OUTBOX_MAX 48
#define BZ_HIDDEN_MAX 8

typedef enum { BZ_OP_CREATE, BZ_OP_UPDATE, BZ_OP_DELETE } bz_op_t;

typedef enum { BZ_ST_READY, BZ_ST_SENDING, BZ_ST_WAITING, BZ_ST_FAILED } bz_status_t;

typedef enum { BZ_EXISTS_NO, BZ_EXISTS_MAYBE, BZ_EXISTS_YES } bz_exists_t;

typedef struct {
    bz_event_t event;
    char baby_id[BZ_ID_LEN];
    bz_op_t op;
    uint8_t patch;
    uint8_t sent_patch;
    bz_status_t status;
    bz_exists_t exists;
    uint32_t version;
    uint32_t sent_version;
    bz_op_t sent_op;
    uint32_t request;
    bool detached;
    uint32_t seq;
} bz_entry_t;

typedef struct {
    char server_baby[BZ_ID_LEN];
    bz_event_t server[BZ_SERVER_MAX];
    size_t server_count;
    bz_entry_t outbox[BZ_OUTBOX_MAX];
    size_t outbox_count;
    char hidden[BZ_HIDDEN_MAX][BZ_ID_LEN];
    size_t hidden_count;
    bz_ms_t last_write_at;
    uint32_t next_seq;
    uint32_t next_request;
} bz_outbox_t;

void bz_ob_init(bz_outbox_t *ob);

void bz_ob_set_baby(bz_outbox_t *ob, const char *baby_id);
void bz_ob_loaded(bz_outbox_t *ob, const bz_event_t *events, size_t count, bz_ms_t requested_at);

bool bz_ob_create(bz_outbox_t *ob, const bz_event_t *event, const char *baby_id);
bool bz_ob_update(bz_outbox_t *ob, const char *id, unsigned changed, const bz_event_t *values);
bool bz_ob_delete(bz_outbox_t *ob, const char *id);
bool bz_ob_can_delete(const bz_outbox_t *ob, const char *id);
void bz_ob_hide(bz_outbox_t *ob, const char *id);
void bz_ob_unhide(bz_outbox_t *ob, const char *id);

const bz_entry_t *bz_ob_next(const bz_outbox_t *ob);
uint32_t bz_ob_send_start(bz_outbox_t *ob, const char *id);
char *bz_ob_request_body(const bz_entry_t *entry);
void bz_ob_send_ok(bz_outbox_t *ob, const char *id, uint32_t request, const bz_event_t *confirmed, bz_ms_t at);
void bz_ob_send_failed(bz_outbox_t *ob, const char *id, uint32_t request, bool definite);
void bz_ob_resume(bz_outbox_t *ob);
void bz_ob_retry(bz_outbox_t *ob);
bool bz_ob_has_waiting(const bz_outbox_t *ob);

size_t bz_ob_derive(const bz_outbox_t *ob, const char *baby_id, bz_event_t *out, size_t max);

typedef struct {
    int queued;
    int failed;
} bz_unsaved_t;
bz_unsaved_t bz_ob_unsaved(const bz_outbox_t *ob);

char *bz_ob_serialize(const bz_outbox_t *ob);
bool bz_ob_adopt(bz_outbox_t *ob, const char *json);
