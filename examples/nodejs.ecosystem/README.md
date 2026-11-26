# A small todo API with fastify

## Problem

Write `buildApp()` in `starter/solution.mjs`. It returns a **new** [fastify](https://fastify.dev)
instance that does not listen. The instance has the routes below.

- Each instance has its own store in memory.
- In each instance, the ids start at 1.

| Route | Body | Success | Errors |
|---|---|---|---|
| `POST /todos` | `{ "title": string }` | `201` `{ id, title, done: false }` | `400` `{ "error": "invalid body" }` |
| `GET /todos/:id` | | `200` the todo | `404` `{ "error": "not found" }` |
| `PATCH /todos/:id` | `{ "done": boolean }` | `200` the updated todo | `400` invalid body · `404` unknown id |

- The API removes the spaces at the start and end of a title (it **trims** it). It checks and
  stores the trimmed title.
- A valid title is a string. After trimming, it has 1 to 100 characters.
- Each id that does not match a todo gives a `404`. This includes ids that are not numbers, such
  as `abc`.

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

- Do not call `listen`. The tests use `app.inject()`, because the sandbox has no network.
- The available libraries are fastify 5.2, zod 3.23 and vitest 2.1 (for the tests).

## How to run

- `ginga test` runs the tests (vitest) against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
