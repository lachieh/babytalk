// What a failed Wi-Fi join means for the person joining, from the station's disconnect reason.
#pragma once

/* The ESP-IDF disconnect reasons (wifi_err_reason_t) that mean the password was wrong. A wrong
 * WPA2 passphrase fails the 4-way handshake; access points and ESP-IDF report that as any of these. */
#define BZ_WIFI_REASON_MIC_FAILURE 14
#define BZ_WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT 15
#define BZ_WIFI_REASON_AUTH_FAIL 202
#define BZ_WIFI_REASON_HANDSHAKE_TIMEOUT 204

typedef enum {
    BZ_WIFI_WRONG_PASSWORD,
    /** Anything else: out of range, refused, or no answer at all (reason 0). */
    BZ_WIFI_UNREACHABLE,
} bz_wifi_failure_t;

bz_wifi_failure_t bz_wifi_failure(int reason);
