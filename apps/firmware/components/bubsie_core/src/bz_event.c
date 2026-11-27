#include "bz_event.h"

#include <stdio.h>
#include <string.h>

#include "cJSON.h"

static const char *const NAMES[BZ_TYPE_COUNT] = {"feed", "sleep", "diaper", "pump", "note"};
static const char *const LABELS[BZ_TYPE_COUNT] = {"Feed", "Sleep", "Diaper", "Pump", "Note"};

const char *bz_type_name(bz_type_t type) { return type < BZ_TYPE_COUNT ? NAMES[type] : "unknown"; }

const char *bz_type_label(bz_type_t type) { return type < BZ_TYPE_COUNT ? LABELS[type] : "Event"; }

bz_type_t bz_type_from_name(const char *name)
{
    for (int i = 0; i < BZ_TYPE_COUNT; i++) {
        if (name && strcmp(name, NAMES[i]) == 0) return (bz_type_t)i;
    }
    return BZ_TYPE_UNKNOWN;
}

bool bz_meta_str(const char *meta, const char *key, char *out, size_t out_len)
{
    if (out_len) out[0] = '\0';
    cJSON *root = cJSON_Parse(meta ? meta : "");
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(root, key);
    bool found = cJSON_IsString(item) && item->valuestring;
    if (found) snprintf(out, out_len, "%s", item->valuestring);
    cJSON_Delete(root);
    return found;
}

bool bz_meta_bool(const char *meta, const char *key)
{
    cJSON *root = cJSON_Parse(meta ? meta : "");
    bool value = cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(root, key));
    cJSON_Delete(root);
    return value;
}

int bz_meta_int(const char *meta, const char *key)
{
    cJSON *root = cJSON_Parse(meta ? meta : "");
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(root, key);
    int value = cJSON_IsNumber(item) ? (int)item->valuedouble : 0;
    cJSON_Delete(root);
    return value;
}

bool bz_meta_with_int(const char *meta, const char *key, int value, char *out, size_t out_len)
{
    cJSON *root = cJSON_Parse(meta ? meta : "");
    if (!cJSON_IsObject(root)) {
        cJSON_Delete(root);
        root = cJSON_CreateObject();
    }
    cJSON_DeleteItemFromObjectCaseSensitive(root, key);
    cJSON_AddNumberToObject(root, key, value);
    bool ok = cJSON_PrintPreallocated(root, out, (int)out_len, false);
    cJSON_Delete(root);
    return ok;
}
