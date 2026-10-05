import Fastify from "fastify";
import { z } from "zod";

/** A new fastify app with the todo routes (not listening). */
export function buildApp() {
  const app = Fastify();
  // TODO: routes
  return app;
}
