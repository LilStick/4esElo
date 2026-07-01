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
2. Pars d'un `main` **à jour**, et nomme la branche d'après l'ID logique :
   ```bash
   git fetch origin
   git switch main && git pull --ff-only
   git switch -c feat/B2.1-match-stats-table
   ```
   Préfixes : `feat/` (feature), `fix/` (bug), `chore/` (outillage), `design/` (UI).
3. Code par petits incréments. Garde vert : `pnpm typecheck && pnpm test && pnpm lint`.
4. Commits clairs (Conventional Commits), en anglais : `feat(web): add per-map stats table`. **1 seul commit par PR.**
5. Ouvre une **PR** vers `main`, liée au ticket (`Closes #<n>`).
6. Merge une fois la **CI verte**.

## Piloter via Claude Code

Le suivi vit sur GitHub : chaque Claude Code (le tien, celui d'Arthur) le lit via `gh`.

```bash
gh issue list --label lilstick --state open    # voir mes tickets
gh issue view 1                                 # lire un ticket + sa DoD
```

Tu peux juste dire à Claude Code : « prends le ticket **B2.1** » → il le retrouve, lit la Definition of Done, crée la branche `feat/B2.1-…`, code, puis ouvre la PR avec `Closes #1`.

## Proposer une feature / créer un ticket

Tout le monde est libre de proposer. Deux niveaux :

- **Idée pas encore mûre** → l'ajouter dans [ROADMAP.md](./ROADMAP.md) (vivier / to-do later).
- **Prête à coder** → créer un **ticket** au format imposé (titres **humain-friendly**, courts) : voir [CLAUDE.md](./CLAUDE.md#créer-des-epics--tickets-format-imposé). En bref : titre `B<n>.<x> · <titre court>`, corps avec `Epic` + `Branche` + **Definition of Done**, labels `type:*` + `area:*` + propriétaire (`arthur`/`lilstick`).

## CI

Chaque PR vers `main` déclenche GitHub Actions (typecheck + lint + tests, avec un Postgres). **La PR doit être verte avant merge.** `main` est protégé : pas de push direct.

## Changelog

- PR **liée à un ticket** → ajoute une ligne dans [CHANGELOG.md](./CHANGELOG.md) : `- AAAA-MM-JJ — <desc> (#<ticket>)` (date du merge).
- PR **non liée** (infra, docs, chore) → mets **`[NO-CHANGELOG]`** dans le titre de la PR/commit.
- La CI bloque si ni l'un ni l'autre.

## Conventions de code

- **TypeScript partout**, ESM. Types partagés API↔front dans `packages/types`.
- **I/O aux extrémités, logique pure au milieu** (cf. `apps/worker/src/sync.ts`).
- **Tests au fil de l'eau** : unit (mocks) systématiques, intégration pour les endpoints.
- **Format/lint** : `pnpm format` + `pnpm lint:fix` avant de push.
- **Cross-platform** (Windows/macOS) : pas de script bash-only dans les `package.json`.
- Ne jamais commit `.env`.

Détails d'architecture et commandes : voir [CLAUDE.md](./CLAUDE.md).
