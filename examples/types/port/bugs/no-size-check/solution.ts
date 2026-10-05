export function bucketCounts(values: number[], size: number): [bucket: number, count: number][] {
  // BUG: no validation; size 0 gives Infinity buckets
  const counts = new Map<number, number>();
  for (const v of values) {
    const bucket = Math.floor(v / size); // Python's // floors toward -infinity
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => a[0] - b[0]);
}
