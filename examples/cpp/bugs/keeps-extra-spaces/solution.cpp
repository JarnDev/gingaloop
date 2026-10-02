#include "solution.hpp"

#include <vector>

std::string reverse_words(std::string_view s) {
    // BUG: splits on every single space, so runs of spaces become empty "words"
    std::vector<std::string_view> words;
    std::size_t start = 0;
    for (std::size_t i = 0; i <= s.size(); ++i) {
        if (i == s.size() || s[i] == ' ') {
            words.push_back(s.substr(start, i - start));
            start = i + 1;
        }
    }
    std::string out;
    for (auto it = words.rbegin(); it != words.rend(); ++it) {
        if (it != words.rbegin()) out += ' ';
        out += *it;
    }
    return out;
}
