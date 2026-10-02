TARGET ?= starter
CC ?= gcc
CFLAGS = -std=c17 -Wall -Wextra -Wpedantic -Werror -g -fno-omit-frame-pointer \
         -fsanitize=address,undefined -fno-sanitize-recover=all
BIN = /tmp/gingaloop-test-$(subst /,_,$(TARGET))

.PHONY: test
test:
	$(CC) $(CFLAGS) -I../$(TARGET) test.c ../$(TARGET)/*.c -o $(BIN)
	$(BIN)
