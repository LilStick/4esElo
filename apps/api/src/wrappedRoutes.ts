import { Hono } from "hono";
import { z } from "zod";
import type { WrappedResponse, PlayerWrappedResponse } from "@4eselo/types";
import { computeAwards, computePlayerWrapped } from "./wrapped";
import { loadWrappedInputs } from "./wrappedData";
import { uuidSchema, badRequest } from "./http";

export const wrappedRoutes = new Hono();

const wrappedParamsSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

wrappedRoutes.get("/wrapped/:year/:month", async (c) => {
  const parsed = wrappedParamsSchema.safeParse({
    year: c.req.param("year"),
    month: c.req.param("month"),
  });
  if (!parsed.success) return badRequest(c, "invalid year/month");
  const { year, month } = parsed.data;

  const inputs = await loadWrappedInputs(year, month);
  return c.json<WrappedResponse>({ year, month, awards: computeAwards(inputs) });
});

wrappedRoutes.get("/wrapped/:year/:month/:playerId", async (c) => {
  const parsed = wrappedParamsSchema.safeParse({
    year: c.req.param("year"),
    month: c.req.param("month"),
  });
  if (!parsed.success) return badRequest(c, "invalid year/month");
  const id = uuidSchema.safeParse(c.req.param("playerId"));
  if (!id.success) return badRequest(c, "invalid player id (uuid)");
  const { year, month } = parsed.data;

  const inputs = await loadWrappedInputs(year, month);
  const wrapped = computePlayerWrapped(id.data, year, month, inputs);
  if (!wrapped) return c.json({ error: "player not found" }, 404);
  return c.json<PlayerWrappedResponse>(wrapped);
});
