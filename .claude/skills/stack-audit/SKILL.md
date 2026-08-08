---
name: stack-audit
description: Audit de santé de toute la stack sur une branche — un chef d'orchestre lance en parallèle des agents spécialistes (providers, worker, api, db, types, tests, web, un pro architecture, conformité) qui font chacun une analyse approfondie de leur domaine et remontent une review consolidée avec verdict « ça roule / à corriger ». À utiliser pour vérifier qu'une branche est saine avant une PR/merge, après un gros changement, ou pour un audit périodique du code. Lecture seule : l'audit rapporte, il ne modifie rien.
---

# Skill: stack-audit — chef d'orchestre de review multi-spécialistes

But : répondre à **« est-ce que tout roule dans le code de cette branche ? »** avec plus de
profondeur qu'une passe unique. Le chef d'orchestre découpe la stack en domaines, lance un
**agent spécialiste par domaine** (en parallèle), consolide leurs findings, vérifie les plus
graves, et rend un rapport hiérarchisé. **Read-only** : on n'écrit pas de code ici (les
correctifs partent ensuite via `/start-ticket`, et le front via #features talk — RÈGLE N°3).

Complémentaire, pas redondant : `/code-review` juge le diff pour des bugs de correctness ;
`/review-pr` relit la PR de l'autre. **stack-audit** vérifie la **conformité d'architecture**
et la **santé par domaine** de toute une branche (les 5 règles DURES de CLAUDE.md incluses).

---

## 0. Cadrer le run

- **Branche** : argument `$1` si fourni, sinon la branche courante (`git branch --show-current`).
- **Scope** (défaut = diff) :
  - **diff** (défaut) : on n'audite que ce qui a bougé vs `main` → seuls les spécialistes dont
    le domaine touche les fichiers modifiés sont lancés. Rapide, ciblé, avant PR.
  - **`--full`** : audit de tout l'arbre, tous les spécialistes. Plus long/cher — audit périodique.
- **Coût** : ce skill fanne out plusieurs agents qui creusent. En diff, on ne lance que les
  spécialistes utiles. Ne pas lancer `--full` pour un one-liner.

---

## 1. Signaux machine D'ABORD (une seule fois, partagés)

Avant de lancer le moindre spécialiste, le chef capture l'état objectif et le **passe à tous**
(sinon N agents relancent tout) :

```bash
git fetch origin --quiet
git diff --stat origin/main...HEAD          # ampleur + fichiers touchés
git diff --name-only origin/main...HEAD     # pour router les spécialistes (mode diff)
git log --oneline origin/main..HEAD         # intentions des commits
pnpm typecheck                              # vert ?
pnpm lint                                   # vert ?
pnpm test                                   # vert ? (intégration skip auto si Postgres absent — le noter)
```

Note le résultat (✓/✗ + extrait des erreurs) de chaque check. Ces signaux sont la **vérité
terrain** : un spécialiste qui « suppose » un test cassé se fait recadrer par le run réel.
Rappel : lancer typecheck/test/lint **depuis la racine** (les chaînes se cassent en silence en sous-dossier).

---

## 2. Roster des spécialistes (ancrés sur CE repo)

Chaque spécialiste est **read-only**, reçoit sa **charte** (périmètre + règles à vérifier) +
le **résumé des signaux machine**, et ne renvoie QUE des findings structurés (schéma §4).
En mode diff, ne lancer un spécialiste que si le diff touche son périmètre.

| Spécialiste               | Périmètre                                               | Vérifie en priorité                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **providers**             | `packages/faceit`, `packages/premier`, `packages/steam` | Toute I/O réseau vit ici + interfaces injectables (règle 1) ; **validation zod des réponses externes** (règle 2) ; **aucune erreur avalée** (règle 3) ; **endpoint non-officiel isolé + commenté fragile** (règle 5) ; tests sans I/O                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **worker**                | `apps/worker`                                           | Boucles de sync, curseurs, snapshot-on-change, heuristique eloAfter, résilience bot GC (watchdog), idempotence, propagation d'erreurs (pas de `catch` muet), `env.ts` validé zod (règle 2), scripts cross-platform (pas de bash-only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **api**                   | `apps/api`                                              | **zod sur inputs (params/query) + env** (règle 2), auth/session, gestion d'erreurs (onError, pas de `catch` vide non commenté — règle 3), formes de réponse **conformes à `packages/types`**, rate-limits, **jamais de `fetch` direct** (passe par un provider — règle 1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **db**                    | `packages/db`                                           | **Colonnes dédiées + index sur les clés de requête** (filtres/tris/jointures — règle 4), JSONB pour le variable, **migrations Drizzle versionnées** (schema.ts → generate, pas de drift), FK/cascade cohérents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **types**                 | `packages/types`                                        | Formes échangées API↔front cohérentes et **non dupliquées/divergentes**, `null` vs optionnel intentionnel, pas de type « fourre-tout »                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **tests**                 | toute la stack                                          | Logique métier nouvelle → **unit avec mocks (zéro I/O)** ; endpoint nouveau/modifié → **intégration** (skip si Postgres absent) ; **bugfix → test de non-régression écrit AVANT** ; couverture réelle du diff ; e2e seulement parcours critiques                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **web** _(front, Arthur)_ | `apps/web`                                              | Tout `fetch` passe par `src/lib/api.ts` ; validation des réponses (recommandé) ; **aucune logique back côté front**. ⚠️ Findings → **Arthur** (on rapporte, on ne corrige pas — RÈGLE N°3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **architecture**          | transverse (tout l'arbre)                               | **Le pro de l'archi.** Direction des dépendances (`apps/*` → `packages/*`, JAMAIS l'inverse ; pas d'import entre apps ; un provider ne dépend d'aucune app ; `packages/types` sans dépendance lourde) ; **isolation des couches** (toute I/O derrière une interface injectable, métier testable sans I/O, pas de `fetch`/SQL qui fuit dans handlers/boucles) ; **couplage / cohésion** (responsabilité claire, pas de god-module, zéro dépendance circulaire) ; **qualité d'abstraction** (pas d'abstraction fuyante, ni sur-abstraction prématurée, ni même concept dupliqué dans 2 packages) ; **cohérence des patterns** (snapshot-on-change, gestion d'erreur, zod aux frontières, config-gate : une feature SUIT l'existant au lieu d'inventer un pattern divergent) ; **cohérence globale** (nommage, conventions, structure homogènes d'un module à l'autre ; 2 endroits qui font la même chose de 2 façons → unifier) ; **tout le code est-il UTILE** (chaque export/fichier/dép package.json/route/colonne a un consommateur réel — sinon **code mort à supprimer**, pas juste toléré : deps inutilisées, exports jamais importés, branches inatteignables, params/flags jamais lus, tables/endpoints orphelins) ; **divergence entre branches**. Verdict par finding : **s'intègre** à l'archi existante, ou **introduit une divergence / dette** à rattraper |
| **conformité**            | transverse                                              | Les **5 règles DURES** au cas par cas ; **secrets jamais loggés/committés** (`.env` gitignoré, clé Faceit server-side) ; **auteurs commits** (jamais de `Co-Authored-By: Claude`) ; cross-platform (pas de bash-only dans les scripts npm)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**architecture** est le spécialiste transverse par excellence : lance-le **toujours en `--full`**,
et en mode diff dès que le changement **touche des frontières de packages, ajoute/déplace un
module, change des dépendances, ou introduit un nouveau `packages/*`** (bref, tout ce qui n'est
pas un patch local). Ajouter un spécialiste ad hoc si le diff crée un nouveau domaine — même patron de charte.

---

## 3. Lancer le fan-out (parallèle)

Lancer les spécialistes retenus **dans un seul message, plusieurs appels `Agent`** (ils tournent
en parallèle). Agent type conseillé : `Explore` (lecture large) ou `general-purpose`.

Prompt type d'un spécialiste :

```
Tu es le spécialiste <domaine> de l'audit stack 4esElo, sur la branche <branche>.
Périmètre : <fichiers/dossiers>. Lecture seule — ne modifie rien.

Règles à vérifier (CLAUDE.md) : <liste de la charte du tableau §2>.
Signaux machine déjà obtenus (ne les relance PAS) : typecheck=<✓/✗>, lint=<✓/✗>,
test=<✓/✗ + extrait>. Diff concerné : <name-only pertinents>.

Creuse À FOND ton domaine (pas de survol). Pour CHAQUE problème réel, renvoie un finding :
{ severity: blocker|major|minor|nit, file, line, rule (réf CLAUDE.md si applicable),
  issue (1 phrase), why (impact concret), fix (piste concrète), owner: lilstick|arthur,
  confidence: 0-1 }
Ne remonte PAS le style déjà couvert par lint/prettier. Classe par severity décroissante.
Renvoie uniquement la liste des findings (ou « RAS » si rien).
```

---

## 4. Schéma de finding (imposé)

```
severity : blocker (casse / faille / perte de données) | major (bug probable, règle DURE violée)
           | minor (fragilité, dette) | nit (cosmétique non-lint)
file:line · rule (ex. « CLAUDE.md règle 3 » / « — ») · owner (lilstick|arthur)
issue    : le défaut en une phrase
why      : impact concret (scénario)
fix      : piste de correction
```

---

## 5. Consolider

- **Dédup** : mêmes `file:line` / même cause → un seul finding (garde la meilleure formulation).
- **Ranking** : par severity, puis par confidence.
- **Recoupe avec les signaux machine** : un finding « test manquant » vs le run réel ; un
  « ça throw » vs typecheck/test verts. Ce qui contredit la vérité terrain est écarté ou requalifié.

## 6. Vérif adversariale (findings graves seulement)

Pour chaque **blocker/major**, lancer un agent sceptique dont le job est de **réfuter** :
« voici le finding — donne le scénario d'entrée précis qui casse, ou conclus faux positif ».
On **garde** le finding s'il survit, on le **dégrade/écarte** sinon. (Proportionné : on ne
vérifie pas les nits.) Objectif : zéro finding « plausible mais faux » dans le rapport.

## 7. Rapport final

1. **Verdict** en tête : **✅ ça roule** (aucun blocker/major survivant) ou **⚠️ à corriger**
   (+ le compte par severity), et l'état des signaux machine (typecheck/lint/test).
2. **Findings** groupés par severity, chacun : `file:line · règle · owner` + issue/why/fix.
3. **À router vers Arthur (front)** : section séparée pour les findings `owner: arthur` —
   ils partent en **#features talk**, on ne les code pas (RÈGLE N°3).
4. **Angles morts** : ce qui n'a pas pu être vérifié (ex. intégration skippée faute de Postgres,
   endpoint non testé) — dire ce qui reste incertain plutôt que de laisser croire à une couverture totale.

Le rapport est une **photo pour décider** : ensuite, chaque correctif `lilstick` se prend via
`/start-ticket`, le front part à Arthur. stack-audit ne modifie jamais le code lui-même.
