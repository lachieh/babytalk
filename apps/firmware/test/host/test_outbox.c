#include <stdlib.h>
#include <string.h>

#include "bz_outbox.h"
#include "check.h"

static bz_outbox_t ob;
static bz_event_t view[BZ_SERVER_MAX];

static bz_event_t ev(const char *id, bz_type_t type, bz_ms_t started, bz_ms_t ended)
{
    bz_event_t e = {.type = type, .started = started, .ended = ended};
    strcpy(e.id, id);
    strcpy(e.meta, "{}");
    return e;
}

static const char *send_next(bool ok, bool definite, char **body_out)
{
    static char id[BZ_ID_LEN];
    const bz_entry_t *next = bz_ob_next(&ob);
    if (!next) return "";
    strcpy(id, next->event.id);
    uint32_t request = bz_ob_send_start(&ob, id);
    char *body = bz_ob_request_body(bz_ob_next(&ob) ? bz_ob_next(&ob) : &ob.outbox[0]);
    for (size_t i = 0; i < ob.outbox_count; i++) {
        if (strcmp(ob.outbox[i].event.id, id) == 0) {
            free(body);
            body = bz_ob_request_body(&ob.outbox[i]);
        }
    }
    if (body_out) {
        *body_out = body;
    } else {
        free(body);
    }
    if (ok) {
        bz_ob_send_ok(&ob, id, request, NULL, 1000);
    } else {
        bz_ob_send_failed(&ob, id, request, definite);
    }
    return id;
}

TEST(test_outbox_create_shows_and_sends_in_order)
{
    bz_ob_init(&ob);
    bz_ob_set_baby(&ob, "b1");
    bz_event_t a = ev("a", BZ_FEED, 100, BZ_RUNNING), b = ev("b", BZ_DIAPER, 200, 200);
    CHECK(bz_ob_create(&ob, &a, "b1"));
    CHECK(bz_ob_create(&ob, &b, "b1"));
    size_t n = bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX);
    CHECK_INT(n, 2);
    CHECK_STR(view[0].id, "b");
    CHECK_INT(view[0].sync, BZ_PENDING);
    CHECK_INT(bz_ob_derive(&ob, "b2", view, BZ_SERVER_MAX), 0);

    CHECK_STR(send_next(false, false, NULL), "a");
    CHECK(bz_ob_next(&ob) == NULL);
    CHECK(bz_ob_has_waiting(&ob));
    CHECK_INT(bz_ob_unsaved(&ob).queued, 2);
    bz_ob_resume(&ob);
    CHECK_STR(send_next(true, false, NULL), "a");
    CHECK_STR(send_next(true, false, NULL), "b");
    CHECK_INT(ob.outbox_count, 0);
    n = bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX);
    CHECK_INT(n, 2);
    CHECK_INT(view[1].sync, BZ_SAVED);
}

TEST(test_outbox_change_during_flight)
{
    bz_ob_init(&ob);
    bz_ob_set_baby(&ob, "b1");
    bz_event_t a = ev("a", BZ_SLEEP, 100, BZ_RUNNING);
    bz_ob_create(&ob, &a, "b1");
    uint32_t request = bz_ob_send_start(&ob, "a");
    bz_event_t stopped = a;
    stopped.ended = 500;
    CHECK(bz_ob_update(&ob, "a", BZ_CHANGED_ENDED, &stopped));
    CHECK(bz_ob_next(&ob) == NULL);
    bz_ob_send_ok(&ob, "a", request, NULL, 1000);
    CHECK_INT(ob.outbox_count, 1);
    CHECK_INT(ob.outbox[0].op, BZ_OP_UPDATE);
    char *body = NULL;
    CHECK_STR(send_next(true, false, &body), "a");
    CHECK(body && strstr(body, "updateEvent") && strstr(body, "endedAt") && !strstr(body, "startedAt\":"));
    free(body);
    CHECK_INT(ob.outbox_count, 0);
    bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX);
    CHECK_INT(view[0].ended, 500);
}

TEST(test_outbox_refused_and_delete)
{
    bz_ob_init(&ob);
    bz_ob_set_baby(&ob, "b1");
    bz_event_t a = ev("a", BZ_NOTE, 100, 100), b = ev("b", BZ_NOTE, 200, 200);
    bz_ob_create(&ob, &a, "b1");
    bz_ob_create(&ob, &b, "b1");
    CHECK_STR(send_next(false, true, NULL), "a");
    CHECK_INT(bz_ob_unsaved(&ob).failed, 1);
    CHECK_STR(send_next(true, false, NULL), "b");
    bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX);
    CHECK_INT(view[1].sync, BZ_FAILED);
    bz_ob_retry(&ob);
    CHECK_STR(send_next(true, false, NULL), "a");

    bz_event_t c = ev("c", BZ_DIAPER, 300, 300);
    bz_ob_create(&ob, &c, "b1");
    CHECK(bz_ob_delete(&ob, "c"));
    CHECK_INT(ob.outbox_count, 0);
    CHECK(bz_ob_delete(&ob, "a"));
    char *body = NULL;
    send_next(true, false, &body);
    CHECK(body && strstr(body, "deleteEvent"));
    free(body);
    CHECK_INT(bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX), 1);
    bz_ob_delete(&ob, "b");
    bz_event_t values = b;
    CHECK(!bz_ob_update(&ob, "b", BZ_CHANGED_META, &values));
}

TEST(test_outbox_loaded_stale_and_hidden)
{
    bz_ob_init(&ob);
    bz_ob_set_baby(&ob, "b1");
    bz_event_t server[2] = {ev("s2", BZ_FEED, 200, 300), ev("s1", BZ_DIAPER, 100, 100)};
    bz_ob_loaded(&ob, server, 2, 50);
    bz_event_t a = ev("a", BZ_DIAPER, 400, 400);
    bz_ob_create(&ob, &a, "b1");
    send_next(true, false, NULL);
    bz_ob_loaded(&ob, server, 2, 900);
    CHECK_INT(bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX), 3);
    bz_ob_loaded(&ob, server, 1, 1100);
    CHECK_INT(bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX), 1);

    bz_ob_hide(&ob, "s2");
    CHECK_INT(bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX), 0);
    bz_ob_unhide(&ob, "s2");
    CHECK_INT(bz_ob_derive(&ob, "b1", view, BZ_SERVER_MAX), 1);
}

TEST(test_outbox_persist_and_adopt)
{
    bz_ob_init(&ob);
    bz_ob_set_baby(&ob, "b1");
    bz_event_t a = ev("a", BZ_FEED, 1795773845123LL, BZ_RUNNING), h = ev("h", BZ_NOTE, 1795773845000LL, 1795773845000LL);
    strcpy(a.meta, "{\"method\":\"breast\",\"side\":\"left\"}");
    bz_ob_create(&ob, &a, "b1");
    bz_ob_create(&ob, &h, "b1");
    bz_ob_send_start(&ob, "a");
    bz_ob_hide(&ob, "h");
    char *json = bz_ob_serialize(&ob);

    static bz_outbox_t after;
    bz_ob_init(&after);
    CHECK(bz_ob_adopt(&after, json));
    free(json);
    CHECK_INT(after.outbox_count, 1);
    CHECK_STR(after.outbox[0].event.id, "a");
    CHECK_INT(after.outbox[0].status, BZ_ST_READY);
    CHECK_INT(after.outbox[0].exists, BZ_EXISTS_MAYBE);
    CHECK_INT(after.outbox[0].event.started, 1795773845123LL);
    CHECK_INT(after.outbox[0].event.ended, BZ_RUNNING);
    CHECK_STR(after.outbox[0].baby_id, "b1");
    CHECK(!bz_ob_adopt(&after, "garbage"));
}
