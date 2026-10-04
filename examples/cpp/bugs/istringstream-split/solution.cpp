#include "solution.hpp"

#include <sstream>
#include <vector>

std::string reverse_words(std::string_view s) {
    // BUG (plausible alternative): operator>> splits on ALL whitespace, but the spec only
    // separates on ' ', so a tab or newline inside a word wrongly splits it.
    std::istringstream in{std::string(s)};
    std::vector<std::string> words;
    for (std::string w; in >> w;) words.push_back(w);
    std::string out;
    for (auto it = words.rbegin(); it != words.rend(); ++it) {
        if (!out.empty()) out += ' ';
        out += *it;
    }
    return out;
}
