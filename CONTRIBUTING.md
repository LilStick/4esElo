# Contribuer à 4esElo

## Avant de commencer (obligatoire)

```bash
pnpm doctor   # doit être tout vert (voir CLAUDE.md)
```

## Numérotation logique (epics & tickets)

GitHub impose ses propres numéros (`#1`, `#2`…) et mélange tout. On lit donc les **IDs logiques dans les titres** :

- **Epic** = un bloc : `EPIC B2 · Fondation data` (regroupé par milestone).
- **Ticket** = `B2.1`, `B2.2`… (rattaché à l'epic du bloc). Ex. `B2.1 · Table faceit_match_stats`.
- Chaque ticket rappelle son epic et sa branche en tête ; chaque epic liste ses tickets (checklist).

Labels de propriété : **`lilstick`** (back / API / data) · **`arthur`** (front / UI / design).

## Workflow branches

1. Prends un ticket. Filtre par propriétaire : `gh issue list --label lilstick` ou `--label arthur`.
2. Crée une branche depuis `main`, **nommée d'après l'ID logique** :
   ```bash
   git switch -c feat/B2.1-match-stats-table
   ```
   Préfixes : `feat/` (feature), `fix/` (bug), `chore/` (outillage), `design/` (UI).

## Piloter via Claude Code

Le suivi vit sur GitHub, donc chaque Claude Code (le tien, celui d'Arthur) le lit via `gh` :

```bash
gh issue list --label lilstick --state open    # voir mes tickets
gh issue view 1                                 # lire le ticket B2.1 (n° GitHub #1) + sa DoD
```

Tu peux simplement dire à Claude Code : « prends le ticket **B2.1** » → il le retrouve (`gh issue list | grep B2.1`), lit la Definition of Done, crée la branche `feat/B2.1-...`, code, puis ouvre la PR avec `Closes #1`.
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
