#include "bz_outbox.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bz_time.h"
#include "cJSON.h"

void bz_ob_init(bz_outbox_t *ob)
{
    memset(ob, 0, sizeof *ob);
    ob->next_seq = 1;
    ob->next_request = 1;
}

/* ── Lookups ─────────────────────────────────────────────── */

static bz_entry_t *entry_of(bz_outbox_t *ob, const char *id)
{
    for (size_t i = 0; i < ob->outbox_count; i++) {
        if (strcmp(ob->outbox[i].event.id, id) == 0) return &ob->outbox[i];
    }
    return NULL;
}

static const bz_event_t *server_event(const bz_outbox_t *ob, const char *id)
{
    for (size_t i = 0; i < ob->server_count; i++) {
        if (strcmp(ob->server[i].id, id) == 0) return &ob->server[i];
    }
    return NULL;
}

static void drop_entry(bz_outbox_t *ob, bz_entry_t *entry)
{
    size_t index = (size_t)(entry - ob->outbox);
    memmove(&ob->outbox[index], &ob->outbox[index + 1], (ob->outbox_count - index - 1) * sizeof *entry);
    ob->outbox_count--;
}

static bz_entry_t *new_entry(bz_outbox_t *ob, const bz_event_t *event, bz_op_t op, unsigned patch, bool detached,
                             const char *baby_id)
{
    if (ob->outbox_count >= BZ_OUTBOX_MAX) return NULL;
    char baby[BZ_ID_LEN];
    snprintf(baby, sizeof baby, "%s", baby_id ? baby_id : "");
    bz_entry_t *entry = &ob->outbox[ob->outbox_count++];
    memset(entry, 0, sizeof *entry);
    entry->event = *event;
    entry->event.sync = BZ_SAVED;
    memcpy(entry->baby_id, baby, sizeof baby);
    entry->op = op;
    entry->patch = (uint8_t)patch;
    entry->exists = op == BZ_OP_CREATE ? BZ_EXISTS_NO : BZ_EXISTS_YES;
    entry->status = BZ_ST_READY;
    entry->version = 1;
    entry->detached = detached;
    entry->seq = ob->next_seq++;
    return entry;
}

static void apply_changes(bz_event_t *event, unsigned changed, const bz_event_t *values)
{
    if (changed & BZ_CHANGED_STARTED) event->started = values->started;
    if (changed & BZ_CHANGED_ENDED) event->ended = values->ended;
    if (changed & BZ_CHANGED_META) memcpy(event->meta, values->meta, sizeof event->meta);
}

static void upsert_server(bz_outbox_t *ob, const bz_event_t *event)
{
    for (size_t i = 0; i < ob->server_count; i++) {
        if (strcmp(ob->server[i].id, event->id) == 0) {
            ob->server[i] = *event;
            return;
        }
    }
    if (ob->server_count >= BZ_SERVER_MAX) ob->server_count--; /* the oldest falls off */
    memmove(&ob->server[1], &ob->server[0], ob->server_count * sizeof *event);
    ob->server[0] = *event;
    ob->server_count++;
}

static void remove_server(bz_outbox_t *ob, const char *id)
{
    for (size_t i = 0; i < ob->server_count; i++) {
        if (strcmp(ob->server[i].id, id) == 0) {
            memmove(&ob->server[i], &ob->server[i + 1], (ob->server_count - i - 1) * sizeof ob->server[0]);
            ob->server_count--;
            return;
        }
    }
}

/* ── Changes ─────────────────────────────────────────────── */

void bz_ob_set_baby(bz_outbox_t *ob, const char *baby_id)
{
    if (strcmp(ob->server_baby, baby_id ? baby_id : "") == 0) return;
    snprintf(ob->server_baby, sizeof ob->server_baby, "%s", baby_id ? baby_id : "");
    ob->server_count = 0;
}

void bz_ob_loaded(bz_outbox_t *ob, const bz_event_t *events, size_t count, bz_ms_t requested_at)
{
    // An answer asked for before the last confirmed write may not include it.
    if (requested_at < ob->last_write_at) return;
    if (count > BZ_SERVER_MAX) count = BZ_SERVER_MAX;
    memcpy(ob->server, events, count * sizeof *events);
    ob->server_count = count;
}

bool bz_ob_create(bz_outbox_t *ob, const bz_event_t *event, const char *baby_id)
{
    return new_entry(ob, event, BZ_OP_CREATE, 0, false, baby_id) != NULL;
}

bool bz_ob_update(bz_outbox_t *ob, const char *id, unsigned changed, const bz_event_t *values)
{
    bz_entry_t *entry = entry_of(ob, id);
    if (entry) {
        if (entry->op == BZ_OP_DELETE) return false;
        apply_changes(&entry->event, changed, values);
        entry->patch |= (uint8_t)changed;
        if (entry->status != BZ_ST_SENDING) entry->status = BZ_ST_READY;
        entry->version++;
        return true;
    }
    const bz_event_t *current = server_event(ob, id);
    bz_event_t base;
    if (current) {
        base = *current;
    } else {
        memset(&base, 0, sizeof base);
        snprintf(base.id, sizeof base.id, "%s", id);
        base.type = values->type;
        strcpy(base.meta, "{}");
    }
    apply_changes(&base, changed, values);
    return new_entry(ob, &base, BZ_OP_UPDATE, changed, !current, ob->server_baby) != NULL;
}

static bool remove_event(bz_outbox_t *ob, const char *id)
{
    bz_entry_t *entry = entry_of(ob, id);
    if (!entry) {
        const bz_event_t *current = server_event(ob, id);
        bz_event_t base;
        if (current) {
            base = *current;
        } else {
            memset(&base, 0, sizeof base);
            snprintf(base.id, sizeof base.id, "%s", id);
            strcpy(base.meta, "{}");
        }
        return new_entry(ob, &base, BZ_OP_DELETE, 0, !current, ob->server_baby) != NULL;
    }
    if (entry->op == BZ_OP_DELETE) return true;
    bool sending = entry->status == BZ_ST_SENDING;
    // Never sent: there is nothing to delete.
    if (entry->exists == BZ_EXISTS_NO && !sending) {
        drop_entry(ob, entry);
        return true;
    }
    entry->op = BZ_OP_DELETE;
    if (!sending) entry->status = BZ_ST_READY;
    entry->version++;
    return true;
}

void bz_ob_unhide(bz_outbox_t *ob, const char *id)
{
    for (size_t i = 0; i < ob->hidden_count; i++) {
        if (strcmp(ob->hidden[i], id) == 0) {
            memmove(&ob->hidden[i], &ob->hidden[i + 1], (ob->hidden_count - i - 1) * sizeof ob->hidden[0]);
            ob->hidden_count--;
            return;
        }
    }
}

bool bz_ob_delete(bz_outbox_t *ob, const char *id)
{
    bz_ob_unhide(ob, id);
    return remove_event(ob, id);
}

void bz_ob_hide(bz_outbox_t *ob, const char *id)
{
    for (size_t i = 0; i < ob->hidden_count; i++) {
        if (strcmp(ob->hidden[i], id) == 0) return;
    }
    if (ob->hidden_count >= BZ_HIDDEN_MAX) {
        // Only one discard waits in its undo window at a time; an old one is long committed.
        bz_ob_delete(ob, ob->hidden[0]);
    }
    snprintf(ob->hidden[ob->hidden_count++], BZ_ID_LEN, "%s", id);
}

/* ── Sending ─────────────────────────────────────────────── */

const bz_entry_t *bz_ob_next(const bz_outbox_t *ob)
{
    const bz_entry_t *oldest = NULL;
    for (size_t i = 0; i < ob->outbox_count; i++) {
        const bz_entry_t *entry = &ob->outbox[i];
        if (entry->status == BZ_ST_FAILED) continue;
        if (!oldest || entry->seq < oldest->seq) oldest = entry;
    }
    return oldest && oldest->status == BZ_ST_READY ? oldest : NULL;
}

uint32_t bz_ob_send_start(bz_outbox_t *ob, const char *id)
{
    bz_entry_t *entry = entry_of(ob, id);
    if (!entry || entry->status != BZ_ST_READY) return 0;
    // A resent create that the server may already hold confirms only that first copy (the server
    // ignores this one), so the changes made since stay unconfirmed and follow as an update.
    bool resent_create = entry->op == BZ_OP_CREATE && entry->exists == BZ_EXISTS_MAYBE;
    if (entry->op == BZ_OP_CREATE) entry->exists = BZ_EXISTS_MAYBE;
    if (!resent_create) {
        entry->sent_patch = entry->patch;
        entry->patch = 0;
        entry->sent_version = entry->version;
    } else {
        entry->sent_patch = 0;
    }
    entry->sent_op = entry->op;
    entry->status = BZ_ST_SENDING;
    entry->request = ob->next_request++;
    if (ob->next_request == 0) ob->next_request = 1;
    return entry->request;
}

char *bz_ob_request_body(const bz_entry_t *entry)
{
    switch (entry->sent_op) {
    case BZ_OP_CREATE: return bz_gql_log_event(&entry->event, entry->baby_id);
    case BZ_OP_UPDATE: return bz_gql_update_event(&entry->event, entry->sent_patch);
    case BZ_OP_DELETE: return bz_gql_delete_event(entry->event.id);
    }
    return NULL;
}

static bz_entry_t *replying(bz_outbox_t *ob, const char *id, uint32_t request)
{
    bz_entry_t *entry = entry_of(ob, id);
    return entry && entry->request == request && entry->status == BZ_ST_SENDING ? entry : NULL;
}

void bz_ob_send_ok(bz_outbox_t *ob, const char *id, uint32_t request, const bz_event_t *confirmed, bz_ms_t at)
{
    bz_entry_t *entry = replying(ob, id, request);
    if (!entry) return;
    if (at > ob->last_write_at) ob->last_write_at = at;
    bz_exists_t exists = entry->sent_op == BZ_OP_DELETE ? BZ_EXISTS_NO : BZ_EXISTS_YES;
    if (entry->version > entry->sent_version) {
        // Changed while the request was in flight: send what changed.
        entry->exists = exists;
        if (entry->op == BZ_OP_CREATE) entry->op = BZ_OP_UPDATE;
        entry->request = 0;
        entry->sent_patch = 0;
        entry->status = BZ_ST_READY;
        return;
    }
    bz_entry_t done = *entry;
    drop_entry(ob, entry);
    if (done.sent_op == BZ_OP_DELETE) {
        remove_server(ob, id);
        return;
    }
    // The loaded list is one baby's; a change to another baby's event waits for their next load.
    if (done.baby_id[0] && strcmp(done.baby_id, ob->server_baby) != 0) return;
    if (confirmed) {
        upsert_server(ob, confirmed);
    } else if (!done.detached) {
        upsert_server(ob, &done.event);
    }
}

static void unsent(bz_entry_t *entry, bz_status_t status)
{
    entry->patch |= entry->sent_patch;
    entry->sent_patch = 0;
    entry->request = 0;
    entry->status = status;
}

void bz_ob_send_failed(bz_outbox_t *ob, const char *id, uint32_t request, bool definite)
{
    bz_entry_t *entry = replying(ob, id, request);
    // A failure never lowers `exists`: a refusal of this request says nothing about an earlier one
    // that went unanswered and may have been stored.
    if (entry) unsent(entry, definite ? BZ_ST_FAILED : BZ_ST_WAITING);
}

void bz_ob_resume(bz_outbox_t *ob)
{
    for (size_t i = 0; i < ob->outbox_count; i++) {
        if (ob->outbox[i].status == BZ_ST_WAITING) ob->outbox[i].status = BZ_ST_READY;
    }
}

void bz_ob_retry(bz_outbox_t *ob)
{
    for (size_t i = 0; i < ob->outbox_count; i++) {
        bz_status_t status = ob->outbox[i].status;
        if (status == BZ_ST_WAITING || status == BZ_ST_FAILED) ob->outbox[i].status = BZ_ST_READY;
    }
}

bool bz_ob_has_waiting(const bz_outbox_t *ob)
{
    for (size_t i = 0; i < ob->outbox_count; i++) {
        if (ob->outbox[i].status == BZ_ST_WAITING) return true;
    }
    return false;
}

/* ── Views ───────────────────────────────────────────────── */

static bool visible(const bz_entry_t *entry) { return entry->op != BZ_OP_DELETE || entry->status == BZ_ST_FAILED; }

static uint8_t sync_of(const bz_entry_t *entry) { return entry->status == BZ_ST_FAILED ? BZ_FAILED : BZ_PENDING; }

static bool is_hidden(const bz_outbox_t *ob, const char *id)
{
    for (size_t i = 0; i < ob->hidden_count; i++) {
        if (strcmp(ob->hidden[i], id) == 0) return true;
    }
    return false;
}

static int newest_first(const void *a, const void *b)
{
    bz_ms_t x = ((const bz_event_t *)a)->started, y = ((const bz_event_t *)b)->started;
    return x < y ? 1 : x > y ? -1 : 0;
}

size_t bz_ob_derive(const bz_outbox_t *ob, const char *baby_id, bz_event_t *out, size_t max)
{
    size_t count = 0;
    size_t loaded = baby_id && strcmp(baby_id, ob->server_baby) == 0 ? ob->server_count : 0;
    for (size_t i = 0; i < loaded && count < max; i++) {
        const bz_event_t *event = &ob->server[i];
        if (is_hidden(ob, event->id)) continue;
        const bz_entry_t *entry = entry_of((bz_outbox_t *)ob, event->id);
        if (!entry) {
            out[count] = *event;
            out[count++].sync = BZ_SAVED;
        } else if (visible(entry)) {
            bz_event_t shown = entry->event;
            if (entry->detached) {
                shown = *event;
                apply_changes(&shown, (unsigned)(entry->patch | entry->sent_patch), &entry->event);
            }
            shown.sync = sync_of(entry);
            out[count++] = shown;
        }
    }
    for (size_t i = 0; i < ob->outbox_count && count < max; i++) {
        const bz_entry_t *entry = &ob->outbox[i];
        if (entry->detached || !visible(entry) || server_event(ob, entry->event.id)) continue;
        if (is_hidden(ob, entry->event.id)) continue;
        // Each change belongs to the baby it was made for.
        if (!baby_id || strcmp(entry->baby_id, baby_id) != 0) continue;
        out[count] = entry->event;
        out[count++].sync = sync_of(entry);
    }
    qsort(out, count, sizeof *out, newest_first);
    return count;
}

bz_unsaved_t bz_ob_unsaved(const bz_outbox_t *ob)
{
    bz_unsaved_t unsaved = {0};
    for (size_t i = 0; i < ob->outbox_count; i++) {
        bz_status_t status = ob->outbox[i].status;
        if (status == BZ_ST_FAILED) {
            unsaved.failed++;
        } else if (status == BZ_ST_WAITING || status == BZ_ST_READY) {
            unsaved.queued++;
        }
    }
    return unsaved;
}

/* ── Persistence ─────────────────────────────────────────── */

static cJSON *event_json(const bz_event_t *event)
{
    cJSON *json = cJSON_CreateObject();
    char iso[25];
    cJSON_AddStringToObject(json, "id", event->id);
    cJSON_AddStringToObject(json, "type", bz_type_name(event->type));
    bz_format_iso(event->started, iso);
    cJSON_AddStringToObject(json, "startedAt", iso);
    if (event->ended == BZ_RUNNING) {
        cJSON_AddNullToObject(json, "endedAt");
    } else {
        bz_format_iso(event->ended, iso);
        cJSON_AddStringToObject(json, "endedAt", iso);
    }
    cJSON_AddStringToObject(json, "metadata", event->meta);
    return json;
}

char *bz_ob_serialize(const bz_outbox_t *ob)
{
    cJSON *root = cJSON_CreateObject();
    cJSON_AddNumberToObject(root, "v", 1);
    cJSON_AddNumberToObject(root, "nextSeq", ob->next_seq);
    cJSON *hidden = cJSON_AddArrayToObject(root, "hidden");
    for (size_t i = 0; i < ob->hidden_count; i++) cJSON_AddItemToArray(hidden, cJSON_CreateString(ob->hidden[i]));
    cJSON *list = cJSON_AddArrayToObject(root, "outbox");
    for (size_t i = 0; i < ob->outbox_count; i++) {
        const bz_entry_t *e = &ob->outbox[i];
        cJSON *item = cJSON_CreateObject();
        cJSON_AddItemToObject(item, "event", event_json(&e->event));
        cJSON_AddStringToObject(item, "baby", e->baby_id);
        cJSON_AddNumberToObject(item, "op", e->op);
        cJSON_AddNumberToObject(item, "patch", e->patch);
        cJSON_AddNumberToObject(item, "sentPatch", e->sent_patch);
        cJSON_AddNumberToObject(item, "status", e->status);
        cJSON_AddNumberToObject(item, "exists", e->exists);
        cJSON_AddNumberToObject(item, "version", e->version);
        cJSON_AddNumberToObject(item, "sentVersion", e->sent_version);
        cJSON_AddNumberToObject(item, "sentOp", e->sent_op);
        cJSON_AddBoolToObject(item, "detached", e->detached);
        cJSON_AddNumberToObject(item, "seq", e->seq);
        cJSON_AddItemToArray(list, item);
    }
    char *text = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return text;
}

static int num(const cJSON *object, const char *key, int fallback)
{
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(object, key);
    return cJSON_IsNumber(item) ? (int)item->valuedouble : fallback;
}

bool bz_ob_adopt(bz_outbox_t *ob, const char *json)
{
    cJSON *root = cJSON_Parse(json ? json : "");
    if (!cJSON_IsObject(root) || num(root, "v", 0) != 1) {
        cJSON_Delete(root);
        return false;
    }
    uint32_t next_seq = (uint32_t)num(root, "nextSeq", 1);
    if (next_seq > ob->next_seq) ob->next_seq = next_seq;
    const cJSON *item;
    cJSON_ArrayForEach(item, cJSON_GetObjectItemCaseSensitive(root, "outbox"))
    {
        cJSON *wrapper = cJSON_CreateObject();
        cJSON *data = cJSON_AddObjectToObject(wrapper, "data");
        cJSON_AddItemToObject(data, "e", cJSON_Duplicate(cJSON_GetObjectItemCaseSensitive(item, "event"), true));
        char *text = cJSON_PrintUnformatted(wrapper);
        cJSON_Delete(wrapper);
        bz_event_t event;
        bool parsed = bz_parse_event(text, "e", &event);
        free(text);
        if (!parsed || entry_of(ob, event.id) || ob->outbox_count >= BZ_OUTBOX_MAX) continue;
        bz_entry_t *entry = &ob->outbox[ob->outbox_count++];
        memset(entry, 0, sizeof *entry);
        entry->event = event;
        const cJSON *baby = cJSON_GetObjectItemCaseSensitive(item, "baby");
        snprintf(entry->baby_id, sizeof entry->baby_id, "%s", cJSON_IsString(baby) ? baby->valuestring : "");
        entry->op = (bz_op_t)num(item, "op", BZ_OP_UPDATE);
        entry->patch = (uint8_t)num(item, "patch", 0);
        entry->sent_patch = (uint8_t)num(item, "sentPatch", 0);
        entry->status = (bz_status_t)num(item, "status", BZ_ST_READY);
        entry->exists = (bz_exists_t)num(item, "exists", BZ_EXISTS_MAYBE);
        entry->version = (uint32_t)num(item, "version", 1);
        entry->sent_version = (uint32_t)num(item, "sentVersion", 0);
        entry->sent_op = (bz_op_t)num(item, "sentOp", entry->op);
        entry->detached = cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(item, "detached"));
        entry->seq = (uint32_t)num(item, "seq", (int)ob->next_seq);
        if (entry->seq >= ob->next_seq) ob->next_seq = entry->seq + 1;
        // A request in flight when the device stopped has no reply coming.
        if (entry->status == BZ_ST_SENDING) unsent(entry, BZ_ST_READY);
    }
    cJSON_ArrayForEach(item, cJSON_GetObjectItemCaseSensitive(root, "hidden"))
    {
        if (cJSON_IsString(item)) remove_event(ob, item->valuestring);
    }
    cJSON_Delete(root);
    return true;
}
