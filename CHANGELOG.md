# Changelog

Évolutions notables du projet. **Une entrée par PR liée à un ticket**, avec la **date du merge** (`AAAA-MM-JJ`) et le n° de ticket.
Une PR non liée à un ticket (infra, docs, chore) porte `[NO-CHANGELOG]` dans son titre et n'apparaît pas ici.

Format d'une ligne : `- AAAA-MM-JJ — <description courte> (#<ticket>)`

## 2026-07-06

- Web : delta d'ELO sur 7 j par ligne du classement — ±points colorés entre le rang et l'avatar (« – » si stable/non suivi), via `/leaderboard/movers`. (#107)
- Web : widget « En jeu maintenant » sur la home — membres actifs (en jeu CS2 / match Faceit / en ligne) via `/presence`, auto-refresh 60 s ; widgets home resserrés à 1 vedette + « Voir tout » vers une modale double-bezel scrollable. (#117)
- Web : widget « Mouvements récents » sur la home — plus grosses montées/descentes d'ELO sur 7 jours (▲▼ + delta coloré, cliquable), état vide si semaine calme. (#116)
- Web : widget « Joueur du jour » sur la home — plus gros gain d'ELO sur 24h (avatar, pseudo, +ELO, cliquable) + mention de la plus grosse chute, état vide si personne n'a bougé. (#115)
- CI : le front est buildé sur chaque PR (un import cassé ne passe plus en vert) + Dependabot activé (deps npm groupées hebdo + GitHub Actions). (#65)
- Tests : l'endpoint principal `/leaderboard` couvert en intégration (tri, dernier snapshot, joueurs sans ELO en fin, source vide). (#64)
- DX : les apps refusent de démarrer mal configurées — env vars validées par zod au démarrage (`packages/env`), erreurs explicites variable par variable. (#63)
- Worker : client Faceit résilient — timeout 10 s, retry avec backoff exponentiel + jitter sur 429/5xx/réseau, `Retry-After` respecté, jamais de retry sur 4xx. (#62)
- API : durcissement — zod sur `source` et les `:id` (400 explicites), CORS restreint à l'origine du front, erreurs 500 structurées sans stack trace, `/health` vérifie la DB. (#61)
- Worker : backfill ELO opportuniste (vote ✅ 2/0) — courbes rétro reconstruites (jusqu'à mai 2024 !) et vrai ±ELO par match (`eloDelta` exposé sur `/players/:id/matches`), via transport curl. Les 6 membres backfillés au premier essai. (#141)
- Worker : échantillonnage quotidien du temps de jeu CS2 (Steam) — base de l'award ⏰ du Wrapped ; heures privées détectées et exposées via `playtimePrivate` sur `/players/:id`. (#153)
- DX : frise d'avancement des blocs (`scripts/timeline.mjs`, live depuis GitHub + ROADMAP) affichée en tête de chaque « quoi de neuf ». (#158)
- API : `GET /presence` — qui est en ligne / en jeu CS2 / en match Faceit, via le nouveau provider `packages/steam` (clé officielle ou fallback XML) + confirmation Faceit best-effort, cache 60 s. (#147)
- API : `GET /leaderboard/movers?window=24h|7d` (deltas d'ELO par joueur, null si pas encore tracké) + `?sparkline=N` sur `/leaderboard` — la data des widgets Player of the Day, Mouvements et sparklines, sans call Faceit. (#148)

## 2026-07-03

- Web : icône retirée du header du bloc « Activité » sur le profil. (#144)
- Web : profil refondu façon Faceit — layout 2 colonnes (rail identité + heatmap d'activité 90 jours à gauche, colonne principale centrée et large), carte ELO (logo de niveau + ELO teinté par palier). Heatmap type GitHub avec labels jours/mois et tooltip au survol. (#135)
- Web : bloc « Performances récentes » sur le profil (façon Faceit) — courbe ELO + bandeau V/D, récap V/L, min/actuel/max, Δ ELO, plus longue série. (#136)
- Web : icônes officielles de map dans les matchs récents et les stats par map (repli générique si inconnue). (#137)
- Web : PWA installable (manifest, icônes, theme-color) + vrai logo 4esElo partout (favicon mark blanc, icône app tile, lockup sidebar, carte OG de partage). (#113)
- Web : raccourcis clavier de nav (G maintenu + h/c/a) + la palette Ctrl+K cherche aussi les pages. (#127, #130)
- Web : transitions douces entre les pages (fondu + glissement, reduced-motion respecté). (#126)
- Web : barre-hover qui glisse sur la sidebar (suit le survol, revient sur l'actif). (#124)
- Web : page « L'asso » (à propos 4eSport/Efrei, règles, rejoindre via Discord) + entrée nav. (#112)
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
