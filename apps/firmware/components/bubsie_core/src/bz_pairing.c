#include "bz_pairing.h"

#include <stdio.h>
#include <string.h>

#define GIVE_UP_AFTER 3

static void set_server(bz_server_t *server, const char *web, const char *api)
{
    snprintf(server->web, sizeof server->web, "%s", web ? web : "");
    size_t len = strlen(server->web);
    while (len > 0 && server->web[len - 1] == '/') server->web[--len] = '\0';
    snprintf(server->api, sizeof server->api, "%s", api ? api : "");
}

void bz_pair_start(bz_pairing_t *p, const char *web_url, const char *api_url)
{
    memset(p, 0, sizeof *p);
    set_server(&p->server, web_url, api_url);
    p->poll_web_url = true;
    p->state = p->server.api[0] ? BZ_PAIR_REQUEST_CODE : BZ_PAIR_FETCH_CONFIG;
}

static int backoff_ms(int failures)
{
    if (failures <= 0) return 0;
    int ms = 1000 << (failures < 5 ? failures : 5);
    return ms > 30000 ? 30000 : ms;
}

bz_pair_act_t bz_pair_next(const bz_pairing_t *p)
{
    bz_pair_act_t act = {.kind = BZ_ACT_GRAPHQL, .delay_ms = backoff_ms(p->failures)};
    switch (p->state) {
    case BZ_PAIR_FETCH_CONFIG:
        act.kind = BZ_ACT_FETCH_CONFIG;
        snprintf(act.url, sizeof act.url, "%s/.well-known/config", p->server.web);
        break;
    case BZ_PAIR_REQUEST_CODE:
        snprintf(act.url, sizeof act.url, "%s", p->server.api);
        act.body = bz_gql_request_device_code(NULL);
        break;
    case BZ_PAIR_POLL:
        snprintf(act.url, sizeof act.url, "%s", p->server.api);
        act.body = bz_gql_poll_device_code(p->code, p->poll_web_url);
        if (act.delay_ms < BZ_PAIR_POLL_MS) act.delay_ms = BZ_PAIR_POLL_MS;
        break;
    case BZ_PAIR_REDIRECT_CONFIG:
        act.kind = BZ_ACT_FETCH_CONFIG;
        snprintf(act.url, sizeof act.url, "%s/.well-known/config", p->target.web);
        break;
    case BZ_PAIR_REDIRECT_CLAIM:
        snprintf(act.url, sizeof act.url, "%s", p->target.api);
        act.body = bz_gql_request_device_code(p->code);
        break;
    case BZ_PAIR_REDIRECT_CHECK:
        snprintf(act.url, sizeof act.url, "%s", p->target.api);
        act.body = bz_gql_poll_device_code(p->code, false);
        break;
    case BZ_PAIR_REDIRECT_CONFIRM:
        snprintf(act.url, sizeof act.url, "%s", p->origin.api);
        act.body = bz_gql_confirm_redirect(p->code);
        break;
    case BZ_PAIR_DONE:
        act.kind = BZ_ACT_DONE;
        act.delay_ms = 0;
        break;
    }
    return act;
}

static void go(bz_pairing_t *p, bz_pair_state_t state)
{
    p->state = state;
    p->failures = 0;
}

static void fall_back(bz_pairing_t *p, const char *why)
{
    char host[BZ_URL_LEN];
    bz_url_host(p->origin.web, host, sizeof host);
    int n = snprintf(p->notice, sizeof p->notice, "%s Pair with %s instead.", why, host);
    if (n < 0 || (size_t)n >= sizeof p->notice) snprintf(p->notice, sizeof p->notice, "%s", why);
    p->server = p->origin;
    p->code[0] = '\0';
    p->poll_web_url = true;
    p->claim_unanswered = false;
    go(p, BZ_PAIR_REQUEST_CODE);
}

static void on_config(bz_pairing_t *p, int status, const char *body, bz_server_t *server, bool redirect)
{
    char api[BZ_URL_LEN];
    if (status == 200 && bz_parse_config(body, api, sizeof api)) {
        snprintf(server->api, sizeof server->api, "%s", api);
        go(p, redirect ? BZ_PAIR_REDIRECT_CLAIM : BZ_PAIR_REQUEST_CODE);
        if (!redirect) p->notice[0] = '\0';
        return;
    }
    p->failures++;
    char host[BZ_URL_LEN];
    bz_url_host(server->web, host, sizeof host);
    if (redirect && p->failures >= GIVE_UP_AFTER) {
        char why[BZ_URL_LEN + 32];
        snprintf(why, sizeof why, "Couldn't reach %s.", host);
        fall_back(p, why);
    } else if (!redirect && p->failures >= 2) {
        int n = snprintf(p->notice, sizeof p->notice, "Can't reach %s yet. Still trying.", host);
        if (n < 0 || (size_t)n >= sizeof p->notice) snprintf(p->notice, sizeof p->notice, "Can't reach the server yet. Still trying.");
    }
}

static void on_poll(bz_pairing_t *p, const bz_reply_t *reply, const char *body)
{
    if (bz_reply_is_unknown_web_url(reply)) {
        // A server from before redirects: ask without the field it does not have.
        p->poll_web_url = false;
        return;
    }
    bz_poll_t poll;
    if (reply->kind != BZ_REPLY_OK || !bz_parse_poll(body, &poll) || poll.status == BZ_POLL_UNKNOWN) {
        p->failures++;
        return;
    }
    p->failures = 0;
    switch (poll.status) {
    case BZ_POLL_APPROVED:
        snprintf(p->token, sizeof p->token, "%s", poll.token);
        snprintf(p->refresh, sizeof p->refresh, "%s", poll.refresh);
        go(p, BZ_PAIR_DONE);
        break;
    case BZ_POLL_EXPIRED:
        p->code[0] = '\0';
        snprintf(p->notice, sizeof p->notice, "That code expired, so here is a new one.");
        go(p, BZ_PAIR_REQUEST_CODE);
        break;
    case BZ_POLL_REDIRECTED:
        p->origin = p->server;
        p->claim_unanswered = false;
        set_server(&p->target, poll.web_url, "");
        p->notice[0] = '\0';
        go(p, BZ_PAIR_REDIRECT_CONFIG);
        break;
    default:
        break;
    }
}

void bz_pair_on_reply(bz_pairing_t *p, int status, const char *body)
{
    if (p->state == BZ_PAIR_FETCH_CONFIG) {
        on_config(p, status, body, &p->server, false);
        return;
    }
    if (p->state == BZ_PAIR_REDIRECT_CONFIG) {
        on_config(p, status, body, &p->target, true);
        return;
    }
    if (p->state == BZ_PAIR_DONE) return;

    bz_reply_t reply = status == 0 ? (bz_reply_t){.kind = BZ_REPLY_TRANSIENT} : bz_gql_classify(status, body);
    char code[16];
    switch (p->state) {
    case BZ_PAIR_REQUEST_CODE:
        if (reply.kind == BZ_REPLY_OK && bz_parse_device_code(body, code, sizeof code)) {
            snprintf(p->code, sizeof p->code, "%s", code);
            go(p, BZ_PAIR_POLL);
        } else {
            p->failures++;
        }
        break;
    case BZ_PAIR_POLL:
        on_poll(p, &reply, body);
        break;
    case BZ_PAIR_REDIRECT_CLAIM: {
        char host[BZ_URL_LEN];
        bz_url_host(p->target.web, host, sizeof host);
        char why[BZ_URL_LEN + 64];
        if (reply.kind == BZ_REPLY_OK && bz_parse_device_code(body, code, sizeof code)) {
            go(p, BZ_PAIR_REDIRECT_CONFIRM);
        } else if (strcmp(reply.code, "CODE_TAKEN") == 0 && p->claim_unanswered) {
            go(p, BZ_PAIR_REDIRECT_CHECK);
        } else if (strcmp(reply.code, "CODE_TAKEN") == 0) {
            snprintf(why, sizeof why, "%s already has a device using this code.", host);
            fall_back(p, why);
        } else if (bz_reply_is_unknown_code_arg(&reply)) {
            snprintf(why, sizeof why, "%s can't take over pairing yet.", host);
            fall_back(p, why);
        } else if (reply.kind == BZ_REPLY_REFUSED || ++p->failures >= GIVE_UP_AFTER) {
            snprintf(why, sizeof why, "Couldn't move pairing to %s.", host);
            fall_back(p, why);
        } else {
            p->claim_unanswered = true;
        }
        break;
    }
    case BZ_PAIR_REDIRECT_CHECK: {
        bz_poll_t poll;
        bool answered = reply.kind == BZ_REPLY_OK && bz_parse_poll(body, &poll) && poll.status != BZ_POLL_UNKNOWN;
        if (answered && poll.status == BZ_POLL_PENDING) {
            go(p, BZ_PAIR_REDIRECT_CONFIRM);
        } else if (answered || reply.kind == BZ_REPLY_REFUSED || ++p->failures >= GIVE_UP_AFTER) {
            char host[BZ_URL_LEN];
            bz_url_host(p->target.web, host, sizeof host);
            char why[BZ_URL_LEN + 64];
            snprintf(why, sizeof why, "%s already has a device using this code.", host);
            fall_back(p, why);
        }
        break;
    }
    case BZ_PAIR_REDIRECT_CONFIRM:
        if (reply.kind == BZ_REPLY_OK && bz_parse_confirm_redirect(body)) {
            p->server = p->target;
            p->server_changed = true;
            p->poll_web_url = true;
            go(p, BZ_PAIR_POLL);
        } else if (reply.kind == BZ_REPLY_OK || reply.kind == BZ_REPLY_REFUSED || ++p->failures >= GIVE_UP_AFTER) {
            fall_back(p, "The move to the new server didn't go through.");
        }
        break;
    default:
        break;
    }
}

void bz_pair_format_code(const char *code, char *out, size_t len)
{
    if (strlen(code) == 8) {
        snprintf(out, len, "%.4s-%.4s", code, code + 4);
    } else {
        snprintf(out, len, "%s", code);
    }
}

void bz_pair_approve_url(const bz_pairing_t *p, char *out, size_t len)
{
    snprintf(out, len, "%s/auth/approve?code=%s", p->server.web, p->code);
}

void bz_url_host(const char *url, char *out, size_t len)
{
    const char *start = strstr(url, "://");
    start = start ? start + 3 : url;
    size_t n = strcspn(start, "/?#");
    snprintf(out, len, "%.*s", (int)n, start);
}
