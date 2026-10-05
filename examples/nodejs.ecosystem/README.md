# A small todo API with fastify

## Problem

Implement `buildApp()` in `starter/solution.mjs`. It returns a **new** [fastify](https://fastify.dev)
instance (not listening) with these routes, each instance keeping its own in-memory store, with ids
starting at 1:

| Route | Body | Success | Errors |
|---|---|---|---|
| `POST /todos` | `{ "title": string }` | `201` `{ id, title, done: false }` | `400` `{ "error": "invalid body" }` |
| `GET /todos/:id` | | `200` the todo | `404` `{ "error": "not found" }` |
| `PATCH /todos/:id` | `{ "done": boolean }` | `200` the updated todo | `400` invalid body · `404` unknown id |

A valid title is a string that is non-empty **after trimming**, at most 100 characters (after
trimming); it's stored trimmed. Any id that doesn't match a todo (including `abc`) is a `404`.

## Examples

```js
const app = buildApp();
await app.inject({ method: "POST", url: "/todos", payload: { title: "  buy milk " } });
// 201 { id: 1, title: "buy milk", done: false }
await app.inject({ method: "PATCH", url: "/todos/1", payload: { done: true } });
// 200 { id: 1, title: "buy milk", done: true }
await app.inject({ method: "GET", url: "/todos/9" });
// 404 { error: "not found" }
await app.inject({ method: "POST", url: "/todos", payload: { title: "   " } });
// 400 { error: "invalid body" }
```

## Constraints

- Don't call `listen`: tests use `app.inject()` (the sandbox has no network).
- Libraries available: fastify 5.2, zod 3.23, vitest 2.1 (tests).

## How to run

- `ginga test` runs the tests (vitest) against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
