export function bucketCounts(values: number[], size: number): [bucket: number, count: number][] {
  if (size <= 0) throw new Error("size must be positive");
  const counts = new Map<number, number>();
  for (const v of values) {
    const bucket = Math.trunc(v / size); // BUG (literal port): truncates toward zero, so -1 lands in bucket 0
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => a[0] - b[0]);
}
