---
name: refine
description: Transforme une idée de feature en epic/ticket(s) GitHub au format 4esElo (titres humain-friendly, labels, dépendances, Definition of Done). À utiliser quand LilStick ou Arthur propose une feature à ticketer, ou pour découper un epic.
---

# Skill: refine — créer epics & tickets au format 4esElo

But : produire des tickets **cohérents et lisibles** quel que soit qui (ou quel Claude) les crée.

## 1. Idée mûre ?

- **Idée floue / pas prioritaire** → NE PAS créer de ticket. L'ajouter dans `ROADMAP.md` (section vivier ou to-do later) via une PR. Stop.
- **Prête à coder** → créer le(s) ticket(s) ci-dessous.

## 2. Rattacher à un bloc (epic)

- Trouver le bloc existant (`gh api repos/:owner/:repo/milestones --jq '.[].title'`).
- Sinon, créer un nouveau bloc : milestone `Bloc <n> — <Nom>` + une issue epic (voir §4).

## 3. Créer le ticket (FORMAT IMPOSÉ)

- **Titre** : `B<n>.<x> · <titre court>` — **humain-friendly, court**, pas verbeux.
- **Labels** : un `type:*` (feature/bugfix/chore/design/infra) + un `area:*` (api/web/worker/db/bot) + un **propriétaire** `arthur` (front/UI) ou `lilstick` (back/API/data).
- **Corps** (exactement cette structure — les 3 sections Contexte / Quoi / DoD sont **obligatoires**) :

  ```
  **Epic :** #<id epic> · EPIC B<n> · <Nom>
  **Branche :** `feat/B<n>.<x>-<slug>`
  **Dépendances :** 🔗 dépend de #<id> (bloqué tant que non mergé)   —OU—   ✅ Autonome

  ---
  <CONTEXTE : 2-3 phrases lisibles par un humain SANS ouvrir le code —
   le problème, pourquoi maintenant, ce que ça apporte>

  **Quoi :**
  - <changement concret 1>
  - <changement concret 2>

  **Definition of Done**
  - [ ] <critère vérifiable 1 — on doit pouvoir répondre oui/non>
  - [ ] <critère vérifiable 2>
  ```

- **Dépendances** : réfléchir à ce qui doit exister avant. Marquer `✅ Autonome` si aucun blocage (piochable en parallèle), sinon lister les `#id` bloquants.

### Exemple canonique (à imiter)

```bash
gh issue create --milestone "Bloc 3 — Profil enrichi" --label "type:feature,area:web,arthur" \
  --title "B3.4 · Radar de comparaison" \
  --body $'**Epic :** #11 · EPIC B3 · Profil enrichi\n**Branche :** `feat/B3.4-compare-radar`\n**Dépendances :** 🔗 dépend de #7 (stats agrégées)\n\n---\nComparer deux membres est LA discussion récurrente du Discord — aujourd\'hui il faut ouvrir deux profils côte à côte. Un radar superposé (ADR, HS%, clutch, entry, utility) tranche le débat d\'un coup d\'œil.\n\n**Quoi :**\n- Page `/compare/<a>/<b>` avec sélecteur de joueurs\n- Radar 5 axes superposé (recharts), normalisé sur les percentiles de l\'asso\n\n**Definition of Done**\n- [ ] Radar affiché pour 2 joueurs quelconques ayant ≥ 10 matchs\n- [ ] Joueur sans données → état vide propre, pas de crash\n- [ ] Responsive mobile + test du composant'
```

**Le test de lisibilité** : Arthur ou Noé doit comprendre _pourquoi ce ticket existe_ en lisant uniquement le contexte — si la description saute direct au « quoi » technique, elle est incomplète. Vaut aussi pour les **epics** : corps = 2-3 phrases de résumé lisible + la checklist des tickets.

## 4. Mettre à jour l'epic

Ajouter le ticket à la checklist de l'issue epic : `- [ ] **B<n>.<x>** · #<id> — <titre>`.
Pour un nouvel epic : issue labellée `epic`, titre `EPIC B<n> · <Nom>`, corps = la checklist.

## Règles

- Titres **courts et clairs** partout (pas de phrase de 15 mots).
- Toujours les 3 labels (type + area + propriétaire).
- Une idée non ticketée vit dans `ROADMAP.md`, pas dans une issue.
