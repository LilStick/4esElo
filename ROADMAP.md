# Roadmap & idées — 4esElo

> Document **vivant**, éditable par tout le monde (LilStick, Arthur). Ici on note **la vision, ce qui est prévu, et les idées "to-do later"**.
> Quand une idée est mûre → on la transforme en **ticket GitHub** (format dans [CONTRIBUTING.md](./CONTRIBUTING.md)) et on la coche/lie ici.
>
> Les **tickets actionnables** vivent dans les issues GitHub (epics = blocs). Ce fichier, c'est le **plan large + le vivier d'idées**.

## Vision

Un site où les membres du pôle CS2 se comparent, suivent leur progression et ont envie de revenir tous les jours : classement ELO, profils riches, stats sociales (duos, head-to-head), et du fun (heatmap, recaps, badges).

## Blocs prévus (voir epics GitHub)

| Bloc | Sujet                                                                      | Statut           |
| ---- | -------------------------------------------------------------------------- | ---------------- |
| V1   | Fondations (DB, API, worker, web, courbe ELO)                              | ✅ fait          |
| B1   | Design & assets (charte, design system, refonte pages)                     | ✅ fait (Arthur) |
| B2   | **Fondation data** : ingestion matchs + backfill courbe ELO                | 🔜 en cours      |
| B3   | Profil enrichi (ADR, clutch, entry, utility, par map, filtres temps)       | à faire          |
| B4   | Social (duos, avec qui je win, head-to-head, 5-stack)                      | à faire          |
| B5   | Engagement (heatmap, Player of the Day, streaks, recaps, badges)           | à faire          |
| B6   | Bot Discord (/register, auto-post, commandes)                              | à faire          |
| B7   | Splashy (Wrapped annuel, achievements, compare radar, AI roast)            | à faire          |
| B8   | Highlights (allstar.gg / Medal)                                            | à faire          |
| B10  | Shell & polish UI (layout header+sidebar, skeletons, 404, meta)            | ✅ fait (Arthur) |
| B11  | Durcissement (validation API, retry Faceit, CI build web, tests)           | à faire          |
| B12  | Mise en ligne (hébergeur, worker prod, backups, monitoring)                | à faire          |
| B13  | Classement v2 (tri/filtres, mouvement de rang, sparklines, par map)        | à faire (Arthur) |
| B14  | Navigation & confort (recherche Ctrl+K, carte accent-bar, « L'asso », PWA) | à faire (Arthur) |
| B15  | Home / Dashboard asso (feed vivant : POTD, mouvements, présence live)      | à faire (Arthur) |

> **Profil "complet" (stats avancées) = épic B3**, data-gated : il dépend des données B2 (matches + stats). Le front B10 (shell + polish) avance sans attendre ; l'enrichissement du profil se fera sur B3 dès que B2.6/B2.7 sont mergés.

## Ce qui fait une app « complète » (principes — Layout / UI / UX)

> Au-delà des features : ce qui fait qu'une app paraît **finie et premium**. Nord de conception, pas des tickets.

- **Layout** — aucune impasse : Dashboard, Classement, Profil, Détail match, Compare, Recherche, « L'asso ». Chaque vue = une URL partageable. La home est un **dashboard vivant**, pas le classement brut.
- **UI** — chaque chiffre a un **contexte** (vs moyenne asso / semaine dernière / percentile) · charts traités comme first-class · tous les états couverts (loading, vide, erreur, **zéro-data / première visite**) · identité noir & bleu tenue partout.
- **UX** — tout cliquable et recoupé (joueur ↔ match ↔ map ↔ coéquipier, zéro cul-de-sac) · filtres qui persistent (URL) · perceived-perf (skeletons) · tout **partageable** (image OG → Discord) · command palette (Ctrl+K).
- **Notre moat (innovation)** — on est un **groupe fermé**, pas un site solo mondial : **boucles sociales** (« X t'a dépassé », « ton duo est chaud ce soir »), **benchmark = l'asso**, **présence live** (qui est en game maintenant), **recap de soirée**, Discord-natif. C'est notre différence défendable.

## Vivier d'idées (parking) — piocher / compléter librement

_Issu de la recherche (Leetify, csstats.gg, scope.gg, Faceit, Calibrum). Tout est faisable via l'API Faceit sauf mention contraire._

**Stats profil** : ADR · K/D · HS% · KAST (approx) · clutch % (1v1/1v2) · entry frags & first kills · utility damage / flashs · sniper kills · multi-kills · consistency (variance du rating) · avg ELO swing · career highs (meilleur match, plus gros ELO).

**Social (le + différenciant)** : meilleurs duos (winrate ensemble) · "avec qui je win le +" · head-to-head entre membres · stats de 5-stack · nemesis/victime · graphe "qui joue avec qui" · table `matches` match-level (clé `matchId` seule : score, équipes, lobby commun) — base propre pour détecter les 5-stacks/duos, cf. note de B2.8 (#60).

**Engagement** : heatmap d'activité (matchs/jour, style GitHub) · Player of the Day (+ gros gain / grosse perte 24h) · streaks + mouvements de classement · recap hebdo · **Wrapped annuel** (percentiles vs asso, façon Calibrum) · badges emoji (🔥 streak, 🎯 HS, 💣 entry, 🧠 clutch, 🚿 grind-day) · awards de la semaine · match of the week · carte de stats partageable (OG image) · **présence live** (qui est en match / en queue Faceit maintenant — « 3 membres en game 👀 ») · **recap de soirée** (résumé d'une session jouée en groupe) · **boucles sociales** (relances douces : « X t'a dépassé », « ton duo avec Y est chaud ce soir », « tu affrontes Z demain ») · **benchmark = l'asso** (percentiles intra-asso plutôt que mondiaux : « top 10 % de l'asso en clutch »).

**Comparaisons & filtres** : filtres 7j/30j/3m/saison partout · stats par map (winrate/KD) · leaderboard par map · compare 2 membres (radar) · split T/CT · form last-10 · **mouvement de rang** (▲▼ depuis 7j) · **mini-sparkline d'ELO** par ligne du classement · **recherche / filtre membre** · career highs (pic d'ELO, meilleur match) · **page détail d'un match** (scoreboard, stats par joueur).

**Layout & navigation** : **home / dashboard asso** (feed vivant — POTD, mouvements, ta forme, présence live — plutôt qu'un simple classement) · **recherche globale (Ctrl+K)** façon DPM · page **« L'asso »** (à propos + règles + comment rejoindre le classement) · **carte accent-bar** (soulignement dégradé en bas de carte, façon DPM) · **PWA installable** (manifest + icône).

**Contexte & feel (UX premium)** : **du contexte sur chaque stat** (vs moyenne asso, vs semaine dernière, percentile) · **moment signature** (tick d'ELO qui s'incrémente, transition partagée classement→profil, podium qui pulse) · cross-linking dense (tout cliquable, zéro cul-de-sac) · états **première visite / zéro-data** soignés.

**Discord** : notifs repo → salon (PR ouverte, CI échouée…) via webhook `/github` (gratuit, immédiat) · auto-post après match · /stats & /leaderboard · sync de rôles par niveau · digest quotidien · **proposition validée par emote** (réagir ✅ pour créer un ticket / merger — nécessite un bot custom, voir B6).

**Gamification** : succès déblocables · course au titre de saison + hall of fame · XP/level d'asso · jeu de pronostics · rivalries auto-détectées · bounties/challenges de la semaine.

**Outillage (DX)** : skill **`/gen-readme`** — régénère le `README.md` pour qu'il colle **fidèlement à l'état réel du repo** (structure, commandes, endpoints, avancement) en inspectant le code + les issues. Même famille que `repo-catchup` (docs auto à jour).

## To-do later (gros morceaux / plus tard)

- **Premier Mode (CS Rating)** — 2ᵉ source d'ELO. Pas d'API Valve officielle → via Leetify (non officiel) ou snapshots réguliers. **Le multi-compte par personne sera introduit uniquement ici** (Faceit interdit les smurfs). Nécessitera : SteamID par membre, provider Premier, courbe/leaderboard par source, sélecteur Faceit/Premier sur le front.
- **Stats mécaniques (façon Leetify)** — placement de viseur, temps de réaction, spray, counter-strafe. **Nécessite de parser les démos** (pipeline lourd, séparé). Gros effort, à évaluer si un jour on veut ce niveau.
- **Highlights** — clips CS2 (allstar.gg / Medal). Zone grise ToS → viser l'embed officiel `allstar.gg/iframe` ou la Partner API. Voir bloc B8.
- **Audit de sécurité** — à faire **avant l'ouverture publique** (pendant/juste avant B12) : surfaces API, secrets, deps. Le skill natif `/security-review` de Claude Code fait le gros du travail en une session ; à ticketer au moment de B12.
- _(ajoute tes idées ici…)_

> Déploiement / hébergement : ticketé → **bloc B12** (epic #59).

## Décisions

> Les choix d'archi **tranchés** — pour ne pas les re-débattre (humains comme agents). Process validé par vote le 2026-07-02 : on débat sur Discord `#features-talk`, le verdict s'écrit ici en 2-3 lignes (date + choix + pourquoi).

- **2026-07-01 — Snapshot-on-change** : le worker n'insère un point d'ELO que si la valeur a changé. Courbe propre, volume minimal ; le « rien n'a bougé » se déduit de l'absence de point.
- **2026-07-01 — Stats de match : colonnes clés + JSONB** (`faceit_match_stats`) : colonnes dédiées et indexées pour ce qu'on filtre/trie (map, date, résultat), JSONB pour le reste → un nouveau champ Faceit ne demande pas de migration.
- **2026-07-02 — Pattern provider** : toute I/O réseau vit dans `packages/<provider>` (client typé + zod + tests), les apps consomment via interfaces injectables — enforced par ESLint. Ajouter une source (Premier, allstar…) = un nouveau package, zéro refactor.
- **2026-07-02 — Décisions tracées ici** : Discord = salle de débat, le repo = source de vérité. Voté ✅ 2/0.

## Comment contribuer à ce fichier

- Ajoute librement une idée dans le **vivier** ou **to-do later** (via une PR, comme le reste).
- Quand on décide de la faire → crée le(s) **ticket(s)** GitHub au format (voir CONTRIBUTING.md) et rattache-les au bon **bloc/epic**.
