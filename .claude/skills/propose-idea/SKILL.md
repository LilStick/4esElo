---
name: propose-idea
description: Poste une idée de feature dans le salon Discord #features-talk (embed clair) et ajoute les réactions de vote ✅/❌. À utiliser quand Noé ou Arthur a une idée de feature et veut la soumettre au vote de l'équipe.
---

# Skill: propose-idea — soumettre une idée au vote Discord

Poste l'idée dans `#features-talk` via l'API REST Discord (aucun bot à faire tourner) et met les réactions de vote.

## 1. Préparer

- Récupérer `DISCORD_BOT_TOKEN` et `DISCORD_FEATURES_CHANNEL_ID` depuis l'environnement (`.env`).
- Identifier l'auteur : `gh api user --jq .login` → `LilStick`=Noé, `luminescencedev`=Arthur.
- **Reformuler l'idée** en clair, court, humain-friendly : un **titre** (≤ ~60 car.) + une **description** de 2-4 lignes (le problème / ce que ça apporte). Pas de jargon.

## 2. Poster l'embed

```bash
TOKEN="$DISCORD_BOT_TOKEN"; CH="$DISCORD_FEATURES_CHANNEL_ID"
MSG_ID=$(curl -s -H "Authorization: Bot $TOKEN" -H "Content-Type: application/json" \
  -X POST "https://discord.com/api/v10/channels/$CH/messages" \
  -d '{"embeds":[{
        "title":"💡 <titre de l idée>",
        "description":"<description claire>",
        "color":5793266,
        "footer":{"text":"Proposé par <Noé|Arthur> · vote ✅ / ❌"}
      }]}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
```

## 3. Ajouter les réactions de vote (emojis URL-encodés)

```bash
# ✅ = %E2%9C%85   ❌ = %E2%9D%8C
# Pause entre les deux : l'endpoint réactions est rate-limité (sinon HTTP 429).
for E in %E2%9C%85 %E2%9D%8C; do
  curl -s -o /dev/null -H "Authorization: Bot $TOKEN" \
    -X PUT "https://discord.com/api/v10/channels/$CH/messages/$MSG_ID/reactions/$E/@me"
  sleep 0.5
done
```

## 4. Rendre compte

- Donner le **lien du message** : `https://discord.com/channels/<guild_id>/<CH>/<MSG_ID>` (et le `MSG_ID`, utile pour le dépouillement).
- Rappeler que le comptage des votes se fait avec le skill **tally-votes**.

## Notes

- On utilise **des réactions** (pas des boutons) → pas besoin de bot en ligne 24/7, tout est en REST à la demande.
- Ne jamais afficher le token en clair dans la sortie.
