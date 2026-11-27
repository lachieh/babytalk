#include "buttons.h"

#include "app.h"
#include "bsp/esp-bsp.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "screens.h"

static const char *TAG = "buttons";

#define PIN_BOOT GPIO_NUM_0
/* The PWR key reaches GPIO3 through a transistor that inverts it: high while pressed. */
#define PIN_PWR GPIO_NUM_3

#define DAY_BRIGHTNESS 90
#define NIGHT_BRIGHTNESS 30

static bool screen_off;

void buttons_apply_brightness(void)
{
    if (!screen_off) bsp_display_brightness_set(theme_is_dark() ? NIGHT_BRIGHTNESS : DAY_BRIGHTNESS);
}

static void on_boot(void *arg)
{
    if (screen_off) return;
    lv_obj_t *active = lv_screen_active();
    // Inside the station (pages, pickers, settings): back to the first page.
    if (screen_named(active, "station") || screen_named(active, "picker") || screen_named(active, "settings") ||
        screen_named(active, "babies") || screen_named(active, "tiles") || screen_named(active, "note") ||
        screen_named(active, "amount-finished")) {
        screen_station_home();
    }
}

static void on_pwr(void *arg)
{
    screen_off = !screen_off;
    ESP_LOGI(TAG, "screen %s", screen_off ? "off" : "on");
    if (screen_off) {
        bsp_display_brightness_set(0);
    } else {
        buttons_apply_brightness();
    }
}

static void poll(void *unused)
{
    bool boot_was = false, pwr_was = false;
    for (;;) {
        bool boot = gpio_get_level(PIN_BOOT) == 0;
        bool pwr = gpio_get_level(PIN_PWR) == 1;
        if (boot && !boot_was) ui_do(on_boot, NULL);
        if (pwr && !pwr_was) ui_do(on_pwr, NULL);
        boot_was = boot;
        pwr_was = pwr;
        vTaskDelay(pdMS_TO_TICKS(30));
    }
}

void buttons_start(void)
{
    const gpio_config_t boot = {.pin_bit_mask = BIT64(PIN_BOOT), .mode = GPIO_MODE_INPUT, .pull_up_en = GPIO_PULLUP_ENABLE};
    gpio_config(&boot);
    const gpio_config_t pwr = {.pin_bit_mask = BIT64(PIN_PWR), .mode = GPIO_MODE_INPUT};
    gpio_config(&pwr);
    // Screens are built on this task (with the display lock), so it needs a full stack.
    xTaskCreate(poll, "buttons", 8192, NULL, 2, NULL);
}
