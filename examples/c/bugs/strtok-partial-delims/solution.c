#include "solution.h"

#include <stdlib.h>
#include <string.h>

size_t count_words(const char *s) {
    if (s == NULL) return 0;
    /* BUG (plausible alternative): strtok on a copy, but the delimiter list is incomplete:
       '\r', '\v' and '\f' are whitespace for isspace() and are missing here. */
    char *copy = malloc(strlen(s) + 1);
    if (copy == NULL) return 0;
    strcpy(copy, s);
    size_t count = 0;
    for (char *tok = strtok(copy, " \t\n"); tok != NULL; tok = strtok(NULL, " \t\n")) count++;
    free(copy);
    return count;
}
