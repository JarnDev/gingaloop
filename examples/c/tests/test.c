#include <stdio.h>
#include <string.h>

#include "solution.h"
#include "cases.h"

static int failures = 0;

#define CHECK_SIZE(name, got, want)                                                       \
    do {                                                                                  \
        size_t g_ = (got), w_ = (want);                                                   \
        if (g_ == w_) {                                                                   \
            printf("[ok]   %s\n", name);                                                  \
        } else {                                                                          \
            failures++;                                                                   \
            printf("[FAIL] %s: expected %zu, got %zu  (%s:%d)\n", name, w_, g_, __FILE__, \
                   __LINE__);                                                             \
        }                                                                                 \
    } while (0)

int main(void) {
    CHECK_SIZE("two simple words", count_words("hello world"), 2);
    CHECK_SIZE("leading and trailing whitespace", count_words("  spaced   out  "), 2);
    CHECK_SIZE("tabs and newlines separate words", count_words("tab\tand\nnewline"), 3);
    CHECK_SIZE("every isspace() character separates words", count_words("a\rb\vc\fd"), 4);
    CHECK_SIZE("empty string has no words", count_words(""), 0);
    CHECK_SIZE("only whitespace has no words", count_words(" \t\n "), 0);
    CHECK_SIZE("NULL has no words", count_words(NULL), 0);
    CHECK_SIZE("single word without spaces", count_words("x"), 1);

    /* bytes >= 0x80 (e.g. UTF-8) are non-space and must not trip UB in isspace */
    CHECK_SIZE("non-ASCII bytes are word characters", count_words("caf\xc3\xa9 ol\xc3\xa9"), 2);

    /* must not modify its input (it is const, but check a writable buffer too) */
    char buf[] = "keep me intact";
    (void)count_words(buf);
    CHECK_SIZE("input is not modified", strcmp(buf, "keep me intact") == 0, 1);

    /* golden table: stop at the first mismatch so the message names the input */
    for (size_t i = 0; i < sizeof CASES / sizeof CASES[0]; i++) {
        size_t got = count_words(CASES[i].text);
        if (got != CASES[i].words) {
            char name[64];
            snprintf(name, sizeof name, "golden case #%zu", i);
            CHECK_SIZE(name, got, CASES[i].words);
            break;
        }
    }

    if (failures) {
        printf("\n%d check(s) failed\n", failures);
        return 1;
    }
    printf("\nALL TESTS PASSED\n");
    return 0;
}
