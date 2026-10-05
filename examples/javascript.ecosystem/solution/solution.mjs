import { z } from "zod";

const Signup = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8).regex(/\d/),
    age: z.number().int().min(13).optional(),
    newsletter: z.boolean().default(false),
  })
  .strict();

/**
 * @param {unknown} input
 * @returns {{ ok: true, data: object } | { ok: false, fields: string[] }}
 */
export function validateSignup(input) {
  const result = Signup.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fields = result.error.issues.flatMap((issue) =>
    issue.path.length ? [String(issue.path[0])] : (issue.keys ?? ["(input)"]),
  );
  return { ok: false, fields: [...new Set(fields)].sort() };
}
