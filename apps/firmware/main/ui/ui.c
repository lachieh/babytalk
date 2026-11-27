#include "esp_log.h"
#include "screens.h"

static const char *TAG = "screen";

void ui_load(lv_obj_t *screen, const char *name)
{
    lv_screen_load_anim(screen, LV_SCREEN_LOAD_ANIM_NONE, 0, 0, true);
    ESP_LOGI(TAG, "%s", name);
}
