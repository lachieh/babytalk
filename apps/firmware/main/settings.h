// What the device remembers, in NVS (namespace "bubsie"). Read once at boot into `settings`;
// each setter writes through.
#pragma once

#include <stdbool.h>
#include <stdint.h>

#define SETTINGS_URL_LEN 160
#define SETTINGS_TOKEN_LEN 1024

typedef struct {
    char web_url[SETTINGS_URL_LEN];  /* the Bubsie instance; default CONFIG_BUBSIE_DEFAULT_WEB_URL */
    char api_url[SETTINGS_URL_LEN];  /* cached from <web_url>/.well-known/config */
    char wifi_ssid[33];
    char wifi_pass[65];
    char token[SETTINGS_TOKEN_LEN];   /* access token (JWT) */
    char refresh[SETTINGS_TOKEN_LEN]; /* refresh token */
    char baby_id[37];
    uint8_t tiles;      /* bit per bz_type_t shown on the station; default feed, diaper, sleep */
    char tz[40];        /* IANA name from bz_time zones; "" until chosen */
    uint8_t dark;       /* 0 auto (8 pm to 7 am, like the web), 1 always, 2 never */
    uint8_t volume_oz;  /* 1: fl oz, 0: ml */
    uint8_t reduced_motion;
} settings_t;

extern settings_t settings;

void settings_load(void);
void settings_set_u8(const char *key, uint8_t *field, uint8_t value);

void settings_save_wifi(const char *ssid, const char *pass);
/** A new session (pairing) or none (""): both tokens in one write. */
void settings_save_tokens(const char *token, const char *refresh);
/** Which session the saved tokens belong to; moves whenever the session is replaced or cleared. */
uint32_t settings_session(void);
/** A refresh's new tokens, saved only if `session` is still the current one. */
bool settings_save_refreshed(uint32_t session, const char *token, const char *refresh);
void settings_save_web_url(const char *web_url, const char *api_url);
void settings_save_api_url(const char *api_url);
void settings_save_baby(const char *baby_id);
void settings_save_tiles(uint8_t tiles);
void settings_save_tz(const char *tz);
/** Unpair: forget the session and the baby, keep Wi-Fi and the server. */
void settings_unpair(void);
/** Reset device: forget the session, the baby and the server (back to the factory web URL). */
void settings_reset(void);
