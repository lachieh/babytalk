// The web's design tokens on the round panel: palette (light, and AMOLED-black dark), fonts,
// geometry of the circle, and the shared "breathe" pulse.
#pragma once

#include <stdbool.h>

#include "bz_event.h"
#include "fonts.h"
#include "icons.h"
#include "lvgl.h"
#include "tokens.h"

#define UI_SIZE 466
#define UI_CENTER (UI_SIZE / 2)
/* The largest square inside the circle is ~330px; content stays in it or follows the curve. */
#define UI_SAFE 330
/* A 44 CSS px touch target on a phone is ~60 px on this panel. */
#define UI_TOUCH 64

typedef struct {
    bubsie_palette_t tokens;
    lv_color_t bg;      /* screen: surface by day, pure black at night */
    lv_color_t raised;  /* cards, sheets */
    lv_color_t sunken;
    lv_color_t text;    /* neutral-800 */
    lv_color_t muted;   /* neutral-500 */
    lv_color_t faint;   /* neutral-300 */
    lv_color_t line;    /* neutral-200 */
    lv_color_t primary; /* primary-500: filled buttons */
    lv_color_t on_primary;
    lv_color_t ink;     /* primary-ink: text links, selection */
} ui_palette_t;

extern ui_palette_t ui_pal;

void theme_init(void);
/** Switch palettes; screens rebuild themselves on UI_EVENT_THEME. */
void theme_set_dark(bool dark);
bool theme_is_dark(void);
void theme_set_reduced_motion(bool reduced);
bool theme_reduced_motion(void);

/* Per-event colours, from lib/event-styles.tsx (bg 50, border 200, icon 500, ink 600). */
lv_color_t theme_event_bg(bz_type_t type);
lv_color_t theme_event_border(bz_type_t type);
lv_color_t theme_event_pressed(bz_type_t type);
lv_color_t theme_event_icon(bz_type_t type);
const lv_image_dsc_t *theme_event_icon_64(bz_type_t type);
const lv_image_dsc_t *theme_event_icon_32(bz_type_t type);

/** The web's `animate-breathe`: opacity 40% -> 100% -> 40% over 2 s. A still 70% with reduced motion. */
void theme_breathe(lv_obj_t *obj, uint32_t period_ms);

/* Building blocks with the brand's shapes. */
lv_obj_t *ui_screen(void);
lv_obj_t *ui_label(lv_obj_t *parent, const lv_font_t *font, lv_color_t color, const char *text);
lv_obj_t *ui_icon(lv_obj_t *parent, const lv_image_dsc_t *icon, lv_color_t color);
/** A filled pill button (primary) or an outlined one (secondary). */
lv_obj_t *ui_button(lv_obj_t *parent, const char *text, bool primary, lv_event_cb_t cb, void *user);
/** A list row the full width of `parent`, at least UI_TOUCH high. */
lv_obj_t *ui_row(lv_obj_t *parent, const char *text, const char *detail, lv_event_cb_t cb, void *user);
