## Hint 1
Two things can go wrong per line: the text isn't JSON at all, or the JSON isn't a valid event. Only
one of them makes `JSON.parse` throw.

## Hint 2
Model each variant as a `z.object`, then combine them with `z.discriminatedUnion("type", [...])`.
`safeParse` tells you valid vs invalid without throwing.

## Hint 3
`export type Event = z.infer<typeof EventSchema>`. Loop with the index: try/catch around
`JSON.parse`, then `EventSchema.safeParse(value)`; push `result.data` or the index.
