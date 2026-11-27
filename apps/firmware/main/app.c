#include "app.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>

#include "api.h"
#include "bsp/esp-bsp.h"
#include "bz_pairing.h"
#include "bz_time.h"
#include "esp_log.h"
#include "esp_netif_sntp.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"
#include "screens.h"
#include "settings.h"
#include "station.h"
#include "wifi.h"

static const char *TAG = "app";


typedef struct {
    app_fn fn;
    void *arg;
} job_t;

static QueueHandle_t jobs;
static EventGroupHandle_t signals;
#define APP_INTERRUPT BIT0

static void worker(void *unused)
{
    job_t job;
    for (;;) {
        if (xQueueReceive(jobs, &job, portMAX_DELAY)) job.fn(job.arg);
    }
}

void app_do(app_fn fn, void *arg)
{
    job_t job = {fn, arg};
    xQueueSend(jobs, &job, portMAX_DELAY);
}

void ui_do(app_fn fn, void *arg)
{
    bsp_display_lock((uint32_t)-1); /* -1: wait as long as it takes */
    fn(arg);
    bsp_display_unlock();
}

void app_interrupt(void) { xEventGroupSetBits(signals, APP_INTERRUPT); }

/* Sleep on the worker; false if interrupted. */
static bool pause_ms(int ms)
{
    if (ms <= 0) return !(xEventGroupClearBits(signals, APP_INTERRUPT) & APP_INTERRUPT);
    return !(xEventGroupWaitBits(signals, APP_INTERRUPT, pdTRUE, pdFALSE, pdMS_TO_TICKS(ms)) & APP_INTERRUPT);
}

/* ── Wi-Fi ───────────────────────────────────────────────── */

typedef struct {
    wifi_ap_t aps[WIFI_SCAN_MAX];
    int count;
} scan_result_t;

static scan_result_t scan;

static void show_wifi_list(void *arg) { screen_wifi_show(scan.aps, scan.count, (const char *)arg); }

static void show_scanning(void *arg) { screen_wifi_show(NULL, -1, (const char *)arg); }

static void do_scan(void *message)
{
    ui_do(show_scanning, message);
    scan.count = wifi_scan(scan.aps, WIFI_SCAN_MAX);
    ui_do(show_wifi_list, message);
}

void app_wifi_scan(void)
{
    app_interrupt();
    app_do(do_scan, NULL);
}

typedef struct {
    char ssid[33];
    char pass[65];
} join_t;

static void show_joining(void *ssid)
{
    char line[64];
    snprintf(line, sizeof line, "Joining %s", (const char *)ssid);
    screen_splash_show(line);
}

static void do_continue(void *arg);

static void do_join(void *arg)
{
    join_t *join = arg;
    ui_do(show_joining, join->ssid);
    wifi_result_t result = wifi_join(join->ssid, join->pass, 20000);
    if (result == WIFI_JOINED) {
        settings_save_wifi(join->ssid, join->pass);
        free(join);
        do_continue(NULL);
        return;
    }
    const char *message = result == WIFI_WRONG_PASSWORD ? "That password didn't work"
                          : result == WIFI_NOT_FOUND    ? "That network is out of range"
                                                        : "Couldn't join that network";
    free(join);
    do_scan((void *)message);
}

void app_wifi_join(const char *ssid, const char *pass)
{
    join_t *join = calloc(1, sizeof *join);
    strlcpy(join->ssid, ssid, sizeof join->ssid);
    strlcpy(join->pass, pass ? pass : "", sizeof join->pass);
    app_interrupt();
    app_do(do_join, join);
}

/* ── Clock ───────────────────────────────────────────────── */

static bool sntp_started;

bool app_clock_synced(void)
{
    struct timeval now;
    gettimeofday(&now, NULL);
    return (long long)now.tv_sec * 1000 > BZ_CLOCK_VALID_AFTER;
}

static void on_time_sync(struct timeval *tv)
{
    char clock[16];
    bz_format_clock((long long)tv->tv_sec * 1000, clock, sizeof clock);
    ESP_LOGI(TAG, "clock set, %s %s", clock, settings.tz);
}

static void start_clock(void)
{
    bz_tz_apply(settings.tz);
    if (sntp_started) return;
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    config.sync_cb = on_time_sync;
    esp_netif_sntp_init(&config);
    sntp_started = true;
}

void app_set_timezone(const char *name)
{
    settings_save_tz(name);
    bz_tz_apply(name);
    ESP_LOGI(TAG, "time zone %s", name);
    app_continue();
}

/* ── Pairing ─────────────────────────────────────────────── */

static bz_pairing_t pairing;
static char signed_out_notice[80];
static screen_pairing_t pairing_view;

static void show_pairing(void *arg) { screen_pairing_show(&pairing_view); }

static void publish_pairing(void)
{
    screen_pairing_t view = {0};
    if (pairing.state == BZ_PAIR_POLL) {
        bz_pair_format_code(pairing.code, view.code, sizeof view.code);
        bz_pair_approve_url(&pairing, view.url, sizeof view.url);
    }
    bz_url_host(pairing.server.web, view.host, sizeof view.host);
    strlcpy(view.notice, pairing.notice, sizeof view.notice);
    if (memcmp(&view, &pairing_view, sizeof view) == 0) return;
    if (view.notice[0] && strncmp(view.notice, pairing_view.notice, sizeof view.notice) != 0) ESP_LOGI(TAG, "pair: notice %s", view.notice);
    pairing_view = view;
    ui_do(show_pairing, NULL);
}

/* Pair until approved; false if interrupted (the person changed server or Wi-Fi). */
static bool pair(void)
{
    bz_pair_start(&pairing, settings.web_url, settings.api_url);
    if (signed_out_notice[0]) {
        strlcpy(pairing.notice, signed_out_notice, sizeof pairing.notice);
        signed_out_notice[0] = '\0';
    }
    memset(&pairing_view, 0xff, sizeof pairing_view);
    for (;;) {
        bz_pair_act_t act = bz_pair_next(&pairing);
        if (act.kind == BZ_ACT_DONE) break;
        publish_pairing();
        if (!pause_ms(act.delay_ms)) {
            free(act.body);
            return false;
        }
        http_resp_t resp;
        int status = http_request(act.url, act.body, NULL, &resp, 15000);
        free(act.body);
        ESP_LOGI(TAG, "pair: %s -> %d %.120s", act.url, status, resp.body ? resp.body : "");
        bz_pair_state_t before = pairing.state;
        bz_pair_on_reply(&pairing, status, resp.body);
        if (before == BZ_PAIR_REQUEST_CODE && pairing.state == BZ_PAIR_POLL) ESP_LOGI(TAG, "pair: code %s", pairing.code);
        http_free(&resp);
        if (pairing.server_changed) {
            // Redirected: from here on this device belongs to the new server.
            pairing.server_changed = false;
            settings_save_web_url(pairing.server.web, pairing.server.api);
            ESP_LOGI(TAG, "pair: server is now %s", pairing.server.web);
        }
    }
    if (strcmp(settings.web_url, pairing.server.web) != 0 || strcmp(settings.api_url, pairing.server.api) != 0) {
        settings_save_web_url(pairing.server.web, pairing.server.api);
    }
    settings_save_tokens(pairing.token, pairing.refresh);
    ESP_LOGI(TAG, "pair: approved");
    return true;
}

static void do_set_server(void *arg)
{
    char *url = arg;
    settings_save_web_url(url, "");
    free(url);
    do_continue(NULL);
}

void app_set_server(const char *web_url)
{
    app_interrupt();
    app_do(do_set_server, strdup(web_url));
}

/* ── Flow ────────────────────────────────────────────────── */

static void show_timezone(void *arg) { screen_timezone_show(settings.tz); }

static void show_station(void *arg)
{
    bz_baby_t babies[1];
    if (station_babies(babies, 1) > 0) {
        screen_station_show();
    } else if (!screen_named(lv_screen_active(), "station")) {
        screen_splash_show("");
    }
}

static void do_continue(void *arg)
{
    xEventGroupClearBits(signals, APP_INTERRUPT);
    if (!settings.tz[0]) {
        ui_do(show_timezone, NULL);
        return;
    }
    start_clock();
    if (!settings.refresh[0] && !pair()) return;
    // The station screen appears once the babies are known (station.c redraw).
    ui_do(show_station, NULL);
    station_start();
}

void app_continue(void) { app_do(do_continue, NULL); }

static void do_boot(void *arg)
{
    wifi_init();
    if (!settings.wifi_ssid[0]) {
        do_scan(NULL);
        return;
    }
    // A saved network: rejoin it quietly, and fall back to the list if it is gone.
    join_t *join = calloc(1, sizeof *join);
    strlcpy(join->ssid, settings.wifi_ssid, sizeof join->ssid);
    strlcpy(join->pass, settings.wifi_pass, sizeof join->pass);
    do_join(join);
}

static void do_signed_out(void *arg)
{
    station_stop();
    station_forget();
    settings_unpair();
    do_continue(NULL);
}

void app_signed_out(void)
{
    ESP_LOGW(TAG, "signed out by the server");
    strlcpy(signed_out_notice, "This device was signed out. Pair it again.", sizeof signed_out_notice);
    app_do(do_signed_out, NULL);
}

static void do_unpair(void *arg)
{
    station_stop();
    station_forget();
    if (arg) {
        settings_reset();
    } else {
        settings_unpair();
    }
    do_continue(NULL);
}

void app_unpair(bool reset)
{
    app_interrupt();
    app_do(do_unpair, reset ? (void *)1 : NULL);
}

void app_start(void)
{
    station_init();
    jobs = xQueueCreate(16, sizeof(job_t));
    signals = xEventGroupCreate();
    bz_tz_apply(settings.tz);
    // TLS handshakes need a deep stack.
    xTaskCreatePinnedToCore(worker, "app", 12 * 1024, NULL, 4, NULL, 0);
    app_do(do_boot, NULL);
}
