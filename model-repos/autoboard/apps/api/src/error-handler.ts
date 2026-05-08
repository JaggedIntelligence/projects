import type { Context } from "hono";
import { ValidationError, NotFoundError, ConflictError } from "@autoboard/shared";

export function handleDomainError(error: unknown, c: Context): Response {
  if (error instanceof ValidationError) {
    return c.json({ error: error.message }, 400);
  }
  if (error instanceof NotFoundError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof ConflictError) {
    return c.json({ error: error.message }, 400);
  }
  console.error("Unhandled error:", error);
  return c.json(
    { error: error instanceof Error ? error.message : "Internal server error" },
    500
  );
}
