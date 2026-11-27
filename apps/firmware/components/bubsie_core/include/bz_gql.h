// The GraphQL the device speaks, as request bodies and parsed replies. The operations match what
// the web sends (apps/web/src/lib/baby-context.tsx, outbox-store.ts, gql-request.ts) and the
// device-code pairing contract. Every builder returns a heap string the caller frees.
#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "bz_event.h"

/* ── Requests ─────────────────────────────────────────────── */

char *bz_gql_my_babies(void);
char *bz_gql_recent_events(const char *baby_id, int limit);
/** `code` NULL asks for a fresh code; a code asks this server to take over that code (redirect). */
char *bz_gql_request_device_code(const char *code);
/** `with_web_url` false for servers that predate redirects (they reject the webUrl field). */
char *bz_gql_poll_device_code(const char *code, bool with_web_url);
char *bz_gql_confirm_redirect(const char *code);
char *bz_gql_refresh_token(const char *refresh_token);

/** logEvent with the client's id, start, end (if any) and `<type>Meta`. */
char *bz_gql_log_event(const bz_event_t *event, const char *baby_id);
/** updateEvent carrying only the fields in `changed` (BZ_CHANGED_*), from `event`. */
char *bz_gql_update_event(const bz_event_t *event, unsigned changed);
char *bz_gql_delete_event(const char *id);

enum { BZ_CHANGED_STARTED = 1, BZ_CHANGED_ENDED = 2, BZ_CHANGED_META = 4 };

/* ── Replies ──────────────────────────────────────────────── */

typedef enum {
    BZ_REPLY_OK,
    /** The server understood and refused (REFUSED, BAD_USER_INPUT, parse/validation): do not resend. */
    BZ_REPLY_REFUSED,
    /** Not signed in, or the access token expired: refresh and retry. */
    BZ_REPLY_UNAUTHENTICATED,
    /** No usable answer (server error, garbage, HTTP 5xx): try again later. */
    BZ_REPLY_TRANSIENT,
} bz_reply_kind_t;

typedef struct {
    bz_reply_kind_t kind;
    char code[40];     /* extensions.code of the first error, if any */
    char message[120]; /* message of the first error, if any */
} bz_reply_t;

/** Classify a reply from its HTTP status and body (gql-request.ts rules). */
bz_reply_t bz_gql_classify(int http_status, const char *body);

typedef struct {
    char id[BZ_ID_LEN];
    char name[64];
} bz_baby_t;

int bz_parse_babies(const char *body, bz_baby_t *out, int max);
/** recentEvents, newest first as the server sends them. Returns the count, -1 if malformed. */
int bz_parse_events(const char *body, const char *field, bz_event_t *out, int max);
/** One event (logEvent/updateEvent result). */
bool bz_parse_event(const char *body, const char *field, bz_event_t *out);
/** One event object: `bz_parse_event` without the envelope. */
struct cJSON;
bool bz_event_from_json(const struct cJSON *item, bz_event_t *out);

typedef enum { BZ_POLL_PENDING, BZ_POLL_APPROVED, BZ_POLL_EXPIRED, BZ_POLL_REDIRECTED, BZ_POLL_UNKNOWN } bz_poll_status_t;

typedef struct {
    bz_poll_status_t status;
    char token[1024];
    char refresh[1024];
    char web_url[160];
} bz_poll_t;

bool bz_parse_poll(const char *body, bz_poll_t *out);
/** requestDeviceCode { code }. */
bool bz_parse_device_code(const char *body, char *code, size_t len);
bool bz_parse_refresh(const char *body, char *token, size_t token_len, char *refresh, size_t refresh_len);
/** /.well-known/config { apiUrl }. */
bool bz_parse_config(const char *body, char *api_url, size_t len);

/** Whether an error says the server does not take a `code` argument (a server older than redirects). */
bool bz_reply_is_unknown_code_arg(const bz_reply_t *reply);
/** Whether an error says the server has no `webUrl` field on the poll payload. */
bool bz_reply_is_unknown_web_url(const bz_reply_t *reply);
