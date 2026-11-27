#pragma once

#include <stdbool.h>

#include "bz_gql.h"

#define BZ_PAIR_POLL_MS 2500
#define BZ_URL_LEN 160

typedef enum {
    BZ_PAIR_FETCH_CONFIG,
    BZ_PAIR_REQUEST_CODE,
    BZ_PAIR_POLL,
    BZ_PAIR_REDIRECT_CONFIG,
    BZ_PAIR_REDIRECT_CLAIM,
    BZ_PAIR_REDIRECT_CHECK,
    BZ_PAIR_REDIRECT_CONFIRM,
    BZ_PAIR_DONE,
} bz_pair_state_t;

typedef struct {
    char web[BZ_URL_LEN];
    char api[BZ_URL_LEN];
} bz_server_t;

typedef struct {
    bz_pair_state_t state;
    bz_server_t server;
    bz_server_t origin;
    bz_server_t target;
    char code[16];
    char notice[120];
    bool poll_web_url;
    int failures;
    bool claim_unanswered;
    bool server_changed;
    char token[1024];
    char refresh[1024];
} bz_pairing_t;

typedef enum {
    BZ_ACT_FETCH_CONFIG,
    BZ_ACT_GRAPHQL,
    BZ_ACT_DONE,
} bz_act_kind_t;

typedef struct {
    bz_act_kind_t kind;
    char url[BZ_URL_LEN + 32];
    char *body;
    int delay_ms;
} bz_pair_act_t;

void bz_pair_start(bz_pairing_t *p, const char *web_url, const char *api_url);
bz_pair_act_t bz_pair_next(const bz_pairing_t *p);

void bz_pair_on_reply(bz_pairing_t *p, int http_status, const char *body);

void bz_pair_format_code(const char *code, char *out, size_t len);
void bz_pair_approve_url(const bz_pairing_t *p, char *out, size_t len);
void bz_url_host(const char *url, char *out, size_t len);
