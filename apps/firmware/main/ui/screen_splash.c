#include "screens.h"

void screen_splash_show(const char *status)
{
    lv_obj_t *screen = ui_screen();

    lv_obj_t *mark = lv_obj_create(screen);
    lv_obj_remove_style_all(mark);
    lv_obj_set_size(mark, 160, 160);
    lv_obj_align(mark, LV_ALIGN_CENTER, 0, -56);
    lv_obj_t *outer = ui_icon(mark, &pebble_outer, lv_color_hex(ui_pal.tokens.primary_100));
    lv_obj_center(outer);
    theme_breathe(outer, 5000);
    lv_obj_t *inner = ui_icon(mark, &pebble_inner, lv_color_hex(ui_pal.tokens.primary_300));
    lv_obj_center(inner);

    lv_obj_t *word = ui_label(screen, &font_serif_72, ui_pal.text, "bubsie");
    lv_obj_align(word, LV_ALIGN_CENTER, 0, 70);

    lv_obj_t *line = ui_label(screen, &font_sans_20, ui_pal.muted, status);
    lv_obj_align(line, LV_ALIGN_CENTER, 0, 128);

    ui_load(screen, "splash");
}
