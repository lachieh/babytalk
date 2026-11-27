// Every screen of the device. Each `screen_*_show` builds a fresh screen and loads it; it runs on
// the LVGL task with the display lock held.
#pragma once

#include "app.h"
#include "theme.h"

/** Load `screen` (deleting the old one) and log `screen: <name>` so tests can follow the flow. */
void ui_load(lv_obj_t *screen, const char *name);
/** Log the touch targets (CONFIG_BUBSIE_UI_TRACE) once laid out, e.g. after a page changes. */
void ui_trace(lv_obj_t *screen);
/** Whether `screen` was loaded under `name`. */
bool screen_named(lv_obj_t *screen, const char *name);

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
/** The password for `ssid`, with `pass` already typed and `notice` (or NULL) under the keyboard. */
void screen_wifi_password_show(const char *ssid, const char *pass, const char *notice);

/* ── Setup ─────────────────────────────────────────────────── */

void screen_timezone_show(const char *current);

typedef struct {
    char code[16];   /* "ABCD-2345", "" while asking for one */
    char url[200];   /* what the QR code opens */
    char host[160];  /* the server, for "Pairing with <host>" */
    char notice[120];
} screen_pairing_t;

void screen_pairing_show(const screen_pairing_t *view);
/** Type another server's web address. `back` is where Cancel returns. */
void screen_server_show(const char *current, app_fn back);

/* ── Station ───────────────────────────────────────────────── */

#include "bz_rules.h"
#include "bz_station.h"

void screen_station_show(void);
/** Night mode as settings and the clock say now (dark 8 pm to 7 am on Auto). */
bool screen_station_want_dark(void);
/** The station's first page. */
void screen_station_home(void);
/** Redraw what changed (from the sync task through ui_do, or after an action). */
void screen_station_refresh(void);
/** The variant the next tap of `type` logs, until it does. */
void screen_station_pick(bz_type_t type, const bz_variant_t *variant);
void screen_picker_show(bz_type_t type, const bz_variant_t *selected);
void screen_note_show(void);
void screen_babies_show(void);
void screen_settings_show(void);
void screen_tiles_show(void);
/** Confirm Unpair (`reset` false) or Reset device. */
void screen_confirm_show(bool reset);
/** No baby in the household yet. */
void screen_no_baby_show(void);

/** Title, three quick amounts around the last one, and the chosen value. */
typedef void (*ui_amount_cb)(double value, void *user);
void ui_amount_picker(lv_obj_t *parent, const char *title, int last_ml, double chosen, ui_amount_cb cb, void *user);

/* The undo toast along the bottom of the circle (ui_toast.c), mirroring station->toast. */
void ui_toast_tick(void);
void ui_toast_hide(void);
/** A short note with no undo, e.g. why a tap did nothing. */
void ui_toast_message(const char *text);
/** Say why a station action did nothing (nothing for BZ_ST_OK and the errors a person cannot act on). */
void ui_toast_error(bz_err_t err);
