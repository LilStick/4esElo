---
name: validated-idea
description: Quand une idée a été validée par le vote (tally-votes = ✅ Validé), ouvre un thread de discussion dédié sur le message de l'idée, puis lance le refinement (analyse de l'état du repo → mise à jour ROADMAP et/ou création de ticket). À utiliser après un verdict "validé".
---

# Skill: validated-idea — transformer une idée validée en travail tracé

Boucle le workflow d'idéation : thread de discussion + refinement → ROADMAP/ticket.

Entrée : le `MSG_ID` de l'idée validée.

## 1. Ouvrir un thread dédié sur l'idée

```bash
TOKEN="$DISCORD_BOT_TOKEN"; CH="$DISCORD_FEATURES_CHANNEL_ID"
THREAD=$(curl -s -H "Authorization: Bot $TOKEN" -H "Content-Type: application/json" \
  -X POST "https://discord.com/api/v10/channels/$CH/messages/$MSG_ID/threads" \
  -d '{"name":"💡 <nom court de l idée>","auto_archive_duration":10080}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
```

## 2. Poster le point de départ dans le thread

```bash
curl -s -H "Authorization: Bot $TOKEN" -H "Content-Type: application/json" \
  -X POST "https://discord.com/api/v10/channels/$THREAD/messages" \
  -d '{"content":"✅ Idée validée — on cadre ici.\nÉtapes : refinement (analyse main + ROADMAP + tickets) → ajout ROADMAP et/ou création de ticket."}'
```

## 3. Refinement (manuel — pas de génération auto)

Lancer le skill **refine** : analyser l'état réel (`main`, `ROADMAP.md`, tickets existants + dépendances) et, selon la maturité :

- idée encore large → l'ajouter au **vivier ROADMAP** ;
- prête → créer le(s) **ticket(s)** au format (Epic, Branche, Dépendances, DoD, labels).

Puis **poster le résultat dans le thread** (lien ROADMAP/PR ou n° de ticket) pour garder la trace idée ↔ travail.

## 4. Boucler

- ROADMAP et/ou tickets à jour.
- Le thread conserve la décision + le lien vers le travail.
- (Re-vote / retours possibles dans le thread avant de coder.)

Ne jamais afficher le token en clair.
