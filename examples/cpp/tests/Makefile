TARGET ?= starter
CXX ?= g++
CXXFLAGS = -std=c++20 -Wall -Wextra -Wpedantic -Werror -g -fno-omit-frame-pointer \
           -fsanitize=address,undefined -fno-sanitize-recover=all
BIN = /tmp/gingaloop-test-$(subst /,_,$(TARGET))

.PHONY: test
test:
	$(CXX) $(CXXFLAGS) -I../$(TARGET) test.cpp ../$(TARGET)/*.cpp -o $(BIN)
	$(BIN)
