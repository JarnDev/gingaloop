import Fastify from "fastify";
import { z } from "zod";

const CreateBody = z.object({ title: z.string().trim().min(1).max(100) });
const PatchBody = z.object({ done: z.boolean() });

/** A new fastify app with the todo routes (not listening). */
export function buildApp() {
  const app = Fastify();
  const store = new Map();
  let nextId = 1;

  const find = (req) => store.get(Number(req.params.id));
  const notFound = (reply) => reply.code(404).send({ error: "not found" });
  const invalid = (reply) => reply.code(400).send({ error: "invalid body" });

  app.post("/todos", (req, reply) => {
    // BUG (plausible alternative): a truthiness check instead of the schema accepts "   " and 42.
    if (!req.body?.title || String(req.body.title).length > 100) return invalid(reply);
    const todo = { id: nextId++, title: String(req.body.title).trim(), done: false };
    store.set(todo.id, todo);
    return reply.code(201).send(todo);
  });

  app.get("/todos/:id", (req, reply) => {
    const todo = find(req);
    return todo ? reply.send(todo) : notFound(reply);
  });

  app.patch("/todos/:id", (req, reply) => {
    const todo = find(req);
    if (!todo) return notFound(reply);
    const body = PatchBody.safeParse(req.body);
    if (!body.success) return invalid(reply);
    todo.done = body.data.done;
    return reply.send(todo);
  });

  return app;
}
