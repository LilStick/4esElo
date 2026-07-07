# OAuth Discord — comment ça marche (et comment le faire tourner chez toi)

Résumé du système d'auth (B17.1) pour bosser dessus côté front sans se noyer dans `auth.ts`.

## L'idée en 30 secondes

Pas de mot de passe, pas de table sessions. On délègue l'identité à Discord :

1. Le front envoie l'utilisateur sur **`GET /auth/login`** (l'API, pas une page front).
2. L'API le redirige vers Discord (« Autoriser 4esElo ? »).
3. Discord le renvoie sur **`GET /auth/callback`** avec un code.
4. L'API échange le code contre un token, vérifie qu'il est **membre du serveur 4esport**, lit son profil (id, pseudo, avatar).
5. L'API pose un **cookie de session signé** (7 jours) et redirige vers le front : `http://localhost:5173/?auth=ok`.
6. À partir de là, chaque requête du front porte le cookie → **`GET /me`** dit qui tu es.

Le cookie EST la session : il contient `{discordId, displayName, avatar, exp}` signé HMAC (`SESSION_SECRET`). Personne ne peut le forger sans le secret, et il expire tout seul. Logout = `POST /auth/logout` (supprime le cookie).

## Ce que le front doit savoir (et rien d'autre)

- **Se connecter** : rediriger (pas fetch !) vers `loginUrl()` de `src/lib/api.ts` → `${API}/auth/login`. C'est une navigation complète, Discord doit prendre la main sur l'onglet.
- **Retour du flow** : on atterrit sur `/?auth=ok|error|not-member` (+ `&invite=<url>` pour not-member). C'est `AuthToast.tsx` qui lit ça.
- **Qui suis-je** : `GET /me` →
  - `{ authenticated: false }` — anonyme (ou auth pas configurée) ;
  - `{ authenticated: true, discordId, displayName, isAdmin, player }` — `player` est la fiche `players` matchée par `discord_id`, **null si la personne ne s'est pas register** sur le site. Il porte maintenant aussi `discordAvatar`, `formation`, `promoStart/End` (B17.6).
- **Le piège classique** : le cookie ne part pas tout seul en cross-origin (front :5173 → API :3001). Tout fetch vers l'API doit avoir **`credentials: "include"`** — c'est déjà le cas si tu passes par les helpers de `src/lib/api.ts`. Si `/me` te répond `authenticated: false` alors que tu viens de te connecter, c'est presque toujours ça (ou l'ordre des vars ci-dessous).

## Le faire tourner en local

L'auth est **optionnelle** : sans les vars, le site marche en anonyme et `/auth/*` répond 503. Pour l'activer il faut **les 5 vars ensemble** dans ton `.env` (préfixe `OAUTH`/`ASSO` — les `DISCORD_*` non préfixés sont au bot dev, rien à voir) :

```bash
DISCORD_OAUTH_CLIENT_ID=…          # application Discord (voir ci-dessous)
DISCORD_OAUTH_CLIENT_SECRET=…
DISCORD_OAUTH_REDIRECT_URI=http://localhost:3001/auth/callback
DISCORD_ASSO_GUILD_ID=…            # id du serveur 4esport (clic droit → Copier l'identifiant)
SESSION_SECRET=…                   # 32 caractères MINIMUM, n'importe quoi de long et aléatoire
# optionnel :
DISCORD_ASSO_INVITE_URL=…          # lien d'invite affiché aux non-membres
ADMIN_DISCORD_IDS=id1,id2          # qui a isAdmin: true (panel admin)
```

Créer l'app Discord (une fois, chacun la sienne en dev) :

1. https://discord.com/developers/applications → **New Application**.
2. Onglet **OAuth2** : copie Client ID + Client Secret.
3. Toujours dans OAuth2 → **Redirects** : ajoute exactement `http://localhost:3001/auth/callback`. Si l'URL diffère d'un caractère de `DISCORD_OAUTH_REDIRECT_URI`, Discord refuse (« invalid redirect_uri »).
4. Relance `pnpm dev` (les env vars sont lues au démarrage, zod râle si un truc manque ou si le secret est trop court).

Scopes utilisés : `identify` + `guilds.members.read` (juste assez pour « qui es-tu » et « es-tu sur le serveur »). Aucun bot, aucune permission serveur.

## Où vit le code

| Quoi | Où |
| --- | --- |
| Routes `/auth/*`, `/me`, cookie, middleware `requireAdmin` | `apps/api/src/auth.ts` |
| Client OAuth Discord (authorize URL, échange du code, membre du serveur ?) | `packages/discord/src/oauth.ts` |
| Validation des env vars (`AUTH_CONFIG`) | `apps/api/src/env.ts` |
| Côté front : helpers fetch (`credentials: include`), `loginUrl()` | `apps/web/src/lib/api.ts` |
| Bandeau retour OAuth (`?auth=…`) | `apps/web/src/components/AuthToast.tsx` |

## Debug express

- `/auth/login` → **503** : une des 5 vars manque (regarde le log de démarrage de l'API).
- Discord affiche « invalid redirect_uri » : le redirect de l'app Discord ≠ `DISCORD_OAUTH_REDIRECT_URI`.
- Retour `/?auth=error` : state CSRF perdu (cookies bloqués ?) ou échange de code raté — le détail est loggé côté API (`[auth] callback failed`).
- Retour `/?auth=not-member` : le compte n'est pas sur le serveur 4esport.
- Connecté mais `/me` dit anonyme : fetch sans `credentials: "include"`, ou `SESSION_SECRET` changé entre-temps (les cookies signés avant ne valent plus rien — reconnecte-toi).
