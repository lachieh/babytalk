#include <stdio.h>
#include <string.h>

#include "app.h"
#include "bz_time.h"
#include "screens.h"
#include "settings.h"

static lv_obj_t *roller;

static void on_zone_done(lv_event_t *event)
{
    size_t count;
    const bz_zone_t *zones = bz_zones(&count);
    uint32_t index = lv_roller_get_selected(roller);
    if (index < count) app_set_timezone(zones[index].name);
}

void screen_timezone_show(const char *current)
{
    lv_obj_t *screen = ui_screen();
    ui_title(screen, "Time zone");

    size_t count;
    const bz_zone_t *zones = bz_zones(&count);
    static char options[1400];
    options[0] = '\0';
    uint32_t selected = 0;
    for (size_t i = 0; i < count; i++) {
        if (i) strlcat(options, "\n", sizeof options);
        strlcat(options, zones[i].label, sizeof options);
        if (strcmp(zones[i].name, current && current[0] ? current : "UTC") == 0) selected = (uint32_t)i;
    }

    roller = lv_roller_create(screen);
    lv_roller_set_options(roller, options, LV_ROLLER_MODE_NORMAL);
    lv_roller_set_visible_row_count(roller, 5);
    lv_roller_set_selected(roller, selected, LV_ANIM_OFF);
    lv_obj_set_width(roller, 340);
    lv_obj_align(roller, LV_ALIGN_CENTER, 0, -14);
    lv_obj_set_style_bg_opa(roller, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(roller, 0, 0);
    lv_obj_set_style_text_font(roller, &font_sans_24, 0);
    lv_obj_set_style_text_color(roller, ui_pal.muted, 0);
    lv_obj_set_style_text_line_space(roller, 18, 0);
    lv_obj_set_style_text_align(roller, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_bg_color(roller, ui_pal.raised, LV_PART_SELECTED);
    lv_obj_set_style_bg_opa(roller, LV_OPA_COVER, LV_PART_SELECTED);
    lv_obj_set_style_radius(roller, 26, LV_PART_SELECTED);
    lv_obj_set_style_text_color(roller, ui_pal.text, LV_PART_SELECTED);
    lv_obj_set_style_text_font(roller, &font_sans_24, LV_PART_SELECTED);

    lv_obj_t *done = ui_button(screen, "Continue", true, on_zone_done, NULL);
    lv_obj_align(done, LV_ALIGN_BOTTOM_MID, 0, -40);
    ui_load(screen, "timezone");
}

static void show_pairing_again(void *arg) { app_continue(); }

static void on_change_server(lv_event_t *event)
{
    app_interrupt();
    screen_server_show(settings.web_url, show_pairing_again);
}

void screen_pairing_show(const screen_pairing_t *view)
{
    lv_obj_t *screen = ui_screen();

    // A light card behind the QR code in both themes: scanners want dark modules on light.
    lv_obj_t *card = lv_obj_create(screen);
    lv_obj_remove_style_all(card);
    lv_obj_set_size(card, 176, 176);
    lv_obj_align(card, LV_ALIGN_TOP_MID, 0, 44);
    lv_obj_set_style_radius(card, 24, 0);
    lv_obj_set_style_bg_opa(card, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(card, lv_color_hex(0xfffdf8), 0);
    if (view->code[0]) {
        lv_obj_t *qr = lv_qrcode_create(card);
        lv_qrcode_set_size(qr, 148);
        lv_qrcode_set_dark_color(qr, lv_color_hex(ui_pal.tokens.neutral_900 < 0x808080 ? ui_pal.tokens.neutral_900 : 0x2a2622));
        lv_qrcode_set_light_color(qr, lv_color_hex(0xfffdf8));
        lv_qrcode_update(qr, view->url, (uint32_t)strlen(view->url));
        lv_obj_center(qr);
    } else {
        theme_breathe(card, 2000);
    }

    lv_obj_t *code = ui_label(screen, &font_sans_30, ui_pal.text, view->code[0] ? view->code : " ");
    lv_obj_set_style_text_letter_space(code, 3, 0);
    lv_obj_align(code, LV_ALIGN_TOP_MID, 0, 232);

    char hint[220];
    if (view->notice[0]) {
        snprintf(hint, sizeof hint, "%s", view->notice);
    } else {
        snprintf(hint, sizeof hint, "Scan, or enter the code at\n%s/auth/approve", view->host);
    }
    lv_obj_t *line = ui_label(screen, &font_sans_20, view->notice[0] ? lv_color_hex(ui_pal.tokens.pump_600) : ui_pal.muted, hint);
    lv_obj_set_width(line, 320);
    lv_label_set_long_mode(line, LV_LABEL_LONG_WRAP);
    lv_obj_align(line, LV_ALIGN_TOP_MID, 0, 280);

    char server[200];
    snprintf(server, sizeof server, "Server: %s", view->host);
    lv_obj_t *change = ui_button(screen, server, false, on_change_server, NULL);
    lv_obj_set_style_text_font(lv_obj_get_child(change, 0), &font_sans_20, 0);
    lv_obj_set_height(change, 56);
    lv_obj_set_style_max_width(change, 300, 0);
    lv_label_set_long_mode(lv_obj_get_child(change, 0), LV_LABEL_LONG_DOT);
    lv_obj_align(change, LV_ALIGN_BOTTOM_MID, 0, -34);
    ui_load(screen, view->code[0] ? "pairing" : "pairing-waiting");
}

static app_fn server_back;

static void on_server_done(lv_event_t *event)
{
    lv_obj_t *keyboard = lv_event_get_target(event);
    if (lv_event_get_code(event) == LV_EVENT_CANCEL) {
        server_back(NULL);
        return;
    }
    const char *typed = lv_textarea_get_text(lv_keyboard_get_textarea(keyboard));
    while (*typed == ' ') typed++;
    if (!*typed) return;
    char url[SETTINGS_URL_LEN];
    if (strncmp(typed, "http://", 7) == 0 || strncmp(typed, "https://", 8) == 0) {
        strlcpy(url, typed, sizeof url);
    } else {
        snprintf(url, sizeof url, "https://%s", typed);
    }
    size_t len = strlen(url);
    while (len && (url[len - 1] == '/' || url[len - 1] == ' ')) url[--len] = '\0';
    app_set_server(url);
}

void screen_server_show(const char *current, app_fn back)
{
    server_back = back;
    lv_obj_t *screen = ui_screen();
    ui_title(screen, "Bubsie server");
    ui_text_entry_t entry = ui_text_entry(screen, "bubsie.app", false, on_server_done, NULL);
    lv_textarea_set_text(entry.field, current);
    lv_keyboard_set_mode(entry.keyboard, LV_KEYBOARD_MODE_TEXT_LOWER);
    ui_load(screen, "server");
}
