#include "solution.h"

#include <ctype.h>
#include <stdbool.h>

size_t count_words(const char *s) {
    if (s == NULL) return 0;
    size_t count = 0;
    bool in_word = false;
    for (; *s != '\0'; s++) {
        if (isspace((unsigned char)*s)) {
            in_word = false;
        } else if (!in_word) {
            in_word = true;
            count++;
        }
    }
    return count;
}
