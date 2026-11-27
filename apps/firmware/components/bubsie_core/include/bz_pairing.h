// Pairing by device code, as a state machine with no I/O. The worker asks `bz_pair_next` what to do,
// does it, and reports the result with one of the `bz_pair_on_*` calls.
//
//   requestDeviceCode -> code C, shown as a QR of <web>/auth/approve?code=C and as XXXX-XXXX
//   pollDeviceCode(C) every 2.5 s:
//     approved   -> tokens: done
//     expired    -> a new code
//     redirected -> webUrl W: fetch W/.well-known/config, requestDeviceCode(code: C) on W,
//                   confirmDeviceCodeRedirect(C) on the original, web_url = W, poll C on W.
//                   If W refuses the code (CODE_TAKEN, or it does not know the `code` argument)
//                   the device says so and starts again on the original server.
#pragma once

#include <stdbool.h>

#include "bz_gql.h"

#define BZ_PAIR_POLL_MS 2500
#define BZ_URL_LEN 160

typedef enum {
    BZ_PAIR_FETCH_CONFIG,     /* the API URL of the server pairing happens on */
    BZ_PAIR_REQUEST_CODE,     /* a fresh code from that server */
    BZ_PAIR_POLL,             /* show the code; poll */
    BZ_PAIR_REDIRECT_CONFIG,  /* W's API URL */
    BZ_PAIR_REDIRECT_CLAIM,   /* requestDeviceCode(code: C) on W */
    BZ_PAIR_REDIRECT_CONFIRM, /* confirmDeviceCodeRedirect(C) on the original */
    BZ_PAIR_DONE,
} bz_pair_state_t;

typedef struct {
    char web[BZ_URL_LEN];
    char api[BZ_URL_LEN];
} bz_server_t;

typedef struct {
    bz_pair_state_t state;
    bz_server_t server; /* where the device is pairing (and polling) */
    bz_server_t origin; /* during a redirect: the server that redirected */
    bz_server_t target; /* during a redirect: W */
    char code[16];
    /* Something to tell the person, shown under the code until the next change. */
    char notice[120];
    /* The server answers pollDeviceCode with a webUrl field (false for servers before redirects). */
    bool poll_web_url;
    /* Attempts at the current step that failed for want of an answer. */
    int failures;
    /* The server to remember once paired (changes on a redirect). */
    bool server_changed;
    char token[1024];
    char refresh[1024];
} bz_pairing_t;

typedef enum {
    BZ_ACT_FETCH_CONFIG, /* GET url */
    BZ_ACT_GRAPHQL,      /* POST body to url */
    BZ_ACT_DONE,
} bz_act_kind_t;

typedef struct {
    bz_act_kind_t kind;
    char url[BZ_URL_LEN + 32];
    char *body; /* BZ_ACT_GRAPHQL: owned by the caller once returned */
    int delay_ms; /* wait this long before doing it */
} bz_pair_act_t;

/** Start pairing with the server at `web_url`; `api_url` may be "" (fetched first). */
void bz_pair_start(bz_pairing_t *p, const char *web_url, const char *api_url);
bz_pair_act_t bz_pair_next(const bz_pairing_t *p);

/** The reply to the last action: HTTP status (0 when nothing answered) and body. */
void bz_pair_on_reply(bz_pairing_t *p, int http_status, const char *body);

/** "ABCD-EFGH" */
void bz_pair_format_code(const char *code, char *out, size_t len);
/** "<web>/auth/approve?code=ABCDEFGH" */
void bz_pair_approve_url(const bz_pairing_t *p, char *out, size_t len);
/** The host of a URL, for "Server: <host>": "bubsie.app", "192.168.1.20:3000". */
void bz_url_host(const char *url, char *out, size_t len);
