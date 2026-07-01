---
name: review-pr
description: Relire la PR d'un coéquipier (Arthur ↔ LilStick) — lire le diff, vérifier la Definition of Done du ticket, la CI verte et le format, puis laisser un commentaire. À utiliser pour regarder ce que l'autre a fait (l'approbation n'est pas obligatoire pour merger).
---

# Skill: review-pr — relire la PR de l'autre

Le but n'est pas de bloquer (aucune approbation requise pour merger) mais de **comprendre ce que l'autre a fait** et repérer les soucis.

## 1. Choisir la PR

```bash
gh pr list --state open
gh pr view <n>            # description, ticket lié, statut
```

## 2. Lire le diff

```bash
gh pr diff <n>
```

- Est-ce que ça répond à la **Definition of Done** du ticket lié ? (`gh issue view <ticket>`)
- Cohérent avec les conventions (I/O aux bords, types partagés, tests au fil de l'eau) ?

## 3. Vérifier les garde-fous

```bash
gh pr checks <n>          # CI verte ?
```

- **1 seul commit** ? Titre **humain-friendly** ?
- Changelog mis à jour **ou** `[NO-CHANGELOG]` dans le titre ?

## 4. Commenter

```bash
gh pr comment <n> --body "…"        # remarques / questions
gh pr review <n> --approve          # optionnel (non requis)
```

## Merge

- L'auteur peut **self-merge** dès que la CI est verte : `gh pr merge <n> --squash`.
- `main` protégé : jamais de push direct.
