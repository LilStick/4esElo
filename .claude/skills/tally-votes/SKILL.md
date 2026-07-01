---
name: tally-votes
description: Relit les réactions de vote (✅/❌) d'une idée postée dans #features-talk et rend un verdict (validé / rejeté / en attente), puis l'annonce. À utiliser pour dépouiller le vote d'une idée soumise avec propose-idea.
---

# Skill: tally-votes — dépouiller le vote d'une idée

Lit les réactions d'un message d'idée (via REST, aucun bot 24/7) et décide.

Entrée : le `MSG_ID` de l'idée (donné par `propose-idea`).

## 1. Lire les réactions

```bash
TOKEN="$DISCORD_BOT_TOKEN"; CH="$DISCORD_FEATURES_CHANNEL_ID"
curl -s -H "Authorization: Bot $TOKEN" \
  "https://discord.com/api/v10/channels/$CH/messages/$MSG_ID" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print({r['emoji']['name']:r['count'] for r in d.get('reactions',[])})"
```

## 2. Compter les votes HUMAINS

Le bot a **amorcé** ✅ et ❌ (compte = 1 chacun au départ). On retire cette amorce :

- `yes = max(0, count(✅) - 1)`
- `no  = max(0, count(❌) - 1)`

## 3. Verdict (règle simple, ajustable)

- **✅ Validé** si `yes >= 2` **et** `yes > no`
- **❌ Rejeté** si `no >= yes` **et** `yes + no >= 1`
- **⏳ En attente** sinon (pas assez de votes)

_(Duo Noé+Arthur : "validé" = les deux pour ; règle modifiable selon le nombre de votants.)_

## 4. Annoncer + logger

Poster un message de verdict dans #features-talk (en réponse à l'idée) :

```bash
curl -s -H "Authorization: Bot $TOKEN" -H "Content-Type: application/json" \
  -X POST "https://discord.com/api/v10/channels/$CH/messages" \
  -d "{\"content\":\"<✅ Validé | ❌ Rejeté | ⏳ En attente> — <yes> pour / <no> contre\",\"message_reference\":{\"message_id\":\"$MSG_ID\"}}"
```

- **Rejeté** → l'idée reste tracée dans l'historique du salon (archive naturelle).
- **Validé** → enchaîner avec le skill **B9.5** (thread dédié + mise à jour ROADMAP).

Ne jamais afficher le token en clair.
