// The station: one event type per page, swiped sideways, then a Settings page.
//
// Why one tile per page: the web's 2-column grid does not fit a 466 px circle with targets big
// enough for a thumb, and a radial menu of five puts every target at the rim, where the bezel and
// curve make it hardest to hit. A page puts a single 232 px button in the middle of the glass (one
// tap logs the inferred default, as on the web), with the variant under it and how long ago it
// last happened inside it: readable at a glance, completable with a thumb, swiping for the rest.
//
// Each page is one of: the type's button (idle), its running timer, or its amount prompt.
#include <stdio.h>
#include <string.h>

#include "app.h"
#include "buttons.h"
#include "bz_time.h"
#include "esp_log.h"
#include "screens.h"
#include "settings.h"
#include "station.h"

static const char *TAG = "screen";

/* The web's TILE_ORDER, then Settings. */
static const bz_type_t ORDER[] = {BZ_FEED, BZ_SLEEP, BZ_DIAPER, BZ_PUMP, BZ_NOTE};
#define MAX_PAGES (BZ_TYPE_COUNT + 1)

typedef struct {
    bz_type_t type; /* BZ_TYPE_UNKNOWN: the Settings page */
    lv_obj_t *tile;
    lv_obj_t *body;
    char signature[200];
    lv_obj_t *digits; /* running timer */
    lv_obj_t *arc;
    bz_ms_t started;
} page_t;

static lv_obj_t *screen;
static lv_obj_t *tileview;
static lv_obj_t *dots[MAX_PAGES];
static page_t pages[MAX_PAGES];
static int page_count;
static int current_page;
static lv_timer_t *ticker;
static bool shown_dark;

/* A variant the person picked for a type, until the next log. NULL: the inferred default. */
static const bz_variant_t *picked[BZ_TYPE_COUNT];
static char amount_choice_id[BZ_ID_LEN];
static double amount_choice;

/* ── Helpers ─────────────────────────────────────────────── */

static const bz_variant_t *variant_for(bz_type_t type)
{
    if (picked[type]) return picked[type];
    return bz_infer_default(type, station->view, station->view_count);
}

static lv_obj_t *bare(lv_obj_t *parent)
{
    lv_obj_t *obj = lv_obj_create(parent);
    lv_obj_remove_style_all(obj);
    lv_obj_remove_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    return obj;
}

/* ── Idle: the big button ────────────────────────────────── */

static lv_point_t pressed_at;

static void on_main_press(lv_event_t *event) { lv_indev_get_point(lv_indev_active(), &pressed_at); }

/* A drag that started on the button (a swipe that went the wrong way) is not a tap. */
static bool moved(void)
{
    lv_point_t now;
    lv_indev_get_point(lv_indev_active(), &now);
    int dx = now.x - pressed_at.x, dy = now.y - pressed_at.y;
    return dx * dx + dy * dy > 28 * 28;
}

static void on_main_tap(lv_event_t *event)
{
    bz_type_t type = (bz_type_t)(intptr_t)lv_event_get_user_data(event);
    if (moved()) return;
    if (type == BZ_NOTE) {
        screen_note_show();
        return;
    }
    station_lock();
    const bz_variant_t *variant = variant_for(type);
    station_unlock();
    bz_err_t err = station_log(type, variant->meta, 0, false, 0);
    if (err == BZ_ST_OK) picked[type] = NULL;
    ui_toast_error(err);
    screen_station_refresh();
}

static void on_open_picker(lv_event_t *event)
{
    bz_type_t type = (bz_type_t)(intptr_t)lv_event_get_user_data(event);
    if (lv_event_get_code(event) == LV_EVENT_LONG_PRESSED && moved()) return;
    if (type == BZ_NOTE) {
        screen_note_show();
        return;
    }
    station_lock();
    const bz_variant_t *variant = variant_for(type);
    station_unlock();
    screen_picker_show(type, variant);
}

static void on_baby(lv_event_t *event) { screen_babies_show(); }

static void build_idle(page_t *page)
{
    bz_type_t type = page->type;
    lv_obj_t *body = page->body;

    lv_obj_t *name = ui_label(body, &font_serif_40, ui_pal.text, station_baby_name()[0] ? station_baby_name() : " ");
    lv_obj_set_width(name, 260);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_align(name, LV_ALIGN_TOP_MID, 0, 34);
    bz_baby_t babies[STATION_BABIES_MAX];
    if (station_babies(babies, STATION_BABIES_MAX) > 1) {
        lv_obj_add_flag(name, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_ext_click_area(name, 12);
        lv_obj_add_event_cb(name, on_baby, LV_EVENT_CLICKED, NULL);
    }
    if (!station->baby_id[0]) theme_breathe(name, 2000);

    lv_obj_t *button = lv_button_create(body);
    lv_obj_remove_style_all(button);
    lv_obj_set_size(button, 236, 236);
    lv_obj_align(button, LV_ALIGN_TOP_MID, 0, 96);
    lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(button, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(button, theme_event_bg(type), 0);
    lv_obj_set_style_bg_color(button, theme_event_pressed(type), LV_STATE_PRESSED);
    lv_obj_set_style_border_width(button, 3, 0);
    lv_obj_set_style_border_color(button, theme_event_border(type), 0);
    if (!theme_reduced_motion()) lv_obj_set_style_transform_scale(button, 246, LV_STATE_PRESSED);
    lv_obj_set_style_transform_pivot_x(button, 118, 0);
    lv_obj_set_style_transform_pivot_y(button, 118, 0);
    lv_obj_add_event_cb(button, on_main_press, LV_EVENT_PRESSED, NULL);
    lv_obj_add_event_cb(button, on_main_tap, LV_EVENT_SHORT_CLICKED, (void *)(intptr_t)type);
    lv_obj_add_event_cb(button, on_open_picker, LV_EVENT_LONG_PRESSED, (void *)(intptr_t)type);
    if (!station->baby_id[0]) lv_obj_add_state(button, LV_STATE_DISABLED);

    lv_obj_t *icon = ui_icon(button, theme_event_icon_64(type), theme_event_icon(type));
    lv_obj_align(icon, LV_ALIGN_TOP_MID, 0, 34);
    lv_obj_t *label = ui_label(button, &font_sans_30, ui_pal.text, bz_type_label(type));
    lv_obj_align(label, LV_ALIGN_TOP_MID, 0, 108);
    char line[96];
    bz_last_line(station->view, station->view_count, type, station_now(), settings.volume_oz, line, sizeof line);
    if (!line[0]) snprintf(line, sizeof line, "%s", type == BZ_NOTE ? "Tap to write" : "Nothing yet");
    lv_obj_t *last = ui_label(button, &font_sans_20, ui_pal.muted, line);
    lv_obj_set_width(last, 176);
    lv_label_set_long_mode(last, LV_LABEL_LONG_WRAP);
    lv_obj_align(last, LV_ALIGN_TOP_MID, 0, 150);

    size_t count;
    bz_variants(type, &count);
    if (count > 1) {
        const bz_variant_t *variant = variant_for(type);
        lv_obj_t *pill = lv_button_create(body);
        lv_obj_remove_style_all(pill);
        lv_obj_set_size(pill, 236, 58);
        lv_obj_align(pill, LV_ALIGN_TOP_MID, 0, 344);
        lv_obj_set_style_radius(pill, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_opa(pill, LV_OPA_COVER, 0);
        lv_obj_set_style_bg_color(pill, ui_pal.raised, 0);
        lv_obj_set_style_bg_color(pill, lv_color_hex(ui_pal.tokens.neutral_100), LV_STATE_PRESSED);
        lv_obj_set_style_border_width(pill, 2, 0);
        lv_obj_set_style_border_color(pill, ui_pal.faint, 0);
        lv_obj_set_flex_flow(pill, LV_FLEX_FLOW_ROW);
        lv_obj_set_flex_align(pill, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_column(pill, 6, 0);
        ui_label(pill, &font_sans_20, ui_pal.text, variant->label);
        ui_icon(pill, &icon_chevron_24, ui_pal.muted);
        lv_obj_add_event_cb(pill, on_open_picker, LV_EVENT_CLICKED, (void *)(intptr_t)type);
        if (!station->baby_id[0]) lv_obj_add_state(pill, LV_STATE_DISABLED);
    }
}

/* ── Running timer ───────────────────────────────────────── */

static char timer_ids[BZ_TYPE_COUNT][BZ_ID_LEN];

static void on_done(lv_event_t *event)
{
    bz_type_t type = (bz_type_t)(intptr_t)lv_event_get_user_data(event);
    ui_toast_error(station_stop_timer(timer_ids[type]));
    screen_station_refresh();
}

static void on_discard(lv_event_t *event)
{
    bz_type_t type = (bz_type_t)(intptr_t)lv_event_get_user_data(event);
    ui_toast_error(station_discard(timer_ids[type]));
    screen_station_refresh();
}

static void update_timer(page_t *page)
{
    if (!page->digits) return;
    bz_ms_t elapsed = station_now() - page->started;
    char text[16];
    bz_format_elapsed(elapsed, text, sizeof text);
    lv_label_set_text(page->digits, text);
    // The ring fills once an hour, so a glance tells where in the hour the timer is.
    long seconds = (long)(elapsed / 1000) % 3600;
    if (page->arc) lv_arc_set_value(page->arc, (int32_t)(seconds * 1000 / 3600));
}

static void build_timer(page_t *page, const bz_event_t *event)
{
    lv_obj_t *body = page->body;
    bz_type_t type = page->type;
    strlcpy(timer_ids[type], event->id, BZ_ID_LEN);
    page->started = event->started;

    lv_obj_t *arc = lv_arc_create(body);
    lv_obj_set_size(arc, UI_SIZE - 12, UI_SIZE - 12);
    lv_obj_center(arc);
    lv_arc_set_rotation(arc, 270);
    lv_arc_set_bg_angles(arc, 0, 360);
    lv_arc_set_range(arc, 0, 1000);
    lv_obj_remove_flag(arc, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_style(arc, NULL, LV_PART_KNOB);
    lv_obj_set_style_arc_width(arc, 6, LV_PART_MAIN);
    lv_obj_set_style_arc_width(arc, 6, LV_PART_INDICATOR);
    lv_obj_set_style_arc_color(arc, theme_event_border(type), LV_PART_MAIN);
    lv_obj_set_style_arc_color(arc, theme_event_icon(type), LV_PART_INDICATOR);
    page->arc = arc;

    lv_obj_t *icon = ui_icon(body, theme_event_icon_32(type), theme_event_icon(type));
    lv_obj_align(icon, LV_ALIGN_TOP_MID, 0, 40);
    char label[64];
    bz_timer_label(event, label, sizeof label);
    lv_obj_t *title = ui_label(body, &font_sans_24, ui_pal.text, label);
    lv_obj_set_width(title, 300);
    lv_label_set_long_mode(title, LV_LABEL_LONG_DOT);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 80);
    char clock[16], since[32];
    bz_format_clock(event->started, clock, sizeof clock);
    snprintf(since, sizeof since, "Started %s", clock);
    lv_obj_t *started = ui_label(body, &font_sans_20, ui_pal.muted, since);
    lv_obj_align(started, LV_ALIGN_TOP_MID, 0, 114);

    page->digits = ui_label(body, &font_digits_72, ui_pal.text, "");
    lv_obj_align(page->digits, LV_ALIGN_TOP_MID, 0, 150);
    update_timer(page);

    lv_obj_t *done = ui_button(body, "Done", true, on_done, (void *)(intptr_t)type);
    lv_obj_set_width(done, 250);
    lv_obj_align(done, LV_ALIGN_TOP_MID, 0, 260);
    lv_obj_t *discard = ui_button(body, "Discard", false, on_discard, (void *)(intptr_t)type);
    lv_obj_set_size(discard, 170, 56);
    lv_obj_set_style_text_font(lv_obj_get_child(discard, 0), &font_sans_20, 0);
    lv_obj_set_style_text_color(lv_obj_get_child(discard, 0), ui_pal.muted, 0);
    lv_obj_align(discard, LV_ALIGN_TOP_MID, 0, 340);
}

/* ── Amount ──────────────────────────────────────────────── */

static void on_amount_save(lv_event_t *event)
{
    if (amount_choice <= 0) return;
    ui_toast_error(station_amount(amount_choice_id, bz_display_to_ml(amount_choice, settings.volume_oz)));
    screen_station_refresh();
}

static void on_amount_skip(lv_event_t *event)
{
    station_amount(amount_choice_id, 0);
    screen_station_refresh();
}

static void on_tile_chip(double value, void *user)
{
    amount_choice = value;
    screen_station_refresh();
}

static void build_amount(page_t *page, const bz_event_t *event)
{
    lv_obj_t *body = page->body;
    if (strcmp(amount_choice_id, event->id) != 0) {
        strlcpy(amount_choice_id, event->id, sizeof amount_choice_id);
        amount_choice = 0;
    }
    char method[16];
    bz_meta_str(event->meta, "method", method, sizeof method);
    const char *title = event->type == BZ_PUMP ? "Amount pumped" : strcmp(method, "formula") == 0 ? "Formula amount"
                                                                                                  : "Bottle amount";
    int last = bz_last_amount_ml(station->view, station->view_count, event->type);
    ui_amount_picker(body, title, last, amount_choice, on_tile_chip, NULL);
    lv_obj_t *save = ui_button(body, "Save", true, on_amount_save, NULL);
    lv_obj_set_width(save, 250);
    lv_obj_align(save, LV_ALIGN_TOP_MID, 0, 262);
    if (amount_choice <= 0) lv_obj_add_state(save, LV_STATE_DISABLED);
    lv_obj_t *skip = ui_button(body, "Skip", false, on_amount_skip, NULL);
    lv_obj_set_size(skip, 170, 56);
    lv_obj_align(skip, LV_ALIGN_TOP_MID, 0, 342);
}

/* ── Settings page ───────────────────────────────────────── */

static void on_settings(lv_event_t *event) { screen_settings_show(); }

static void build_settings_page(page_t *page)
{
    lv_obj_t *body = page->body;
    lv_obj_t *button = lv_button_create(body);
    lv_obj_remove_style_all(button);
    lv_obj_set_size(button, 200, 200);
    lv_obj_align(button, LV_ALIGN_CENTER, 0, -20);
    lv_obj_set_style_radius(button, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(button, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(button, ui_pal.raised, 0);
    lv_obj_set_style_bg_color(button, lv_color_hex(ui_pal.tokens.neutral_100), LV_STATE_PRESSED);
    lv_obj_set_style_border_width(button, 2, 0);
    lv_obj_set_style_border_color(button, ui_pal.line, 0);
    lv_obj_add_event_cb(button, on_settings, LV_EVENT_CLICKED, NULL);
    lv_obj_t *icon = ui_icon(button, &icon_settings_32, ui_pal.muted);
    lv_obj_align(icon, LV_ALIGN_CENTER, 0, -18);
    lv_obj_t *label = ui_label(button, &font_sans_24, ui_pal.text, "Settings");
    lv_obj_align(label, LV_ALIGN_CENTER, 0, 24);

    station_lock();
    bz_unsaved_t unsaved = bz_ob_unsaved(&station->ob);
    station_unlock();
    char status[64];
    if (unsaved.failed) {
        snprintf(status, sizeof status, "%d change%s not saved", unsaved.failed, unsaved.failed == 1 ? "" : "s");
    } else if (unsaved.queued) {
        snprintf(status, sizeof status, "%d change%s waiting to send", unsaved.queued, unsaved.queued == 1 ? "" : "s");
    } else {
        snprintf(status, sizeof status, "%s", station_offline() ? "Offline" : "All saved");
    }
    lv_obj_t *line = ui_label(body, &font_sans_20, ui_pal.muted, status);
    lv_obj_align(line, LV_ALIGN_CENTER, 0, 110);
    if (unsaved.queued) theme_breathe(line, 2000);
}

/* ── Pages ───────────────────────────────────────────────── */

typedef enum { STATE_IDLE, STATE_TIMER, STATE_AMOUNT } tile_state_t;

static void signature_of(page_t *page, char *out, size_t len, tile_state_t *state, const bz_event_t **event)
{
    *event = NULL;
    *state = STATE_IDLE;
    if (page->type == BZ_TYPE_UNKNOWN) {
        bz_unsaved_t unsaved = bz_ob_unsaved(&station->ob);
        snprintf(out, len, "settings %d %d %d", unsaved.queued, unsaved.failed, station_offline());
        return;
    }
    bz_ms_t now = station_now();
    const bz_event_t *active = bz_st_active(station, page->type);
    const bz_event_t *awaiting = active ? NULL : bz_st_awaiting_amount(station, page->type, now);
    if (active) {
        *state = STATE_TIMER;
        *event = active;
        snprintf(out, len, "timer %s %lld %s", active->id, (long long)active->started, active->meta);
    } else if (awaiting) {
        *state = STATE_AMOUNT;
        *event = awaiting;
        snprintf(out, len, "amount %s %g", awaiting->id, amount_choice);
    } else {
        char line[96];
        bz_last_line(station->view, station->view_count, page->type, now, settings.volume_oz, line, sizeof line);
        snprintf(out, len, "idle %s %s %s %d", variant_for(page->type)->key, line, station_baby_name(),
                 station->baby_id[0] != 0);
    }
}

static bool fill_page(page_t *page, bool force)
{
    char signature[sizeof page->signature];
    tile_state_t state;
    const bz_event_t *event;
    station_lock();
    signature_of(page, signature, sizeof signature, &state, &event);
    if (!force && strcmp(signature, page->signature) == 0) {
        station_unlock();
        return false;
    }
    strlcpy(page->signature, signature, sizeof page->signature);
    lv_obj_clean(page->body);
    page->digits = NULL;
    page->arc = NULL;
    if (page->type == BZ_TYPE_UNKNOWN) {
        build_settings_page(page);
    } else if (state == STATE_TIMER) {
        build_timer(page, event);
    } else if (state == STATE_AMOUNT) {
        build_amount(page, event);
    } else {
        build_idle(page);
    }
    station_unlock();
    return true;
}

static void update_dots(void)
{
    for (int i = 0; i < page_count; i++) {
        bool on = i == current_page;
        lv_obj_set_style_bg_color(dots[i], on ? ui_pal.text : ui_pal.faint, 0);
        lv_obj_set_size(dots[i], on ? 10 : 8, on ? 10 : 8);
    }
}

static void on_page_changed(lv_event_t *event)
{
    lv_obj_t *active = lv_tileview_get_tile_active(lv_event_get_target(event));
    for (int i = 0; i < page_count; i++) {
        if (pages[i].tile == active && current_page != i) {
            current_page = i;
            ESP_LOGI(TAG, "station page %s", pages[i].type == BZ_TYPE_UNKNOWN ? "settings" : bz_type_name(pages[i].type));
            update_dots();
        }
    }
}

static void on_scroll_end(lv_event_t *event) { ui_trace(screen); }

bool screen_station_want_dark(void)
{
    if (settings.dark == 1) return true;
    if (settings.dark == 2 || !app_clock_synced()) return false;
    return bz_is_dark_hour(bz_local_hour(station_now()), 20, 7);
}

static void on_tick(lv_timer_t *timer)
{
    if (lv_screen_active() != screen) return;
    if (screen_station_want_dark() != shown_dark) {
        screen_station_show();
        return;
    }
    if (station_tick()) ui_toast_hide();
    ui_toast_tick();
    screen_station_refresh();
    for (int i = 0; i < page_count; i++) update_timer(&pages[i]);
}

static void on_delete(lv_event_t *event)
{
    // A rebuilt station loads before the old one goes: only forget what belongs to this one.
    if (lv_event_get_target(event) != screen) return;
    if (ticker) lv_timer_delete(ticker);
    ticker = NULL;
    screen = NULL;
    tileview = NULL;
}

void screen_station_show(void)
{
    shown_dark = screen_station_want_dark();
    theme_set_dark(shown_dark);
    buttons_apply_brightness();
    if (ticker) lv_timer_delete(ticker);
    ticker = NULL;
    screen = ui_screen();
    lv_obj_add_event_cb(screen, on_delete, LV_EVENT_DELETE, NULL);

    tileview = lv_tileview_create(screen);
    lv_obj_set_size(tileview, UI_SIZE, UI_SIZE);
    lv_obj_set_style_bg_opa(tileview, LV_OPA_TRANSP, 0);
    lv_obj_set_scrollbar_mode(tileview, LV_SCROLLBAR_MODE_OFF);
    lv_obj_add_event_cb(tileview, on_page_changed, LV_EVENT_VALUE_CHANGED, NULL);
    lv_obj_add_event_cb(tileview, on_scroll_end, LV_EVENT_SCROLL_END, NULL);

    page_count = 0;
    for (size_t i = 0; i < sizeof ORDER / sizeof ORDER[0]; i++) {
        if (settings.tiles & (1u << ORDER[i])) pages[page_count++].type = ORDER[i];
    }
    pages[page_count++].type = BZ_TYPE_UNKNOWN;
    if (current_page >= page_count) current_page = 0;

    for (int i = 0; i < page_count; i++) {
        page_t *page = &pages[i];
        page->tile = lv_tileview_add_tile(tileview, (uint8_t)i, 0, (i > 0 ? LV_DIR_LEFT : 0) | (i < page_count - 1 ? LV_DIR_RIGHT : 0));
        lv_obj_remove_flag(page->tile, LV_OBJ_FLAG_SCROLLABLE);
        page->body = bare(page->tile);
        lv_obj_set_size(page->body, UI_SIZE, UI_SIZE);
        page->signature[0] = '\0';
        fill_page(page, true);
    }
    lv_tileview_set_tile_by_index(tileview, (uint32_t)current_page, 0, LV_ANIM_OFF);

    // Page dots along the bottom of the circle.
    lv_obj_t *row = bare(screen);
    lv_obj_set_size(row, LV_SIZE_CONTENT, 14);
    lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(row, 10, 0);
    lv_obj_align(row, LV_ALIGN_BOTTOM_MID, 0, -22);
    lv_obj_remove_flag(row, LV_OBJ_FLAG_CLICKABLE);
    for (int i = 0; i < page_count; i++) {
        dots[i] = bare(row);
        lv_obj_remove_flag(dots[i], LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_style_radius(dots[i], LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_opa(dots[i], LV_OPA_COVER, 0);
    }
    update_dots();

    ticker = lv_timer_create(on_tick, 1000, NULL);
    ui_load(screen, "station");
    ui_toast_tick();
}

void screen_station_refresh(void)
{
    if (!screen || lv_screen_active() != screen) return;
    bool changed = false;
    for (int i = 0; i < page_count; i++) changed |= fill_page(&pages[i], false);
    ui_toast_tick();
    if (changed) ui_trace(screen);
}

void screen_station_pick(bz_type_t type, const bz_variant_t *variant)
{
    if (type < BZ_TYPE_COUNT) picked[type] = variant;
}

void screen_station_home(void)
{
    current_page = 0;
    screen_station_show();
}
