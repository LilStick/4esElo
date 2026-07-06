import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { loadEnv } from "./index";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  OPTIONAL_KEY: z.string().optional(),
});

test("valid env → parsed values (unknown vars ignored)", () => {
  const env = loadEnv(schema, {
    DATABASE_URL: "postgres://u:p@localhost:5432/db",
    UNRELATED: "x",
  });
  assert.equal(env.DATABASE_URL, "postgres://u:p@localhost:5432/db");
  assert.equal(env.OPTIONAL_KEY, undefined);
});

test("missing or malformed env → prints the culprit vars and exits 1", () => {
  const errors: string[] = [];
  const origError = console.error;
  const origExit = process.exit;
  console.error = (msg: string) => errors.push(String(msg));
  process.exit = ((code: number) => {
    throw new Error(`exit ${code}`);
  }) as typeof process.exit;
  try {
    assert.throws(() => loadEnv(schema, { DATABASE_URL: "not-a-url" }), /exit 1/);
    assert.ok(errors.some((l) => l.includes("DATABASE_URL")));
  } finally {
    console.error = origError;
    process.exit = origExit;
  }
});
