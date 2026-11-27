// Every screen of the device. Each `screen_*_show` builds a fresh screen and loads it; it runs on
// the LVGL task with the display lock held.
#pragma once

#include "theme.h"

/** Load `screen` (deleting the old one) and log `screen: <name>` so tests can follow the flow. */
void ui_load(lv_obj_t *screen, const char *name);

void screen_splash_show(const char *status);

/* ── Shared round-screen pieces (ui.c) ─────────────────────── */

/** A screen-sized, vertically scrolling column whose rows narrow to follow the circle. */
lv_obj_t *ui_round_list(lv_obj_t *screen, int top_pad, int bottom_pad);
/** Fit the rows to the circle once they are laid out (call after adding rows). */
void ui_round_list_fit(lv_obj_t *list);
/** A title along the top of the circle. */
lv_obj_t *ui_title(lv_obj_t *parent, const char *text);
/** A round back button at the top of the circle. */
lv_obj_t *ui_back_button(lv_obj_t *parent, lv_event_cb_t cb, void *user);
/** The on-screen keyboard and a one-line field above it, fitted inside the circle. */
typedef struct {
    lv_obj_t *field;
    lv_obj_t *keyboard;
} ui_text_entry_t;
ui_text_entry_t ui_text_entry(lv_obj_t *screen, const char *placeholder, bool password, lv_event_cb_t on_done,
                              void *user);

/* ── Wi-Fi ─────────────────────────────────────────────────── */

#include "wifi.h"
/** `count` -1 while scanning. `message` (optional) explains why the list is back. */
void screen_wifi_show(const wifi_ap_t *aps, int count, const char *message);
void screen_wifi_password_show(const char *ssid);
