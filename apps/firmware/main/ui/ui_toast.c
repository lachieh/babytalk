// The undo toast (components/undo-toast.tsx): what just happened, Undo when it can be undone, and
// a thin bar for the five seconds it stays. It floats on the top layer over every screen.
#include <stdio.h>
#include <string.h>

#include "esp_log.h"
#include "screens.h"
#include "settings.h"
#include "station.h"

static lv_obj_t *toast;
static lv_obj_t *bar;
static char shown_key[80];
static bz_ms_t started, expires;

static void on_undo(lv_event_t *event)
{
    station_undo();
    ui_toast_hide();
    screen_station_refresh();
}

static void build(const char *text, bool can_undo)
{
    ui_toast_hide();
    toast = lv_obj_create(lv_layer_top());
    lv_obj_remove_style_all(toast);
    lv_obj_set_size(toast, 320, 68);
    lv_obj_align(toast, LV_ALIGN_BOTTOM_MID, 0, -40);
    lv_obj_set_style_radius(toast, 22, 0);
    lv_obj_set_style_bg_opa(toast, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(toast, ui_pal.raised, 0);
    lv_obj_set_style_border_width(toast, 2, 0);
    lv_obj_set_style_border_color(toast, ui_pal.line, 0);
    lv_obj_set_style_shadow_width(toast, 24, 0);
    lv_obj_set_style_shadow_opa(toast, LV_OPA_20, 0);
    lv_obj_set_style_clip_corner(toast, true, 0);
    lv_obj_remove_flag(toast, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *label = ui_label(toast, &font_sans_20, ui_pal.text, text);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_LEFT, 0);
    lv_obj_set_width(label, can_undo ? 210 : 290);
    lv_label_set_long_mode(label, LV_LABEL_LONG_DOT);
    lv_obj_set_height(label, LV_SIZE_CONTENT);
    lv_obj_set_style_max_height(label, 52, 0);
    lv_obj_align(label, LV_ALIGN_LEFT_MID, 16, 0);

    if (can_undo) {
        lv_obj_t *undo = lv_button_create(toast);
        lv_obj_remove_style_all(undo);
        lv_obj_set_size(undo, 84, 60);
        lv_obj_align(undo, LV_ALIGN_RIGHT_MID, -2, 0);
        lv_obj_set_style_radius(undo, 18, 0);
        lv_obj_set_style_bg_opa(undo, LV_OPA_COVER, LV_STATE_PRESSED);
        lv_obj_set_style_bg_color(undo, lv_color_hex(ui_pal.tokens.primary_100), LV_STATE_PRESSED);
        lv_obj_t *text_undo = ui_label(undo, &font_sans_24, ui_pal.ink, "Undo");
        lv_obj_center(text_undo);
        lv_obj_add_event_cb(undo, on_undo, LV_EVENT_CLICKED, NULL);
    }
    bar = lv_obj_create(toast);
    lv_obj_remove_style_all(bar);
    lv_obj_set_size(bar, 320, 3);
    lv_obj_align(bar, LV_ALIGN_BOTTOM_LEFT, 0, 0);
    lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(bar, lv_color_hex(ui_pal.tokens.primary_400), 0);
    ESP_LOGI("toast", "%s%s", text, can_undo ? " [Undo]" : "");
    ui_trace(lv_screen_active());
}

void ui_toast_hide(void)
{
    if (toast) lv_obj_delete(toast);
    toast = NULL;
    bar = NULL;
    shown_key[0] = '\0';
}

void ui_toast_message(const char *text)
{
    build(text, false);
    strcpy(shown_key, "message");
    started = station_now();
    expires = started + 3500;
}

void ui_toast_error(bz_err_t err)
{
    if (err == BZ_ERR_NO_CLOCK) ui_toast_message("The clock is still setting. Try again in a moment.");
    else if (err == BZ_ERR_NO_BABY) ui_toast_message("Still loading. Try again in a moment.");
    else if (err == BZ_ERR_FULL) ui_toast_message("Too many changes waiting to send. Check Wi-Fi.");
    else if (err == BZ_ERR_TOO_LONG) ui_toast_message("This one has too much detail to change here. Use the app.");
}

void ui_toast_tick(void)
{
    bz_ms_t now = station_now();
    if (strcmp(shown_key, "message") == 0) {
        if (now >= expires) ui_toast_hide();
    } else {
        station_lock();
        bz_toast_state_t state = station->toast;
        station_unlock();
        char key[sizeof shown_key];
        snprintf(key, sizeof key, "%s %d %lld", state.event.id, state.phase, (long long)state.expires);
        if (!state.shown || now >= state.expires) {
            if (toast) ui_toast_hide();
            return;
        }
        if (strcmp(key, shown_key) != 0) {
            char text[120];
            bz_toast_copy(&state.event, state.phase, settings.volume_oz, text, sizeof text);
            build(text, state.can_undo);
            strlcpy(shown_key, key, sizeof shown_key);
            started = state.expires - BZ_UNDO_MS;
            expires = state.expires;
        }
    }
    if (bar && expires > started) {
        bz_ms_t left = expires - now;
        lv_obj_set_width(bar, (int32_t)(320 * (left > 0 ? left : 0) / (expires - started)));
    }
}
