#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "bz_event.h"

char *bz_gql_my_babies(void);
char *bz_gql_recent_events(const char *baby_id, int limit);
char *bz_gql_request_device_code(const char *code);
char *bz_gql_poll_device_code(const char *code, bool with_web_url);
char *bz_gql_confirm_redirect(const char *code);
char *bz_gql_refresh_token(const char *refresh_token);

char *bz_gql_log_event(const bz_event_t *event, const char *baby_id);
char *bz_gql_update_event(const bz_event_t *event, unsigned changed);
char *bz_gql_delete_event(const char *id);

enum { BZ_CHANGED_STARTED = 1, BZ_CHANGED_ENDED = 2, BZ_CHANGED_META = 4 };

typedef enum {
    BZ_REPLY_OK,
    BZ_REPLY_REFUSED,
    BZ_REPLY_UNAUTHENTICATED,
    BZ_REPLY_TRANSIENT,
} bz_reply_kind_t;

typedef struct {
    bz_reply_kind_t kind;
    char code[40];
    char message[120];
} bz_reply_t;

bz_reply_t bz_gql_classify(int http_status, const char *body);

typedef struct {
    char id[BZ_ID_LEN];
    char name[64];
} bz_baby_t;

int bz_parse_babies(const char *body, bz_baby_t *out, int max);
int bz_parse_events(const char *body, const char *field, bz_event_t *out, int max);
bool bz_parse_event(const char *body, const char *field, bz_event_t *out);
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
bool bz_parse_device_code(const char *body, char *code, size_t len);
bool bz_parse_confirm_redirect(const char *body);
bool bz_parse_refresh(const char *body, char *token, size_t token_len, char *refresh, size_t refresh_len);
bool bz_parse_config(const char *body, char *api_url, size_t len);

bool bz_reply_is_unknown_code_arg(const bz_reply_t *reply);
bool bz_reply_is_unknown_web_url(const bz_reply_t *reply);
