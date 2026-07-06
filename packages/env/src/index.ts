import type { z } from "zod";

/**
 * Fail-fast env validation (B11.3): parse the environment against a zod
 * schema at startup; on failure, print WHICH variables are wrong and exit —
 * an app must never run half-configured.
 */
export function loadEnv<S extends z.ZodTypeAny>(
  schema: S,
  source: Record<string, string | undefined> = process.env,
): z.infer<S> {
  const parsed = schema.safeParse(source);
  if (parsed.success) return parsed.data;

  console.error("✗ Configuration invalide (.env) :");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "?"}: ${issue.message}`);
  }
  console.error("  → voir .env.example");
  process.exit(1);
}
