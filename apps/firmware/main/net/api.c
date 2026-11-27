#include "api.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_log.h"
#include "settings.h"

static const char *TAG = "api";

#define TIMEOUT_MS 15000

bool api_ensure_config(void)
{
    if (settings.api_url[0]) return true;
    char url[SETTINGS_URL_LEN + 32];
    snprintf(url, sizeof url, "%s/.well-known/config", settings.web_url);
    http_resp_t resp;
    char api[SETTINGS_URL_LEN];
    bool ok = http_request(url, NULL, NULL, &resp, TIMEOUT_MS) == 200 && bz_parse_config(resp.body, api, sizeof api);
    http_free(&resp);
    if (ok) {
        ESP_LOGI(TAG, "config: %s", api);
        settings_save_api_url(api);
    }
    return ok;
}

typedef enum { REFRESHED, REJECTED, UNAVAILABLE } refresh_t;

/* Rotate the refresh token (refresh-token.ts). Only an answer that refuses it ends the session. */
static refresh_t refresh(void)
{
    if (!settings.refresh[0]) return REJECTED;
    char *body = bz_gql_refresh_token(settings.refresh);
    http_resp_t resp;
    int status = http_request(settings.api_url, body, NULL, &resp, TIMEOUT_MS);
    free(body);
    refresh_t result = UNAVAILABLE;
    static char token[SETTINGS_TOKEN_LEN], next[SETTINGS_TOKEN_LEN];
    if (status == 200 && bz_parse_refresh(resp.body, token, sizeof token, next, sizeof next)) {
        settings_save_tokens(token, next);
        result = REFRESHED;
    } else if (status != 0) {
        bz_reply_t reply = bz_gql_classify(status, resp.body);
        // An API from before the refusal code answers a rejected token with no session and no error.
        if (strcmp(reply.code, "REFUSED") == 0 || (reply.kind == BZ_REPLY_OK && status == 200)) result = REJECTED;
    }
    http_free(&resp);
    ESP_LOGI(TAG, "refresh: %s", result == REFRESHED ? "ok" : result == REJECTED ? "rejected" : "unavailable");
    return result;
}

api_result_t api_call(char *body, http_resp_t *out, bz_reply_t *reply)
{
    api_result_t result = API_TRANSIENT;
    for (int attempt = 0; attempt < 2; attempt++) {
        int status = http_request(settings.api_url, body, settings.token, out, TIMEOUT_MS);
        *reply = status ? bz_gql_classify(status, out->body) : (bz_reply_t){.kind = BZ_REPLY_TRANSIENT};
        if (reply->kind == BZ_REPLY_OK) {
            result = API_OK;
            break;
        }
        if (reply->kind == BZ_REPLY_REFUSED) {
            ESP_LOGW(TAG, "refused: %s %s", reply->code, reply->message);
            result = API_REFUSED;
            break;
        }
        if (reply->kind == BZ_REPLY_TRANSIENT) break;
        // Not authenticated: refresh once. A token just refreshed and still refused is rejected.
        http_free(out);
        refresh_t refreshed = attempt == 0 ? refresh() : REJECTED;
        if (refreshed == REJECTED) {
            result = API_SIGNED_OUT;
            break;
        }
        if (refreshed == UNAVAILABLE) break;
    }
    free(body);
    if (result != API_OK) http_free(out);
    return result;
}
