#include "bz_gql.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bz_time.h"
#include "cJSON.h"

/* ── Requests ─────────────────────────────────────────────── */

static char *body(const char *query, cJSON *variables)
{
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "query", query);
    if (variables) cJSON_AddItemToObject(root, "variables", variables);
    char *text = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return text;
}

static const char *EVENT_FIELDS = "id type startedAt endedAt metadata";

char *bz_gql_my_babies(void) { return body("query { myBabies { id name } }", NULL); }

char *bz_gql_recent_events(const char *baby_id, int limit)
{
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "babyId", baby_id);
    cJSON_AddNumberToObject(vars, "limit", limit);
    char query[200];
    snprintf(query, sizeof query,
             "query RecentEvents($babyId: String!, $limit: Int) { recentEvents(babyId: $babyId, limit: $limit) { %s } }",
             EVENT_FIELDS);
    return body(query, vars);
}

char *bz_gql_request_device_code(const char *code)
{
    if (!code) return body("mutation { requestDeviceCode { code expiresAt } }", NULL);
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "code", code);
    return body("mutation RequestDeviceCode($code: String) { requestDeviceCode(code: $code) { code expiresAt } }", vars);
}

char *bz_gql_poll_device_code(const char *code, bool with_web_url)
{
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "code", code);
    return body(with_web_url
                    ? "mutation PollDeviceCode($code: String!) { pollDeviceCode(code: $code) { status token refreshToken webUrl } }"
                    : "mutation PollDeviceCode($code: String!) { pollDeviceCode(code: $code) { status token refreshToken } }",
                vars);
}

char *bz_gql_confirm_redirect(const char *code)
{
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "code", code);
    return body("mutation ConfirmDeviceCodeRedirect($code: String!) { confirmDeviceCodeRedirect(code: $code) }", vars);
}

char *bz_gql_refresh_token(const char *refresh_token)
{
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "refreshToken", refresh_token);
    return body("mutation RefreshToken($refreshToken: String!) { refreshToken(refreshToken: $refreshToken) { refreshToken token } }",
                vars);
}

static const char *META_TYPES[BZ_TYPE_COUNT] = {"FeedMetadataInput", "SleepMetadataInput", "DiaperMetadataInput",
                                                "PumpMetadataInput", "NoteMetadataInput"};

/* The metadata object as the API's input type takes it: only the fields that input declares. */
static cJSON *meta_input(const bz_event_t *event)
{
    static const char *const FIELDS[BZ_TYPE_COUNT][6] = {
        {"amountMl", "foodDesc", "method", "notes", "side", NULL},
        {"location", "notes", "quality", NULL},
        {"color", "notes", "soiled", "wet", NULL},
        {"amountMl", "notes", "side", NULL},
        {"text", NULL},
    };
    cJSON *source = cJSON_Parse(event->meta);
    cJSON *out = cJSON_CreateObject();
    if (event->type < BZ_TYPE_COUNT && cJSON_IsObject(source)) {
        for (int i = 0; FIELDS[event->type][i]; i++) {
            cJSON *item = cJSON_GetObjectItemCaseSensitive(source, FIELDS[event->type][i]);
            if (item && !cJSON_IsNull(item)) cJSON_AddItemToObject(out, FIELDS[event->type][i], cJSON_Duplicate(item, true));
        }
    }
    cJSON_Delete(source);
    return out;
}

char *bz_gql_log_event(const bz_event_t *event, const char *baby_id)
{
    const char *type = bz_type_name(event->type);
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "id", event->id);
    cJSON_AddStringToObject(vars, "babyId", baby_id);
    cJSON_AddStringToObject(vars, "type", type);
    char iso[25];
    bz_format_iso(event->started, iso);
    cJSON_AddStringToObject(vars, "startedAt", iso);
    if (event->ended != BZ_RUNNING) {
        bz_format_iso(event->ended, iso);
        cJSON_AddStringToObject(vars, "endedAt", iso);
    }
    cJSON_AddItemToObject(vars, "meta", meta_input(event));
    char query[420];
    snprintf(query, sizeof query,
             "mutation LogEvent($id: String, $babyId: String!, $type: EventType!, $startedAt: String, $endedAt: String, "
             "$meta: %s) { logEvent(id: $id, babyId: $babyId, type: $type, startedAt: $startedAt, endedAt: $endedAt, "
             "%sMeta: $meta) { %s } }",
             META_TYPES[event->type < BZ_TYPE_COUNT ? event->type : BZ_NOTE], type, EVENT_FIELDS);
    return body(query, vars);
}

char *bz_gql_update_event(const bz_event_t *event, unsigned changed)
{
    const char *type = bz_type_name(event->type);
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "id", event->id);
    char iso[25];
    char params[160] = "$id: String!";
    char args[160] = "id: $id";
    if (changed & BZ_CHANGED_STARTED) {
        bz_format_iso(event->started, iso);
        cJSON_AddStringToObject(vars, "startedAt", iso);
        strcat(params, ", $startedAt: String");
        strcat(args, ", startedAt: $startedAt");
    }
    if (changed & BZ_CHANGED_ENDED) {
        if (event->ended == BZ_RUNNING) {
            cJSON_AddNullToObject(vars, "endedAt");
        } else {
            bz_format_iso(event->ended, iso);
            cJSON_AddStringToObject(vars, "endedAt", iso);
        }
        strcat(params, ", $endedAt: String");
        strcat(args, ", endedAt: $endedAt");
    }
    if (changed & BZ_CHANGED_META) {
        cJSON_AddItemToObject(vars, "meta", meta_input(event));
        char extra[64];
        snprintf(extra, sizeof extra, ", $meta: %s", META_TYPES[event->type < BZ_TYPE_COUNT ? event->type : BZ_NOTE]);
        strcat(params, extra);
        snprintf(extra, sizeof extra, ", %sMeta: $meta", type);
        strcat(args, extra);
    }
    char query[420];
    snprintf(query, sizeof query, "mutation UpdateEvent(%s) { updateEvent(%s) { %s } }", params, args, EVENT_FIELDS);
    return body(query, vars);
}

char *bz_gql_delete_event(const char *id)
{
    cJSON *vars = cJSON_CreateObject();
    cJSON_AddStringToObject(vars, "id", id);
    return body("mutation DeleteEvent($id: String!) { deleteEvent(id: $id) }", vars);
}

/* ── Replies ──────────────────────────────────────────────── */

static const char *const REFUSAL_CODES[] = {"REFUSED", "BAD_USER_INPUT", "GRAPHQL_PARSE_FAILED",
                                            "GRAPHQL_VALIDATION_FAILED", NULL};

bz_reply_t bz_gql_classify(int http_status, const char *text)
{
    bz_reply_t reply = {.kind = BZ_REPLY_OK};
    cJSON *root = cJSON_Parse(text ? text : "");
    const cJSON *errors = cJSON_GetObjectItemCaseSensitive(root, "errors");
    bool any_error = cJSON_IsArray(errors) && cJSON_GetArraySize(errors) > 0;
    bool auth = http_status == 401;
    bool refused = false;
    if (any_error) {
        const cJSON *first = cJSON_GetArrayItem(errors, 0);
        const cJSON *message = cJSON_GetObjectItemCaseSensitive(first, "message");
        if (cJSON_IsString(message)) snprintf(reply.message, sizeof reply.message, "%s", message->valuestring);
        const cJSON *error;
        cJSON_ArrayForEach(error, errors)
        {
            const cJSON *code = cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(error, "extensions"), "code");
            const cJSON *msg = cJSON_GetObjectItemCaseSensitive(error, "message");
            if (cJSON_IsString(code)) {
                if (!reply.code[0]) snprintf(reply.code, sizeof reply.code, "%s", code->valuestring);
                if (strcmp(code->valuestring, "UNAUTHENTICATED") == 0) auth = true;
                for (int i = 0; REFUSAL_CODES[i]; i++) refused |= strcmp(code->valuestring, REFUSAL_CODES[i]) == 0;
            }
            if (cJSON_IsString(msg) && strcmp(msg->valuestring, "Not authenticated") == 0) auth = true;
        }
    }
    if (auth) {
        reply.kind = BZ_REPLY_UNAUTHENTICATED;
    } else if (refused) {
        reply.kind = BZ_REPLY_REFUSED;
    } else if (http_status < 200 || http_status >= 300 || !cJSON_IsObject(root) || any_error) {
        reply.kind = BZ_REPLY_TRANSIENT;
        if (!reply.message[0]) snprintf(reply.message, sizeof reply.message, "HTTP %d", http_status);
    }
    cJSON_Delete(root);
    return reply;
}

static const cJSON *data_field(const cJSON *root, const char *field)
{
    return cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(root, "data"), field);
}

static void copy_str(const cJSON *object, const char *key, char *out, size_t len)
{
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(object, key);
    snprintf(out, len, "%s", cJSON_IsString(item) ? item->valuestring : "");
}

int bz_parse_babies(const char *text, bz_baby_t *out, int max)
{
    cJSON *root = cJSON_Parse(text ? text : "");
    const cJSON *list = data_field(root, "myBabies");
    int count = -1;
    if (cJSON_IsArray(list)) {
        count = 0;
        const cJSON *item;
        cJSON_ArrayForEach(item, list)
        {
            if (count >= max) break;
            copy_str(item, "id", out[count].id, sizeof out[count].id);
            copy_str(item, "name", out[count].name, sizeof out[count].name);
            if (out[count].id[0]) count++;
        }
    }
    cJSON_Delete(root);
    return count;
}

bool bz_event_from_json(const cJSON *item, bz_event_t *out)
{
    memset(out, 0, sizeof *out);
    copy_str(item, "id", out->id, sizeof out->id);
    const cJSON *type = cJSON_GetObjectItemCaseSensitive(item, "type");
    out->type = bz_type_from_name(cJSON_IsString(type) ? type->valuestring : "");
    const cJSON *started = cJSON_GetObjectItemCaseSensitive(item, "startedAt");
    out->started = bz_parse_iso(cJSON_IsString(started) ? started->valuestring : NULL);
    const cJSON *ended = cJSON_GetObjectItemCaseSensitive(item, "endedAt");
    out->ended = cJSON_IsString(ended) ? bz_parse_iso(ended->valuestring) : BZ_RUNNING;
    if (out->ended < 0) out->ended = BZ_RUNNING;
    const cJSON *meta = cJSON_GetObjectItemCaseSensitive(item, "metadata");
    if (cJSON_IsString(meta)) {
        snprintf(out->meta, sizeof out->meta, "%s", meta->valuestring);
    } else if (cJSON_IsObject(meta)) {
        cJSON_PrintPreallocated((cJSON *)meta, out->meta, sizeof out->meta, false);
    } else {
        strcpy(out->meta, "{}");
    }
    return out->id[0] && out->type != BZ_TYPE_UNKNOWN && out->started > 0;
}

int bz_parse_events(const char *text, const char *field, bz_event_t *out, int max)
{
    cJSON *root = cJSON_Parse(text ? text : "");
    const cJSON *list = data_field(root, field);
    int count = -1;
    if (cJSON_IsArray(list)) {
        count = 0;
        const cJSON *item;
        cJSON_ArrayForEach(item, list)
        {
            if (count >= max) break;
            // Types the device does not show (growth, ...) are skipped.
            if (bz_event_from_json(item, &out[count])) count++;
        }
    }
    cJSON_Delete(root);
    return count;
}

bool bz_parse_event(const char *text, const char *field, bz_event_t *out)
{
    cJSON *root = cJSON_Parse(text ? text : "");
    const cJSON *item = data_field(root, field);
    bool ok = cJSON_IsObject(item) && bz_event_from_json(item, out);
    cJSON_Delete(root);
    return ok;
}

bool bz_parse_poll(const char *text, bz_poll_t *out)
{
    memset(out, 0, sizeof *out);
    cJSON *root = cJSON_Parse(text ? text : "");
    const cJSON *poll = data_field(root, "pollDeviceCode");
    bool ok = cJSON_IsObject(poll);
    if (ok) {
        char status[16];
        copy_str(poll, "status", status, sizeof status);
        out->status = strcmp(status, "pending") == 0      ? BZ_POLL_PENDING
                      : strcmp(status, "approved") == 0   ? BZ_POLL_APPROVED
                      : strcmp(status, "expired") == 0    ? BZ_POLL_EXPIRED
                      : strcmp(status, "redirected") == 0 ? BZ_POLL_REDIRECTED
                                                          : BZ_POLL_UNKNOWN;
        copy_str(poll, "token", out->token, sizeof out->token);
        copy_str(poll, "refreshToken", out->refresh, sizeof out->refresh);
        copy_str(poll, "webUrl", out->web_url, sizeof out->web_url);
        // An approval without tokens, or a redirect without a destination, cannot be acted on.
        if (out->status == BZ_POLL_APPROVED && (!out->token[0] || !out->refresh[0])) out->status = BZ_POLL_UNKNOWN;
        if (out->status == BZ_POLL_REDIRECTED && !out->web_url[0]) out->status = BZ_POLL_UNKNOWN;
    }
    cJSON_Delete(root);
    return ok;
}

bool bz_parse_device_code(const char *text, char *code, size_t len)
{
    cJSON *root = cJSON_Parse(text ? text : "");
    copy_str(data_field(root, "requestDeviceCode"), "code", code, len);
    cJSON_Delete(root);
    return code[0] != '\0';
}

bool bz_parse_confirm_redirect(const char *text)
{
    cJSON *root = cJSON_Parse(text ? text : "");
    bool confirmed = cJSON_IsTrue(data_field(root, "confirmDeviceCodeRedirect"));
    cJSON_Delete(root);
    return confirmed;
}

bool bz_parse_refresh(const char *text, char *token, size_t token_len, char *refresh, size_t refresh_len)
{
    cJSON *root = cJSON_Parse(text ? text : "");
    const cJSON *payload = data_field(root, "refreshToken");
    copy_str(payload, "token", token, token_len);
    copy_str(payload, "refreshToken", refresh, refresh_len);
    cJSON_Delete(root);
    return token[0] && refresh[0];
}

bool bz_parse_config(const char *text, char *api_url, size_t len)
{
    cJSON *root = cJSON_Parse(text ? text : "");
    copy_str(root, "apiUrl", api_url, len);
    cJSON_Delete(root);
    return strncmp(api_url, "http://", 7) == 0 || strncmp(api_url, "https://", 8) == 0;
}

static bool mentions(const bz_reply_t *reply, const char *a, const char *b)
{
    return strstr(reply->message, a) && strstr(reply->message, b);
}

bool bz_reply_is_unknown_code_arg(const bz_reply_t *reply)
{
    // graphql-js: Unknown argument "code" on field "Mutation.requestDeviceCode".
    return reply->kind == BZ_REPLY_REFUSED && mentions(reply, "Unknown argument", "\"code\"");
}

bool bz_reply_is_unknown_web_url(const bz_reply_t *reply)
{
    // graphql-js: Cannot query field "webUrl" on type "DeviceCodePollPayload".
    return reply->kind == BZ_REPLY_REFUSED && mentions(reply, "Cannot query field", "\"webUrl\"");
}
