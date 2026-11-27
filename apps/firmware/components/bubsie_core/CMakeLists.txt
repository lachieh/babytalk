# Pure logic: no ESP-IDF or LVGL headers, so test/ builds the same sources on the host.
# On the device cJSON comes from ESP-IDF's json component; the host tests use vendor/cjson.
idf_component_register(
    SRC_DIRS "src"
    INCLUDE_DIRS "include"
    REQUIRES json)
# Text is cut to the fields it goes into on purpose (a long server name, a notice).
target_compile_options(${COMPONENT_LIB} PRIVATE -Wno-format-truncation)
