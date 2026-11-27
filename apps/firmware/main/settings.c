#include "settings.h"

#include <stdio.h>
#include <string.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

static const char *TAG = "settings";
static const char *NS = "bubsie";

settings_t settings;

#define DEFAULT_TILES ((1 << 0) | (1 << 1) | (1 << 2)) /* feed, sleep, diaper */

static void read_str(nvs_handle_t nvs, const char *key, char *out, size_t len, const char *fallback)
{
    size_t size = len;
    if (nvs_get_str(nvs, key, out, &size) != ESP_OK) snprintf(out, len, "%s", fallback);
}

static void read_u8(nvs_handle_t nvs, const char *key, uint8_t *out, uint8_t fallback)
{
    if (nvs_get_u8(nvs, key, out) != ESP_OK) *out = fallback;
}

void settings_load(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    nvs_handle_t nvs;
    bool open = nvs_open(NS, NVS_READONLY, &nvs) == ESP_OK;
    if (!open) nvs = 0;
    read_str(nvs, "web_url", settings.web_url, sizeof settings.web_url, CONFIG_BUBSIE_DEFAULT_WEB_URL);
    read_str(nvs, "api_url", settings.api_url, sizeof settings.api_url, "");
    read_str(nvs, "wifi_ssid", settings.wifi_ssid, sizeof settings.wifi_ssid, "");
    read_str(nvs, "wifi_pass", settings.wifi_pass, sizeof settings.wifi_pass, "");
    static char blob[SETTINGS_TOKEN_LEN * 2];
    size_t size = sizeof blob;
    if (open && nvs_get_blob(nvs, "session", blob, &size) == ESP_OK && size >= 2 && blob[size - 1] == '\0' &&
        strlen(blob) + 1 < size) {
        strlcpy(settings.token, blob, sizeof settings.token);
        strlcpy(settings.refresh, blob + strlen(blob) + 1, sizeof settings.refresh);
    } else {
        read_str(nvs, "token", settings.token, sizeof settings.token, "");
        read_str(nvs, "refresh", settings.refresh, sizeof settings.refresh, "");
    }
    read_str(nvs, "baby_id", settings.baby_id, sizeof settings.baby_id, "");
    read_str(nvs, "tz", settings.tz, sizeof settings.tz, "");
    read_u8(nvs, "tiles", &settings.tiles, DEFAULT_TILES);
    read_u8(nvs, "dark", &settings.dark, 0);
    read_u8(nvs, "volume_oz", &settings.volume_oz, 0);
    read_u8(nvs, "reduced", &settings.reduced_motion, 0);
    if (open) nvs_close(nvs);
    ESP_LOGI(TAG, "server %s, wifi %s, paired %s", settings.web_url, settings.wifi_ssid[0] ? "saved" : "none",
             settings.refresh[0] ? "yes" : "no");
}

static nvs_handle_t open_rw(void)
{
    nvs_handle_t nvs = 0;
    ESP_ERROR_CHECK(nvs_open(NS, NVS_READWRITE, &nvs));
    return nvs;
}

static void persist_str(const char *key, const char *field)
{
    nvs_handle_t nvs = open_rw();
    if (field[0]) {
        nvs_set_str(nvs, key, field);
    } else {
        nvs_erase_key(nvs, key);
    }
    nvs_commit(nvs);
    nvs_close(nvs);
}

void settings_set_u8(const char *key, uint8_t *field, uint8_t value)
{
    *field = value;
    nvs_handle_t nvs = open_rw();
    nvs_set_u8(nvs, key, value);
    nvs_commit(nvs);
    nvs_close(nvs);
}

#define SET(key, field, value)                                                  \
    do {                                                                        \
        if (settings.field != (value)) {                                        \
            strlcpy(settings.field, (value) ? (value) : "", sizeof settings.field); \
        }                                                                       \
        persist_str(key, settings.field);                                       \
    } while (0)

void settings_save_wifi(const char *ssid, const char *pass)
{
    SET("wifi_ssid", wifi_ssid, ssid);
    SET("wifi_pass", wifi_pass, pass);
}

/* Both tokens in one blob, "<token>\0<refresh>\0": one NVS write, so a restart never finds a new
 * access token beside the refresh token it replaced (or the reverse). */
static void persist_tokens(void)
{
    size_t token_len = strlen(settings.token) + 1, refresh_len = strlen(settings.refresh) + 1;
    static char blob[SETTINGS_TOKEN_LEN * 2];
    memcpy(blob, settings.token, token_len);
    memcpy(blob + token_len, settings.refresh, refresh_len);
    nvs_handle_t nvs = open_rw();
    if (settings.refresh[0]) {
        nvs_set_blob(nvs, "session", blob, token_len + refresh_len);
    } else {
        nvs_erase_key(nvs, "session");
    }
    nvs_erase_key(nvs, "token");
    nvs_erase_key(nvs, "refresh");
    nvs_commit(nvs);
    nvs_close(nvs);
}

static SemaphoreHandle_t session_lock;
static uint32_t session_id;

static void lock_session(void)
{
    if (!session_lock) session_lock = xSemaphoreCreateMutex();
    xSemaphoreTake(session_lock, portMAX_DELAY);
}

static void set_tokens(const char *token, const char *refresh)
{
    strlcpy(settings.token, token ? token : "", sizeof settings.token);
    strlcpy(settings.refresh, refresh ? refresh : "", sizeof settings.refresh);
    persist_tokens();
}

void settings_save_tokens(const char *token, const char *refresh)
{
    lock_session();
    session_id++;
    set_tokens(token, refresh);
    xSemaphoreGive(session_lock);
}

uint32_t settings_session(void)
{
    lock_session();
    uint32_t id = session_id;
    xSemaphoreGive(session_lock);
    return id;
}

bool settings_save_refreshed(uint32_t session, const char *token, const char *refresh)
{
    lock_session();
    bool current = session == session_id && settings.refresh[0];
    if (current) set_tokens(token, refresh);
    xSemaphoreGive(session_lock);
    return current;
}

void settings_save_web_url(const char *web_url, const char *api_url)
{
    SET("web_url", web_url, web_url);
    SET("api_url", api_url, api_url);
}

void settings_save_api_url(const char *api_url) { SET("api_url", api_url, api_url); }
void settings_save_baby(const char *baby_id) { SET("baby_id", baby_id, baby_id); }
void settings_save_tiles(uint8_t tiles) { settings_set_u8("tiles", &settings.tiles, tiles); }
void settings_save_tz(const char *tz) { SET("tz", tz, tz); }

void settings_unpair(void)
{
    settings_save_tokens("", "");
    settings_save_baby("");
}

void settings_reset(void)
{
    settings_unpair();
    settings_save_web_url(CONFIG_BUBSIE_DEFAULT_WEB_URL, "");
}
