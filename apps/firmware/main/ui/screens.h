#pragma once

#include "app.h"
#include "theme.h"

void ui_load(lv_obj_t *screen, const char *name);
void ui_trace(lv_obj_t *screen);
bool screen_named(lv_obj_t *screen, const char *name);

void screen_splash_show(const char *status);

lv_obj_t *ui_round_list(lv_obj_t *screen, int top_pad, int bottom_pad);
void ui_round_list_fit(lv_obj_t *list);
lv_obj_t *ui_title(lv_obj_t *parent, const char *text);
lv_obj_t *ui_back_button(lv_obj_t *parent, lv_event_cb_t cb, void *user);
typedef struct {
    lv_obj_t *field;
    lv_obj_t *keyboard;
} ui_text_entry_t;
ui_text_entry_t ui_text_entry(lv_obj_t *screen, const char *placeholder, bool password, lv_event_cb_t on_done,
                              void *user);

#include "wifi.h"
void screen_wifi_show(const wifi_ap_t *aps, int count, const char *message);
void screen_wifi_password_show(const char *ssid, const char *pass, const char *notice);

void screen_timezone_show(const char *current);

typedef struct {
    char code[16];
    char url[200];
    char host[160];
    char notice[120];
} screen_pairing_t;

void screen_pairing_show(const screen_pairing_t *view);
void screen_server_show(const char *current, app_fn back);

#include "bz_rules.h"
#include "bz_station.h"

void screen_station_show(void);
bool screen_station_want_dark(void);
void screen_station_home(void);
void screen_station_refresh(void);
void screen_station_pick(bz_type_t type, const bz_variant_t *variant);
void screen_picker_show(bz_type_t type, const bz_variant_t *selected);
void screen_note_show(void);
void screen_babies_show(void);
void screen_settings_show(void);
void screen_tiles_show(void);
void screen_confirm_show(bool reset);
void screen_no_baby_show(void);

typedef void (*ui_amount_cb)(double value, void *user);
void ui_amount_picker(lv_obj_t *parent, const char *title, int last_ml, double chosen, ui_amount_cb cb, void *user);

void ui_toast_tick(void);
void ui_toast_hide(void);
void ui_toast_message(const char *text);
void ui_toast_error(bz_err_t err);
