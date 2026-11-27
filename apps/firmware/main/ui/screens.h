// Every screen of the device. Each `screen_*_show` builds a fresh screen and loads it; it runs on
// the LVGL task with the display lock held.
#pragma once

#include "theme.h"

/** Load `screen` (deleting the old one) and log `screen: <name>` so tests can follow the flow. */
void ui_load(lv_obj_t *screen, const char *name);

void screen_splash_show(const char *status);
