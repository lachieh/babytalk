// A minimal test harness for the host tests: CHECK records a failure and carries on.
#pragma once
#include <stdio.h>
#include <string.h>

extern int check_failures;
extern int check_count;

#define CHECK(cond)                                                                     \
    do {                                                                                \
        check_count++;                                                                  \
        if (!(cond)) {                                                                  \
            check_failures++;                                                           \
            fprintf(stderr, "%s:%d: CHECK(%s) failed\n", __FILE__, __LINE__, #cond);   \
        }                                                                               \
    } while (0)

#define CHECK_STR(actual, expected)                                                             \
    do {                                                                                        \
        const char *a_ = (actual), *e_ = (expected);                                            \
        check_count++;                                                                          \
        if (!a_ || strcmp(a_, e_) != 0) {                                                       \
            check_failures++;                                                                   \
            fprintf(stderr, "%s:%d: got \"%s\", expected \"%s\"\n", __FILE__, __LINE__, a_ ? a_ : "(null)", e_); \
        }                                                                                       \
    } while (0)

#define CHECK_INT(actual, expected)                                                                 \
    do {                                                                                            \
        long long a_ = (long long)(actual), e_ = (long long)(expected);                             \
        check_count++;                                                                              \
        if (a_ != e_) {                                                                             \
            check_failures++;                                                                       \
            fprintf(stderr, "%s:%d: %s is %lld, expected %lld\n", __FILE__, __LINE__, #actual, a_, e_); \
        }                                                                                           \
    } while (0)

#define TEST(name) void name(void)
