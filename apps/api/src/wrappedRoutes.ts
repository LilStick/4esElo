import { Hono } from "hono";
import { z } from "zod";
import type {
  WrappedResponse,
  PlayerWrappedResponse,
  BigWrappedResponse,
  PlayerBigWrappedResponse,
} from "@4eselo/types";
import {
  computeAwards,
  computePlayerWrapped,
  computePlayerBigWrapped,
  periodRange,
  periodLabel,
} from "./wrapped";
import { loadWrappedInputs, loadWrappedInputsForRange } from "./wrappedData";
import { uuidSchema, badRequest } from "./http";

export const wrappedRoutes = new Hono();

const wrappedParamsSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// BIG Wrapped (B7.12) — période longue : "2026" (année) ou "2026-H1"/"2026-H2".
// Segment statique "big" → Hono le route ici, pas vers /wrapped/:year/:month.
wrappedRoutes.get("/wrapped/big/:period", async (c) => {
  const period = c.req.param("period");
  const range = periodRange(period);
  if (!range) return badRequest(c, "invalid period (YYYY | YYYY-H1 | YYYY-H2)");

  const inputs = await loadWrappedInputsForRange(range.start, range.end);
  return c.json<BigWrappedResponse>({ period, awards: computeAwards(inputs, periodLabel(period)) });
});

wrappedRoutes.get("/wrapped/big/:period/:playerId", async (c) => {
  const period = c.req.param("period");
  const range = periodRange(period);
  if (!range) return badRequest(c, "invalid period (YYYY | YYYY-H1 | YYYY-H2)");
  const id = uuidSchema.safeParse(c.req.param("playerId"));
  if (!id.success) return badRequest(c, "invalid player id (uuid)");

  const inputs = await loadWrappedInputsForRange(range.start, range.end);
  const wrapped = computePlayerBigWrapped(id.data, period, inputs);
  if (!wrapped) return c.json({ error: "player not found" }, 404);
  return c.json<PlayerBigWrappedResponse>(wrapped);
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
