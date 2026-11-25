## Hint 1
The component needs only one state value. On each render, you can calculate all other values from
it and the props: the visible items, the counts and the empty state.

## Hint 2
Use a controlled input: `const [query, setQuery] = useState("")`, `value={query}`,
`onChange={(e) => setQuery(e.target.value)}`, and a `<label>` for it. Compare lowercase strings.

## Hint 3
`const q = query.trim().toLowerCase(); const visible = items.filter((it) => it.toLowerCase().includes(q));`
then render `visible.length ? <ul>…</ul> : <p>No matches</p>` and `Showing {visible.length} of {items.length}`.
