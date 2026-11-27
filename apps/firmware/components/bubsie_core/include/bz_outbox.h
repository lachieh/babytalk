// Unconfirmed changes to events: the device's port of apps/web/src/lib/event-outbox.ts.
//
// Every event has its final id from the moment it is logged (the device picks a UUID and the server
// stores the row under it), so a resent create is the same event however it was edited since.
// Changes are sent one request at a time, oldest first: a change made while a request is in
// flight waits for it, so the server sees them in the order they were made. A request carries
// only what the server has not confirmed. The whole state is persisted after every change.
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

/**
 * ready: needs a request; sending: waiting for the reply; waiting: the request did not get
 * through, sent again automatically; failed: the server refused it, sent again only on retry.
 */
typedef enum { BZ_ST_READY, BZ_ST_SENDING, BZ_ST_WAITING, BZ_ST_FAILED } bz_status_t;

/** Whether the server may hold a row with this id. */
typedef enum { BZ_EXISTS_NO, BZ_EXISTS_MAYBE, BZ_EXISTS_YES } bz_exists_t;

typedef struct {
    bz_event_t event;       /* the event as it should end up */
    char baby_id[BZ_ID_LEN];/* whose event: a create names its baby */
    bz_op_t op;
    uint8_t patch;          /* BZ_CHANGED_* not in any request yet */
    uint8_t sent_patch;     /* BZ_CHANGED_* the request in flight carries */
    bz_status_t status;
    bz_exists_t exists;
    uint32_t version;
    uint32_t sent_version;
    bz_op_t sent_op;
    uint32_t request;       /* the request in flight, 0 if none */
    bool detached;          /* a change to a saved event this device has not loaded */
    uint32_t seq;           /* order of first change: requests go oldest first */
} bz_entry_t;

typedef struct {
    char server_baby[BZ_ID_LEN];      /* whose events `server` holds */
    bz_event_t server[BZ_SERVER_MAX]; /* the current baby's events as last loaded, newest first */
    size_t server_count;
    bz_entry_t outbox[BZ_OUTBOX_MAX];
    size_t outbox_count;
    char hidden[BZ_HIDDEN_MAX][BZ_ID_LEN]; /* discarded, inside the undo window */
    size_t hidden_count;
    bz_ms_t last_write_at;
    uint32_t next_seq;
    uint32_t next_request;
} bz_outbox_t;

void bz_ob_init(bz_outbox_t *ob);

/** Show another baby: the loaded events go until that baby's are loaded. Unsent changes stay. */
void bz_ob_set_baby(bz_outbox_t *ob, const char *baby_id);
/** A recentEvents answer. Ignored if it was asked for before the last confirmed write. */
void bz_ob_loaded(bz_outbox_t *ob, const bz_event_t *events, size_t count, bz_ms_t requested_at);

/** false if the outbox is full (the change could not be recorded and must not be shown as saved). */
bool bz_ob_create(bz_outbox_t *ob, const bz_event_t *event, const char *baby_id);
bool bz_ob_update(bz_outbox_t *ob, const char *id, unsigned changed, const bz_event_t *values);
bool bz_ob_delete(bz_outbox_t *ob, const char *id);
/** Whether bz_ob_delete(id) has room to be recorded. */
bool bz_ob_can_delete(const bz_outbox_t *ob, const char *id);
void bz_ob_hide(bz_outbox_t *ob, const char *id);
void bz_ob_unhide(bz_outbox_t *ob, const char *id);

/**
 * The entry to send next: the oldest that is ready. Nothing while an older one is sending or
 * waiting, so requests stay in order. Failed entries do not hold the others back.
 */
const bz_entry_t *bz_ob_next(const bz_outbox_t *ob);
/** Claim an entry for a request. Returns the request number (0 if the entry is not ready). */
uint32_t bz_ob_send_start(bz_outbox_t *ob, const char *id);
/** The request a sending entry needs: its body, built from what the request carries. Heap. */
char *bz_ob_request_body(const bz_entry_t *entry);
void bz_ob_send_ok(bz_outbox_t *ob, const char *id, uint32_t request, const bz_event_t *confirmed, bz_ms_t at);
/** `definite`: the server answered and refused. */
void bz_ob_send_failed(bz_outbox_t *ob, const char *id, uint32_t request, bool definite);
/** The network may be back: send what was waiting. */
void bz_ob_resume(bz_outbox_t *ob);
/** The person asked to try again, including what the server refused. */
void bz_ob_retry(bz_outbox_t *ob);
bool bz_ob_has_waiting(const bz_outbox_t *ob);

/** Events as the person should see them: loaded ones with unsent changes applied, newest first. */
size_t bz_ob_derive(const bz_outbox_t *ob, const char *baby_id, bz_event_t *out, size_t max);

typedef struct {
    int queued;
    int failed;
} bz_unsaved_t;
bz_unsaved_t bz_ob_unsaved(const bz_outbox_t *ob);

/** Persisted form (JSON, heap): the outbox and the hidden list. */
char *bz_ob_serialize(const bz_outbox_t *ob);
/** Take over a persisted outbox after a restart: a request that was in flight has no reply coming,
 * so its changes go into the next one; a discard whose undo window was cut short is committed. */
bool bz_ob_adopt(bz_outbox_t *ob, const char *json);
