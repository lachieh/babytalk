// The app's flow (Wi-Fi -> time zone -> pairing -> station) and its worker task. Network calls block,
// so they run on the worker; screens are built on the LVGL task. `ui_do` crosses back.
#pragma once

#include <stdbool.h>

typedef void (*app_fn)(void *arg);

void app_start(void);
/** Run `fn` on the worker task, after what is already queued. */
void app_do(app_fn fn, void *arg);
/** Run `fn` with the display lock held (from the worker or any task but LVGL's). */
void ui_do(app_fn fn, void *arg);

/* Flow steps the screens ask for. Each returns at once; the work happens on the worker. */
void app_wifi_scan(void);
void app_wifi_join(const char *ssid, const char *pass);
/** The next step of setup after Wi-Fi, or the station once set up. */
void app_continue(void);
