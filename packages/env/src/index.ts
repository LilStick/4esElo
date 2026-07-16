import type { z } from "zod";

/** Validation env fail-fast (B11.3) : parse au démarrage, affiche les variables fautives et exit - jamais à moitié configuré. */
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
