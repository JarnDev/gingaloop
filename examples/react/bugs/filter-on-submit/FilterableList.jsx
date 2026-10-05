import { useId, useRef, useState } from "react";

// BUG (plausible alternative): an uncontrolled input read through a ref, filtering only when the
// form is submitted (Enter), so nothing changes while typing.
export function FilterableList({ items }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const inputId = useId();
  const q = query.trim().toLowerCase();
  const visible = items.filter((item) => item.toLowerCase().includes(q));

  return (
    <form onSubmit={(e) => { e.preventDefault(); setQuery(inputRef.current.value); }}>
      <label htmlFor={inputId}>Search</label>
      <input id={inputId} ref={inputRef} defaultValue="" />
      <p role="status">
        Showing {visible.length} of {items.length}
      </p>
      {visible.length ? (
        <ul>
          {visible.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>No matches</p>
      )}
    </form>
  );
}
