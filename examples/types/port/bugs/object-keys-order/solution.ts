export function bucketCounts(values: number[], size: number): [bucket: number, count: number][] {
  if (size <= 0) throw new Error("size must be positive");
  // BUG (plausible alternative): a plain object as the Counter. Keys become strings, and sorting
  // the entries without a numeric comparator orders them as strings ("-1" < "-10" < "0" < "10" < "2").
  const counts: Record<string, number> = {};
  for (const v of values) {
    const bucket = Math.floor(v / size);
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort()
    .map(([k, n]) => [Number(k), n]);
}
