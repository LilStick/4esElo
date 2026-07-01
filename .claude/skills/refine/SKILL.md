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
- **Labels** : un `type:*` (feature/chore/design/infra) + un `area:*` (api/web/worker/db/bot) + un **propriétaire** `arthur` (front/UI) ou `lilstick` (back/API/data).
- **Corps** (exactement cette structure) :

  ```
  **Epic :** #<id epic> · EPIC B<n> · <Nom>
  **Branche :** `feat/B<n>.<x>-<slug>`
  **Dépendances :** 🔗 dépend de #<id> (bloqué tant que non mergé)   —OU—   ✅ Autonome

  ---
  <description>

  **Definition of Done**
  - [ ] <critère vérifiable 1>
  - [ ] <critère vérifiable 2>
  ```

- **Dépendances** : réfléchir à ce qui doit exister avant. Marquer `✅ Autonome` si aucun blocage (piochable en parallèle), sinon lister les `#id` bloquants.

```bash
gh issue create --milestone "Bloc 3 — Profil enrichi" --label "type:feature,area:web,arthur" \
  --title "B3.4 · Radar de comparaison" \
  --body $'**Epic :** #11 · EPIC B3 · Profil enrichi\n**Branche :** `feat/B3.4-compare-radar`\n**Dépendances :** ✅ Autonome\n\n---\n…\n\n**Definition of Done**\n- [ ] …'
```

## 4. Mettre à jour l'epic

Ajouter le ticket à la checklist de l'issue epic : `- [ ] **B<n>.<x>** · #<id> — <titre>`.
Pour un nouvel epic : issue labellée `epic`, titre `EPIC B<n> · <Nom>`, corps = la checklist.

## Règles

- Titres **courts et clairs** partout (pas de phrase de 15 mots).
- Toujours les 3 labels (type + area + propriétaire).
- Une idée non ticketée vit dans `ROADMAP.md`, pas dans une issue.
