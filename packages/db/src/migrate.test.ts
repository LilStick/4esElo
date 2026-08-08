import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { shouldMigrateOnBoot, runMigrations } from "./migrate";

const DRIZZLE_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));

// Charge le .env racine (DATABASE_URL) pour le test d'intégration.
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

// DB d'abord (top-level await) → tous les test() déclarés APRÈS, sinon
// --test-force-exit coupe avant les tests déclarés post-await.
const BASE = process.env.DATABASE_URL;
async function pgReachable(url: string): Promise<boolean> {
  try {
    const s = postgres(url, { max: 1 });
    await s`select 1`;
    await s.end();
    return true;
  } catch {
    return false;
  }
}
const DB_UP = BASE ? await pgReachable(BASE) : false;
const skip = DB_UP ? false : "requires Postgres - run `pnpm db:up`";

// --- Unit (pur) ------------------------------------------------------------

test("shouldMigrateOnBoot : true uniquement si DB_MIGRATE_ON_BOOT=true", () => {
  assert.equal(shouldMigrateOnBoot({ DB_MIGRATE_ON_BOOT: "true" }), true);
  assert.equal(shouldMigrateOnBoot({ DB_MIGRATE_ON_BOOT: "false" }), false);
  assert.equal(shouldMigrateOnBoot({ DB_MIGRATE_ON_BOOT: "1" }), false); // strict "true"
  assert.equal(shouldMigrateOnBoot({}), false); // absent → off (dev/CI = db:push)
});

// --- Intégration : migrate sur une DB jetable (skip si Postgres absent) ----

test("runMigrations : applique toutes les migrations sur une DB fraîche + idempotent", { skip }, async () => {
  const u = new URL(BASE!);
  const tmpName = (u.pathname.slice(1) || "postgres") + "_migboot_test";
  u.pathname = "/" + tmpName;
  const tmpUrl = u.toString();

  const admin = postgres(BASE!, { max: 1 });
  try {
    await admin.unsafe(`drop database if exists "${tmpName}" with (force)`);
    await admin.unsafe(`create database "${tmpName}"`);
  } finally {
    await admin.end();
  }

  try {
    await runMigrations(tmpUrl); // applique 0000..0014 sur la DB vide
    const check = postgres(tmpUrl, { max: 1 });
    try {
      // Preuve que les migrations ont tourné jusqu'au bout (0014 = is_admin, l'incident).
      const [row] = await check`
        select exists(
          select 1 from information_schema.columns
          where table_name = 'players' and column_name = 'is_admin'
        ) as ok`;
      assert.equal(row!.ok, true);
      await runMigrations(tmpUrl); // 2e passage = no-op, ne throw pas
    } finally {
      await check.end();
    }
  } finally {
    const admin2 = postgres(BASE!, { max: 1 });
    try {
      await admin2.unsafe(`drop database if exists "${tmpName}" with (force)`);
    } finally {
      await admin2.end();
    }
  }
});

test(
  "runMigrations : prod déjà à melodic (0015) → v2 s'applique sans rejouer faceit_unranked (B18.18)",
  { skip },
  async () => {
    const u = new URL(BASE!);
    const tmpName = (u.pathname.slice(1) || "postgres") + "_migb1818_test";
    u.pathname = "/" + tmpName;
    const tmpUrl = u.toString();

    const admin = postgres(BASE!, { max: 1 });
    try {
      await admin.unsafe(`drop database if exists "${tmpName}" with (force)`);
      await admin.unsafe(`create database "${tmpName}"`);
    } finally {
      await admin.end();
    }

    // Dossier de migrations tronqué = l'état de la prod actuelle : tout jusqu'à
    // 0015_melodic_nightcrawler inclus (qui crée faceit_unranked), sans le Premier.
    const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, "meta/_journal.json"), "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const upToMelodic = journal.entries.filter((e) => e.idx <= 15);
    const prodDir = mkdtempSync(join(tmpdir(), "b1818-prod-"));
    mkdirSync(join(prodDir, "meta"), { recursive: true });
    writeFileSync(join(prodDir, "meta/_journal.json"), JSON.stringify({ ...journal, entries: upToMelodic }));
    for (const e of upToMelodic) {
      copyFileSync(join(DRIZZLE_DIR, `${e.tag}.sql`), join(prodDir, `${e.tag}.sql`));
    }

    try {
      await runMigrations(tmpUrl, prodDir); // simule la prod (0000..0015)
      await runMigrations(tmpUrl); // applique v2 complet : Premier posé, faceit_unranked NON rejouée
      const check = postgres(tmpUrl, { max: 1 });
      try {
        const [t] = await check`
          select exists(
            select 1 from information_schema.tables where table_name = 'premier_match_stats'
          ) as ok`;
        assert.equal(t!.ok, true, "premier_match_stats créée par la migration v2");
        const [c] = await check`
          select count(*)::int as n from information_schema.columns
          where table_name = 'players' and column_name = 'faceit_unranked'`;
        assert.equal(c!.n, 1, "faceit_unranked présente une seule fois (pas de rejeu → pas de 42701)");
        await runMigrations(tmpUrl); // idempotent
      } finally {
        await check.end();
      }
    } finally {
      const admin2 = postgres(BASE!, { max: 1 });
      try {
        await admin2.unsafe(`drop database if exists "${tmpName}" with (force)`);
      } finally {
        await admin2.end();
      }
    }
  },
);
