# Roadmap & idées — 4esElo

> Document **vivant**, éditable par tout le monde (LilStick, Arthur). Ici on note **la vision, ce qui est prévu, et les idées "to-do later"**.
> Quand une idée est mûre → on la transforme en **ticket GitHub** (format dans [CONTRIBUTING.md](./CONTRIBUTING.md)) et on la coche/lie ici.
>
> Les **tickets actionnables** vivent dans les issues GitHub (epics = blocs). Ce fichier, c'est le **plan large + le vivier d'idées**.

## Vision

Un site où les membres du pôle CS2 se comparent, suivent leur progression et ont envie de revenir tous les jours : classement ELO, profils riches, stats sociales (duos, head-to-head), et du fun (heatmap, recaps, badges).

## Blocs prévus (voir epics GitHub)

| Bloc | Sujet                                                                | Statut           |
| ---- | -------------------------------------------------------------------- | ---------------- |
| V1   | Fondations (DB, API, worker, web, courbe ELO)                        | ✅ fait          |
| B1   | Design & assets (look Faceit, logos niveaux 1-10)                    | à faire (Arthur) |
| B2   | **Fondation data** : ingestion matchs + backfill courbe ELO          | 🔜 en cours      |
| B3   | Profil enrichi (ADR, clutch, entry, utility, par map, filtres temps) | à faire          |
| B4   | Social (duos, avec qui je win, head-to-head, 5-stack)                | à faire          |
| B5   | Engagement (heatmap, Player of the Day, streaks, recaps, badges)     | à faire          |
| B6   | Bot Discord (/register, auto-post, commandes)                        | à faire          |
| B7   | Splashy (Wrapped annuel, achievements, compare radar, AI roast)      | à faire          |
| B8   | Highlights (allstar.gg / Medal)                                      | à faire          |

## Vivier d'idées (parking) — piocher / compléter librement

_Issu de la recherche (Leetify, csstats.gg, scope.gg, Faceit, Calibrum). Tout est faisable via l'API Faceit sauf mention contraire._

**Stats profil** : ADR · K/D · HS% · KAST (approx) · clutch % (1v1/1v2) · entry frags & first kills · utility damage / flashs · sniper kills · multi-kills · consistency (variance du rating) · avg ELO swing · career highs (meilleur match, plus gros ELO).

**Social (le + différenciant)** : meilleurs duos (winrate ensemble) · "avec qui je win le +" · head-to-head entre membres · stats de 5-stack · nemesis/victime · graphe "qui joue avec qui".

**Engagement** : heatmap d'activité (matchs/jour, style GitHub) · Player of the Day (+ gros gain / grosse perte 24h) · streaks + mouvements de classement · recap hebdo · **Wrapped annuel** (percentiles vs asso, façon Calibrum) · badges emoji (🔥 streak, 🎯 HS, 💣 entry, 🧠 clutch, 🚿 grind-day) · awards de la semaine · match of the week · carte de stats partageable (OG image).

**Comparaisons & filtres** : filtres 7j/30j/3m/saison partout · stats par map (winrate/KD) · leaderboard par map · compare 2 membres (radar) · split T/CT · form last-10.

**Discord** : notifs repo → salon (PR ouverte, CI échouée…) via webhook `/github` (gratuit, immédiat) · auto-post après match · /stats & /leaderboard · sync de rôles par niveau · digest quotidien · **proposition validée par emote** (réagir ✅ pour créer un ticket / merger — nécessite un bot custom, voir B6).

**Gamification** : succès déblocables · course au titre de saison + hall of fame · XP/level d'asso · jeu de pronostics · rivalries auto-détectées · bounties/challenges de la semaine.

**Outillage (DX)** : skill **`/gen-readme`** — régénère le `README.md` pour qu'il colle **fidèlement à l'état réel du repo** (structure, commandes, endpoints, avancement) en inspectant le code + les issues. Même famille que `repo-catchup` (docs auto à jour).

## To-do later (gros morceaux / plus tard)

- **Premier Mode (CS Rating)** — 2ᵉ source d'ELO. Pas d'API Valve officielle → via Leetify (non officiel) ou snapshots réguliers. **Le multi-compte par personne sera introduit uniquement ici** (Faceit interdit les smurfs). Nécessitera : SteamID par membre, provider Premier, courbe/leaderboard par source, sélecteur Faceit/Premier sur le front.
- **Stats mécaniques (façon Leetify)** — placement de viseur, temps de réaction, spray, counter-strafe. **Nécessite de parser les démos** (pipeline lourd, séparé). Gros effort, à évaluer si un jour on veut ce niveau.
- **Highlights** — clips CS2 (allstar.gg / Medal). Zone grise ToS → viser l'embed officiel `allstar.gg/iframe` ou la Partner API. Voir bloc B8.
- **Déploiement / hébergement** — choisir l'hébergeur (pas OVH), CI/CD de déploiement, cron du worker en prod.
- _(ajoute tes idées ici…)_

## Comment contribuer à ce fichier

- Ajoute librement une idée dans le **vivier** ou **to-do later** (via une PR, comme le reste).
- Quand on décide de la faire → crée le(s) **ticket(s)** GitHub au format (voir CONTRIBUTING.md) et rattache-les au bon **bloc/epic**.
