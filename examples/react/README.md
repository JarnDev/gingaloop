# A filterable list with an empty state

## Problem

Implement `FilterableList` in `starter/FilterableList.jsx`: `<FilterableList items={["Apple", ...]} />`.

- A text input labelled **Search** filters the items **as you type**: an item is shown when it
  contains the query, case-insensitively, after trimming the query.
- Items are shown in a list (`<ul>` with one `<li>` per item), in their original order.
- A status line shows `Showing X of Y`.
- When nothing matches, the list is replaced by the text `No matches`.
- With an empty query, all items are shown.

## Examples

| items | typed | visible | status |
|---|---|---|---|
| Apple, Banana, Cherry | (nothing) | Apple, Banana, Cherry | Showing 3 of 3 |
| Apple, Banana, Cherry | `an` | Banana | Showing 1 of 3 |
| Apple, Banana, Cherry | `  APP ` | Apple | Showing 1 of 3 |
| Apple, Banana, Cherry | `kiwi` | *No matches* | Showing 0 of 3 |

## Constraints

- React 18 function components and hooks; tests use Testing Library (they find the input by its
  label and the items by role).
- Derive the visible items from the props and the query; don't copy props into state.

## How to run

- `ginga test` runs the tests (vitest + jsdom) against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
