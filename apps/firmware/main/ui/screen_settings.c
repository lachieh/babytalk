#include <stdio.h>
#include <string.h>

#include "app.h"
#include "buttons.h"
#include "bz_pairing.h"
#include "bz_time.h"
#include "esp_log.h"
#include "esp_system.h"
#include "screens.h"
#include "settings.h"
#include "station.h"

static const char *const NIGHT[] = {"Auto, 8 pm to 7 am", "Always", "Never"};

static void on_back(lv_event_t *event) { screen_station_show(); }
static void on_settings_back(lv_event_t *event) { screen_settings_show(); }
static void on_babies(lv_event_t *event) { screen_babies_show(); }
static void on_tiles(lv_event_t *event) { screen_tiles_show(); }
static void on_wifi(lv_event_t *event) { app_wifi_scan(); }
static void on_timezone(lv_event_t *event) { screen_timezone_show(settings.tz); }

static void on_night(lv_event_t *event)
{
    settings_set_u8("dark", &settings.dark, (night_mode_t)((settings.dark + 1) % NIGHT_MODE_COUNT));
    theme_set_dark(screen_station_want_dark());
    buttons_apply_brightness();
    screen_settings_show();
}

static void on_volume(lv_event_t *event)
{
    settings_set_u8("volume_oz", &settings.volume_oz, !settings.volume_oz);
    screen_settings_show();
}

static void on_motion(lv_event_t *event)
{
    settings_set_u8("reduced", &settings.reduced_motion, !settings.reduced_motion);
    theme_set_reduced_motion(settings.reduced_motion);
    screen_settings_show();
}

static void on_retry(lv_event_t *event)
{
    station_retry();
    screen_settings_show();
}

static void on_restart(lv_event_t *event)
{
    ESP_LOGI("settings", "restart");
    esp_restart();
}

static void on_unpair(lv_event_t *event) { screen_confirm_show(false); }
static void on_reset(lv_event_t *event) { screen_confirm_show(true); }

void screen_settings_show(void)
{
    lv_obj_t *screen = ui_screen();
    lv_obj_t *list = ui_round_list(screen, 104, 130);
    ui_title(screen, "Settings");
    ui_back_button(screen, on_back, NULL);

    bz_baby_t babies[STATION_BABIES_MAX];
    if (station_babies(babies, STATION_BABIES_MAX) > 1) ui_row(list, "Baby", station_baby_name(), on_babies, NULL);

    char tiles[80] = "";
    for (int t = 0; t < BZ_TYPE_COUNT; t++) {
        if (!(settings.tiles & (1u << t))) continue;
        if (tiles[0]) strlcat(tiles, ", ", sizeof tiles);
        strlcat(tiles, bz_type_label((bz_type_t)t), sizeof tiles);
    }
    ui_row(list, "Buttons", tiles[0] ? tiles : "None", on_tiles, NULL);

    station_lock();
    bz_unsaved_t unsaved = bz_ob_unsaved(&station->ob);
    station_unlock();
    if (unsaved.failed) {
        char detail[48];
        snprintf(detail, sizeof detail, "%d the server didn't take", unsaved.failed);
        ui_row(list, "Send again", detail, on_retry, NULL);
    }

    ui_row(list, "Night mode", NIGHT[settings.dark % NIGHT_MODE_COUNT], on_night, NULL);
    ui_row(list, "Volume", settings.volume_oz ? "Fluid ounces" : "Millilitres", on_volume, NULL);
    ui_row(list, "Reduce motion", settings.reduced_motion ? "On" : "Off", on_motion, NULL);
    const bz_zone_t *zone = bz_zone_find(settings.tz);
    ui_row(list, "Time zone", zone ? zone->label : "UTC", on_timezone, NULL);
    ui_row(list, "Wi-Fi", settings.wifi_ssid, on_wifi, NULL);
    char host[SETTINGS_URL_LEN];
    bz_url_host(settings.web_url, host, sizeof host);
    char server[SETTINGS_URL_LEN + 16];
    snprintf(server, sizeof server, "Server: %s", host);
    ui_row(list, server, "Change it with Reset device", NULL, NULL);
    ui_row(list, "Restart", NULL, on_restart, NULL);
    ui_row(list, "Unpair", "Sign this device out", on_unpair, NULL);
    lv_obj_t *reset = ui_row(list, "Reset device", "Unpair and go back to bubsie.app", on_reset, NULL);
    lv_obj_set_style_text_color(lv_obj_get_child(reset, 0), lv_color_hex(ui_pal.tokens.pump_600), 0);
    ui_round_list_fit(list);
    ui_load(screen, "settings");
}

static void on_toggle(lv_event_t *event)
{
    bz_type_t type = (bz_type_t)(intptr_t)lv_event_get_user_data(event);
    settings_save_tiles((uint8_t)(settings.tiles ^ (1u << type)));
    screen_tiles_show();
}

static const char *const DESCRIPTIONS[BZ_TYPE_COUNT] = {"Bottle, breast, formula, solid", "Naps and stretches",
                                                         "Wet, soiled, or both", "Pumping sessions", "Quick text notes"};

void screen_tiles_show(void)
{
    static const bz_type_t ORDER[] = {BZ_FEED, BZ_DIAPER, BZ_SLEEP, BZ_PUMP, BZ_NOTE};
    lv_obj_t *screen = ui_screen();
    lv_obj_t *list = ui_round_list(screen, 104, 120);
    ui_title(screen, "Buttons");
    ui_back_button(screen, on_settings_back, NULL);
    for (size_t i = 0; i < sizeof ORDER / sizeof ORDER[0]; i++) {
        bz_type_t type = ORDER[i];
        lv_obj_t *row = ui_row(list, bz_type_label(type), DESCRIPTIONS[type], on_toggle, (void *)(intptr_t)type);
        bool on = settings.tiles & (1u << type);
        lv_obj_t *mark = ui_icon(row, on ? &icon_check_32 : &icon_close_32, on ? ui_pal.ink : ui_pal.faint);
        lv_obj_add_flag(mark, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_align(mark, LV_ALIGN_RIGHT_MID, 0, 0);
        if (on) lv_obj_add_state(row, LV_STATE_CHECKED);
    }
    lv_obj_t *note = ui_label(list, &font_sans_20, ui_pal.muted, "These stay on this device only.");
    lv_obj_set_width(note, 280);
    lv_label_set_long_mode(note, LV_LABEL_LONG_WRAP);
    ui_round_list_fit(list);
    ui_load(screen, "tiles");
}

static bool confirm_reset;

static void on_confirm(lv_event_t *event) { app_unpair(confirm_reset); }
static void on_cancel(lv_event_t *event) { screen_settings_show(); }

void screen_confirm_show(bool reset)
{
    confirm_reset = reset;
    lv_obj_t *screen = ui_screen();
    ui_title(screen, reset ? "Reset device" : "Unpair");
    station_lock();
    bz_unsaved_t unsaved = bz_ob_unsaved(&station->ob);
    station_unlock();
    int waiting = unsaved.queued + unsaved.failed;
    char text[200];
    snprintf(text, sizeof text, "%s%s", reset ? "This signs the device out and sets the server back to bubsie.app."
                                              : "This signs the device out. Wi-Fi and the server stay.",
             waiting ? " Changes not sent yet will be lost." : "");
    lv_obj_t *body = ui_label(screen, &font_sans_24, ui_pal.text, text);
    lv_obj_set_width(body, 320);
    lv_label_set_long_mode(body, LV_LABEL_LONG_WRAP);
    lv_obj_align(body, LV_ALIGN_TOP_MID, 0, 100);
    lv_obj_t *yes = ui_button(screen, reset ? "Reset" : "Unpair", true, on_confirm, NULL);
    lv_obj_set_style_bg_color(yes, lv_color_hex(ui_pal.tokens.pump_600), 0);
    lv_obj_set_width(yes, 240);
    lv_obj_align(yes, LV_ALIGN_TOP_MID, 0, 268);
    lv_obj_t *no = ui_button(screen, "Cancel", false, on_cancel, NULL);
    lv_obj_set_width(no, 180);
    lv_obj_align(no, LV_ALIGN_TOP_MID, 0, 346);
    ui_load(screen, reset ? "confirm-reset" : "confirm-unpair");
}
