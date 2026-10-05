# A small todo API with fastify: explanation

## Approach

`buildApp()` is a **factory**: the store (`Map`) and the id counter are created inside it, so every
app, and every test, starts clean. Routes stay thin: validate the body with a zod schema, look the
todo up, then set the status with `reply.code()` and send.

- `z.string().trim().min(1).max(100)` encodes "non-empty after trimming, at most 100" and returns the
  trimmed title, so validation and normalization are the same step.
- Ids come from the URL as strings: `Number("abc")` is `NaN`, which matches no key, so it naturally
  becomes a 404.
- Tests call `app.inject()`, which runs the full request lifecycle (routing, parsing, hooks) in
  memory with no socket.

Trace: `POST /todos {"title":"  buy milk "}` goes to safeParse, which gives `{ title: "buy milk" }`;
the handler creates `{ id: 1, title: "buy milk", done: false }` and replies `201`.

## Complexity

O(1) per request (a `Map` lookup). Memory is O(number of todos) per app.

## Alternatives

- fastify's built-in JSON-schema validation (`schema: { body }`) is fast, but its default 400
  payload differs from this contract unless you add a custom error handler.
- A module-level store is simpler, but it leaks state between apps and tests (see the bugs).
- Testing through `listen()` + `fetch` exercises the network stack too, but it's slower and doesn't
  work in an offline sandbox; `inject` is the idiomatic way to test fastify.

## Common bugs

- **Replying 200 on create** (`bugs/create-returns-200`): fastify's default is 200, so `201 Created`
  must be explicit. Caught by "create returns 201 with the new todo".
- **Module-level state** (`bugs/shared-store`): a second app continues the first one's ids. Caught by
  "each app instance has its own store".
- **A truthiness check instead of a schema** (`bugs/truthy-title-check`): `"   "` and `42` are truthy,
  so they pass. Caught by "rejects blank or non-string titles".

## Idioms

- Factory functions for apps (`buildApp()`) make tests independent.
- `reply.code(n).send(body)` and returning it from the handler.
- `app.inject()` for HTTP tests; assert status **and** body together.

## Level up

1. Add `GET /todos?done=true&limit=10&cursor=…` with cursor pagination.
2. Make `POST` idempotent with an `Idempotency-Key` header (the same key returns the same todo).
