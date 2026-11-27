#pragma once

#include <stdbool.h>

#include "bz_event.h"
#include "fonts.h"
#include "icons.h"
#include "lvgl.h"
#include "tokens.h"

#define UI_SIZE 466
#define UI_CENTER (UI_SIZE / 2)
#define UI_SAFE 330
#define UI_TOUCH 64

typedef struct {
    bubsie_palette_t tokens;
    lv_color_t bg;
    lv_color_t raised;
    lv_color_t sunken;
    lv_color_t text;
    lv_color_t muted;
    lv_color_t faint;
    lv_color_t line;
    lv_color_t primary;
    lv_color_t on_primary;
    lv_color_t ink;
} ui_palette_t;

extern ui_palette_t ui_pal;

void theme_init(void);
void theme_set_dark(bool dark);
bool theme_is_dark(void);
void theme_set_reduced_motion(bool reduced);
bool theme_reduced_motion(void);

lv_color_t theme_event_bg(bz_type_t type);
lv_color_t theme_event_border(bz_type_t type);
lv_color_t theme_event_pressed(bz_type_t type);
lv_color_t theme_event_icon(bz_type_t type);
const lv_image_dsc_t *theme_event_icon_64(bz_type_t type);
const lv_image_dsc_t *theme_event_icon_32(bz_type_t type);

void theme_breathe(lv_obj_t *obj, uint32_t period_ms);

lv_obj_t *ui_screen(void);
lv_obj_t *ui_label(lv_obj_t *parent, const lv_font_t *font, lv_color_t color, const char *text);
lv_obj_t *ui_icon(lv_obj_t *parent, const lv_image_dsc_t *icon, lv_color_t color);
lv_obj_t *ui_button(lv_obj_t *parent, const char *text, bool primary, lv_event_cb_t cb, void *user);
lv_obj_t *ui_row(lv_obj_t *parent, const char *text, const char *detail, lv_event_cb_t cb, void *user);
