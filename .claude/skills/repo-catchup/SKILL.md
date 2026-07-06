---
name: repo-catchup
description: Résume l'activité récente du repo (PR mergées, tickets, CI, commits) en clair, par personne (toi vs l'autre). À utiliser quand l'utilisateur reprend le projet, fait /resume, ou demande "ce qui s'est passé sur le repo depuis la dernière fois".
---

# Skill: repo-catchup — « quoi de neuf sur le repo ? »

À déclencher au début d'une session (ex. après `/resume`) ou quand l'utilisateur veut faire le point.

## 0. La frise d'abord (TOUJOURS)

Afficher la frise d'avancement en premier — la vue d'ensemble avant le détail :

```bash
node scripts/timeline.mjs
```

(Recopier sa sortie telle quelle en tête de réponse, dans un bloc de code.)

## 1. Qui es-tu ? (auto)

```bash
gh api user --jq .login
```

Mapper : `LilStick` → **Noé**, `luminescencedev` → **Arthur**. « L'autre » = le second. Si le login est inconnu, demander simplement « tu es Noé ou Arthur ? ».

## 2. Quelle vue ?

- **Par défaut (aucune période précisée)** → le **dernier merge en détail** + un rappel des **3 derniers merges**.
- **Si l'utilisateur veut une période** → proposer **1h · 24h · 7j · 30j** et l'utiliser à la place.

## 3. Récupérer l'activité

```bash
git fetch origin >/dev/null 2>&1

# Défaut : les 3 dernières PR mergées
gh pr list --state merged --limit 3 --json number,title,author,mergedAt,url

# (le dernier merge = le 1er de la liste ; détailler avec)
gh pr view <n> --json title,body,author,files

# Mode période : traduire 1h/24h/7j/30j -> DATE (AAAA-MM-JJ) et SINCE (git)
gh pr list --state all --search "updated:>=<DATE>" --json number,title,author,state,mergedAt,url
gh issue list --state all --search "updated:>=<DATE>" --json number,title,state,labels,url
git log origin/main --since="<SINCE>" --pretty="%h %s (%an)"
gh run list --limit 20 --json headBranch,conclusion,displayTitle   # repérer les échecs CI

# Qui bosse sur quoi MAINTENANT (tickets en cours, par assigné)
gh issue list --state open --label "status:in-progress" --json number,title,assignees
```

## 4. Résumer : clair, par personne

Détecter l'auteur de chaque PR/commit → séparer **toi** vs **l'autre**. Court, humain-friendly, pas de dump brut.

```
📦 Repo 4esElo — dernières updates (toi = Noé)

🆕 Dernier merge
- #42 · B3.4 Radar de comparaison (Arthur) — ajoute la page de comparaison 2 joueurs.

🔨 En cours
- #3 · B2.3 Ingestion des matchs — Noé

🧑 Ce que tu as fait récemment (Noé)
- #40 · B2.1 Table match_stats — mergé

👥 Ce qu'Arthur a fait
- #42 · B3.4 Radar de comparaison — mergé
- #41 · B1.2 Refonte page joueur — mergé

🛠️ CI : ✅ tout vert   ·   📈 main : 5 commits
```

Règles : **humain-friendly**, groupé (dernier merge → toi → l'autre), mettre en avant ce qui **bloque** (CI rouge, PR à relire). Si rien n'a bougé, le dire simplement.
