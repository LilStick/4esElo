export type EloSource = "faceit" | "premier";

export interface PlayerSummary {
  id: string;
  /** Snowflake Discord - nécessaire pour construire l'URL CDN de l'avatar. */
  discordId: string | null;
  discordName: string | null;
  faceitNickname: string | null;
  steamId64: string | null;
  /** Current ELO for the requested source, null if unknown yet. */
  elo: number | null;
  /** Faceit skill level 1-10 (null for premier / unknown). */
  level: number | null;
  /** Discord avatar hash (register) - null until the member registers on the site. */
  discordAvatar: string | null;
  /** Formation + promo years (register) - null until the member registers. */
  formation: string | null;
  promoStart: number | null;
  promoEnd: number | null;
}

/** Badges emoji (B5.8) - flex gagné selon les stats, calculé côté API.
 *  Les seuils vivent dans le code (`apps/api/src/badges.ts`). */
export type BadgeId = "streak" | "headshot" | "entry" | "clutch" | "grind";

export interface BadgeDef {
  emoji: string;
  label: string;
  description: string;
}

export const BADGE_CATALOG: Record<BadgeId, BadgeDef> = {
  streak: { emoji: "🔥", label: "En feu", description: "Série de victoires en cours" },
  headshot: { emoji: "🎯", label: "Machine à HS", description: "Gros pourcentage de headshots" },
  entry: { emoji: "💣", label: "Entry fragger", description: "Gagne ses duels d'entrée" },
  clutch: { emoji: "🧠", label: "Roi du clutch", description: "Gagne ses clutchs 1v1 / 1v2" },
  grind: { emoji: "🚿", label: "Grind-day", description: "Grosse journée de matchs" },
};

/** Badge à paliers (B5.13) - fenêtré (24h classement, 30j profil). Coexiste avec badges[] le temps que le front migre. */
export interface BadgeTier {
  /** BadgeId + le négatif « coldstreak ». */
  id: BadgeId | "coldstreak";
  emoji: string;
  /** Paliers atteints (≥ 1) = nb d'émojis. */
  count: number;
  message: string;
}

export interface LeaderboardEntry extends PlayerSummary {
  rank: number;
  /** Last N ELO points, oldest first - only when the request asks for it. */
  sparkline?: number[];
  /** Badges décrochés (B5.8) ; liste vide si aucun. */
  badges: BadgeId[];
  /** Badges à paliers, fenêtre 24h (B5.13) ; liste vide si aucun. */
  badgeTiers: BadgeTier[];
}

export type MoversWindow = "24h" | "7d";

/** ELO movement over a window, computed from stored snapshots. */
export interface MoverEntry extends PlayerSummary {
  /** Rank by current ELO (same ordering as the leaderboard). */
  rank: number;
  /** ELO change over the window; null when the player wasn't tracked at its start. */
  delta: number | null;
}

export interface MoversResponse {
  source: EloSource;
  window: MoversWindow;
  /** Sorted by delta, biggest gain first; null deltas last. */
  movers: MoverEntry[];
}

/** Live presence of one member (Steam status + optional Faceit confirmation). */
export interface PresenceEntry {
  id: string;
  faceitNickname: string | null;
  discordName: string | null;
  discordId: string | null;
  discordAvatar: string | null;
  /** null = unknown (private profile, Steam unreachable). */
  online: boolean | null;
  inGameCs2: boolean;
  /** true = confirmed in a Faceit match; null = couldn't check (endpoint fragile). */
  inFaceitMatch: boolean | null;
}

export interface PresenceResponse {
  updatedAt: string; // ISO
  players: PresenceEntry[];
}

export interface EloPoint {
  elo: number;
  capturedAt: string; // ISO
}

/** Séries de wins/losses (B5.5), calculées des matchs stockés. */
export interface PlayerStreak {
  /** Série en cours ; null si aucun match stocké. */
  current: { type: "win" | "loss"; length: number } | null;
  bestWinStreak: number;
  worstLossStreak: number;
}

export interface PlayerDetail extends PlayerSummary {
  createdAt: string;
  history: EloPoint[];
  /** true = ses heures de jeu Steam sont privées (hint front) ; null = pas encore échantillonné. */
  playtimePrivate?: boolean | null;
  streak: PlayerStreak;
  /** Badges décrochés (B5.8) ; liste vide si aucun. */
  badges: BadgeId[];
  /** Badges à paliers, fenêtre 30j (B5.13) ; liste vide si aucun. */
  badgeTiers: BadgeTier[];
}

/** Dépassement au classement (B5.5) : `passer` est passé devant `passed` sur la fenêtre. */
export interface OvertakePlayer {
  id: string;
  discordId: string | null;
  faceitNickname: string | null;
  discordName: string | null;
  discordAvatar: string | null;
  elo: number | null;
}

export interface OvertakeEntry {
  passer: OvertakePlayer;
  passed: OvertakePlayer;
  /** Quand le croisement a eu lieu (ISO). Historique = events des N derniers jours. */
  at: string;
}

export interface OvertakesResponse {
  source: EloSource;
  window: MoversWindow;
  overtakes: OvertakeEntry[];
}

export interface LeaderboardResponse {
  source: EloSource;
  leaderboard: LeaderboardEntry[];
}

export interface EloCurveResponse {
  source: EloSource;
  points: EloPoint[];
}

/** Normalized per-match player stats (from Faceit /matches/{id}/stats, CS2). */
export interface FaceitMatchStats {
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  kr: number;
  adr: number;
  damage: number;
  hsPercent: number;
  mvps: number;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
  clutch1v1Count: number;
  clutch1v1Wins: number;
  clutch1v2Count: number;
  clutch1v2Wins: number;
  clutchKills: number;
  entryCount: number;
  entryWins: number;
  firstKills: number;
  utilityDamage: number;
  utilityCount: number;
  flashCount: number;
  enemiesFlashed: number;
  flashSuccesses: number;
  sniperKills: number;
}

/** Composants nécessaires au calcul du rating HLTV 1.0 (par match ou agrégés). */
export interface HltvRatingInput {
  kills: number;
  deaths: number;
  rounds: number;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
}

/** Rating HLTV 1.0 (partagé front/back). rounds fourni par l'appelant (par match : kills/kr ; agrégé : somme). Null si non calculable. */
export function hltvRating(i: HltvRatingInput): number | null {
  if (i.rounds <= 0) return null;
  const k2 = i.doubleKills;
  const k3 = i.tripleKills;
  const k4 = i.quadroKills;
  const k5 = i.pentaKills;
  const k1 = Math.max(0, i.kills - (2 * k2 + 3 * k3 + 4 * k4 + 5 * k5));
  const killRating = i.kills / i.rounds / 0.679;
  const survival = (i.rounds - i.deaths) / i.rounds / 0.317;
  const rmk = (1 * k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5) / i.rounds / 1.277;
  return (killRating + 0.7 * survival + rmk) / 2.7;
}

/** Une punchline roast (B7.6). */
export interface RoastLine {
  emoji: string;
  label: string;
  text: string;
}

const r0 = (n: number) => Math.round(n);

/** Roast d'un match (#302) - punchline la plus saillante (priorité décroissante), null si banale. Partagé front/back. */
export function matchRoast(s: FaceitMatchStats, result: number): RoastLine | null {
  const clutchWins = s.clutch1v1Wins + s.clutch1v2Wins;
  if (s.pentaKills >= 1) return { emoji: "🎽", label: "Ace", text: "ACE - 5 dans une manche, gg." };
  if (result === 1 && s.kills >= 25)
    return { emoji: "🔥", label: "Patron du lobby", text: `${s.kills}-${s.deaths}, t'as fait le ménage.` };
  if (result === 0 && s.kills >= 20)
    return {
      emoji: "🚑",
      label: "Mal entouré",
      text: `${s.kills} kills pour une défaite - tes mates étaient en visite.`,
    };
  if (clutchWins >= 2)
    return { emoji: "🧊", label: "Sang-froid", text: `${clutchWins} clutchs gagnés - calme olympien.` };
  if (s.hsPercent >= 60)
    return { emoji: "🎯", label: "Chirurgien", text: `${r0(s.hsPercent)}% de HS - les casques pleurent.` };
  if (s.adr > 0 && s.adr < 50)
    return { emoji: "🪶", label: "Chatouilleur", text: `${r0(s.adr)} d'ADR - t'as distribué des caresses.` };
  if (s.deaths >= 22 && s.kills < s.deaths)
    return {
      emoji: "💀",
      label: "Charnier",
      text: `${s.kills}-${s.deaths} - cette game restera entre nous.`,
    };
  if (s.entryCount >= 4 && s.entryWins <= 1)
    return {
      emoji: "📦",
      label: "Livraison express",
      text: `${s.entryWins}/${s.entryCount} entrées gagnées - t'ouvres la porte et tu livres ton corps.`,
    };
  if (result === 0 && s.kills < s.deaths)
    return {
      emoji: "🧹",
      label: "Balayé",
      text: `${s.kills}-${s.deaths} - t'as surtout fait de la figuration.`,
    };
  // GG réservé aux K/D positifs ; sinon « porté ».
  if (result === 1 && s.kills > s.deaths)
    return { emoji: "✅", label: "GG", text: `${s.kills}-${s.deaths}, propre.` };
  if (result === 1)
    return { emoji: "🎟️", label: "Porté", text: `${s.kills}-${s.deaths} en gagnant - merci les mates.` };
  return null;
}

/** Prévision d'ELO (B7.6) : tendance linéaire sur 30 j. */
export interface RoastForecast {
  /** Pente en ELO/jour (arrondie). */
  perDay: number;
  text: string;
}

export interface RoastResponse {
  /** Profil, meilleures d'abord (2-3). */
  lines: RoastLine[];
  /** Prévision d'ELO, null si pas assez de snapshots. */
  forecast: RoastForecast | null;
}

export interface MatchSummary {
  matchId: string;
  map: string;
  playedAt: string; // ISO
  result: number; // 1 win, 0 loss
  eloAfter: number | null;
  /** Vrai ±ELO du match (backfill #141) ; null tant que non récupéré. */
  eloDelta: number | null;
  stats: FaceitMatchStats;
}

export interface MatchesResponse {
  items: MatchSummary[];
  total: number;
}

/** Refresh ELO à la demande (B16.6) : resync d'un joueur depuis Faceit. */
export interface RefreshEloResponse {
  /** ELO courant Faceit, null si le joueur n'a pas de profil CS2. */
  elo: number | null;
  /** true si l'ELO a changé (un snapshot a été inséré). */
  changed: boolean;
}

/** Flux de matchs récents du pôle (B15.11), tous joueurs confondus.
 *  Un même match apparaît une fois par membre y ayant joué (chacun son eloDelta). */
export interface RecentMatchEntry {
  matchId: string;
  player: {
    id: string;
    nickname: string;
    discordId: string | null;
    discordAvatar: string | null;
  };
  map: string;
  playedAt: string; // ISO
  result: number; // 1 win, 0 loss
  /** Vrai ±ELO du match (backfill #141) ; null tant que non récupéré. */
  eloDelta: number | null;
}

export interface RecentMatchesResponse {
  items: RecentMatchEntry[];
}

/** Classement du pôle par map (B13.6). */
export interface MapLeaderboardEntry {
  player: { id: string; nickname: string; discordId: string | null; discordAvatar: string | null };
  matches: number;
  wins: number;
  winRate: number; // 0-100
  kd: number;
}

export interface MapLeaderboard {
  map: string;
  /** Membres triés par winrate desc (min. de games appliqué). */
  players: MapLeaderboardEntry[];
}

export interface MapsLeaderboardResponse {
  minMatches: number;
  /** Maps triées par activité (total de games) desc. */
  maps: MapLeaderboard[];
}

export type StatsRange = "7d" | "30d" | "3m" | "all";

/** Aggregated stats over a time window, computed from stored matches. */
export interface StatsAggregate {
  range: StatsRange;
  matches: number;
  wins: number;
  winRate: number; // 0-100
  kd: number;
  adr: number;
  hsPercent: number;
  clutchWinRate: number; // 0-100
  entrySuccessRate: number; // 0-100
  utilityDamagePerMatch: number;
  /** Rating HLTV 1.0 agrégé sur la période (B16.8) ; null si pas de rounds. */
  rating: number | null;
}

export interface MapStat {
  map: string;
  matches: number;
  wins: number;
  winRate: number; // 0-100
  kd: number;
  adr: number;
}

export interface PlayerStatsResponse {
  range: StatsRange;
  overall: StatsAggregate;
  maps: MapStat[];
}

/** Stats classées dans le benchmark intra-asso (B5.11) - pour toutes, "plus haut = mieux". */
export type BenchmarkStatKey = "adr" | "kd" | "hsPercent" | "clutchWinRate" | "entrySuccessRate" | "winRate";

/** Valeur du membre + son percentile (0-100) face au pôle ; null s'il n'est pas dans le référentiel. */
export interface BenchmarkStat {
  value: number;
  percentile: number | null;
}

/**
 * Ta place dans l'asso (B5.11) : par stat clé, ta valeur et ton percentile intra-asso.
 * `qualified` = tu as assez de matchs sur la fenêtre pour être classé (sinon percentiles null).
 */
export interface PlayerBenchmarkResponse {
  range: StatsRange;
  matches: number;
  qualified: boolean;
  stats: Record<BenchmarkStatKey, BenchmarkStat>;
}

/** Register (B17.2) : préviusalisation du pseudo Faceit avant confirmation. */
export interface RegisterLookupResponse {
  faceitId: string;
  nickname: string;
  avatar: string | null;
  elo: number | null;
  level: number | null;
  /** Ce compte Faceit est déjà relié à un membre. */
  alreadyClaimed: boolean;
}

export interface RegisterRequest {
  faceitNickname: string;
  /** Cursus EFREI (ex. « Mastère Dev », « Licence », « Bachelor ») - libre, suggéré côté front. */
  formation: string;
  /** Années de promo, ex. 2026 → 2028. */
  promoStart: number;
  promoEnd: number;
}

export interface RegisterResponse {
  player: PlayerSummary;
  formation: string;
  promoStart: number;
  promoEnd: number;
  /** Fin de promo passée = Alumni 🎓. */
  isAlumni: boolean;
}

/** Session (B17.1) : qui suis-je. `player` = fiche matchée via discord_id, null si pas registré. */
export type MeResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      discordId: string;
      displayName: string;
      isAdmin: boolean;
      /** Hash d'avatar Discord de la session (frais à chaque connexion), null si aucun. */
      avatar: string | null;
      player: PlayerSummary | null;
    };

/** Heatmap d'activité (B5.2) : nb de matchs par jour UTC, style GitHub. */
export interface ActivityDay {
  day: string; // YYYY-MM-DD (UTC)
  matches: number;
}

/** Réponse **creuse** : seuls les jours avec ≥ 1 match sont présents (ordre chrono).
 *  Le front remplit la grille - un jour absent = 0 match. */
export interface ActivityResponse {
  /** Fenêtre demandée en jours (aujourd'hui inclus). */
  days: number;
  activity: ActivityDay[];
}

/** Duos (B4.1) : stats de paires de membres coéquipiers, calculées des matchs stockés. */
export interface DuoPlayer {
  id: string;
  nickname: string;
  discordId: string | null;
  discordAvatar: string | null;
}

export interface DuoStat {
  /** Les deux coéquipiers, ordre stable (pseudo alphabétique). */
  players: [DuoPlayer, DuoPlayer];
  matches: number;
  wins: number;
  winRate: number; // 0-100
}

export interface DuosResponse {
  /** Games ensemble minimum pour apparaître (anti « 100% sur 1 game »). */
  minMatches: number;
  /** Triés par winrate desc, puis nb de games desc. */
  duos: DuoStat[];
}

export interface PlayerDuosResponse extends DuosResponse {
  playerId: string;
}

/** Lineups (B4.4) : groupes de 3 à 5 membres qui jouent ensemble. */
export interface LineupStat {
  /** Les membres du groupe, ordre stable (pseudo alphabétique). */
  players: DuoPlayer[];
  /** Taille du groupe (3, 4 ou 5). */
  size: number;
  matches: number;
  wins: number;
  winRate: number; // 0-100
}

export interface LineupsResponse {
  /** Games ensemble minimum pour apparaître. */
  minMatches: number;
  /** Triés par winrate desc, puis nb de games, puis taille. */
  lineups: LineupStat[];
}

/** Annonce du site (B7.4) : Wrapped mensuel auto, recap hebdo (B5.7), annonce staff (B17.4). */
export interface Announcement {
  id: string;
  type: "wrapped" | "staff" | "weekly-recap" | "big-wrapped";
  title: string;
  /** Texte libre (recap hebdo, annonce staff), null pour le Wrapped. */
  body: string | null;
  /** Chemin interne (ex. /wrapped/juin-2026), null = annonce sans lien. */
  linkUrl: string | null;
  publishedAt: string; // ISO
}

/** Admin (B17.4) : édition partielle d'un joueur. */
export interface AdminPlayerPatch {
  discordName?: string | null;
  formation?: string | null;
  promoStart?: number | null;
  promoEnd?: number | null;
}

/** Admin (B17.4) : l'annonce staff de la home (une seule active, upsert). */
export interface StaffAnnouncementRequest {
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}

export interface AnnouncementsResponse {
  announcements: Announcement[];
}

/** Boîte à idées (B17.7) - suggestion d'un membre pour le site. */
export interface IdeaItem {
  id: string;
  text: string;
  /** Nom d'affichage de l'auteur (Discord), null si inconnu. */
  author: string | null;
  createdAt: string; // ISO
  /** true = idée du membre connecté. */
  mine: boolean;
}

export interface IdeasResponse {
  items: IdeaItem[];
}

export interface PostIdeaRequest {
  text: string;
}

export interface PostIdeaResponse {
  idea: IdeaItem;
}

/** Succès permanent (B7.8) : un palier atteint sur une métrique, date de déblocage figée. */
export interface AchievementDef {
  id: string;
  emoji: string;
  label: string;
  description: string;
  /** Palier à atteindre sur la métrique du succès. */
  target: number;
}

export interface AchievementState extends AchievementDef {
  /** Valeur courante du joueur sur la métrique (pour la progression). */
  current: number;
  unlocked: boolean;
  /** Date de déblocage (ISO), null si encore verrouillé. */
  unlockedAt: string | null;
}

export interface AchievementsResponse {
  achievements: AchievementState[];
}

/** Composition + score d'une équipe, stocké dans `matches.teams` (B4.3, vue match-level). */
export interface MatchTeam {
  /** faction id Faceit. */
  teamId: string;
  /** Manches gagnées, 0 si indisponible. */
  score: number;
  /** Faceit player_id des joueurs de l'équipe. */
  playerIds: string[];
}

/** Ban d'un compte Discord (B17.9, admin). */
export interface BanEntry {
  discordId: string;
  reason: string | null;
  /** discord_id de l'admin qui a posé le ban, null si inconnu. */
  bannedBy: string | null;
  createdAt: string; // ISO
}

export interface BansResponse {
  bans: BanEntry[];
}

/** Admin listé dans le panel (B12.10). `env` = socle ADMIN_DISCORD_IDS (non-retirable). */
export interface AdminEntry {
  discordId: string;
  discordName: string | null;
  source: "env" | "db";
}

export interface AdminsResponse {
  admins: AdminEntry[];
}

/** Wrapped mensuel (B7.2) - awards du pôle, votés ✅ par l'asso. */
export type AwardKey =
  | "rat"
  | "spammeur"
  | "puant"
  | "chute-libre"
  | "tryharder"
  | "ministre-du-clutch"
  | "nolife"
  | "abonne-absent"
  | "fantome"
  | "tibia-dor"
  | "chirurgien"
  | "baby-sitter"
  | "hamster"
  | "chatouilleur";

/** Un award décerné. Plusieurs gagnants possibles pour un même award (ex æquo). */
export interface AwardWinner {
  award: AwardKey;
  emoji: string;
  title: string;
  playerId: string;
  nickname: string;
  discordId: string | null;
  discordAvatar: string | null;
  /** Valeur brute qui a fait gagner (frags/match, ΔELO, nb de games…). */
  value: number;
  punchline: string;
}

export interface WrappedResponse {
  year: number;
  month: number; // 1-12
  /** Vide si personne d'éligible (mois sans matchs). */
  awards: AwardWinner[];
}

/** Percentiles 0-100 vs les membres du pôle actifs sur le mois. */
export interface WrappedPercentiles {
  matches: number;
  winRate: number;
  kd: number;
  adr: number;
}

export interface PlayerWrappedResponse {
  year: number;
  month: number;
  playerId: string;
  nickname: string;
  discordId: string | null;
  discordAvatar: string | null;
  matches: number;
  wins: number;
  winRate: number; // 0-100
  /** Map la plus jouée du mois, null si aucun match. */
  topMap: { map: string; matches: number; winRate: number } | null;
  /** Minutes CS2 jouées sur le mois (Steam), null si privé / pas encore tracké. */
  playtimeMinutes: number | null;
  /** Évolution d'ELO sur le mois, null si pas assez de snapshots. */
  elo: { start: number; end: number; delta: number } | null;
  /** null si le joueur n'a pas joué ce mois-ci. */
  percentiles: WrappedPercentiles | null;
  /** Ses awards du mois (sous-ensemble de WrappedResponse.awards). */
  awards: AwardWinner[];
}

/** BIG Wrapped (B7.12) - Wrapped longue période, `period` = "2026" | "2026-H1" | "2026-H2". */
export interface BigWrappedResponse {
  period: string;
  /** Vide si personne d'éligible (période sans matchs). */
  awards: AwardWinner[];
}

/** BIG Wrapped perso - mêmes stats que le mensuel, indexées sur une période longue. */
export type PlayerBigWrappedResponse = { period: string } & Omit<PlayerWrappedResponse, "year" | "month">;
