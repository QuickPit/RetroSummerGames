// Zielwerte des Schwierigkeitsgrads (Spec RSG-02): Spieler-Modelle aus derselben Fabrik
// wie die Gegner treten gegen jede Stufe an – fester Seed, Toleranzen wie in der Spec.

import { describe, expect, it } from 'vitest';
import {
  BALANCE_EVENTS,
  eventRunner,
  hasGold,
  hasMedal,
  versusField,
  type BalanceEvent,
  type Entrant,
  type EventOutcome,
} from './balance';
import { COMPETITION_ORDER, ceremonyPodium, createCompetition, overallWinners, recordEvent, medalTable } from './competition';
import { createRng } from './cpu';
import { DIFFICULTIES, type Difficulty } from './difficulty';
import { DIVE, type DiveId } from './dive';
import { SWIM } from './swim';

const RUNS = 80;
const TIMEOUT = { timeout: 60_000 };

// Turm-Sprunglisten der Spieler-Modelle (die 3 mit dem besten Erwartungswert)
const STEADY: DiveId[] = ['15s2', '35h', '25p'];
const GOOD: DiveId[] = ['35h', '45h', '15s2'];
const PERFECT: DiveId[] = ['45h', '35h', '25p'];

interface Row {
  d: Difficulty;
  player: Entrant;
}

const ROWS = {
  easy6: { d: 'easy', player: { skill: { rate: 6, error: 1 }, dives: STEADY } },
  easy8: { d: 'easy', player: { skill: { rate: 8, error: 1 }, dives: STEADY } },
  normal8: { d: 'normal', player: { skill: { rate: 8, error: 1 }, dives: STEADY } },
  normal9good: { d: 'normal', player: { skill: { rate: 9, error: 0.67 }, dives: GOOD } },
  hard8: { d: 'hard', player: { skill: { rate: 8, error: 1 }, dives: STEADY } },
  hard10: { d: 'hard', player: { skill: { rate: 10, error: 1 }, dives: STEADY } },
  hard10good: { d: 'hard', player: { skill: { rate: 10, error: 0.67 }, dives: GOOD } },
  hard10perfect: { d: 'hard', player: { skill: { rate: 10, error: 0.33 }, dives: PERFECT } },
} as const satisfies Record<string, Row>;
type RowKey = keyof typeof ROWS;

// Jede Zeile wird nur einmal simuliert und von mehreren Prüfungen genutzt
const cache = new Map<RowKey, Record<BalanceEvent, EventOutcome[]>>();
function outcomes(key: RowKey): Record<BalanceEvent, EventOutcome[]> {
  let result = cache.get(key);
  if (!result) {
    const row: Row = ROWS[key];
    const seed = Object.keys(ROWS).indexOf(key) + 1;
    result = {} as Record<BalanceEvent, EventOutcome[]>;
    for (const ev of BALANCE_EVENTS) {
      const run = eventRunner(ev, versusField(row.player, row.d));
      const rng = createRng(seed * 100 + BALANCE_EVENTS.indexOf(ev));
      result[ev] = Array.from({ length: RUNS }, () => run(rng));
    }
    cache.set(key, result);
  }
  return result;
}

const rate = (list: EventOutcome[], f: (o: EventOutcome) => boolean) => list.filter(f).length / list.length;

/** Medaillen- und Goldquote je Disziplin */
function quotas(key: RowKey): Record<BalanceEvent, { medal: number; gold: number }> {
  const all = outcomes(key);
  return Object.fromEntries(
    BALANCE_EVENTS.map((ev) => [ev, { medal: rate(all[ev], (o) => hasMedal(o)), gold: rate(all[ev], (o) => hasGold(o)) }]),
  ) as Record<BalanceEvent, { medal: number; gold: number }>;
}

/** Prüft ein Kriterium in allen 6 Disziplinen und nennt im Fehlerfall die Disziplin */
function each(key: RowKey, check: (q: { medal: number; gold: number }) => boolean): void {
  const q = quotas(key);
  const failed = BALANCE_EVENTS.filter((ev) => !check(q[ev])).map((ev) => `${ev} ${JSON.stringify(q[ev])}`);
  expect(failed).toEqual([]);
}

describe('Zielwerte je Disziplin (80 Wettbewerbe je Zeile)', () => {
  it('LEICHT, 6/s ordentlich: Medaille ≥ 80 %', TIMEOUT, () => each('easy6', (q) => q.medal >= 0.8));
  it('LEICHT, 8/s ordentlich: Gold ≥ 40 %', TIMEOUT, () => each('easy8', (q) => q.gold >= 0.4));
  it('NORMAL, 8/s ordentlich: Medaille ≥ 65 %, Gold ≤ 30 %', TIMEOUT, () =>
    each('normal8', (q) => q.medal >= 0.65 && q.gold <= 0.3));
  it('NORMAL, 9/s gut: Gold 25–75 %', TIMEOUT, () => each('normal9good', (q) => q.gold >= 0.25 && q.gold <= 0.75));
  it('SCHWER, 8/s ordentlich: Medaille ≤ 50 %', TIMEOUT, () => each('hard8', (q) => q.medal <= 0.5));
  it('SCHWER, 10/s ordentlich: Gold ≤ 30 %', TIMEOUT, () => each('hard10', (q) => q.gold <= 0.3));
  it('SCHWER, 10/s nahezu perfekt: Gold 30–85 %', TIMEOUT, () =>
    each('hard10perfect', (q) => q.gold >= 0.3 && q.gold <= 0.85));

  it('in jeder Stufe gilt Ø Rookie < Profi < Champion', TIMEOUT, () => {
    const lowerIsBetter: Partial<Record<BalanceEvent, boolean>> = { '110h': true, swim: true };
    const rowsOf = (d: Difficulty) => (Object.keys(ROWS) as RowKey[]).filter((k) => ROWS[k].d === d).slice(0, 1);
    for (const d of DIFFICULTIES) {
      for (const ev of BALANCE_EVENTS) {
        const list = rowsOf(d).flatMap((k) => outcomes(k)[ev]);
        const means = [1, 2, 3].map((i) => {
          const v = list.map((o) => o.values[i]).filter((x): x is number => x !== null);
          return v.reduce((a, b) => a + b, 0) / v.length;
        });
        const ordered = lowerIsBetter[ev] ? means[0] > means[1] && means[1] > means[2] : means[0] < means[1] && means[1] < means[2];
        expect([d, ev, ordered, means]).toEqual([d, ev, true, means]);
      }
    }
  });
});

describe('Wettkampf (Ränge je Disziplin zufällig kombiniert, 2000 Wettkämpfe)', () => {
  const CODES = ['P', 'R', 'F', 'C'];

  function competitions(key: RowKey): { podium: number; win: number } {
    const all = outcomes(key);
    const rng = createRng(4242);
    let podium = 0;
    let win = 0;
    const n = 2000;
    for (let k = 0; k < n; k++) {
      let s = createCompetition('P', CODES, rng, 1, ROWS[key].d);
      for (const ev of COMPETITION_ORDER) {
        const o = all[ev][Math.floor(rng() * RUNS)];
        // Teilnehmer i tritt immer für dieselbe Nation an
        s = recordEvent(s, ev, o.order.map((i) => ({ code: CODES[i], valid: o.valid[i] })));
      }
      if (ceremonyPodium(s).some((g) => g.codes.includes('P'))) podium++;
      if (overallWinners(s).includes('P')) win++;
      expect(medalTable(s)).toHaveLength(4);
    }
    return { podium: podium / n, win: win / n };
  }

  it('LEICHT, 6/s: Podest ≥ 90 %', TIMEOUT, () => expect(competitions('easy6').podium).toBeGreaterThanOrEqual(0.9));
  it('LEICHT, 8/s: Gesamtsieg ≥ 80 %', TIMEOUT, () => expect(competitions('easy8').win).toBeGreaterThanOrEqual(0.8));
  it('NORMAL, 8/s: Podest ≥ 80 %, Gesamtsieg ≤ 10 %', TIMEOUT, () => {
    const r = competitions('normal8');
    expect(r.podium).toBeGreaterThanOrEqual(0.8);
    expect(r.win).toBeLessThanOrEqual(0.1);
  });
  it('NORMAL, 9/s gut: Gesamtsieg 35–85 %', TIMEOUT, () => {
    const r = competitions('normal9good');
    expect(r.win).toBeGreaterThanOrEqual(0.35);
    expect(r.win).toBeLessThanOrEqual(0.85);
  });
  it('SCHWER, 8/s: Podest ≤ 35 %', TIMEOUT, () => expect(competitions('hard8').podium).toBeLessThanOrEqual(0.35));
  it('SCHWER, 10/s gut: Gesamtsieg ≤ 35 %', TIMEOUT, () => expect(competitions('hard10good').win).toBeLessThanOrEqual(0.35));
  it('SCHWER, 10/s nahezu perfekt: Gesamtsieg ≥ 50 %', TIMEOUT, () =>
    expect(competitions('hard10perfect').win).toBeGreaterThanOrEqual(0.5));
});

describe('Weltrekorde bleiben besonders (je 100 Läufe allein)', () => {
  const RECORD: Partial<Record<BalanceEvent, (v: number) => boolean>> = {
    '110h': (v) => v < 12.8,
    long: (v) => v > 8.95,
    swim: (v) => v < SWIM.worldRecord,
    dive: (v) => v > DIVE.worldRecord,
  };

  function records(ev: BalanceEvent, player: Entrant, seed: number): number {
    const run = eventRunner(ev, [player]);
    const rng = createRng(seed);
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const v = run(rng).values[0];
      if (v !== null && RECORD[ev]!(v)) n++;
    }
    return n;
  }

  it('8/s ordentlich bricht keinen Weltrekord', TIMEOUT, () => {
    for (const ev of ['110h', 'long', 'swim', 'dive'] as const) {
      expect([ev, records(ev, { skill: { rate: 8, error: 1 }, dives: STEADY }, 11)]).toEqual([ev, 0]);
    }
  });

  it('10/s nahezu perfekt schafft Hürden oder Weitsprung mindestens einmal', TIMEOUT, () => {
    const perfect: Entrant = { skill: { rate: 10, error: 0.33 }, dives: PERFECT };
    expect(records('110h', perfect, 12) + records('long', perfect, 13)).toBeGreaterThan(0);
  });
});
