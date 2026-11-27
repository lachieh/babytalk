#include <stdio.h>
#include <string.h>

#include "bz_time.h"
#include "cJSON.h"
#include "screens.h"
#include "settings.h"
#include "station.h"

static const int BACKDATE_MINUTES[] = {0, 5, 10, 15, 30};
#define BACKDATE_COUNT 5

static const char *const WHEN_LEGEND[BZ_TYPE_COUNT] = {"Started", "Fell asleep", "Changed", "Started", "Logged"};

static bz_type_t picker_type;
static const bz_variant_t *picker_variant;
static int picker_minutes;

static void on_back(lv_event_t *event) { screen_station_show(); }

static void show_result(bz_err_t err)
{
    screen_station_show();
    ui_toast_error(err);
}

typedef struct {
    ui_amount_cb cb;
    void *user;
    double value;
} chip_t;

static chip_t chips[3];

static void on_chip(lv_event_t *event)
{
    chip_t *chip = lv_event_get_user_data(event);
    chip->cb(chip->value, chip->user);
}

void ui_amount_picker(lv_obj_t *parent, const char *title, int last_ml, double chosen, ui_amount_cb cb, void *user)
{
    lv_obj_t *label = ui_label(parent, &font_sans_24, ui_pal.text, title);
    lv_obj_set_width(label, 320);
    lv_label_set_long_mode(label, LV_LABEL_LONG_WRAP);
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 72);

    double values[3];
    bz_amount_chips(last_ml, settings.volume_oz, values);
    for (int i = 0; i < 3; i++) {
        chips[i] = (chip_t){cb, user, values[i]};
        bool on = chosen > 0 && chosen == values[i];
        lv_obj_t *chip = lv_button_create(parent);
        lv_obj_remove_style_all(chip);
        lv_obj_set_size(chip, 100, 76);
        lv_obj_align(chip, LV_ALIGN_TOP_MID, (i - 1) * 108, 150);
        lv_obj_set_style_radius(chip, 22, 0);
        lv_obj_set_style_bg_opa(chip, LV_OPA_COVER, 0);
        lv_obj_set_style_bg_color(chip, on ? lv_color_hex(ui_pal.tokens.primary_100) : ui_pal.raised, 0);
        lv_obj_set_style_border_width(chip, 2, 0);
        lv_obj_set_style_border_color(chip, on ? ui_pal.ink : ui_pal.line, 0);
        char text[16];
        snprintf(text, sizeof text, "%g", values[i]);
        lv_obj_t *number = ui_label(chip, &font_sans_30, ui_pal.text, text);
        lv_obj_align(number, LV_ALIGN_CENTER, 0, -10);
        lv_obj_t *unit = ui_label(chip, &font_sans_20, ui_pal.muted, settings.volume_oz ? "oz" : "ml");
        lv_obj_align(unit, LV_ALIGN_CENTER, 0, 20);
        lv_obj_add_event_cb(chip, on_chip, LV_EVENT_CLICKED, &chips[i]);
    }
}

static double finished_amount;

static void log_finished(int amount_ml)
{
    bz_err_t err = station_log(picker_type, picker_variant->meta, picker_minutes, true, amount_ml);
    if (err == BZ_ST_OK) screen_station_pick(picker_type, NULL);
    show_result(err);
}

static void show_finished_amount(void);

static void on_finished_chip(double value, void *user)
{
    finished_amount = value;
    show_finished_amount();
}

static void on_finished_save(lv_event_t *event)
{
    if (finished_amount > 0) log_finished(bz_display_to_ml(finished_amount, settings.volume_oz));
}

static void on_finished_skip(lv_event_t *event) { log_finished(0); }

static void show_finished_amount(void)
{
    lv_obj_t *screen = ui_screen();
    char title[80];
    snprintf(title, sizeof title, "%s, finished", picker_variant->label);
    lv_obj_t *head = ui_title(screen, title);
    lv_obj_set_width(head, 300);
    char ask[64] = "How much?";
    if (picker_minutes > 0) {
        char clock[16];
        bz_format_clock(station_now() - picker_minutes * 60000LL, clock, sizeof clock);
        snprintf(ask, sizeof ask, "How much? Logged at %s.", clock);
    }
    station_lock();
    int last = bz_last_amount_ml(station->view, station->view_count, picker_type);
    station_unlock();
    ui_amount_picker(screen, ask, last, finished_amount, on_finished_chip, NULL);
    lv_obj_t *save = ui_button(screen, "Save feed", true, on_finished_save, NULL);
    lv_obj_set_width(save, 250);
    lv_obj_align(save, LV_ALIGN_TOP_MID, 0, 262);
    if (finished_amount <= 0) lv_obj_add_state(save, LV_STATE_DISABLED);
    lv_obj_t *skip = ui_button(screen, "Skip amount", false, on_finished_skip, NULL);
    lv_obj_set_size(skip, 200, 56);
    lv_obj_align(skip, LV_ALIGN_TOP_MID, 0, 342);
    ui_load(screen, "amount-finished");
}

static void rebuild_picker(void) { screen_picker_show(picker_type, picker_variant); }

static void on_variant(lv_event_t *event)
{
    picker_variant = lv_event_get_user_data(event);
    screen_station_pick(picker_type, picker_variant);
    rebuild_picker();
}

static void on_minutes(lv_event_t *event)
{
    picker_minutes = (int)(intptr_t)lv_event_get_user_data(event);
    rebuild_picker();
}

static void on_primary(lv_event_t *event)
{
    bz_err_t err = station_log(picker_type, picker_variant->meta, picker_minutes, false, 0);
    if (err == BZ_ST_OK) screen_station_pick(picker_type, NULL);
    show_result(err);
}

static void on_already_finished(lv_event_t *event)
{
    if (bz_meta_takes_amount(picker_type, picker_variant->meta)) {
        finished_amount = 0;
        show_finished_amount();
        return;
    }
    log_finished(0);
}

void screen_picker_show(bz_type_t type, const bz_variant_t *selected)
{
    if (type != picker_type || !picker_variant) picker_minutes = 0;
    picker_type = type;
    picker_variant = selected;
    lv_obj_t *screen = ui_screen();
    lv_obj_t *list = ui_round_list(screen, 100, 70);
    ui_title(screen, bz_type_label(type));
    ui_back_button(screen, on_back, NULL);

    size_t count;
    const bz_variant_t *variants = bz_variants(type, &count);
    for (size_t i = 0; i < count; i++) {
        lv_obj_t *row = ui_row(list, variants[i].label, NULL, on_variant, (void *)&variants[i]);
        if (&variants[i] == selected) {
            lv_obj_add_state(row, LV_STATE_CHECKED);
            lv_obj_t *check = ui_icon(row, &icon_check_32, ui_pal.ink);
            lv_obj_add_flag(check, LV_OBJ_FLAG_IGNORE_LAYOUT);
            lv_obj_align(check, LV_ALIGN_RIGHT_MID, 0, 0);
        }
    }

    char legend[80];
    if (picker_minutes > 0) {
        char clock[16];
        bz_format_clock(station_now() - picker_minutes * 60000LL, clock, sizeof clock);
        snprintf(legend, sizeof legend, "%s %d minutes ago, at %s", WHEN_LEGEND[type], picker_minutes, clock);
    } else {
        snprintf(legend, sizeof legend, "%s just now", WHEN_LEGEND[type]);
    }
    lv_obj_t *when = ui_label(list, &font_sans_20, ui_pal.muted, legend);
    lv_obj_set_width(when, 300);
    lv_label_set_long_mode(when, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_margin_top(when, 10, 0);

    lv_obj_t *chips_row = lv_obj_create(list);
    lv_obj_remove_style_all(chips_row);
    lv_obj_set_size(chips_row, 330, 62);
    lv_obj_set_flex_flow(chips_row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(chips_row, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    for (int i = 0; i < BACKDATE_COUNT; i++) {
        bool on = BACKDATE_MINUTES[i] == picker_minutes;
        lv_obj_t *chip = lv_button_create(chips_row);
        lv_obj_remove_style_all(chip);
        lv_obj_set_size(chip, 62, 62);
        lv_obj_set_style_radius(chip, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_opa(chip, LV_OPA_COVER, 0);
        lv_obj_set_style_bg_color(chip, on ? ui_pal.primary : ui_pal.raised, 0);
        lv_obj_set_style_border_width(chip, on ? 0 : 2, 0);
        lv_obj_set_style_border_color(chip, ui_pal.line, 0);
        char text[8];
        if (BACKDATE_MINUTES[i] == 0) {
            snprintf(text, sizeof text, "Now");
        } else {
            snprintf(text, sizeof text, "%dm", BACKDATE_MINUTES[i]);
        }
        lv_obj_t *label = ui_label(chip, &font_sans_20, on ? ui_pal.on_primary : ui_pal.text, text);
        lv_obj_center(label);
        lv_obj_add_event_cb(chip, on_minutes, LV_EVENT_CLICKED, (void *)(intptr_t)BACKDATE_MINUTES[i]);
    }

    bool timer = bz_starts_timer(type, selected->meta);
    char primary[32];
    if (timer) {
        snprintf(primary, sizeof primary, "Start timer");
    } else {
        snprintf(primary, sizeof primary, "Log %s", bz_type_name(type));
    }
    lv_obj_t *go = ui_button(list, primary, true, on_primary, NULL);
    lv_obj_set_width(go, 260);
    lv_obj_set_style_margin_top(go, 12, 0);
    if (type == BZ_FEED && timer) {
        lv_obj_t *done = ui_button(list, "Already finished", false, on_already_finished, NULL);
        lv_obj_set_width(done, 260);
    }
    ui_round_list_fit(list);
    ui_load(screen, "picker");
}

static void on_note_done(lv_event_t *event)
{
    lv_obj_t *keyboard = lv_event_get_target(event);
    if (lv_event_get_code(event) == LV_EVENT_CANCEL) {
        screen_station_show();
        return;
    }
    const char *text = lv_textarea_get_text(lv_keyboard_get_textarea(keyboard));
    while (*text == ' ') text++;
    if (!*text) {
        screen_station_show();
        return;
    }
    cJSON *meta = cJSON_CreateObject();
    cJSON_AddStringToObject(meta, "text", text);
    char json[BZ_META_LEN];
    bool ok = cJSON_PrintPreallocated(meta, json, sizeof json, false);
    cJSON_Delete(meta);
    if (!ok) return;
    show_result(station_log(BZ_NOTE, json, 0, true, 0));
}

void screen_note_show(void)
{
    lv_obj_t *screen = ui_screen();
    ui_title(screen, "Quick note");
    ui_text_entry_t entry = ui_text_entry(screen, "Anything to remember", false, on_note_done, NULL);
    lv_textarea_set_max_length(entry.field, 200);
    ui_load(screen, "note");
}

static bz_baby_t baby_list[STATION_BABIES_MAX];

static void on_choose_baby(lv_event_t *event)
{
    const bz_baby_t *baby = lv_event_get_user_data(event);
    station_choose_baby(baby->id);
    screen_station_show();
}

void screen_babies_show(void)
{
    lv_obj_t *screen = ui_screen();
    lv_obj_t *list = ui_round_list(screen, 110, 110);
    ui_title(screen, "Baby");
    ui_back_button(screen, on_back, NULL);
    int count = station_babies(baby_list, STATION_BABIES_MAX);
    for (int i = 0; i < count; i++) {
        lv_obj_t *row = ui_row(list, baby_list[i].name, NULL, on_choose_baby, &baby_list[i]);
        lv_obj_set_style_text_font(lv_obj_get_child(row, 0), &font_serif_40, 0);
        if (strcmp(baby_list[i].id, station->baby_id) == 0) lv_obj_add_state(row, LV_STATE_CHECKED);
    }
    ui_round_list_fit(list);
    ui_load(screen, "babies");
}

void screen_no_baby_show(void)
{
    lv_obj_t *screen = ui_screen();
    lv_obj_t *mark = ui_icon(screen, &pebble_outer, lv_color_hex(ui_pal.tokens.primary_100));
    lv_obj_align(mark, LV_ALIGN_CENTER, 0, -70);
    theme_breathe(mark, 5000);
    lv_obj_t *text = ui_label(screen, &font_sans_24, ui_pal.text, "Add your baby in Bubsie on your phone. They'll show up here.");
    lv_obj_set_width(text, 300);
    lv_label_set_long_mode(text, LV_LABEL_LONG_WRAP);
    lv_obj_align(text, LV_ALIGN_CENTER, 0, 70);
    ui_load(screen, "no-baby");
}
