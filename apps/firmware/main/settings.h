#pragma once

#include <stdbool.h>
#include <stdint.h>

#define SETTINGS_URL_LEN 160
#define SETTINGS_TOKEN_LEN 1024

typedef struct {
    char web_url[SETTINGS_URL_LEN];
    char api_url[SETTINGS_URL_LEN];
    char wifi_ssid[33];
    char wifi_pass[65];
    char token[SETTINGS_TOKEN_LEN];
    char refresh[SETTINGS_TOKEN_LEN];
    char baby_id[37];
    uint8_t tiles;
    char tz[40];
    uint8_t dark;
    uint8_t volume_oz;
    uint8_t reduced_motion;
} settings_t;

extern settings_t settings;

void settings_load(void);
void settings_set_u8(const char *key, uint8_t *field, uint8_t value);

void settings_save_wifi(const char *ssid, const char *pass);
void settings_save_tokens(const char *token, const char *refresh);
uint32_t settings_session(void);
bool settings_save_refreshed(uint32_t session, const char *token, const char *refresh);
void settings_save_web_url(const char *web_url, const char *api_url);
void settings_save_api_url(const char *api_url);
void settings_save_baby(const char *baby_id);
void settings_save_tiles(uint8_t tiles);
void settings_save_tz(const char *tz);
void settings_unpair(void);
void settings_reset(void);
