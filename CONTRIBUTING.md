# Contribuer à 4esElo

## Avant de commencer (obligatoire)

```bash
pnpm doctor   # doit être tout vert (voir CLAUDE.md)
```

## Workflow branches

1. Prends un ticket (issue GitHub). Chaque ticket est rattaché à un **epic** (milestone).
2. Crée une branche depuis `main` :
   ```bash
   git switch -c feat/<n°issue>-slug        # ex: feat/23-schema-match-stats
   ```
   Préfixes : `feat/` (feature), `fix/` (bug), `chore/` (outillage), `design/` (UI).
3. Code par petits incréments. Garde vert :
   ```bash
   pnpm typecheck && pnpm test && pnpm lint
   ```
4. Commits clairs, en anglais, style Conventional Commits :
   `feat(web): add per-map stats table`. Référence le ticket : `... (#23)`.
5. Ouvre une **Pull Request** vers `main`, liée au ticket (`Closes #23`).
6. Merge une fois la PR verte (typecheck + test + lint).

## Conventions de code

- **TypeScript partout**, ESM. Types partagés API↔front dans `packages/types`.
- **I/O aux extrémités, logique pure au milieu** (cf. `apps/worker/src/sync.ts`).
- **Tests au fil de l'eau** : unit (mocks) systématiques, intégration pour les endpoints.
- **Format/lint** : `pnpm format` + `pnpm lint:fix` avant de push.
- **Cross-platform** (Windows/macOS) : pas de script bash-only dans les `package.json`.
- Ne jamais commit `.env`.

Détails d'architecture et commandes : voir [CLAUDE.md](./CLAUDE.md).
