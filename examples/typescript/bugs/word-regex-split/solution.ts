export type WordCount = readonly [word: string, count: number];

export function topWords(text: string, limit: number): WordCount[] {
  const counts = new Map<string, number>();
  // BUG (plausible alternative): \W keeps digits and "_" inside words and splits on apostrophes,
  // so "abc123abc" is one word and "don't" becomes "don" + "t".
  for (const word of text.toLowerCase().split(/\W+/)) {
    if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts]
    .sort(([wordA, countA], [wordB, countB]) => countB - countA || (wordA < wordB ? -1 : wordA > wordB ? 1 : 0))
    .slice(0, limit);
}
