---
name: open-pr
description: Ouvre une PR 4esElo propre — formate (pnpm format), vérifie typecheck/test/lint verts, un seul commit, met à jour le changelog (ou [NO-CHANGELOG]), et crée la PR vers main avec Closes #n. À utiliser quand un ticket est terminé et prêt à merger.
---

# Skill: open-pr — ouvrir une PR propre

## 1. Formater + vert local

**Toujours formater AVANT de committer** — la CI bloque sur `format:check` :

```bash
pnpm format
pnpm typecheck && pnpm test && pnpm lint
```

Corriger tant que ce n'est pas vert.

## 2. Changelog

- PR **liée à un ticket** → ajouter une ligne dans `CHANGELOG.md` sous la date du jour :
  `- AAAA-MM-JJ — <desc courte> (#<ticket>)`.
- PR **non liée** (infra/docs/chore) → mettre **`[NO-CHANGELOG]`** dans le titre du commit/PR.
- (La CI bloque si ni l'un ni l'autre.)

## 3. Un seul commit

Regrouper le travail en **un commit** (amend/squash). Message clair, humain-friendly, en anglais (Conventional Commits), sans co-auteur Claude :

```bash
git add -A && git commit -m "feat(web): radar de comparaison (#42)"
# si plusieurs commits: git reset --soft main && git commit -m "…"
```

## 4. Pousser + PR

```bash
git push -u origin feat/B<n>.<x>-<slug>
gh pr create --base main --title "B<n>.<x> · <titre court>" --body "Closes #<n>\n\n<résumé>"
```

## 5. Merge

- Attendre la **CI verte** (`gh pr checks <pr>`).
- **Pas d'approbation requise** : self-merge OK (`gh pr merge <pr> --squash`).
- `main` est protégé : jamais de push direct.

## Rappels

- **1 seul commit par PR** · titres **courts** · auteurs = LilStick/Arthur seulement.
