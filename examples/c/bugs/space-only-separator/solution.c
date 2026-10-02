#include "solution.h"

#include <stdbool.h>

size_t count_words(const char *s) {
    if (s == NULL) return 0;
    size_t count = 0;
    bool in_word = false;
    for (; *s != '\0'; s++) {
        if (*s == ' ') { /* BUG: only ' ' is whitespace; tabs and newlines are not */
            in_word = false;
        } else if (!in_word) {
            in_word = true;
            count++;
        }
    }
    return count;
}
