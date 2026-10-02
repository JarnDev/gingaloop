#include "solution.hpp"

#include <algorithm>
#include <vector>

std::string reverse_words(std::string_view s) {
    std::vector<std::string_view> words;
    std::size_t i = 0;
    while (i < s.size()) {
        while (i < s.size() && s[i] == ' ') ++i;
        std::size_t j = i;
        while (j < s.size() && s[j] != ' ') ++j;
        if (j > i) words.push_back(s.substr(i, j - i));
        i = j;
    }
    std::string out;
    for (auto w : words) {
        if (!out.empty()) out += ' ';
        out += w;
    }
    std::reverse(out.begin(), out.end());  // BUG: reverses characters, not words
    return out;
}
