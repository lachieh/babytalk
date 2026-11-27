#pragma once

#include <stddef.h>

typedef struct {
    int status;
    char *body;
    size_t len;
} http_resp_t;

int http_request(const char *url, const char *body, const char *bearer, http_resp_t *out, int timeout_ms);
void http_free(http_resp_t *resp);
