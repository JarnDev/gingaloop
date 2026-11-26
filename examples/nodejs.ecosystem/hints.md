## Hint 1
"Each instance has its own store" tells you *where* the store variable must be. The tests make two
apps. What happens to a variable at module level?

## Hint 2
Make the `Map` and the id counter inside `buildApp()`. Check the bodies with a zod schema
(`z.object({ title: z.string().trim().min(1).max(100) })`). Set the status codes with
`reply.code()`.

## Hint 3
`app.post("/todos", (req, reply) => { const r = Schema.safeParse(req.body); if (!r.success) return reply.code(400).send({ error: "invalid body" }); … return reply.code(201).send(todo); })`,
and find a todo with `store.get(Number(req.params.id))`.
