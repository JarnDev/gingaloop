export type WordCount = readonly [word: string, count: number];

const WORD = /[a-z']+/g;

export function topWords(text: string, limit: number): WordCount[] {
  const counts = new Map<string, number>();
  for (const [word] of text.toLowerCase().matchAll(WORD)) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts]
    .sort(([, countA], [, countB]) => countB - countA) // BUG: no tie-break; ties keep insertion order
    .slice(0, limit);
}
