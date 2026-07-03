# Changelog

Évolutions notables du projet. **Une entrée par PR liée à un ticket**, avec la **date du merge** (`AAAA-MM-JJ`) et le n° de ticket.
Une PR non liée à un ticket (infra, docs, chore) porte `[NO-CHANGELOG]` dans son titre et n'apparaît pas ici.

Format d'une ligne : `- AAAA-MM-JJ — <description courte> (#<ticket>)`

## 2026-07-03

- Web : variante `Card accent` (soulignement dégradé façon DPM) + démo sur la charte. (#111)
- Web : recherche/filtre membre dans le classement — filtre client live, podium masqué en recherche, état vide dédié. (#106)
- Web : tri du classement (ELO / niveau) — bascule client, podium conservé sur le tri ELO. (#105)
- Web : recherche globale (Ctrl/Cmd+K) — palette de commande pour sauter à un joueur, nav clavier + barre-hover qui glisse. (#110)
- Web : home transformée en tableau de bord (widgets à venir + aperçu top classement) ; classement déplacé sur `/classement`, nav mise à jour. (#114)
- Web : radar de performance sur le profil — 6 axes (aim, impact, clutch, entry, utility, win) normalisés + breakdown chiffré, suit le filtre de période. (#56)
- Web : stats par map sur le profil — tableau winrate/K/D/ADR par carte, aligné et cohérent avec les matchs récents (barre-hover partagée). (#55)
- Web : matchs récents sur le profil — carte par match (map, résultat V/D coloré, K/D, ADR), barre-hover qui glisse, lien room Faceit. (#54)
- Web : filtres temporels (7j/30j/3m/tout) sur les stats du profil — segmented control qui repilote le bento. (#53)
- Web : stats agrégées du profil en bento (win rate, K/D, ADR, HS%, clutch, entry, utility) depuis `/players/:id/stats`, avec skeleton et état vide. (#52)
- Worker : `elo_after` par match en forward — quand un tick voit l'ELO changer et exactement un nouveau match, il lui attribue l'ELO courant (l'historique rétroactif n'est plus récupérable, cf. Décisions). (#93)
- API : `GET /players/:id/stats?range=7d|30d|3m|all` — agrégats (winrate, K/D, ADR, HS%, clutch, entry, utility) + détail par map. (#7)
- API : `GET /players/:id/matches` — liste paginée des matchs stockés (map, résultat, stats), zod sur la pagination. (#6)
- DX : brief de session — à l'ouverture, chacun voit ses tickets débloqués par l'autre (🔓/⛔, calculé depuis les lignes « dépend de #x »). (#89)
- Worker : ingestion des matchs Faceit — backfill borné (90 j / 100 matchs) puis incrémental à chaque tick, dédup par `(match_id, player_id)`, throttle sous le rate-limit. Premier backfill réel : 202 matchs. (#3)

## 2026-07-02

- Process : format de ticket durci dans le skill refine (Contexte lisible / Quoi / DoD + exemple canonique) — même sortie quel que soit l'agent. (#80)
- Garde-fous machine : hook SessionStart (preflight auto), hook PreToolUse qui bloque les commandes dépendant de Postgres quand il est down, ESLint anti-`fetch` dans les apps et anti-`process.env` hors `env.ts`. (#79)
- Docs : règles d'architecture (pattern provider, zod aux frontières, catch commenté, DB par défaut) et règles de tests gravées dans CLAUDE.md. (#78)
- CI : le format Prettier est vérifié (`format:check`) ; `pnpm format` avant chaque commit (skill open-pr à jour, 5 fichiers web reformatés). (#76)
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
