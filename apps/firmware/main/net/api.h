// The Bubsie API as this device's session sees it: GraphQL to settings.api_url with the access
// token, one refresh and retry when the server says the session is not authenticated
// (apps/web/src/lib/gql-request.ts). A refresh the server rejects ends the session.
#pragma once

#include <stdbool.h>

#include "bz_gql.h"
#include "http.h"

typedef enum {
    API_OK,
    API_REFUSED,    /* the server refused this request: sending it again will not help */
    API_TRANSIENT,  /* no usable answer: try again later */
    API_SIGNED_OUT, /* the server rejected the refresh token: the device must pair again */
} api_result_t;

/** POST `body` (freed here). On API_OK `out` holds the reply; free it with http_free. */
api_result_t api_call(char *body, http_resp_t *out, bz_reply_t *reply);
/** Fetch <web_url>/.well-known/config into settings.api_url if it is not cached. */
bool api_ensure_config(void);
