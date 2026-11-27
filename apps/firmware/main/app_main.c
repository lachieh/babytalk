// Bubsie for the Waveshare ESP32-S3-Touch-AMOLED-1.75C.
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "screens.h"

static const char *TAG = "bubsie";

void app_main(void)
{
    lv_display_t *display = bsp_display_start();
    assert(display != NULL);
    bsp_display_backlight_on();

    bsp_display_lock(-1);
    theme_init();
    screen_splash_show("Starting");
    bsp_display_unlock();
    ESP_LOGI(TAG, "ready %d x %d", (int)lv_display_get_horizontal_resolution(display),
             (int)lv_display_get_vertical_resolution(display));
}
