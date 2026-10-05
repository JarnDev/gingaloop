## Hint 1
"Each instance keeps its own store" is a statement about *where* the store variable lives. What
happens to module-level state when the tests create two apps?

## Hint 2
Create the `Map` and the id counter inside `buildApp()`. Validate bodies with a zod schema
(`z.object({ title: z.string().trim().min(1).max(100) })`) and set status codes with `reply.code()`.

## Hint 3
`app.post("/todos", (req, reply) => { const r = Schema.safeParse(req.body); if (!r.success) return reply.code(400).send({ error: "invalid body" }); … return reply.code(201).send(todo); })`,
and look ids up with `store.get(Number(req.params.id))`.
