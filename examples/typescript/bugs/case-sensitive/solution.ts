export type WordCount = readonly [word: string, count: number];

const WORD = /[A-Za-z']+/g;

export function topWords(text: string, limit: number): WordCount[] {
  const counts = new Map<string, number>();
  for (const [word] of text.matchAll(WORD)) {
    // BUG: no lowercasing, so "The" and "the" are counted separately
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts]
    .sort(([wordA, countA], [wordB, countB]) => countB - countA || (wordA < wordB ? -1 : wordA > wordB ? 1 : 0))
    .slice(0, limit);
}
