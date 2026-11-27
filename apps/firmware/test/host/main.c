#include <stdlib.h>

#include "check.h"

int check_failures;
int check_count;

#define X(name) void name(void);
#include "tests.def"
#undef X

int main(void)
{
    // Times in the tests are local to this zone unless a test sets another.
    setenv("TZ", "UTC0", 1);
#define X(name) name();
#include "tests.def"
#undef X
    printf("%d checks, %d failed\n", check_count, check_failures);
    return check_failures ? 1 : 0;
}
