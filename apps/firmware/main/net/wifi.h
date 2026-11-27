// Wi-Fi station: scan, join, and stay joined. The blocking calls run on the app worker, never on
// the LVGL task.
#pragma once

#include <stdbool.h>

#define WIFI_SCAN_MAX 16

typedef struct {
    char ssid[33];
    int rssi;
    bool secure;
} wifi_ap_t;

typedef enum {
    WIFI_JOINED,
    WIFI_WRONG_PASSWORD,
    /** Out of range, refused, or no answer. */
    WIFI_UNREACHABLE,
} wifi_result_t;

void wifi_init(void);
/** Networks in range, strongest first, one row per name. Returns the count. */
int wifi_scan(wifi_ap_t *out, int max);
/** Join and wait for an address. Remembers nothing; the caller saves what worked. */
wifi_result_t wifi_join(const char *ssid, const char *pass, int timeout_ms);
