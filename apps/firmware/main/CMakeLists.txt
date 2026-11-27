file(GLOB_RECURSE SOURCES "*.c")
idf_component_register(
    SRCS ${SOURCES}
    INCLUDE_DIRS "." "assets" "ui" "net"
    REQUIRES bubsie_core nvs_flash esp_wifi esp_netif esp_event esp_http_client esp-tls mbedtls
             esp_timer lwip esp_driver_gpio)
