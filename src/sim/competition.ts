// Wettkampfmodus „Die Spiele“: festes Teilnehmerfeld über alle Disziplinen,
// Medaillen je Disziplin und Medaillenspiegel der Nationen.

import type { EventKey } from '../data/events';

export const COMPETITION = {
  opponents: 3, // + Spieler = 4, wie in allen Disziplinen
  medalBlinkMs: 400, // Blinken der neuen Medaillen in `medals`
  confirmDefault: 'no',
} as const;

export const COMPETITION_ORDER = ['110h', 'long', 'pole', 'swim', 'bmx'] as const satisfies readonly EventKey[];

export type Medal = 'gold' | 'silver' | 'bronze';
const MEDALS: readonly Medal[] = ['gold', 'silver', 'bronze'];

export interface FieldEntry {
  code: string;
  isPlayer: boolean;
  /** Index in den `*_CPU_PROFILES` (Rookie/Profi/Champion), null = Spieler */
  profile: 0 | 1 | 2 | null;
  lookSeed: number;
}

export interface Placing {
  code: string;
  /** 1..4 */
  place: number;
  valid: boolean;
}

export interface CompetitionState {
  /** Spieler + 3 Gegner, fest für den ganzen Wettkampf */
  field: FieldEntry[];
  /** Nächste/aktuelle Disziplin in COMPETITION_ORDER */
  index: number;
  results: Partial<Record<EventKey, Placing[]>>;
}

export interface MedalRow {
  code: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  /** Gleiche Medaillen = gleicher Rang („1, 2, 2, 4“) */
  rank: number;
}

/** Zieht 3 Gegner-Nationen und verteilt jedes Profil genau einmal. */
export function createCompetition(
  playerCode: string,
  pool: readonly string[],
  rng: () => number,
  playerLook: number,
): CompetitionState {
  const shuffle = <T,>(list: T[]): T[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const others = shuffle([...new Set(pool)].filter((c) => c !== playerCode));
  if (others.length < COMPETITION.opponents) throw new Error('Zu wenige Nationen für einen Wettkampf');
  const profiles = shuffle([0, 1, 2] as (0 | 1 | 2)[]);
  const field: FieldEntry[] = [{ code: playerCode, isPlayer: true, profile: null, lookSeed: playerLook }];
  for (let i = 0; i < COMPETITION.opponents; i++) {
    field.push({ code: others[i], isPlayer: false, profile: profiles[i], lookSeed: Math.floor(rng() * 1e9) });
  }
  return { field, index: 0, results: {} };
}

/** null = alle Disziplinen gespielt */
export function currentEvent(s: CompetitionState): EventKey | null {
  return COMPETITION_ORDER[s.index] ?? null;
}

/**
 * Trägt das Ergebnis der aktuellen Disziplin ein (rows bereits nach Platz sortiert).
 * Idempotent: ein zweiter Aufruf und eine falsche Disziplin ändern nichts.
 */
export function recordEvent(
  s: CompetitionState,
  event: EventKey,
  rows: readonly { code: string; valid: boolean }[],
): CompetitionState {
  if (s.results[event] || currentEvent(s) !== event) return s;
  const placings = rows.map((r, i) => ({ code: r.code, place: i + 1, valid: r.valid }));
  return { ...s, index: s.index + 1, results: { ...s.results, [event]: placings } };
}

/** Medaillen wie auf dem Podest: Platz 1–3, aber nur für gültige Leistungen (kein Nachrücken). */
export function medalsOf(rows: readonly { code: string; valid: boolean }[]): Map<string, Medal> {
  const medals = new Map<string, Medal>();
  rows.slice(0, MEDALS.length).forEach((r, i) => {
    if (r.valid) medals.set(r.code, MEDALS[i]);
  });
  return medals;
}

/** Medaillenspiegel: Gold > Silber > Bronze, bei Gleichstand gleicher Rang und Anzeige A–Z. */
export function medalTable(s: CompetitionState): MedalRow[] {
  const rows = s.field.map((f) => ({ code: f.code, gold: 0, silver: 0, bronze: 0, total: 0, rank: 0 }));
  for (const key of COMPETITION_ORDER) {
    const placings = s.results[key];
    if (!placings) continue;
    for (const [code, medal] of medalsOf(placings)) {
      const row = rows.find((r) => r.code === code);
      if (!row) continue;
      row[medal]++;
      row.total++;
    }
  }
  const compare = (a: MedalRow, b: MedalRow) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze;
  rows.sort((a, b) => compare(a, b) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  for (const r of rows) r.rank = 1 + rows.filter((o) => compare(o, r) < 0).length;
  return rows;
}

/** Alle Nationen auf Platz 1 – [] wenn noch niemand eine Medaille hat. */
export function overallWinners(s: CompetitionState): string[] {
  return medalTable(s)
    .filter((r) => r.rank === 1 && r.total > 0)
    .map((r) => r.code);
}

/** Platzierung einer Nation in einer Disziplin, undefined = noch offen */
export function placingOf(s: CompetitionState, event: EventKey, code: string): Placing | undefined {
  return s.results[event]?.find((p) => p.code === code);
}

export interface PlayerStanding {
  /** noMedals = noch niemand hat eine Medaille, dann gibt es auch keine Spitze */
  kind: 'noMedals' | 'leader' | 'tied' | 'behind';
  rank: number;
}

/** Wo steht der Spieler im Medaillenspiegel? Grundlage für die Rückmeldung in `medals`. */
export function playerStanding(s: CompetitionState): PlayerStanding {
  const table = medalTable(s);
  const code = s.field.find((f) => f.isPlayer)?.code;
  const me = table.find((r) => r.code === code) ?? table[table.length - 1];
  if (table.every((r) => r.total === 0)) return { kind: 'noMedals', rank: me.rank };
  if (me.rank > 1) return { kind: 'behind', rank: me.rank };
  return { kind: table.filter((r) => r.rank === 1).length === 1 ? 'leader' : 'tied', rank: 1 };
}

export interface PodiumGroup {
  /** Rang im Medaillenspiegel (1–3, bei Gleichstand „1, 1, 3“) */
  rank: number;
  /** Nationen auf dieser Stufe, A–Z */
  codes: string[];
}

/**
 * Podest der Abschlussfeier: Ränge 1–3 des Medaillenspiegels, Gleichstand teilt sich die Stufe.
 * Nationen ohne Medaille kommen nicht aufs Podest – ohne jede Medaille ist es leer.
 */
export function ceremonyPodium(s: CompetitionState): PodiumGroup[] {
  const groups: PodiumGroup[] = [];
  for (const row of medalTable(s)) {
    if (row.rank > 3 || row.total === 0) continue;
    const group = groups.find((g) => g.rank === row.rank);
    if (group) group.codes.push(row.code);
    else groups.push({ rank: row.rank, codes: [row.code] });
  }
  return groups;
}
