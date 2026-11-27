// One HTTP request, http or https (TLS checked against the ESP-IDF certificate bundle; plain http is
// allowed for self-hosted servers on a LAN).
#pragma once

#include <stddef.h>

typedef struct {
    int status;  /* 0 when nothing answered */
    char *body;  /* NUL-terminated, heap; free with http_free */
    size_t len;
} http_resp_t;

/** `body` NULL makes a GET. `bearer` adds Authorization. Returns the status (0 on no answer). */
int http_request(const char *url, const char *body, const char *bearer, http_resp_t *out, int timeout_ms);
void http_free(http_resp_t *resp);
