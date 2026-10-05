# A filterable list: explanation

## Approach

There's exactly **one** piece of state, the query, held by a **controlled** input
(`value={query}` + `onChange`). Everything else is *derived* on every render: the trimmed lowercase
query, the visible items, the counts, and whether to show the list or `No matches`. Nothing derived
is stored in state, so nothing can go out of sync.

`useId()` links the `<label>` to the input, which is good for accessibility and is how the tests find
it (`getByLabelText("Search")`). The status line uses `role="status"`, so screen readers announce
the count.

Trace: items `Apple, Banana, Cherry`, typing `an` goes `a`, then `an`. After each keystroke React
re-renders; `"an"` keeps only `banana`, so the result is `Banana` and `Showing 1 of 3`.

## Complexity

O(n · m) per render (n items, m = item length) for the `includes` checks, which is fine for UI
lists. For thousands of items, wrap the filter in `useMemo` and debounce the input.

## Alternatives

- Storing `visible` in state and updating it in `onChange` duplicates information and goes stale
  when `items` changes.
- An uncontrolled input read via a ref on submit is simpler, but it only filters after Enter (see
  the bugs).
- `useDeferredValue(query)` keeps typing smooth on huge lists while filtering in the background.

## Common bugs

- **Case-sensitive matching** (`bugs/case-sensitive`): `APP` doesn't find `Apple`. Caught by "filters
  case-insensitively".
- **No empty state** (`bugs/no-empty-state`): an empty `<ul>` and no message. Caught by "shows No
  matches when nothing matches".
- **Filtering on submit** (`bugs/filter-on-submit`): an uncontrolled input + `onSubmit` looks
  equivalent, but nothing happens while typing. Caught by "filters as you type".

## Idioms

- Controlled inputs, derived values, and no state for what can be computed.
- `useId` for label/input pairs; query the DOM by role and label in tests.
- `userEvent.type` over `fireEvent.change`: it simulates real keystrokes.

## Level up

1. Highlight the matching part of each item with `<mark>`.
2. Load the items from a `fetchItems()` prop with loading and error states, cancelling stale
   requests.
