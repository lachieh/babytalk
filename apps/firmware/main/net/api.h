#pragma once

#include <stdbool.h>

#include "bz_gql.h"
#include "http.h"

typedef enum {
    API_OK,
    API_REFUSED,
    API_TRANSIENT,
    API_SIGNED_OUT,
} api_result_t;

api_result_t api_call(char *body, http_resp_t *out, bz_reply_t *reply);
bool api_ensure_config(void);
