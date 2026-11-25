# A filterable list with an empty state

## Problem

Write `FilterableList` in `starter/FilterableList.jsx`: `<FilterableList items={["Apple", ...]} />`.

- A text input with the label **Search** filters the items **while you type**.
- The component removes the spaces at the start and end of the query. Then it shows each item that
  contains the query. Upper and lower case are equal.
- The component shows the items in a list (`<ul>` with one `<li>` for each item), in their input
  order.
- A status line shows `Showing X of Y`.
- If no item matches, the component shows the text `No matches` instead of the list.
- If the query is empty, the component shows all items.

## Examples

| items | typed | visible | status |
|---|---|---|---|
| Apple, Banana, Cherry | (nothing) | Apple, Banana, Cherry | Showing 3 of 3 |
| Apple, Banana, Cherry | `an` | Banana | Showing 1 of 3 |
| Apple, Banana, Cherry | `  APP ` | Apple | Showing 1 of 3 |
| Apple, Banana, Cherry | `kiwi` | *No matches* | Showing 0 of 3 |

## Constraints

- Use React 18 function components and hooks.
- The tests use Testing Library. They find the input by its label and the items by role.
- Calculate the visible items from the props and the query. Do not copy props into state.

## How to run

- `ginga test` runs the tests (vitest + jsdom) against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
