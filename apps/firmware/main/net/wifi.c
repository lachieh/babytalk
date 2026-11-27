#include "wifi.h"

#include <string.h>

#include "bz_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

static const char *TAG = "wifi";

_Static_assert(BZ_WIFI_REASON_MIC_FAILURE == WIFI_REASON_MIC_FAILURE, "reason codes");
_Static_assert(BZ_WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT == WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT, "reason codes");
_Static_assert(BZ_WIFI_REASON_AUTH_FAIL == WIFI_REASON_AUTH_FAIL, "reason codes");
_Static_assert(BZ_WIFI_REASON_HANDSHAKE_TIMEOUT == WIFI_REASON_HANDSHAKE_TIMEOUT, "reason codes");

#define GOT_ADDRESS BIT0
#define JOIN_FAILED BIT1

static EventGroupHandle_t events;
/* Rejoin after a drop only once a network has been joined (or is being joined). */
static volatile bool want_connection;
static volatile uint8_t last_reason;

static void on_event(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        const wifi_event_sta_disconnected_t *gone = data;
        last_reason = gone->reason;
        xEventGroupClearBits(events, GOT_ADDRESS);
        xEventGroupSetBits(events, JOIN_FAILED);
        ESP_LOGI(TAG, "disconnected, reason %d", gone->reason);
        if (want_connection) esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        const ip_event_got_ip_t *got = data;
        ESP_LOGI(TAG, "address " IPSTR, IP2STR(&got->ip_info.ip));
        xEventGroupClearBits(events, JOIN_FAILED);
        xEventGroupSetBits(events, GOT_ADDRESS);
    }
}

void wifi_init(void)
{
    events = xEventGroupCreate();
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t init = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, WIFI_EVENT_STA_DISCONNECTED, on_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_event, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());
}

int wifi_scan(wifi_ap_t *out, int max)
{
    wifi_scan_config_t config = {.show_hidden = false};
    if (esp_wifi_scan_start(&config, true) != ESP_OK) {
        ESP_LOGW(TAG, "scan failed");
        return 0;
    }
    uint16_t found = 0;
    esp_wifi_scan_get_ap_num(&found);
    wifi_ap_record_t *records = calloc(found ? found : 1, sizeof *records);
    if (!records) return 0;
    esp_wifi_scan_get_ap_records(&found, records);

    int count = 0;
    // Records come strongest first; keep the first (strongest) of each name.
    for (int i = 0; i < found && count < max; i++) {
        const char *ssid = (const char *)records[i].ssid;
        if (!ssid[0]) continue;
        bool seen = false;
        for (int j = 0; j < count; j++) seen |= strcmp(out[j].ssid, ssid) == 0;
        if (seen) continue;
        strlcpy(out[count].ssid, ssid, sizeof out[count].ssid);
        out[count].rssi = records[i].rssi;
        out[count].secure = records[i].authmode != WIFI_AUTH_OPEN;
        count++;
    }
    free(records);
    ESP_LOGI(TAG, "scan: %d networks", count);
    for (int i = 0; i < count; i++) ESP_LOGI(TAG, "  %s %d%s", out[i].ssid, out[i].rssi, out[i].secure ? " secure" : "");
    return count;
}

wifi_result_t wifi_join(const char *ssid, const char *pass, int timeout_ms)
{
    want_connection = false;
    esp_wifi_disconnect();
    xEventGroupClearBits(events, GOT_ADDRESS | JOIN_FAILED);

    wifi_config_t config = {0};
    strlcpy((char *)config.sta.ssid, ssid, sizeof config.sta.ssid);
    strlcpy((char *)config.sta.password, pass ? pass : "", sizeof config.sta.password);
    config.sta.threshold.authmode = pass && pass[0] ? WIFI_AUTH_WEP : WIFI_AUTH_OPEN;
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &config));
    last_reason = 0;
    want_connection = true;
    ESP_LOGI(TAG, "joining %s", ssid);
    esp_wifi_connect();

    // The station retries on its own after a failure. A wrong password fails the same way every
    // time, so it ends the wait; anything else gets three tries.
    TickType_t deadline = xTaskGetTickCount() + pdMS_TO_TICKS(timeout_ms);
    int failures = 0;
    // Taken as each failure is seen: the disconnect below reports a reason of its own (36).
    uint8_t reason = 0;
    while (xTaskGetTickCount() < deadline) {
        EventBits_t bits = xEventGroupWaitBits(events, GOT_ADDRESS | JOIN_FAILED, pdFALSE, pdFALSE,
                                               deadline - xTaskGetTickCount());
        if (bits & GOT_ADDRESS) return WIFI_JOINED;
        if (bits & JOIN_FAILED) {
            xEventGroupClearBits(events, JOIN_FAILED);
            reason = last_reason;
            if (bz_wifi_failure(reason) == BZ_WIFI_WRONG_PASSWORD || ++failures >= 3) break;
        }
    }
    want_connection = false;
    esp_wifi_disconnect();
    ESP_LOGI(TAG, "join failed, reason %d", reason);
    return bz_wifi_failure(reason) == BZ_WIFI_WRONG_PASSWORD ? WIFI_WRONG_PASSWORD : WIFI_UNREACHABLE;
}
