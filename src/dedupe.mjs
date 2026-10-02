// Duplicate detection for generated challenges: compares a new slug/title against every
// past challenge in the same language. Catches exact and near-exact repeats (plurals, word
// order, filler words, "-2" suffixes); different wording for the same idea can still slip by.

const STOP = new Set(["a", "an", "the", "of", "in", "on", "for", "to", "with", "and", "or", "from", "by", "your", "into", "its"]);

export function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w))
      .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Slug of a challenge id like "2026-10-02-python-top-k-words-2" → "top-k-words". */
export function slugFromId(id, lang) {
  const prefix = /^\d{4}-\d{2}-\d{2}-/.exec(id)?.[0] ?? "";
  let rest = id.slice(prefix.length);
  if (rest.startsWith(`${lang}-`)) rest = rest.slice(lang.length + 1);
  return rest.replace(/-\d+$/, "");
}

/**
 * @param {{slug:string, title:string}} candidate
 * @param {Array<{id:string, lang:string, title:string}>} history  past "generated" events, same language
 * @returns {object|null} the past challenge it duplicates
 */
export function findDuplicate(candidate, history, threshold = 0.75) {
  const slug = candidate.slug.replace(/-\d+$/, "");
  const cand = tokens(`${candidate.title} ${slug.replace(/-/g, " ")}`);
  for (const h of history) {
    const hSlug = slugFromId(h.id, h.lang);
    if (hSlug === slug) return h;
    const past = tokens(`${h.title} ${hSlug.replace(/-/g, " ")}`);
    if (jaccard(cand, past) >= threshold) return h;
  }
  return null;
}
