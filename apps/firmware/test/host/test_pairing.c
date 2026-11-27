#include <stdlib.h>
#include <string.h>

#include "bz_pairing.h"
#include "check.h"

static const char *CONFIG_A = "{\"apiUrl\":\"https://api.bubsie.app/graphql\"}";
static const char *CONFIG_W = "{\"apiUrl\":\"http://192.168.1.20:4000/graphql\"}";
static const char *CODE = "{\"data\":{\"requestDeviceCode\":{\"code\":\"ABCD2345\",\"expiresAt\":\"x\"}}}";
static const char *PENDING = "{\"data\":{\"pollDeviceCode\":{\"status\":\"pending\",\"token\":null,\"refreshToken\":null,\"webUrl\":null}}}";
static const char *APPROVED = "{\"data\":{\"pollDeviceCode\":{\"status\":\"approved\",\"token\":\"T\",\"refreshToken\":\"R\"}}}";
static const char *REDIRECTED = "{\"data\":{\"pollDeviceCode\":{\"status\":\"redirected\",\"webUrl\":\"http://192.168.1.20:3000/\"}}}";

static void step(bz_pairing_t *p, bz_act_kind_t kind, const char *url, const char *must_contain, int status, const char *reply)
{
    bz_pair_act_t act = bz_pair_next(p);
    CHECK_INT(act.kind, kind);
    CHECK_STR(act.url, url);
    if (must_contain) CHECK(act.body && strstr(act.body, must_contain));
    free(act.body);
    bz_pair_on_reply(p, status, reply);
}

TEST(test_pairing_approve)
{
    bz_pairing_t p;
    bz_pair_start(&p, "https://bubsie.app/", "");
    step(&p, BZ_ACT_FETCH_CONFIG, "https://bubsie.app/.well-known/config", NULL, 200, CONFIG_A);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "requestDeviceCode {", 200, CODE);
    CHECK_INT(p.state, BZ_PAIR_POLL);
    char shown[16], url[200];
    bz_pair_format_code(p.code, shown, sizeof shown);
    CHECK_STR(shown, "ABCD-2345");
    bz_pair_approve_url(&p, url, sizeof url);
    CHECK_STR(url, "https://bubsie.app/auth/approve?code=ABCD2345");
    bz_pair_act_t wait = bz_pair_next(&p);
    CHECK_INT(wait.delay_ms, BZ_PAIR_POLL_MS);
    free(wait.body);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "\"ABCD2345\"", 200, PENDING);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "pollDeviceCode", 0, NULL);
    CHECK_INT(p.state, BZ_PAIR_POLL);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "pollDeviceCode", 200, APPROVED);
    CHECK_INT(p.state, BZ_PAIR_DONE);
    CHECK_STR(p.token, "T");
    CHECK_STR(p.refresh, "R");
    CHECK(!p.server_changed);
    CHECK_INT(bz_pair_next(&p).kind, BZ_ACT_DONE);
}

TEST(test_pairing_expired_and_old_server)
{
    bz_pairing_t p;
    bz_pair_start(&p, "https://bubsie.app", "https://api.bubsie.app/graphql");
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "requestDeviceCode", 200, CODE);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "webUrl", 400,
         "{\"errors\":[{\"message\":\"Cannot query field \\\"webUrl\\\" on type \\\"DeviceCodePollPayload\\\".\",\"extensions\":{\"code\":\"GRAPHQL_VALIDATION_FAILED\"}}]}");
    bz_pair_act_t act = bz_pair_next(&p);
    CHECK(strstr(act.body, "webUrl") == NULL);
    free(act.body);
    bz_pair_on_reply(&p, 200, "{\"data\":{\"pollDeviceCode\":{\"status\":\"expired\",\"token\":null,\"refreshToken\":null}}}");
    CHECK_INT(p.state, BZ_PAIR_REQUEST_CODE);
    CHECK(strstr(p.notice, "expired") != NULL);
}

TEST(test_pairing_redirect)
{
    bz_pairing_t p;
    bz_pair_start(&p, "https://bubsie.app", "https://api.bubsie.app/graphql");
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, CODE);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "pollDeviceCode", 200, REDIRECTED);
    CHECK_INT(p.state, BZ_PAIR_REDIRECT_CONFIG);
    step(&p, BZ_ACT_FETCH_CONFIG, "http://192.168.1.20:3000/.well-known/config", NULL, 200, CONFIG_W);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "\"code\":\"ABCD2345\"", 200, CODE);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "confirmDeviceCodeRedirect", 200,
         "{\"data\":{\"confirmDeviceCodeRedirect\":true}}");
    CHECK(p.server_changed);
    CHECK_STR(p.server.web, "http://192.168.1.20:3000");
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "\"ABCD2345\"", 200, APPROVED);
    CHECK_INT(p.state, BZ_PAIR_DONE);
}

TEST(test_pairing_redirect_refused)
{
    const char *refusals[] = {
        "{\"errors\":[{\"message\":\"taken\",\"extensions\":{\"code\":\"CODE_TAKEN\"}}]}",
        "{\"errors\":[{\"message\":\"Unknown argument \\\"code\\\" on field \\\"Mutation.requestDeviceCode\\\".\",\"extensions\":{\"code\":\"GRAPHQL_VALIDATION_FAILED\"}}]}",
    };
    for (int i = 0; i < 2; i++) {
        bz_pairing_t p;
        bz_pair_start(&p, "https://bubsie.app", "https://api.bubsie.app/graphql");
        step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, CODE);
        step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, REDIRECTED);
        step(&p, BZ_ACT_FETCH_CONFIG, "http://192.168.1.20:3000/.well-known/config", NULL, 200, CONFIG_W);
        step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", NULL, i ? 400 : 200, refusals[i]);
        CHECK_INT(p.state, BZ_PAIR_REQUEST_CODE);
        CHECK_STR(p.server.web, "https://bubsie.app");
        CHECK(strstr(p.notice, "192.168.1.20:3000") != NULL);
        CHECK(strstr(p.notice, "Pair with bubsie.app instead.") != NULL);
        bz_pair_act_t act = bz_pair_next(&p);
        CHECK_STR(act.url, "https://api.bubsie.app/graphql");
        CHECK(strstr(act.body, "requestDeviceCode {") != NULL);
        free(act.body);
    }
}

TEST(test_pairing_redirect_unreachable)
{
    bz_pairing_t p;
    bz_pair_start(&p, "https://bubsie.app", "https://api.bubsie.app/graphql");
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, CODE);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, REDIRECTED);
    for (int i = 0; i < 3; i++) step(&p, BZ_ACT_FETCH_CONFIG, "http://192.168.1.20:3000/.well-known/config", NULL, 0, NULL);
    CHECK_INT(p.state, BZ_PAIR_REQUEST_CODE);
    CHECK(strstr(p.notice, "Couldn't reach 192.168.1.20:3000.") != NULL);
}

TEST(test_url_host)
{
    char host[64];
    bz_url_host("https://bubsie.app", host, sizeof host);
    CHECK_STR(host, "bubsie.app");
    bz_url_host("http://192.168.1.20:3000/path?x", host, sizeof host);
    CHECK_STR(host, "192.168.1.20:3000");
}

static void to_claim(bz_pairing_t *p)
{
    bz_pair_start(p, "https://bubsie.app", "https://api.bubsie.app/graphql");
    step(p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, CODE);
    step(p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, REDIRECTED);
    step(p, BZ_ACT_FETCH_CONFIG, "http://192.168.1.20:3000/.well-known/config", NULL, 200, CONFIG_W);
}

TEST(test_pairing_redirect_confirm_false)
{
    bz_pairing_t p;
    to_claim(&p);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "\"code\":\"ABCD2345\"", 200, CODE);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "confirmDeviceCodeRedirect", 200,
         "{\"data\":{\"confirmDeviceCodeRedirect\":false}}");
    CHECK(!p.server_changed);
    CHECK_INT(p.state, BZ_PAIR_REQUEST_CODE);
    CHECK_STR(p.server.web, "https://bubsie.app");
    CHECK(strstr(p.notice, "Pair with bubsie.app instead.") != NULL);
    bz_pair_act_t act = bz_pair_next(&p);
    CHECK_STR(act.url, "https://api.bubsie.app/graphql");
    CHECK(strstr(act.body, "requestDeviceCode {") != NULL);
    free(act.body);

    to_claim(&p);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", NULL, 200, CODE);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", NULL, 200, "{\"data\":{\"confirmDeviceCodeRedirect\":null}}");
    CHECK(!p.server_changed);
    CHECK_STR(p.server.web, "https://bubsie.app");
}

static const char *TAKEN = "{\"errors\":[{\"message\":\"taken\",\"extensions\":{\"code\":\"CODE_TAKEN\"}}]}";

TEST(test_pairing_redirect_claim_reply_lost)
{
    bz_pairing_t p;
    to_claim(&p);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "\"code\":\"ABCD2345\"", 0, NULL);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "\"code\":\"ABCD2345\"", 200, TAKEN);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "pollDeviceCode", 200, PENDING);
    CHECK_INT(p.state, BZ_PAIR_REDIRECT_CONFIRM);
    step(&p, BZ_ACT_GRAPHQL, "https://api.bubsie.app/graphql", "confirmDeviceCodeRedirect", 200,
         "{\"data\":{\"confirmDeviceCodeRedirect\":true}}");
    CHECK(p.server_changed);
    CHECK_STR(p.server.web, "http://192.168.1.20:3000");

    to_claim(&p);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", NULL, 0, NULL);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", NULL, 200, TAKEN);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "pollDeviceCode", 200,
         "{\"data\":{\"pollDeviceCode\":{\"status\":\"expired\",\"token\":null,\"refreshToken\":null,\"webUrl\":null}}}");
    CHECK_INT(p.state, BZ_PAIR_REQUEST_CODE);
    CHECK_STR(p.server.web, "https://bubsie.app");
    CHECK(strstr(p.notice, "already has a device using this code") != NULL);

    to_claim(&p);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", NULL, 0, NULL);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", NULL, 200, TAKEN);
    for (int i = 0; i < 3; i++) step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", "pollDeviceCode", 0, NULL);
    CHECK_INT(p.state, BZ_PAIR_REQUEST_CODE);
    CHECK_STR(p.server.web, "https://bubsie.app");

    to_claim(&p);
    step(&p, BZ_ACT_GRAPHQL, "http://192.168.1.20:4000/graphql", NULL, 200, TAKEN);
    CHECK_INT(p.state, BZ_PAIR_REQUEST_CODE);
}
