# Changelog

Évolutions notables du projet. **Une entrée par PR liée à un ticket**, avec la **date du merge** (`AAAA-MM-JJ`) et le n° de ticket.
Une PR non liée à un ticket (infra, docs, chore) porte `[NO-CHANGELOG]` dans son titre et n'apparaît pas ici.

Format d'une ligne : `- AAAA-MM-JJ — <description courte> (#<ticket>)`

## 2026-07-01

- Web : refonte page classement — podium top 3 + liste à barre-hover (spring), avatars dérivés du pseudo, niveaux Faceit, branchée sur l'API. (#36)
- Web : charte visuelle (noir & bleu premium) — tokens Tailwind, composants `ui/` (carte double-bezel, bouton, jauge ELO, badge niveau Faceit, liste à barre-hover) et page démo `/charte`. (#33)
- Faceit : client `getMatchStats(matchId)` — stats avancées par match (ADR, clutch 1v1/1v2, entry, utility, flashs…), normalisées + testées. (#2)
- DB : table `faceit_match_stats` (stats par match/joueur, colonnes clés + JSONB) — base des stats avancées & du social. (#1)
- V1 — Fondations : monorepo pnpm/TS, DB Drizzle/Postgres, API Hono (classement, profil, courbe ELO), worker de sync, front React (classement + page joueur).
