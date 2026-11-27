#pragma once

#include <stdbool.h>

typedef void (*app_fn)(void *arg);

void app_start(void);
void app_do(app_fn fn, void *arg);
void ui_do(app_fn fn, void *arg);

void app_wifi_scan(void);
void app_wifi_join(const char *ssid, const char *pass);
void app_continue(void);
void app_set_timezone(const char *name);
void app_set_server(const char *web_url);
void app_interrupt(void);
bool app_clock_synced(void);
void app_signed_out(void);
void app_unpair(bool reset);
