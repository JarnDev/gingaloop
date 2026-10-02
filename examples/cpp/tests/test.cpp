#include <chrono>
#include <iostream>
#include <string>

#include "solution.hpp"

static int failures = 0;

static void check_eq(const char* name, const std::string& got, const std::string& want) {
    if (got == want) {
        std::cout << "[ok]   " << name << '\n';
    } else {
        ++failures;
        std::cout << "[FAIL] " << name << ": expected \"" << want << "\", got \"" << got << "\"\n";
    }
}

static void check(const char* name, bool ok, const char* why) {
    if (ok) {
        std::cout << "[ok]   " << name << '\n';
    } else {
        ++failures;
        std::cout << "[FAIL] " << name << ": " << why << '\n';
    }
}

int main() {
    check_eq("reverses word order", reverse_words("the sky is blue"), "blue is sky the");
    check_eq("trims leading and trailing spaces", reverse_words("  hello world  "), "world hello");
    check_eq("collapses repeated spaces", reverse_words("a good   example"), "example good a");
    check_eq("letters inside words keep their order", reverse_words("abc de"), "de abc");
    check_eq("only spaces gives empty string", reverse_words("   "), "");
    check_eq("empty input gives empty string", reverse_words(""), "");
    check_eq("single word is unchanged", reverse_words("solo"), "solo");

    std::string big;
    for (int k = 0; k < 200000; ++k) big += "word ";
    auto start = std::chrono::steady_clock::now();
    auto out = reverse_words(big);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - start).count();
    check("large input is linear", out.size() == big.size() - 1 && ms < 3000, "1 MB input should take well under a second");

    if (failures) {
        std::cout << '\n' << failures << " check(s) failed\n";
        return 1;
    }
    std::cout << "\nALL TESTS PASSED\n";
    return 0;
}
