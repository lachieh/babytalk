#include "bz_wifi.h"
#include "check.h"

TEST(test_wifi_failure)
{
    // A wrong passphrase, as the emulator (204), real access points (15) and ESP-IDF (202, 14) report it.
    CHECK_INT(bz_wifi_failure(204), BZ_WIFI_WRONG_PASSWORD);
    CHECK_INT(bz_wifi_failure(15), BZ_WIFI_WRONG_PASSWORD);
    CHECK_INT(bz_wifi_failure(202), BZ_WIFI_WRONG_PASSWORD);
    CHECK_INT(bz_wifi_failure(14), BZ_WIFI_WRONG_PASSWORD);
    CHECK_INT(bz_wifi_failure(201), BZ_WIFI_UNREACHABLE);
    CHECK_INT(bz_wifi_failure(205), BZ_WIFI_UNREACHABLE);
    CHECK_INT(bz_wifi_failure(2), BZ_WIFI_UNREACHABLE);
    CHECK_INT(bz_wifi_failure(8), BZ_WIFI_UNREACHABLE);
    CHECK_INT(bz_wifi_failure(0), BZ_WIFI_UNREACHABLE);
}
