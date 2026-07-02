# Changelog

Évolutions notables du projet. **Une entrée par PR liée à un ticket**, avec la **date du merge** (`AAAA-MM-JJ`) et le n° de ticket.
Une PR non liée à un ticket (infra, docs, chore) porte `[NO-CHANGELOG]` dans son titre et n'apparaît pas ici.

Format d'une ligne : `- AAAA-MM-JJ — <description courte> (#<ticket>)`

## 2026-07-02

- DX : `pnpm doctor` → `pnpm preflight` — la commande native `doctor` de pnpm masquait le script et rendait un faux vert. (#74)
- DB : suppression de la table `faceit_matches`, doublon jamais alimenté de `faceit_match_stats` (migration 0002). (#60)

## 2026-07-01

- Web : audit responsive — podium et header joueur adaptés mobile, cibles tactiles ≥ 40px. (#46)
- Web : meta & partage — favicon 4esElo, `<title>` dynamique par page, balises OG/Twitter + image de partage. (#45)
- Web : page 404 + états vides soignés (aucun joueur, joueur introuvable) via composant `EmptyState`. (#44)
- Web : skeletons de chargement (classement + page joueur), remplacent les "Chargement…". (#43)
- Web : app shell — sidebar desktop + header/drawer mobile (spring), nav, charte retirée du nav. (#42)
- Web : refonte page joueur — header (avatar, niveau, ELO), jauge de palier, courbe d'ELO habillée (recharts), repères pic/plus bas/points. (#37)
- Web : refonte page classement — podium top 3 + liste à barre-hover (spring), avatars dérivés du pseudo, niveaux Faceit, branchée sur l'API. (#36)
- Web : charte visuelle (noir & bleu premium) — tokens Tailwind, composants `ui/` (carte double-bezel, bouton, jauge ELO, badge niveau Faceit, liste à barre-hover) et page démo `/charte`. (#33)
- Faceit : client `getMatchStats(matchId)` — stats avancées par match (ADR, clutch 1v1/1v2, entry, utility, flashs…), normalisées + testées. (#2)
- DB : table `faceit_match_stats` (stats par match/joueur, colonnes clés + JSONB) — base des stats avancées & du social. (#1)
- V1 — Fondations : monorepo pnpm/TS, DB Drizzle/Postgres, API Hono (classement, profil, courbe ELO), worker de sync, front React (classement + page joueur).
