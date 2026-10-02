/**
 * Split `items` into arrays of at most `size` elements, in order.
 * @template T
 * @param {T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(items, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`size must be a positive integer, got ${size}`);
  }
  const out = [];
  while (items.length > 0) {
    out.push(items.splice(0, size)); // BUG: splice empties the caller's array
  }
  return out;
}
