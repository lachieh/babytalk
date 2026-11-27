#include <math.h>
#include <string.h>

#include "esp_log.h"
#include "sdkconfig.h"
#include "screens.h"

static const char *TAG = "screen";

bool screen_named(lv_obj_t *screen, const char *name)
{
    const char *loaded = screen ? lv_obj_get_user_data(screen) : NULL;
    return loaded && strcmp(loaded, name) == 0;
}

#if CONFIG_BUBSIE_UI_TRACE
// Button areas are private to LVGL; only the trace build reads them.
#include "src/widgets/buttonmatrix/lv_buttonmatrix_private.h"

static const char *key_name(const char *text)
{
    if (strcmp(text, LV_SYMBOL_OK) == 0) return "OK";
    if (strcmp(text, LV_SYMBOL_BACKSPACE) == 0) return "Backspace";
    if (strcmp(text, LV_SYMBOL_KEYBOARD) == 0) return "Hide";
    return text;
}

/* Each key of a keyboard (a button matrix is one object, so its keys are traced one by one). */
static void trace_keys(lv_obj_t *obj)
{
    const lv_buttonmatrix_t *matrix = (const lv_buttonmatrix_t *)obj;
    lv_area_t at;
    lv_obj_get_coords(obj, &at);
    for (uint32_t i = 0; i < matrix->btn_cnt; i++) {
        const char *text = lv_buttonmatrix_get_button_text(obj, i);
        if (!text || !text[0]) continue;
        const lv_area_t *key = &matrix->button_areas[i];
        ESP_LOGI("ui", "at %d,%d key %s", (int)(at.x1 + (key->x1 + key->x2) / 2), (int)(at.y1 + (key->y1 + key->y2) / 2),
                 key_name(text));
    }
}

static const char *label_of(lv_obj_t *obj)
{
    if (lv_obj_check_type(obj, &lv_label_class)) return lv_label_get_text(obj);
    uint32_t count = lv_obj_get_child_count(obj);
    for (uint32_t i = 0; i < count; i++) {
        const char *text = label_of(lv_obj_get_child(obj, i));
        if (text && text[0]) return text;
    }
    return NULL;
}

static void trace_targets(lv_obj_t *obj)
{
    uint32_t count = lv_obj_get_child_count(obj);
    for (uint32_t i = 0; i < count; i++) {
        lv_obj_t *child = lv_obj_get_child(obj, i);
        if (lv_obj_has_flag(child, LV_OBJ_FLAG_HIDDEN)) continue;
        if (lv_obj_check_type(child, &lv_keyboard_class)) {
            trace_keys(child);
            continue;
        }
        // A target is something that answers a touch: clickable, with a handler of its own.
        if (lv_obj_has_flag(child, LV_OBJ_FLAG_CLICKABLE) && lv_obj_get_event_count(child) > 0) {
            lv_area_t a;
            lv_obj_get_coords(child, &a);
            int x = (a.x1 + a.x2) / 2, y = (a.y1 + a.y2) / 2;
            int dx = x - UI_CENTER, dy = y - UI_CENTER;
            const char *text = label_of(child);
            if (dx * dx + dy * dy < (UI_CENTER - 8) * (UI_CENTER - 8) && x >= 0 && x < UI_SIZE) {
                ESP_LOGI("ui", "at %d,%d %s", x, y, text ? text : "(icon)");
            }
        }
        trace_targets(child);
    }
}

static void trace_now(lv_timer_t *timer)
{
    lv_obj_t *screen = lv_timer_get_user_data(timer);
    if (lv_screen_active() != screen) return;
    lv_obj_update_layout(screen);
    ESP_LOGI("ui", "targets");
    trace_targets(screen);
    trace_targets(lv_layer_top());
}

void ui_trace(lv_obj_t *screen)
{
    lv_timer_t *timer = lv_timer_create(trace_now, 30, screen);
    lv_timer_set_repeat_count(timer, 1);
}

static void trace_after_scroll(lv_event_t *event) { ui_trace(lv_screen_active()); }
#else
void ui_trace(lv_obj_t *screen) {}
#endif

void ui_load(lv_obj_t *screen, const char *name)
{
    lv_obj_set_user_data(screen, (void *)name);
    ui_trace(screen);
    lv_screen_load_anim(screen, LV_SCREEN_LOAD_ANIM_NONE, 0, 0, true);
    ESP_LOGI(TAG, "%s", name);
}

/* Half the width of the circle at height y, less a margin. */
static int chord_half(int y, int margin)
{
    int dy = y - UI_CENTER;
    int r = UI_CENTER - margin;
    if (dy <= -r || dy >= r) return 0;
    return (int)sqrtf((float)(r * r - dy * dy));
}

static void fit_to_curve(lv_obj_t *list)
{
    uint32_t count = lv_obj_get_child_count(list);
    for (uint32_t i = 0; i < count; i++) {
        lv_obj_t *row = lv_obj_get_child(list, i);
        lv_area_t area;
        lv_obj_get_coords(row, &area);
        // The narrower of the row's two edges sets its width, so its corners stay on the glass.
        int half = LV_MIN(chord_half(area.y1, 16), chord_half(area.y2, 16));
        int width = LV_CLAMP(160, 2 * half, UI_SAFE + 30);
        if (lv_obj_get_width(row) != width) lv_obj_set_width(row, width);
    }
}

static void follow_curve(lv_event_t *event) { fit_to_curve(lv_event_get_target(event)); }

static void fit_after_layout(lv_timer_t *timer)
{
    lv_obj_t *list = lv_timer_get_user_data(timer);
    lv_obj_update_layout(list);
    fit_to_curve(list);
}

void ui_round_list_fit(lv_obj_t *list)
{
    lv_timer_t *timer = lv_timer_create(fit_after_layout, 0, list);
    lv_timer_set_repeat_count(timer, 1);
}

lv_obj_t *ui_round_list(lv_obj_t *screen, int top_pad, int bottom_pad)
{
    lv_obj_t *list = lv_obj_create(screen);
    lv_obj_remove_style_all(list);
    lv_obj_set_size(list, UI_SIZE, UI_SIZE);
    lv_obj_set_flex_flow(list, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(list, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_top(list, top_pad, 0);
    lv_obj_set_style_pad_bottom(list, bottom_pad, 0);
    lv_obj_set_style_pad_row(list, 10, 0);
    lv_obj_set_scrollbar_mode(list, LV_SCROLLBAR_MODE_OFF);
    lv_obj_set_scroll_dir(list, LV_DIR_VER);
    lv_obj_add_event_cb(list, follow_curve, LV_EVENT_SCROLL, NULL);
#if CONFIG_BUBSIE_UI_TRACE
    lv_obj_add_event_cb(list, trace_after_scroll, LV_EVENT_SCROLL_END, NULL);
#endif
    return list;
}

lv_obj_t *ui_title(lv_obj_t *parent, const char *text)
{
    lv_obj_t *title = ui_label(parent, &font_sans_24, ui_pal.muted, text);
    lv_obj_set_width(title, 240);
    lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 34);
    return title;
}

lv_obj_t *ui_back_button(lv_obj_t *parent, lv_event_cb_t cb, void *user)
{
    lv_obj_t *button = lv_button_create(parent);
    lv_obj_remove_style_all(button);
    lv_obj_set_size(button, UI_TOUCH, UI_TOUCH);
    lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(button, LV_OPA_COVER, LV_STATE_PRESSED);
    lv_obj_set_style_bg_color(button, lv_color_hex(ui_pal.tokens.neutral_100), LV_STATE_PRESSED);
    lv_obj_align(button, LV_ALIGN_TOP_MID, -118, 52);
    lv_obj_t *icon = ui_icon(button, &icon_back_32, ui_pal.muted);
    lv_obj_center(icon);
    lv_obj_add_event_cb(button, cb, LV_EVENT_CLICKED, user);
    return button;
}

static void keyboard_event(lv_event_t *event)
{
    lv_event_code_t code = lv_event_get_code(event);
    lv_event_cb_t done = (lv_event_cb_t)lv_event_get_user_data(event);
    if (code == LV_EVENT_READY || code == LV_EVENT_CANCEL) done(event);
}

ui_text_entry_t ui_text_entry(lv_obj_t *screen, const char *placeholder, bool password, lv_event_cb_t on_done,
                              void *user)
{
    ui_text_entry_t entry;
    entry.field = lv_textarea_create(screen);
    lv_textarea_set_one_line(entry.field, true);
    lv_textarea_set_password_mode(entry.field, password);
    lv_textarea_set_placeholder_text(entry.field, placeholder);
    lv_obj_set_size(entry.field, 320, 58);
    lv_obj_align(entry.field, LV_ALIGN_TOP_MID, 0, 80);
    lv_obj_set_style_radius(entry.field, 30, 0);
    lv_obj_set_style_bg_color(entry.field, ui_pal.raised, 0);
    lv_obj_set_style_border_color(entry.field, ui_pal.faint, 0);
    lv_obj_set_style_border_color(entry.field, ui_pal.ink, LV_STATE_FOCUSED);
    lv_obj_set_style_text_color(entry.field, ui_pal.text, 0);
    lv_obj_set_style_text_font(entry.field, &font_sans_24, 0);
    lv_obj_set_style_pad_hor(entry.field, 22, 0);
    lv_obj_set_style_pad_ver(entry.field, 14, 0);
    lv_obj_set_style_text_color(entry.field, ui_pal.muted, LV_PART_TEXTAREA_PLACEHOLDER);
    lv_obj_set_style_bg_color(entry.field, ui_pal.ink, LV_PART_CURSOR);
    lv_obj_add_state(entry.field, LV_STATE_FOCUSED);

    entry.keyboard = lv_keyboard_create(screen);
    lv_keyboard_set_textarea(entry.keyboard, entry.field);
    lv_keyboard_set_popovers(entry.keyboard, true);
    // Between y 146 and 380 the circle is at least 360 px wide, so every key sits on the glass.
    lv_obj_set_size(entry.keyboard, 352, 234);
    lv_obj_align(entry.keyboard, LV_ALIGN_TOP_MID, 0, 146);
    lv_obj_set_style_bg_opa(entry.keyboard, LV_OPA_TRANSP, 0);
    lv_obj_set_style_pad_all(entry.keyboard, 0, 0);
    lv_obj_set_style_pad_gap(entry.keyboard, 4, 0);
    lv_obj_set_style_border_width(entry.keyboard, 0, 0);
    lv_obj_set_style_bg_color(entry.keyboard, ui_pal.raised, LV_PART_ITEMS);
    lv_obj_set_style_bg_color(entry.keyboard, lv_color_hex(ui_pal.tokens.neutral_100), LV_PART_ITEMS | LV_STATE_CHECKED);
    lv_obj_set_style_bg_color(entry.keyboard, lv_color_hex(ui_pal.tokens.primary_100), LV_PART_ITEMS | LV_STATE_PRESSED);
    lv_obj_set_style_text_color(entry.keyboard, ui_pal.text, LV_PART_ITEMS);
    lv_obj_set_style_text_font(entry.keyboard, &font_sans_20, LV_PART_ITEMS);
    lv_obj_set_style_radius(entry.keyboard, 12, LV_PART_ITEMS);
    lv_obj_set_style_border_width(entry.keyboard, 0, LV_PART_ITEMS);
    lv_obj_set_style_shadow_width(entry.keyboard, 0, LV_PART_ITEMS);
    lv_obj_add_event_cb(entry.keyboard, keyboard_event, LV_EVENT_ALL, (void *)on_done);
    lv_obj_set_user_data(entry.keyboard, user);
    return entry;
}
