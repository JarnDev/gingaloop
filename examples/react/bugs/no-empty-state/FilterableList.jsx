import { useId, useState } from "react";

export function FilterableList({ items }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => item.toLowerCase().includes(q));

  return (
    <div>
      <label htmlFor={inputId}>Search</label>
      <input id={inputId} value={query} onChange={(e) => setQuery(e.target.value)} />
      <p role="status">
        Showing {visible.length} of {items.length}
      </p>
      {/* BUG: an empty list renders as an empty <ul> with no message */}
      <ul>
        {visible.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
