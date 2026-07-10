# Changelog

Évolutions notables du projet. **Une entrée par PR liée à un ticket**, avec la **date du merge** (`AAAA-MM-JJ`) et le n° de ticket.
Une PR non liée à un ticket (infra, docs, chore) porte `[NO-CHANGELOG]` dans son titre et n'apparaît pas ici.

Format d'une ligne : `- AAAA-MM-JJ — <description courte> (#<ticket>)`

## 2026-07-10

- API : roast par match enrichi (`matchRoast`) — « GG » réservé aux vraies bonnes games (K/D positif), victoire portée par l'équipe → punchline dédiée, et nouvelles vannes en défaite (« Livraison express » entrées ratées, « Balayé » K/D négatif) ; règles partagées `packages/types`, zéro changement front. (#338)
- Web : heatmap d'activité refaite — fenêtre récente à taille de carreau fixe qui tient dans la card (nb de semaines calculé selon la largeur), sans scroll ; labels jours + mois toujours visibles, carreaux plus gros sur le home que sur le profil. (#334)
- Web : card « Performances récentes » refaite façon Faceit — courbe d'ELO lissée où chaque sommet est un match, barème rang + ELO à gauche, bande V/D alignée sous les points, et tooltip riche au survol (map, V/D, date, rating, K/D/A, ±ELO) ; survol partagé courbe ↔ bande. (#333)
- Web : micro-animations premium — count-up des chiffres clés (ELO du profil, bento de stats, records du pôle), entrée en cascade + léger lift au survol du bento, pastille active qui glisse sur le sélecteur de période, barre de survol glissante sur « avec qui il win le + », et tooltip au survol du radar de perf ; tout coupé si `prefers-reduced-motion`. (#205)
- Web : section « Modération — bans » dans le panel admin — bannir un membre (dropdown avec avatars + raison, confirmation) et débannir (confirmation), liste des comptes bannis (raison + date) ; réservé aux admins. Données de l'API B17.9. (#270)
- Web : page « Boîte à idées » (`/ideas`, entrée nav) — formulaire connecté (compteur 500 car.) qui relaie l'idée dans le salon Discord dédié, + fil des idées récentes (auteur, « toi », date) ; états non connecté (CTA login), rate-limit (3/jour) et succès gérés. Données de l'API B17.7. (#268)
- Web : classement par map (`/classement/maps`) — sélecteur de cartes (triées par activité) + classement des membres sur la map choisie (winrate, K/D, games), lignes cliquables vers les profils ; accès via un bouton « Par map » sur le classement. Données de l'API B13.6. (#109)
- Web : section « Les fives du pôle » sur la page Social — les groupes de 3 à 5 membres qui jouent ensemble (avatars, taille, winrate, games), triés par taille puis winrate, pseudos cliquables ; état vide propre. Données de l'API B4.4. (#262)
- Web : page dédiée « Succès » par joueur (`/player/:id/succes`) — en-tête + progression globale + grille de trophées (débloqués datés, verrouillés grisés avec condition et barre de progression) ; carte résumé cliquable sur le profil. Données de l'API B7.8. (#266)

## 2026-07-09

- Web : badges emoji de perf récente à côté du pseudo — sur le classement (max 3, « +N » au-delà) et sur le profil (tous), avec un tooltip au survol (emoji + libellé + comment on le gagne) ; rien affiché si aucun badge. Données de l'API B5.8. (#259)

- Web : punchline « 4esBot » sur le détail d'un match — une vanne ou un compliment calculé depuis les stats de la game (moteur partagé), affiché dans la modale de match (barre d'accent V/D, emoji, ton fun) ; rien si la game est banale. (#302)

- Web : passe responsive shell + home + profil — sidebar repliée d'office et toggle masqué sous 1760 px (fini les chevauchements), bulle du shell retirée en mode menu burger (contenu à plat), home et profil basculent en une colonne à 1280 px avec un ordre lisible (centre d'abord), et le profil ne s'écrase plus sur les laptops. (#208)
- Web : fix responsive de la home — le layout multi-colonnes (rails 280/320 px) s'active dès 1280 px (`xl`) au lieu de 1536 px (`2xl`), pour que les widgets restent compacts sur les écrans laptop ~1280–1440 px au lieu de s'empiler pleine largeur. (#297)
- Web : encart « Roast » sur le profil — la mascotte 4esBot (poulet CS) analyse les dernières games au clic et déroule 2-3 punchlines déterministes (négatif + positif) avec un effet de frappe, + prévision d'ELO, depuis `GET /players/:id/roast`. Rail droit du profil, état neutre si pas assez de games. (#264)
- API : BIG Wrapped longue période — `GET /wrapped/big/:period` (`2026`, `2026-H1`, `2026-H2`) et `/wrapped/big/:period/:playerId` réutilisent le moteur d'awards + percentiles vs l'asso sur une fenêtre semestre/année (façon Spotify Wrapped) ; annonce annuelle auto (« Le BIG Wrapped <année> est là », dédupliquée). Débloque le front #321. (#320)
- Fix : ±ELO du dernier match posé sans attendre de rejouer (worker) — l'`elo_after` du match le plus récent est désormais rempli dès qu'un sync enregistre un changement d'ELO (l'ELO ne bouge que sur un match), au lieu d'exiger que le match ait été ingéré au même tick ; couvre le décalage Faceit et les enchaînements de games. Complète #316 (le ±ELO dérivé apparaît dès le premier sync). (#318)
- Fix : ±ELO du dernier match affiché en retard (« — ») sur le feed « Matchs récents » et les historiques — le ±ELO est désormais dérivé des `elo_after` consécutifs (`eloDelta ?? eloAfter − eloAfter précédent`) côté lecture (`/matches/recent`, `/players/:id/matches`) au lieu d'attendre le backfill (souvent 403) ; soigne aussi tout l'historique. La vraie valeur du backfill reste prioritaire. (#316)
- Web : bouton « rafraîchir l'ELO » (icône) sur la carte ELO du profil — resync Faceit à la demande, spinner pendant, l'ELO affiché se met à jour sans recharger ; message propre si déjà à jour ou rate-limité (429). (#303)
- Web : rating moyen (façon HLTV) sur le profil, dans le bento de stats et suivant le sélecteur de période, couleur selon la valeur ; bouton « Comparer » (icône) sur la carte de profil de performance qui pré-remplit le joueur sur la page de comparaison. La formule de rating par match pointe désormais vers la source unique partagée (`packages/types`). (#286)
- Web : flux « Matchs récents » du pôle dans un rail à droite de la home (tous joueurs confondus, avatar, map, V/D, ±ELO coloré), en remplacement du widget « Mouvements récents » ; un clic sur une ligne ouvre la modale de détail du match. (#285)
- Tests : socle e2e Playwright — boote la vraie stack (API + web + Postgres) et la teste en conditions réelles : e2e API en HTTP réel (`/health`, `/leaderboard`, `/players/:id`, `/players/:id/og.png`) + smoke « la SPA monte », seed déterministe, job CI dédié. Pas de parcours UI métier (front en mouvement jusqu'à la v1) ; le socle est prêt pour en ajouter plus tard. (#312)
- API : carte de partage OG par joueur — `GET /players/:id/og.png` génère une carte perso (avatar, pseudo, niveau, ELO, winrate/K-D/rating) en PNG via SVG→resvg (sans navigateur headless, police Inter embarquée) ; `GET /player/:id` sert aux crawlers (Discord/Twitter/WhatsApp) un HTML avec les balises OG du bon joueur, les navigateurs étant redirigés vers la SPA. Joueur sans stats → carte dégradée. Coller un lien de profil affiche désormais la carte du joueur au lieu de l'aperçu générique. (#253)
- Worker : recap hebdo automatique — chaque lundi, une annonce « La semaine du pôle 📅 » résume la semaine écoulée (games jouées, plus gros grinder, plus belle progression et plus dure semaine côté ELO), publiée via la même mécanique que le Wrapped (dédup par semaine ISO, relançable sans doublon) et affichée par la bannière home. (#257)
- API : moteur roast + forecast ELO — `GET /players/:id/roast` (2-3 punchlines conditionnées aux stats, sans IA, ton fun) + prévision d'ELO (tendance linéaire 30 j) ; roast par-match partagé (`matchRoast` dans `packages/types`) réutilisable par le front. Débloque #264 et #302. (#263)
- API : 5 nouveaux prix « roast » au Wrapped mensuel — 🦵 Tibia d'or (pire HS%), 🎯 Chirurgien (meilleur HS%), 🚑 Baby-sitter (carry en défaite), 🐹 Hamster (games pour un ΔELO ≤ 0), 🪶 Chatouilleur (pire ADR). (#301)
- API : classement du pôle par map — `GET /leaderboard/maps` (par map, membres classés par winrate + K-D, min. 5 games, maps triées par activité). Débloque #109. (#300)
- API : rafraîchir l'ELO à la demande — `POST /players/:id/refresh` resync un joueur depuis Faceit (snapshot-on-change), rate-limité 1/min/joueur ; sans worker 24/7, permet de forcer la maj de l'ELO du profil. Débloque #303. (#283)
- API : rating HLTV 1.0 agrégé sur le profil — `/players/:id/stats` renvoie `rating` calculé sur la période sélectionnée (range-aware 7j/30j/3m/all), + formule HLTV centralisée dans `packages/types` (une seule source front+back). Débloque #286. (#298)
- Worker : deep-ingest de l'historique — un membre non encore traité (nouvel inscrit ou roster à rattraper) voit tout son historique Faceit tiré une bonne fois (fenêtre large), au lieu de la fenêtre glissante de 90 j ; colonne `deep_ingested_at`, 1 joueur par run. Remplit la heatmap et l'historique en profondeur. (#282)
- API : succès permanents — `GET /players/:id/achievements` (14 succès à paliers : matchs, kills, aces, clutchs, MVP, ELO…), déblocages persistés avec date figée + progression des verrouillés ; débloque le front #266. (#265)
- API : lineups — `GET /social/lineups` (groupes de 3 à 5 membres qui jouent ensemble, games + winrate, min. 3 games), prolongement des duos ; débloque le front #262. (#261)
- Data : vue match-level — le client Faceit expose désormais la composition des équipes + le score, stockés dans une nouvelle table `matches` (une ligne par match) alimentée par le worker (nouveaux matchs + backfill des anciens). Socle des lineups (#261). (#260)
- API : ban d'un compte Discord (admin) — table `banned_discord_ids`, check en cache court dans `readSession` (coupe une session déjà ouverte en < 30 s) + refus au login OAuth (`?auth=banned`), endpoints `GET/PUT/DELETE /admin/bans` ; filet anti-lockout (impossible de bannir un admin). (#269)
- API : boîte à idées — `POST /ideas` (session requise, texte 500 car. max, 3 idées/jour/membre) relayée dans le salon Discord dev via webhook (mentions désactivées → aucun ping abusif ; webhook absent/mort → idée stockée quand même), + `GET /ideas` (fil récent, marque les siennes). (#267)
- API : badges emoji sur le classement et le profil — 🔥 série en cours, 🎯 machine à HS, 💣 entry fragger, 🧠 roi du clutch, 🚿 grind-day, calculés depuis les stats stockées (seuils documentés, échantillon minimal par règle) ; catalogue partagé dans `packages/types`. (#258)
- API : flux de matchs récents du pôle — `GET /matches/recent?limit=N` renvoie les derniers matchs tous joueurs confondus (joueur, map, résultat, ±ELO, date), triés par date, index dédié sur `played_at` ; débloque le fil d'activité de la home (#285). (#284)

## 2026-07-08

- Web : heatmap d'activité façon GitHub branchée sur l'API `/activity` — sur le profil (le joueur) et sur la home (le pôle entier, matchs partagés dédupliqués), 52 semaines, tooltip par jour, grille vide propre sans matchs. (#230)
- Web : home — joueur du jour, grimpeur, présence, mouvements et records du pôle passent dans une colonne latérale gauche, liste complète visible sans clic (fini la modale « voir tout »), largeur de page alignée sur celle du profil. (#274)
- Web : série en cours + record perso sur le profil (🔥 wins / ❄️ losses, données réelles au lieu d'une approximation sur 30 matchs) et « Dépassements récents » dans le rail de la home (qui passe devant qui au classement). (#256)
- Web : refonte du shell — sidebar repliable (icônes fixes + tooltips, état persisté), toggle dans le coin du contenu, compte en popover façon menu, contenu dans un cadre qui défile en interne pendant que la sidebar reste fixe. (#251)
- Web/API : vraies photos Discord partout (classement, profil, home, comparaison, panel admin, Wrapped, social, présence live…) au lieu des initiales — `/me` renvoie l'avatar frais de la session, et le snapshot DB se rafraîchit à chaque connexion au lieu de rester figé depuis l'inscription. (#279)

## 2026-07-07

- Engagement : les streaks & dépassements — `/players/:id` porte la série en cours + records (`streak`), et `GET /leaderboard/overtakes?window=24h|7d` liste qui est passé devant qui. Le front (#256) et les badges (#258) sont débloqués. (#255)
- Web : onboarding première visite — tour guidé « façon jeu vidéo » : spotlight sur les vrais éléments (navigation, recherche, classement, compte) avec bulles, navigation automatique entre les pages, barre de progression ; affiché une seule fois (localStorage), skippable, Échap ferme, `prefers-reduced-motion` respecté. (#125)
- Web : panel admin `/admin` (réservé aux admins, lien dans la nav) — liste des joueurs avec édition (pseudo Discord, formation, promo) et suppression (confirmation + cascade), éditeur de l'annonce staff de la home, régénération d'un Wrapped mensuel. (#170)
- Web : badges promo/Alumni 🎓 sur le classement et les profils (années de promo + formation) + avatar Discord de l'utilisateur connecté dans la nav — dernier bout de l'expérience connectée, débloqué par l'API B17.6. (#168)
- Web : cheatsheet des raccourcis clavier — « ? » ouvre une modale listant les raccourcis (⌘/Ctrl+K, G puis H/C/A, Échap) ; inactive quand on tape dans un champ, fermeture Esc. (#207)
- Web : page « Social » (`/social`) — classement des duos du pôle par winrate (nb de games en commun, médailles top 3), + encart « avec qui il win le + » (top 3 coéquipiers) sur le profil, masqué si aucun duo. Entrée nav, états vides propres. (#228)
- Web : le widget « En jeu maintenant » précise le mode — « En match Faceit » (confirmé) sinon « En jeu CS2 » sinon « En ligne » ; vérif Faceit impossible → « En jeu CS2 », jamais de fausse mention Faceit. (#214)
- Web : bannière d'annonce sur la home — la plus récente annonce (Wrapped auto ou staff) avec son lien, fermable et mémorisée (localStorage, ne revient pas), rien du tout si aucune annonce. (#225)
- API : promo + avatar Discord exposés sur `/leaderboard`, `/leaderboard/movers` et `/players/:id` (`discordAvatar`, `formation`, `promoStart/End`, null si pas register) — débloque badges promo/Alumni 🎓 et avatars côté front connecté. (#247)
- Web : expérience connectée (connexion Discord) — bouton se connecter/déconnecter dans la nav, page d'inscription `/register` (lookup du pseudo Faceit avec aperçu avatar/ELO/niveau → formation + promo, états d'erreur : pseudo introuvable, déjà pris, déjà inscrit), bandeau retour OAuth (`?auth=ok|error|not-member`), ta ligne surlignée dans le classement, raccourcis « ton Wrapped » et « ton profil » sur le home. (#168)
- Worker : les byes/forfaits (durée 0, jamais de stats côté Faceit) sont ignorés à l'ingestion au lieu d'être retentés en 404 à chaque sync. (#244)
- Admin : les endpoints protégés du panel (whitelist Discord) — éditer un joueur (`PATCH /admin/players/:id` : pseudo, formation, promo), le retirer avec confirmation obligatoire (cascade sur tout l'historique), gérer l'annonce staff de la home (`PUT/DELETE /admin/announcement`, une seule active, servie par `GET /announcements`), re-publier un Wrapped (`POST /admin/wrapped/:y/:m/regenerate`). (#169)
- Comptes : le register vit sur le site — `GET /register/lookup` (préviusalisation du pseudo Faceit : avatar, niveau, ELO, déjà réclamé ?) puis `POST /register` (session Discord requise) : fiche `players` créée avec discord_id/avatar, faceit, steam, **formation + années de promo** (ex. Mastère Dev 2026-2028, Alumni 🎓 déduit). Doublons refusés proprement (1 Discord = 1 compte, 1 Faceit = 1 personne). Vérifié en réel. (#167)
- Comptes : « Se connecter avec Discord » côté back — OAuth (`/auth/login`, `/auth/callback`, `/auth/logout`), session 7 j en cookie httpOnly signé, `GET /me` (anonyme / membre / admin), refus propre des non-membres du serveur avec lien d'invite, middleware `requireAdmin` prêt pour le panel. Auth désactivable proprement (vars absentes = site consultable). (#166)
- Engagement : la data de la heatmap d'activité — `GET /activity` (matchs/jour du pôle, un match partagé compte une fois) et `GET /players/:id/activity`, réponse creuse (jours sans match absents). La heatmap front (#230) est débloquée. (#229)
- Social : les duos du pôle — `GET /social/duos` (meilleurs duos : games ensemble + winrate, min. 5 games) et `GET /players/:id/duos` (« avec qui je win le + »), calculés des matchs stockés (même match + même résultat = coéquipiers). La page Social (#228) est débloquée. (#227)
- Wrapped : annonce automatique sur le site — chaque début de mois le worker publie « Le Wrapped de <mois> est là 🎁 » (table `announcements`, dédup par mois, relançable sans doublon) + `GET /announcements` pour la future bannière home (#225). (#156)
- Web : décor photo de map pour rendre le site plus vivant — bannière de la modale de détail de match, fond de la carte ELO du profil, en-tête du classement, hero des pages Wrapped ; + page 404 refaite (gros 404 + stickers CS éparpillés). (#223)
- Web : page « Comparer » (/compare) — deux joueurs face à face : radar superposé + tableau comparatif (ELO, winrate, K/D, ADR, HS%, clutch, entry), meilleur surligné ; sélection dans l'URL (partageable). (#203)
- Web : Wrapped — page vitrine des awards du pôle (`/wrapped/juillet-2026`) + Wrapped perso (`/wrapped/juillet-2026/:player` : matchs, winrate, Δ ELO, temps de jeu, map signature, percentiles vs pôle, awards) ; entrée nav. (#155)

## 2026-07-06

- Web : section « Records du pôle » sur le home — plus haut ELO, meilleur K/D, meilleur winrate, plus de matchs (joueur + valeur, cliquable). (#204)
- Web : hint « heures de jeu privées » sur le profil (si Steam en privé) avec lien vers le réglage. (#162)
- Web : colonne Rating (façon HLTV, calculé en front, coloré) dans les matchs récents du profil + en vedette dans la modale de détail. (#138)
- Web : détail de match en modale (clic sur un match) — K/D/A, ADR, HS%, clutch 1v1/1v2, entry, multi-kills, utilitaire, ±ELO + lien room Faceit. (#201)
- Web : dates des matchs en relatif (« il y a 2 h », « hier »…) sur le profil, date complète au survol. (#206)
- Web : bouton « Partager » sur le profil — copie le lien du joueur + feedback « Lien copié » animé. (#202)
- Wrapped : le moteur d'awards mensuels (🐀💨🧀📉🔥🧠🌙⏰👻, punchlines incluses) + `GET /wrapped/:year/:month` (awards du pôle) et `/wrapped/:year/:month/:playerId` (récap perso : top map, temps de jeu, ELO, percentiles). La carte partageable (#155) est débloquée. (#154)
- Web : home refondue — hero cinématique (fond de_Ancient + CTA), 4 widgets côte à côte (Joueur du jour, Grimpeur, En jeu, Mouvements), aperçu classement (top 5 + « voir les autres »), bannière Discord ; transition de page sans flicker (largeur portée par la page, scroll remis en haut). (#211)
- Web : ±ELO par match dans les matchs récents du profil (colonne colorée, « – » si non récupéré). (#200)
- Web : classement en ladder par paliers de niveau (bandeaux « Niveau 10/9/8… » + compteur), #1 mis en avant (couronne) ; podium et bascule ELO/Niveau retirés (redondants avec les paliers). (#199)
- Web : footer global (collé en bas du viewport) — crédits (LilStick & luminescence, liens GitHub) + réseaux de l'asso (Discord, Instagram, X, site 4eSport). (#171)
- Web : page « Nouveautés » (`/changelog`) — rend le CHANGELOG groupé par date, badges par domaine, tickets liés à GitHub ; entrée nav + palette. (#172)
- Web : palette de commande (Ctrl/Cmd+K) réécrite sur cmdk — groupes Pages/Joueurs, filtrage fuzzy et nav clavier natifs, style double-bezel + aide clavier. (#190)
- Web : mini-sparkline d'ELO par ligne du classement (12 derniers points, colorée selon la pente, dégradé discret), via `?sparkline=N`. (#108)
- Web : home transformée en landing — hero identité + stats du pôle (membres, ELO moyen, top ELO, niveau moyen), podium top 3, rail de blocs (Joueur du jour, Grimpeur de la semaine, En jeu, Mouvements, CTA Discord) et aperçu classement, en pleine largeur. (#193)
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
