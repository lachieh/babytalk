#include "app.h"
#include "buttons.h"
#include "bsp/esp-bsp.h"
#include "esp_log.h"
#include "screens.h"
#include "settings.h"

static const char *TAG = "bubsie";

void app_main(void)
{
    settings_load();
    lv_display_t *display = bsp_display_start();
    assert(display != NULL);

    bsp_display_lock(-1);
    theme_set_reduced_motion(settings.reduced_motion);
    theme_init();
    buttons_apply_brightness();
    screen_splash_show("");
    bsp_display_unlock();
    ESP_LOGI(TAG, "ready %d x %d", (int)lv_display_get_horizontal_resolution(display),
             (int)lv_display_get_vertical_resolution(display));
    buttons_start();
    app_start();
}
