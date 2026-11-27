#include "station.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>

#include "api.h"
#include "app.h"
#include "bz_uuid.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_random.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "screens.h"
#include "settings.h"

static const char *TAG = "sync";

bz_station_t *station;
static SemaphoreHandle_t lock;
static TaskHandle_t task;
static volatile bool running;
static volatile bool offline;
static volatile bool force_refresh;
static uint32_t persisted_revision;

static bz_baby_t babies[STATION_BABIES_MAX];
static int baby_count = -1;

#define REFRESH_ACTIVE_MS 15000
#define REFRESH_IDLE_MS 60000
#define BABIES_EVERY_MS (5 * 60000)
#define BACKOFF_MAX_MS 60000

void station_lock(void) { xSemaphoreTakeRecursive(lock, portMAX_DELAY); }
void station_unlock(void) { xSemaphoreGiveRecursive(lock); }

bz_ms_t station_now(void)
{
    struct timeval now;
    gettimeofday(&now, NULL);
    return (bz_ms_t)now.tv_sec * 1000 + now.tv_usec / 1000;
}

static void persist(void)
{
    if (station->revision == persisted_revision) return;
    char *json = bz_ob_serialize(&station->ob);
    nvs_handle_t nvs;
    if (json && nvs_open_from_partition("outbox", "outbox", NVS_READWRITE, &nvs) == ESP_OK) {
        esp_err_t err = nvs_set_blob(nvs, "state", json, strlen(json) + 1);
        if (err == ESP_OK) err = nvs_commit(nvs);
        nvs_close(nvs);
        if (err == ESP_OK) persisted_revision = station->revision;
        else ESP_LOGE(TAG, "outbox not stored: %s", esp_err_to_name(err));
    }
    free(json);
}

static void restore(void)
{
    if (nvs_flash_init_partition("outbox") != ESP_OK) {
        nvs_flash_erase_partition("outbox");
        nvs_flash_init_partition("outbox");
    }
    nvs_handle_t nvs;
    if (nvs_open_from_partition("outbox", "outbox", NVS_READONLY, &nvs) != ESP_OK) return;
    size_t size = 0;
    if (nvs_get_blob(nvs, "state", NULL, &size) == ESP_OK && size > 0) {
        char *json = heap_caps_malloc(size, MALLOC_CAP_SPIRAM);
        if (json && nvs_get_blob(nvs, "state", json, &size) == ESP_OK && bz_ob_adopt(&station->ob, json)) {
            ESP_LOGI(TAG, "restored %d unsent", (int)station->ob.outbox_count);
        }
        free(json);
    }
    nvs_close(nvs);
}

void station_init(void)
{
    lock = xSemaphoreCreateRecursiveMutex();
    station = heap_caps_calloc(1, sizeof *station, MALLOC_CAP_SPIRAM);
    bz_st_init(station);
    restore();
    persisted_revision = station->revision;
}

static void redraw(void *arg)
{
    lv_obj_t *active = lv_screen_active();
    if (baby_count == 0) {
        if (!screen_named(active, "no-baby") && (screen_named(active, "station") || screen_named(active, "splash"))) {
            screen_no_baby_show();
        }
    } else if (baby_count > 0 && (screen_named(active, "no-baby") || screen_named(active, "splash"))) {
        screen_station_show();
    } else {
        screen_station_refresh();
    }
}

static void wake(void)
{
    if (task) xTaskNotifyGive(task);
}

static void after_change(void)
{
    persist();
    wake();
}

static bool signed_out;

static bool load_babies(void)
{
    http_resp_t resp;
    bz_reply_t reply;
    api_result_t result = api_call(bz_gql_my_babies(), &resp, &reply);
    if (result == API_SIGNED_OUT) signed_out = true;
    if (result != API_OK) return false;
    bz_baby_t found[STATION_BABIES_MAX];
    int count = bz_parse_babies(resp.body, found, STATION_BABIES_MAX);
    http_free(&resp);
    if (count < 0) return false;
    station_lock();
    memcpy(babies, found, sizeof found);
    baby_count = count;
    const char *chosen = NULL;
    for (int i = 0; i < count; i++) {
        if (strcmp(found[i].id, settings.baby_id) == 0) chosen = found[i].id;
    }
    if (!chosen && count > 0) chosen = found[0].id;
    if (chosen && strcmp(chosen, station->baby_id) != 0) {
        settings_save_baby(chosen);
        bz_st_set_baby(station, chosen);
    }
    station_unlock();
    ESP_LOGI(TAG, "babies: %d", count);
    return true;
}

static bool load_events(void)
{
    char baby[BZ_ID_LEN];
    station_lock();
    strlcpy(baby, station->baby_id, sizeof baby);
    station_unlock();
    if (!baby[0]) return false;
    bz_ms_t requested_at = station_now();
    http_resp_t resp;
    bz_reply_t reply;
    api_result_t result = api_call(bz_gql_recent_events(baby, BZ_SERVER_MAX), &resp, &reply);
    if (result == API_SIGNED_OUT) signed_out = true;
    if (result != API_OK) return false;
    static bz_event_t loaded[BZ_SERVER_MAX];
    int count = bz_parse_events(resp.body, "recentEvents", loaded, BZ_SERVER_MAX);
    http_free(&resp);
    if (count < 0) return false;
    station_lock();
    if (strcmp(baby, station->baby_id) == 0) {
        bz_st_loaded(station, loaded, (size_t)count, requested_at);
        bz_ob_resume(&station->ob);
    }
    station_unlock();
    ESP_LOGI(TAG, "events: %d", count);
    return true;
}

static bool send_one(bool *failed)
{
    station_lock();
    const bz_entry_t *next = bz_ob_next(&station->ob);
    if (!next) {
        station_unlock();
        return false;
    }
    char id[BZ_ID_LEN];
    strlcpy(id, next->event.id, sizeof id);
    bz_op_t op = next->op;
    uint32_t request = bz_ob_send_start(&station->ob, id);
    char *body = bz_ob_request_body(next);
    station->revision++;
    persist();
    station_unlock();

    http_resp_t resp;
    bz_reply_t reply;
    api_result_t result = api_call(body, &resp, &reply);
    station_lock();
    if (result == API_OK) {
        bz_event_t confirmed;
        const char *field = op == BZ_OP_CREATE ? "logEvent" : "updateEvent";
        bool has = op != BZ_OP_DELETE && bz_parse_event(resp.body, field, &confirmed);
        bz_ob_send_ok(&station->ob, id, request, has ? &confirmed : NULL, station_now());
        ESP_LOGI(TAG, "sent %s %s", op == BZ_OP_CREATE ? "create" : op == BZ_OP_UPDATE ? "update" : "delete", id);
        http_free(&resp);
    } else {
        bz_ob_send_failed(&station->ob, id, request, result == API_REFUSED);
        ESP_LOGW(TAG, "not sent %s (%s)", id, result == API_REFUSED ? "refused" : "will retry");
        if (result == API_SIGNED_OUT) signed_out = true;
        *failed = result != API_REFUSED;
    }
    station->revision++;
    bz_st_refresh(station);
    persist();
    station_unlock();
    ui_do(redraw, NULL);
    return true;
}

static void sync_task(void *arg)
{
    bz_ms_t next_refresh = 0, next_babies = 0;
    int backoff = 0;
    bz_ms_t retry_at = 0;
    while (running) {
        if (!api_ensure_config()) {
            offline = true;
            ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(10000));
            continue;
        }
        bz_ms_t now = station_now();
        if (baby_count < 0 || now >= next_babies) {
            if (load_babies()) next_babies = now + BABIES_EVERY_MS;
            ui_do(redraw, NULL);
        }
        bool failed = false;
        while (running && !signed_out && !failed && send_one(&failed)) {
        }
        if (failed) {
            backoff = backoff ? (backoff * 2 > BACKOFF_MAX_MS ? BACKOFF_MAX_MS : backoff * 2) : 2000;
            retry_at = station_now() + backoff;
            offline = true;
        }
        now = station_now();
        if (force_refresh) {
            force_refresh = false;
            next_refresh = 0;
        }
        if (now >= next_refresh && !signed_out) {
            bool ok = load_events();
            offline = !ok;
            station_lock();
            bool active = false;
            for (int t = 0; t < BZ_TYPE_COUNT; t++) active |= bz_st_active(station, (bz_type_t)t) != NULL;
            station_unlock();
            next_refresh = now + (active ? REFRESH_ACTIVE_MS : REFRESH_IDLE_MS);
            if (ok) backoff = 0;
            ui_do(redraw, NULL);
        }
        if (signed_out) {
            running = false;
            app_signed_out();
            break;
        }
        station_lock();
        bool waiting = bz_ob_has_waiting(&station->ob);
        bool ready = bz_ob_next(&station->ob) != NULL;
        station_unlock();
        if (ready && !failed) continue;
        if (waiting && station_now() >= retry_at) {
            station_lock();
            bz_ob_resume(&station->ob);
            station_unlock();
            continue;
        }
        bz_ms_t until = next_refresh;
        if (waiting && retry_at < until) until = retry_at;
        bz_ms_t wait = until - station_now();
        if (wait < 50) wait = 50;
        ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(wait));
    }
    task = NULL;
    vTaskDelete(NULL);
}

void station_start(void)
{
    if (running) {
        wake();
        return;
    }
    while (task) vTaskDelay(pdMS_TO_TICKS(20));
    signed_out = false;
    baby_count = -1;
    station_lock();
    if (settings.baby_id[0]) bz_st_set_baby(station, settings.baby_id);
    station_unlock();
    running = true;
    xTaskCreatePinnedToCore(sync_task, "sync", 12 * 1024, NULL, 3, &task, 0);
}

void station_stop(void)
{
    running = false;
    wake();
    while (task) vTaskDelay(pdMS_TO_TICKS(20));
}

void station_forget(void)
{
    station_lock();
    bz_st_init(station);
    persisted_revision = UINT32_MAX;
    persist();
    baby_count = -1;
    station_unlock();
}

int station_sign_out(void)
{
    station_lock();
    bz_st_sign_out(station);
    persist();
    baby_count = -1;
    int unsent = (int)station->ob.outbox_count;
    station_unlock();
    return unsent;
}

static const char *err_name(bz_err_t err)
{
    switch (err) {
    case BZ_ST_OK: return "ok";
    case BZ_ERR_NO_CLOCK: return "no clock";
    case BZ_ERR_FULL: return "outbox full";
    case BZ_ERR_NO_BABY: return "no baby";
    case BZ_ERR_TOO_LONG: return "metadata too long";
    default: return "not found";
    }
}

bz_err_t station_log(bz_type_t type, const char *meta, int minutes_ago, bool finished, int amount_ml)
{
    uint8_t random[16];
    esp_fill_random(random, sizeof random);
    char id[BZ_ID_LEN];
    bz_uuid_format(random, id);
    station_lock();
    bz_err_t err = bz_st_log(station, type, meta, minutes_ago, finished, amount_ml, station_now(), id);
    after_change();
    station_unlock();
    ESP_LOGI(TAG, "log %s %s: %s", bz_type_name(type), meta, err_name(err));
    return err;
}

bz_err_t station_stop_timer(const char *id)
{
    station_lock();
    bz_err_t err = bz_st_stop(station, id, station_now());
    after_change();
    station_unlock();
    ESP_LOGI(TAG, "stop %s: %s", id, err_name(err));
    return err;
}

bz_err_t station_discard(const char *id)
{
    station_lock();
    bz_err_t err = bz_st_discard(station, id, station_now());
    after_change();
    station_unlock();
    ESP_LOGI(TAG, "discard %s: %s", id, err_name(err));
    return err;
}

bz_err_t station_amount(const char *id, int amount_ml)
{
    station_lock();
    bz_err_t err = bz_st_complete_amount(station, id, amount_ml, station_now());
    after_change();
    station_unlock();
    ESP_LOGI(TAG, "amount %s %d: %s", id, amount_ml, err_name(err));
    return err;
}

void station_undo(void)
{
    station_lock();
    bz_st_undo(station);
    after_change();
    station_unlock();
    ESP_LOGI(TAG, "undo");
}

bool station_tick(void)
{
    station_lock();
    bool changed = bz_st_tick(station, station_now());
    if (changed) after_change();
    station_unlock();
    return changed;
}

void station_retry(void)
{
    station_lock();
    bz_ob_retry(&station->ob);
    station->revision++;
    after_change();
    station_unlock();
}

int station_babies(bz_baby_t *out, int max)
{
    station_lock();
    int count = baby_count < max ? baby_count : max;
    if (count > 0) memcpy(out, babies, sizeof *out * (size_t)count);
    station_unlock();
    return count;
}

void station_choose_baby(const char *baby_id)
{
    station_lock();
    settings_save_baby(baby_id);
    bz_st_set_baby(station, baby_id);
    after_change();
    station_unlock();
    ESP_LOGI(TAG, "baby %s", baby_id);
    force_refresh = true;
    wake();
}

const char *station_baby_name(void)
{
    for (int i = 0; i < baby_count; i++) {
        if (strcmp(babies[i].id, station->baby_id) == 0) return babies[i].name;
    }
    return "";
}

bool station_offline(void) { return offline; }
