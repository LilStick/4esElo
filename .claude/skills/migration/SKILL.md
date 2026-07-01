---
name: migration
description: Fait évoluer le schéma PostgreSQL de 4esElo proprement avec Drizzle — modifier schema.ts, générer la migration SQL versionnée, la relire, l'appliquer et la committer. À utiliser pour tout changement de table / colonne / index / enum.
---

# Skill: migration — changer le schéma DB sans rien casser

Le schéma est la **source de vérité** : `packages/db/src/schema.ts`. On ne modifie **jamais** la base à la main.

## 1. Modifier le schéma

- Éditer `packages/db/src/schema.ts` (tables, colonnes, index).
- Exposer les nouveaux types (`$inferSelect` / `$inferInsert`) et les ré-exporter depuis `packages/db/src/index.ts`.
- Formes échangées avec l'API/front → dans `packages/types` (les colonnes JSONB sont typées via `.$type<...>()`).

## 2. Générer la migration (SQL versionné)

```bash
pnpm db:generate --name <desc_courte>     # ex: match_stats
```

- Produit `packages/db/drizzle/NNNN_<desc>.sql` + snapshot. **Relire le SQL** généré (c'est lui qui sera joué).
- **Ne jamais éditer** un fichier de migration déjà généré à la main ; refaire un `generate` si besoin.
- **Committer** la migration (elle est versionnée dans git).

## 3. Appliquer

```bash
pnpm db:push        # dev local (applique directement)
# prod / CI : pnpm db:migrate (joue les migrations une à une)
```

## 4. Vérifier

```bash
pnpm typecheck && pnpm test      # les tests d'intégration tournent sur la vraie DB
```

## Pièges

- Pas de `db:push` sans `db:generate` d'abord (sinon la migration versionnée manque).
- Un `NOT NULL` sur une table déjà remplie casse → prévoir un défaut ou une backfill.
- La CI applique le schéma via `pnpm db:push` sur un Postgres jetable : garder le schéma cohérent.
