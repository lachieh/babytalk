#include "app.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "screens.h"
#include "settings.h"
#include "wifi.h"

static const char *TAG = "app";

typedef struct {
    app_fn fn;
    void *arg;
} job_t;

static QueueHandle_t jobs;

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

/* ── Wi-Fi ───────────────────────────────────────────────── */

typedef struct {
    wifi_ap_t aps[WIFI_SCAN_MAX];
    int count;
    const char *message;
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

void app_wifi_scan(void) { app_do(do_scan, NULL); }

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

static void do_join(void *arg)
{
    join_t *join = arg;
    ui_do(show_joining, join->ssid);
    wifi_result_t result = wifi_join(join->ssid, join->pass, 20000);
    if (result == WIFI_JOINED) {
        settings_save_wifi(join->ssid, join->pass);
        free(join);
        app_continue();
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
    app_do(do_join, join);
}

/* ── Flow ────────────────────────────────────────────────── */

static void show_connected(void *arg) { screen_splash_show("Connected"); }

static void do_continue(void *arg)
{
    ESP_LOGI(TAG, "online");
    ui_do(show_connected, NULL);
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

void app_start(void)
{
    jobs = xQueueCreate(16, sizeof(job_t));
    // TLS handshakes need a deep stack.
    xTaskCreatePinnedToCore(worker, "app", 12 * 1024, NULL, 4, NULL, 0);
    app_do(do_boot, NULL);
}
