#include "theme.h"

static const bubsie_palette_t LIGHT = BUBSIE_PALETTE_LIGHT;
static const bubsie_palette_t DARK = BUBSIE_PALETTE_DARK;

ui_palette_t ui_pal;
static bool dark;
static bool reduced_motion;

static void apply(void)
{
    const bubsie_palette_t *t = dark ? &DARK : &LIGHT;
    ui_pal.tokens = *t;
    // AMOLED: black pixels are off, so the night background is true black, not the web's charcoal.
    ui_pal.bg = dark ? lv_color_black() : lv_color_hex(t->surface);
    ui_pal.raised = lv_color_hex(t->surface_raised);
    ui_pal.sunken = lv_color_hex(dark ? t->surface : t->surface_sunken);
    ui_pal.text = lv_color_hex(t->neutral_800);
    ui_pal.muted = lv_color_hex(t->neutral_500);
    ui_pal.faint = lv_color_hex(t->neutral_300);
    ui_pal.line = lv_color_hex(t->neutral_200);
    ui_pal.primary = lv_color_hex(t->primary_500);
    ui_pal.on_primary = lv_color_hex(dark ? t->neutral_900 : 0xffffff);
    ui_pal.ink = lv_color_hex(t->primary_ink);
}

void theme_init(void) { apply(); }

void theme_set_dark(bool value)
{
    dark = value;
    apply();
}

bool theme_is_dark(void) { return dark; }
void theme_set_reduced_motion(bool value) { reduced_motion = value; }
bool theme_reduced_motion(void) { return reduced_motion; }

#define PICK(type, shade)                                                \
    switch (type) {                                                      \
    case BZ_FEED: return lv_color_hex(ui_pal.tokens.feed_##shade);       \
    case BZ_SLEEP: return lv_color_hex(ui_pal.tokens.sleep_##shade);     \
    case BZ_DIAPER: return lv_color_hex(ui_pal.tokens.diaper_##shade);   \
    case BZ_PUMP: return lv_color_hex(ui_pal.tokens.pump_##shade);       \
    default: break;                                                      \
    }

lv_color_t theme_event_bg(bz_type_t type)
{
    PICK(type, 50);
    return lv_color_hex(ui_pal.tokens.note_50);
}

lv_color_t theme_event_border(bz_type_t type)
{
    PICK(type, 200);
    return lv_color_hex(ui_pal.tokens.note_200);
}

lv_color_t theme_event_icon(bz_type_t type)
{
    PICK(type, 500);
    return lv_color_hex(ui_pal.tokens.neutral_400);
}

const lv_image_dsc_t *theme_event_icon_64(bz_type_t type)
{
    static const lv_image_dsc_t *const ICONS[] = {&icon_feed_64, &icon_sleep_64, &icon_diaper_64, &icon_pump_64,
                                                  &icon_note_64};
    return ICONS[type < BZ_TYPE_COUNT ? type : BZ_NOTE];
}

const lv_image_dsc_t *theme_event_icon_32(bz_type_t type)
{
    static const lv_image_dsc_t *const ICONS[] = {&icon_feed_32, &icon_sleep_32, &icon_diaper_32, &icon_pump_32,
                                                  &icon_note_32};
    return ICONS[type < BZ_TYPE_COUNT ? type : BZ_NOTE];
}

static void set_opa(void *obj, int32_t value) { lv_obj_set_style_opa(obj, (lv_opa_t)value, 0); }

void theme_breathe(lv_obj_t *obj, uint32_t period_ms)
{
    if (reduced_motion) {
        lv_obj_set_style_opa(obj, LV_OPA_70, 0);
        return;
    }
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, obj);
    lv_anim_set_exec_cb(&a, set_opa);
    lv_anim_set_values(&a, LV_OPA_40, LV_OPA_COVER);
    lv_anim_set_duration(&a, period_ms / 2);
    lv_anim_set_playback_duration(&a, period_ms / 2);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_in_out);
    lv_anim_start(&a);
}

lv_obj_t *ui_screen(void)
{
    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(screen, ui_pal.bg, 0);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);
    lv_obj_set_style_text_color(screen, ui_pal.text, 0);
    lv_obj_set_style_text_font(screen, &font_sans_24, 0);
    lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
    return screen;
}

lv_obj_t *ui_label(lv_obj_t *parent, const lv_font_t *font, lv_color_t color, const char *text)
{
    lv_obj_t *label = lv_label_create(parent);
    lv_obj_set_style_text_font(label, font, 0);
    lv_obj_set_style_text_color(label, color, 0);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_text(label, text ? text : "");
    return label;
}

lv_obj_t *ui_icon(lv_obj_t *parent, const lv_image_dsc_t *icon, lv_color_t color)
{
    lv_obj_t *image = lv_image_create(parent);
    lv_image_set_src(image, icon);
    lv_obj_set_style_image_recolor(image, color, 0);
    lv_obj_set_style_image_recolor_opa(image, LV_OPA_COVER, 0);
    lv_obj_remove_flag(image, LV_OBJ_FLAG_CLICKABLE);
    return image;
}

static void press_feedback(lv_obj_t *obj)
{
    // The web's active:scale-[0.97], skipped with reduced motion.
    if (reduced_motion) return;
    lv_obj_set_style_transform_scale(obj, 248, LV_STATE_PRESSED);
    lv_obj_set_style_transform_pivot_x(obj, lv_pct(50), 0);
    lv_obj_set_style_transform_pivot_y(obj, lv_pct(50), 0);
}

lv_obj_t *ui_button(lv_obj_t *parent, const char *text, bool primary, lv_event_cb_t cb, void *user)
{
    lv_obj_t *button = lv_button_create(parent);
    lv_obj_remove_style_all(button);
    lv_obj_set_height(button, UI_TOUCH);
    lv_obj_set_style_min_width(button, 120, 0);
    lv_obj_set_style_pad_hor(button, 28, 0);
    lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(button, LV_OPA_COVER, 0);
    if (primary) {
        lv_obj_set_style_bg_color(button, ui_pal.primary, 0);
        lv_obj_set_style_bg_color(button, lv_color_hex(ui_pal.tokens.primary_600), LV_STATE_PRESSED);
    } else {
        lv_obj_set_style_bg_color(button, ui_pal.raised, 0);
        lv_obj_set_style_bg_color(button, lv_color_hex(ui_pal.tokens.neutral_100), LV_STATE_PRESSED);
        lv_obj_set_style_border_width(button, 2, 0);
        lv_obj_set_style_border_color(button, ui_pal.faint, 0);
    }
    lv_obj_set_style_bg_color(button, ui_pal.line, LV_STATE_DISABLED);
    press_feedback(button);
    lv_obj_t *label = ui_label(button, &font_sans_24, primary ? ui_pal.on_primary : ui_pal.text, text);
    lv_obj_set_style_text_color(label, ui_pal.muted, LV_STATE_DISABLED);
    lv_obj_center(label);
    if (cb) lv_obj_add_event_cb(button, cb, LV_EVENT_CLICKED, user);
    return button;
}

lv_obj_t *ui_row(lv_obj_t *parent, const char *text, const char *detail, lv_event_cb_t cb, void *user)
{
    lv_obj_t *row = lv_button_create(parent);
    lv_obj_remove_style_all(row);
    lv_obj_set_width(row, lv_pct(100));
    lv_obj_set_height(row, LV_SIZE_CONTENT);
    lv_obj_set_style_min_height(row, UI_TOUCH + 8, 0);
    lv_obj_set_style_pad_hor(row, 24, 0);
    lv_obj_set_style_pad_ver(row, 10, 0);
    lv_obj_set_style_radius(row, 24, 0);
    lv_obj_set_style_bg_opa(row, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(row, ui_pal.raised, 0);
    lv_obj_set_style_bg_color(row, lv_color_hex(ui_pal.tokens.neutral_100), LV_STATE_PRESSED);
    lv_obj_set_style_bg_color(row, lv_color_hex(ui_pal.tokens.primary_100), LV_STATE_CHECKED);
    lv_obj_set_flex_flow(row, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(row, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
    lv_obj_t *title = ui_label(row, &font_sans_24, ui_pal.text, text);
    lv_obj_set_style_text_align(title, LV_TEXT_ALIGN_LEFT, 0);
    lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);
    lv_obj_set_width(title, lv_pct(100));
    if (detail) {
        lv_obj_t *sub = ui_label(row, &font_sans_20, ui_pal.muted, detail);
        lv_obj_set_style_text_align(sub, LV_TEXT_ALIGN_LEFT, 0);
        lv_label_set_long_mode(sub, LV_LABEL_LONG_DOT);
        lv_obj_set_width(sub, lv_pct(100));
    }
    if (cb) lv_obj_add_event_cb(row, cb, LV_EVENT_CLICKED, user);
    return row;
}
