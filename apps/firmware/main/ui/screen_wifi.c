#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "app.h"
#include "esp_log.h"
#include "screens.h"

static char chosen[33];

static void on_network(lv_event_t *event)
{
    const wifi_ap_t *ap = lv_event_get_user_data(event);
    ESP_LOGI("ui", "network %s", ap->ssid);
    strlcpy(chosen, ap->ssid, sizeof chosen);
    if (ap->secure) {
        screen_wifi_password_show(chosen, "", NULL);
    } else {
        app_wifi_join(chosen, "");
    }
}

static void on_rescan(lv_event_t *event) { app_wifi_scan(); }

static wifi_ap_t shown[WIFI_SCAN_MAX];

static const char *strength(int rssi)
{
    if (rssi >= -60) return "Strong signal";
    if (rssi >= -72) return "Good signal";
    return "Weak signal";
}

void screen_wifi_show(const wifi_ap_t *aps, int count, const char *message)
{
    lv_obj_t *screen = ui_screen();
    lv_obj_t *list = ui_round_list(screen, 96, 120);
    ui_title(screen, "Choose Wi-Fi");

    if (message) {
        ESP_LOGI("ui", "notice %s", message);
        lv_obj_t *note = ui_label(list, &font_sans_20, lv_color_hex(ui_pal.tokens.pump_600), message);
        lv_obj_set_width(note, 300);
        lv_label_set_long_mode(note, LV_LABEL_LONG_WRAP);
    }

    if (count < 0) {
        lv_obj_t *looking = ui_label(list, &font_sans_24, ui_pal.muted, "Looking for networks");
        lv_obj_set_style_pad_top(looking, 90, 0);
        theme_breathe(looking, 2000);
        ui_load(screen, "wifi-scanning");
        return;
    }

    memcpy(shown, aps, sizeof(wifi_ap_t) * (size_t)count);
    for (int i = 0; i < count; i++) {
        char detail[40];
        snprintf(detail, sizeof detail, "%s%s", strength(shown[i].rssi), shown[i].secure ? " · Password" : " · Open");
        ui_row(list, shown[i].ssid, detail, on_network, &shown[i]);
    }
    if (count == 0) {
        lv_obj_t *none = ui_label(list, &font_sans_24, ui_pal.muted, "No networks found");
        lv_obj_set_style_pad_ver(none, 40, 0);
    }
    lv_obj_t *again = ui_button(list, "Scan again", false, on_rescan, NULL);
    lv_obj_set_style_margin_top(again, 8, 0);
    ui_round_list_fit(list);
    ui_load(screen, "wifi-list");
}

static void on_password_done(lv_event_t *event)
{
    lv_obj_t *keyboard = lv_event_get_target(event);
    if (lv_event_get_code(event) == LV_EVENT_CANCEL) {
        app_wifi_scan();
        return;
    }
    lv_obj_t *field = lv_keyboard_get_textarea(keyboard);
    const char *pass = lv_textarea_get_text(field);
    if (strlen(pass) < 8) return; // WPA needs at least 8 characters; keep typing
    app_wifi_join(chosen, pass);
}

void screen_wifi_password_show(const char *ssid, const char *pass, const char *notice)
{
    lv_obj_t *screen = ui_screen();
    ui_title(screen, ssid);
    ui_text_entry_t entry = ui_text_entry(screen, "Password", true, on_password_done, NULL);
    lv_textarea_set_text(entry.field, pass);
    if (notice) {
        lv_obj_t *note = ui_label(screen, &font_sans_20, lv_color_hex(ui_pal.tokens.pump_600), notice);
        lv_obj_align(note, LV_ALIGN_TOP_MID, 0, 392);
        ESP_LOGI("ui", "notice %s", notice);
    }
    ui_load(screen, "wifi-password");
}
