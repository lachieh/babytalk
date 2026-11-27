#include <stdlib.h>
#include <string.h>

#include "bz_gql.h"
#include "bz_time.h"
#include "cJSON.h"
#include "check.h"

static cJSON *vars_of(char *body)
{
    cJSON *root = cJSON_Parse(body);
    free(body);
    return root;
}

static const char *var_str(cJSON *root, const char *key)
{
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(root, "variables"), key);
    return cJSON_IsString(item) ? item->valuestring : NULL;
}

static const char *query_of(cJSON *root) { return cJSON_GetObjectItemCaseSensitive(root, "query")->valuestring; }

TEST(test_gql_log_event)
{
    bz_event_t event = {.id = "6f1c2b8e-1111-4222-8333-944455556666", .type = BZ_FEED};
    event.started = bz_parse_iso("2026-11-27T10:00:00.000Z");
    strcpy(event.meta, "{\"method\":\"breast\",\"side\":\"left\",\"syncedBy\":\"x\"}");
    cJSON *root = vars_of(bz_gql_log_event(&event, "baby-1"));
    CHECK_STR(var_str(root, "id"), event.id);
    CHECK_STR(var_str(root, "babyId"), "baby-1");
    CHECK_STR(var_str(root, "type"), "feed");
    CHECK_STR(var_str(root, "startedAt"), "2026-11-27T10:00:00.000Z");
    CHECK(var_str(root, "endedAt") == NULL); // a running timer has no end
    CHECK(strstr(query_of(root), "$meta: FeedMetadataInput") != NULL);
    CHECK(strstr(query_of(root), "feedMeta: $meta") != NULL);
    cJSON *meta = cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(root, "variables"), "meta");
    CHECK_STR(cJSON_GetObjectItemCaseSensitive(meta, "side")->valuestring, "left");
    // Fields the API's input type does not declare are not sent (they would fail validation).
    CHECK(cJSON_GetObjectItemCaseSensitive(meta, "syncedBy") == NULL);
    cJSON_Delete(root);

    event.type = BZ_DIAPER;
    event.ended = event.started;
    strcpy(event.meta, "{\"wet\":true,\"soiled\":false}");
    root = vars_of(bz_gql_log_event(&event, "baby-1"));
    CHECK_STR(var_str(root, "endedAt"), "2026-11-27T10:00:00.000Z");
    CHECK(strstr(query_of(root), "diaperMeta: $meta") != NULL);
    cJSON_Delete(root);
}

TEST(test_gql_update_event)
{
    bz_event_t event = {.id = "e1", .type = BZ_PUMP, .started = 1000, .ended = 61000};
    strcpy(event.meta, "{\"side\":\"both\",\"amountMl\":90}");
    cJSON *root = vars_of(bz_gql_update_event(&event, BZ_CHANGED_ENDED));
    CHECK_STR(var_str(root, "endedAt"), "1970-01-01T00:01:01.000Z");
    CHECK(var_str(root, "startedAt") == NULL);
    CHECK(strstr(query_of(root), "Meta") == NULL);
    cJSON_Delete(root);

    root = vars_of(bz_gql_update_event(&event, BZ_CHANGED_META));
    CHECK(strstr(query_of(root), "pumpMeta: $meta") != NULL);
    CHECK(strstr(query_of(root), "$endedAt") == NULL);
    cJSON_Delete(root);

    root = vars_of(bz_gql_delete_event("e1"));
    CHECK_STR(var_str(root, "id"), "e1");
    cJSON_Delete(root);
}

TEST(test_gql_classify)
{
    bz_reply_t r = bz_gql_classify(200, "{\"data\":{\"x\":1}}");
    CHECK_INT(r.kind, BZ_REPLY_OK);
    r = bz_gql_classify(200, "{\"errors\":[{\"message\":\"Not authenticated\"}],\"data\":null}");
    CHECK_INT(r.kind, BZ_REPLY_UNAUTHENTICATED);
    r = bz_gql_classify(401, "");
    CHECK_INT(r.kind, BZ_REPLY_UNAUTHENTICATED);
    r = bz_gql_classify(200, "{\"errors\":[{\"message\":\"no\",\"extensions\":{\"code\":\"REFUSED\"}}]}");
    CHECK_INT(r.kind, BZ_REPLY_REFUSED);
    CHECK_STR(r.code, "REFUSED");
    r = bz_gql_classify(200, "{\"errors\":[{\"message\":\"taken\",\"extensions\":{\"code\":\"CODE_TAKEN\"}}]}");
    CHECK_INT(r.kind, BZ_REPLY_TRANSIENT);
    CHECK_STR(r.code, "CODE_TAKEN");
    r = bz_gql_classify(502, "<html>bad gateway</html>");
    CHECK_INT(r.kind, BZ_REPLY_TRANSIENT);
    r = bz_gql_classify(400, "{\"errors\":[{\"message\":\"Unknown argument \\\"code\\\" on field \\\"Mutation.requestDeviceCode\\\".\","
                             "\"extensions\":{\"code\":\"GRAPHQL_VALIDATION_FAILED\"}}]}");
    CHECK(bz_reply_is_unknown_code_arg(&r));
    CHECK(!bz_reply_is_unknown_web_url(&r));
    r = bz_gql_classify(400, "{\"errors\":[{\"message\":\"Cannot query field \\\"webUrl\\\" on type \\\"DeviceCodePollPayload\\\".\","
                             "\"extensions\":{\"code\":\"GRAPHQL_VALIDATION_FAILED\"}}]}");
    CHECK(bz_reply_is_unknown_web_url(&r));
}

TEST(test_gql_parse)
{
    bz_baby_t babies[4];
    CHECK_INT(bz_parse_babies("{\"data\":{\"myBabies\":[{\"id\":\"b1\",\"name\":\"Ada\"},{\"id\":\"b2\",\"name\":\"Zoë\"}]}}", babies, 4), 2);
    CHECK_STR(babies[1].name, "Zoë");
    CHECK_INT(bz_parse_babies("{\"data\":null}", babies, 4), -1);

    bz_event_t events[4];
    const char *body = "{\"data\":{\"recentEvents\":["
                       "{\"id\":\"a\",\"type\":\"sleep\",\"startedAt\":\"2026-11-27T09:00:00.000Z\",\"endedAt\":null,\"metadata\":\"{\\\"location\\\":\\\"crib\\\"}\"},"
                       "{\"id\":\"g\",\"type\":\"growth\",\"startedAt\":\"2026-11-27T08:00:00.000Z\",\"endedAt\":null,\"metadata\":\"{}\"},"
                       "{\"id\":\"b\",\"type\":\"feed\",\"startedAt\":\"2026-11-27T07:00:00.000Z\",\"endedAt\":\"2026-11-27T07:20:00.000Z\",\"metadata\":\"{}\"}]}}";
    CHECK_INT(bz_parse_events(body, "recentEvents", events, 4), 2);
    CHECK_STR(events[0].id, "a");
    CHECK_INT(events[0].ended, BZ_RUNNING);
    CHECK_STR(events[0].meta, "{\"location\":\"crib\"}");
    CHECK_INT(events[1].ended - events[1].started, 20 * 60000);

    bz_poll_t poll;
    CHECK(bz_parse_poll("{\"data\":{\"pollDeviceCode\":{\"status\":\"approved\",\"token\":\"t\",\"refreshToken\":\"r\"}}}", &poll));
    CHECK_INT(poll.status, BZ_POLL_APPROVED);
    CHECK(bz_parse_poll("{\"data\":{\"pollDeviceCode\":{\"status\":\"approved\",\"token\":null,\"refreshToken\":null}}}", &poll));
    CHECK_INT(poll.status, BZ_POLL_UNKNOWN);
    CHECK(bz_parse_poll("{\"data\":{\"pollDeviceCode\":{\"status\":\"redirected\",\"webUrl\":\"https://home.example\"}}}", &poll));
    CHECK_INT(poll.status, BZ_POLL_REDIRECTED);
    CHECK_STR(poll.web_url, "https://home.example");

    char api[100];
    CHECK(bz_parse_config("{\"apiUrl\":\"https://api.bubsie.app/graphql\",\"sourceUrl\":\"x\"}", api, sizeof api));
    CHECK_STR(api, "https://api.bubsie.app/graphql");
    CHECK(!bz_parse_config("{\"apiUrl\":\"/graphql\"}", api, sizeof api));
    char token[16], refresh[16];
    CHECK(bz_parse_refresh("{\"data\":{\"refreshToken\":{\"token\":\"t2\",\"refreshToken\":\"r2\"}}}", token, 16, refresh, 16));
    CHECK_STR(refresh, "r2");
    CHECK(!bz_parse_refresh("{\"data\":{\"refreshToken\":null}}", token, 16, refresh, 16));
}
