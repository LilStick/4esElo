import type { Context } from "hono";
import { z } from "zod";
import type { EloSource } from "@4eselo/types";

/** Helpers HTTP partagés par les routeurs (validation params/query). */

export const sourceSchema = z.enum(["faceit", "premier"]).default("faceit");
export const uuidSchema = z.string().uuid();

/** `?source=` validé ; null → une 400 a déjà été renvoyée. */
export function readSource(c: Context): EloSource | null {
  const parsed = sourceSchema.safeParse(c.req.query("source"));
  return parsed.success ? parsed.data : null;
}

/** `:id` validé UUID ; null → 400 à renvoyer. */
export function readPlayerId(c: Context): string | null {
  const parsed = uuidSchema.safeParse(c.req.param("id"));
  return parsed.success ? parsed.data : null;
}

export const badRequest = (c: Context, error: string) => c.json({ error }, 400);
