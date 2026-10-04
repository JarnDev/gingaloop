/**
 * Split `items` into arrays of at most `size` elements, in order.
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(items, size) {
  // BUG (plausible alternative): "size > 0" accepts 1.5, and Math.ceil hides it,
  // so chunk([1, 2, 3], 1.5) returns chunks instead of throwing.
  if (!(size > 0)) throw new RangeError(`size must be a positive integer, got ${size}`);
  return Array.from({ length: Math.ceil(items.length / size) }, (_, k) =>
    items.slice(Math.round(k * size), Math.round((k + 1) * size)),
  );
}
