## Hint 1
Each line can fail in two ways: the text is not JSON, or the JSON is not a valid event. Only one of
the two makes `JSON.parse` throw.

## Hint 2
Write each form as a `z.object`. Then combine them with `z.discriminatedUnion("type", [...])`.
`safeParse` tells you if a value is valid, and it does not throw.

## Hint 3
`export type Event = z.infer<typeof EventSchema>`. Loop with the index. Put a try/catch around
`JSON.parse`, then call `EventSchema.safeParse(value)`. Push `result.data` or the index.
