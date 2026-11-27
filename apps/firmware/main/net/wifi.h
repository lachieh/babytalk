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
    WIFI_UNREACHABLE,
} wifi_result_t;

void wifi_init(void);
int wifi_scan(wifi_ap_t *out, int max);
wifi_result_t wifi_join(const char *ssid, const char *pass, int timeout_ms);
