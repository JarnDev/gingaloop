#include "solution.h"

#include <ctype.h>

size_t count_words(const char *s) {
    if (s == NULL || *s == '\0') return 0;
    /* BUG: counts separators + 1, so leading/trailing/double spaces add phantom words */
    size_t count = 1;
    for (; *s != '\0'; s++) {
        if (isspace((unsigned char)*s)) count++;
    }
    return count;
}
