#include "bz_wifi.h"

bz_wifi_failure_t bz_wifi_failure(int reason)
{
    switch (reason) {
    case BZ_WIFI_REASON_MIC_FAILURE:
    case BZ_WIFI_REASON_4WAY_HANDSHAKE_TIMEOUT:
    case BZ_WIFI_REASON_AUTH_FAIL:
    case BZ_WIFI_REASON_HANDSHAKE_TIMEOUT:
        return BZ_WIFI_WRONG_PASSWORD;
    default:
        return BZ_WIFI_UNREACHABLE;
    }
}
