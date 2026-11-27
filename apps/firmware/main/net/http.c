#include "http.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_crt_bundle.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_log.h"

static const char *TAG = "http";

#define BODY_LIMIT (256 * 1024)

static esp_err_t on_data(esp_http_client_event_t *event)
{
    http_resp_t *out = event->user_data;
    if (event->event_id != HTTP_EVENT_ON_DATA || !out) return ESP_OK;
    if (out->len + event->data_len > BODY_LIMIT) return ESP_FAIL;
    char *grown = heap_caps_realloc(out->body, out->len + event->data_len + 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!grown) return ESP_FAIL;
    memcpy(grown + out->len, event->data, event->data_len);
    out->len += event->data_len;
    grown[out->len] = '\0';
    out->body = grown;
    return ESP_OK;
}

int http_request(const char *url, const char *body, const char *bearer, http_resp_t *out, int timeout_ms)
{
    memset(out, 0, sizeof *out);
    esp_http_client_config_t config = {
        .url = url,
        .method = body ? HTTP_METHOD_POST : HTTP_METHOD_GET,
        .timeout_ms = timeout_ms,
        .event_handler = on_data,
        .user_data = out,
        .crt_bundle_attach = strncmp(url, "https://", 8) == 0 ? esp_crt_bundle_attach : NULL,
        .buffer_size = 2048,
        .buffer_size_tx = 2048,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) return 0;
    if (body) {
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, body, (int)strlen(body));
    }
    if (bearer && bearer[0]) {
        size_t len = strlen(bearer) + 8;
        char *auth = malloc(len);
        snprintf(auth, len, "Bearer %s", bearer);
        esp_http_client_set_header(client, "Authorization", auth); /* copies the value */
        free(auth);
    }
    esp_err_t err = esp_http_client_perform(client);
    out->status = err == ESP_OK ? esp_http_client_get_status_code(client) : 0;
    if (err != ESP_OK) ESP_LOGW(TAG, "%s: %s", url, esp_err_to_name(err));
    esp_http_client_cleanup(client);
    if (!out->body) out->body = calloc(1, 1);
    return out->status;
}

void http_free(http_resp_t *resp)
{
    free(resp->body);
    resp->body = NULL;
    resp->len = 0;
}
