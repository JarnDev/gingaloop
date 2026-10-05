## Hint 1
There's only one piece of state here. Everything else (the visible items, the counts, the empty
state) can be computed from it and the props on every render.

## Hint 2
A controlled input: `const [query, setQuery] = useState("")`, `value={query}`,
`onChange={(e) => setQuery(e.target.value)}`, and a `<label>` tied to it. Compare lowercased strings.

## Hint 3
`const q = query.trim().toLowerCase(); const visible = items.filter((it) => it.toLowerCase().includes(q));`
then render `visible.length ? <ul>…</ul> : <p>No matches</p>` and `Showing {visible.length} of {items.length}`.
