---
name: start-ticket
description: Démarre proprement le travail sur un ticket 4esElo (ex. B2.1) — vérifie l'env, met main à jour, crée la branche feat/, lit la Definition of Done et alerte si le ticket est bloqué par une dépendance non mergée. À utiliser avant de coder un ticket.
---

# Skill: start-ticket — démarrer un ticket proprement

Entrée : un ID logique de ticket (ex. `B2.1`).

## 1. Env OK (RÈGLE N°1)

```bash
pnpm doctor    # doit être tout vert, sinon corriger avant de continuer
```

## 2. Retrouver le ticket + vérifier les dépendances

```bash
gh issue list --state open --search "B2.1 in:title" --json number,title,body
```

- Lire la ligne **Dépendances** du corps.
- Si `🔗 dépend de #x` et que #x n'est **pas mergé** → **prévenir l'utilisateur** que le ticket est bloqué ; proposer un ticket `✅ Autonome` à la place (`gh issue list --search "Autonome in:body"`).
- Si `✅ Autonome` → OK, continuer.

## 3. Partir d'un `main` à jour (RÈGLE N°2)

```bash
git fetch origin
git switch main && git pull --ff-only
git switch -c feat/B2.1-<slug>          # slug court, humain-friendly
```

## 4. Lire la Definition of Done

Afficher la DoD du ticket et coder **par petits incréments vérifiés** (`pnpm typecheck && pnpm test && pnpm lint` verts au fur et à mesure).

Quand c'est fini → utiliser le skill **open-pr**.
