# Predict the output: explanation

## Approach

Trace each block and track **values vs references**:

1. `const b = a` doesn't copy: `a` and `b` name the same array, so `b.push(4)` makes it `[1,2,3,4]`.
   `[...a]` *does* copy, so `c` is a new array `[1,2,3,4]` and `c.push(5)` only changes `c`.
   Output: `4 4 5`.
2. `"5" + 3`: when either operand is a string, `+` concatenates, giving `"53"`. `"5" - 3`: `-` only
   works on numbers, so `"5"` becomes `5`, giving `2`. Output: `53 2 string number`.
3. `var i` is a single binding for the whole loop (function-scoped). The arrows capture *the
   variable*, not its value at push time, and after the loop it's `3`. Output: `3,3,3`.

## Complexity

Not applicable: this is a reading exercise. Trace cost is linear in the program's steps.

## Alternatives

- With `let` instead of `var`, each iteration gets a fresh binding: `0,1,2`.
- `structuredClone(a)` or `a.slice()` copy like the spread does (deep vs shallow is the next
  question).
- Template literals (`${"5"}${3}`) make concatenation explicit and avoid the ambiguity of `+`.

## Common bugs

- **"Assignment copies"** (`bugs/copy-on-assign`): answering `3 4 5`. Caught by `line 1 matches`.
- **"`+` adds numbers"** (`bugs/numeric-plus`): answering `8 2 number number`. Caught by
  `line 2 matches`.
- **Reading `var` as `let`** (`bugs/let-semantics`): answering `0,1,2`. Caught by `line 3 matches`.

## Idioms

- `const` makes the *binding* constant, not the array: `b.push` is allowed.
- Prefer `let` in loops that create closures; prefer explicit `Number(x)` / `String(x)` over relying
  on coercion.

## Level up

1. Predict the output when the loop uses `let`, and when `fns.push(() => i)` becomes
   `fns.push(((j) => () => j)(i))`.
2. Add `setTimeout(() => console.log("later"))` and a `Promise.resolve().then(...)`: in which order
   do they print?
