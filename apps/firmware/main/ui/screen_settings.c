// Settings (station-settings-sheet.tsx and the device's own): reached from the last station page.
#include <stdio.h>
#include <string.h>

#include "app.h"
#include "bz_pairing.h"
#include "screens.h"
#include "settings.h"
#include "station.h"

static void on_back(lv_event_t *event) { screen_station_show(); }
static void on_unpair(lv_event_t *event) { app_unpair(false); }

void screen_settings_show(void)
{
    lv_obj_t *screen = ui_screen();
    lv_obj_t *list = ui_round_list(screen, 110, 120);
    ui_title(screen, "Settings");
    ui_back_button(screen, on_back, NULL);
    char host[SETTINGS_URL_LEN];
    bz_url_host(settings.web_url, host, sizeof host);
    char server[SETTINGS_URL_LEN + 16];
    snprintf(server, sizeof server, "Server: %s", host);
    ui_row(list, server, NULL, NULL, NULL);
    ui_row(list, "Unpair", "Sign this device out", on_unpair, NULL);
    ui_round_list_fit(list);
    ui_load(screen, "settings");
}
