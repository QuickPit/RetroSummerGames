// Zielwerte LEICHT (Spec RSG-02): Spieler-Modelle aus derselben Fabrik wie die Gegner,
// 80 Wettbewerbe je Zeile mit festem Seed. Aufgeteilt nach Stufen, damit die Dateien parallel laufen.

import { describe, expect, it } from 'vitest';
import {
  BALANCE_EVENTS,
  PLAYER_DIVES,
  competitionRates,
  eventRunner,
  opponentMeans,
  quotas,
  simulateRow,
  strongerIsBetter,
  type BalanceEvent,
  type BalanceRow,
  type Entrant,
  type RowOutcomes,
} from './balance';
import { createRng } from './cpu';
import { DIVE } from './dive';
import { SWIM } from './swim';

const TIMEOUT = { timeout: 60_000 };
const ROWS = {
  easy6: { d: 'easy', seed: 1, player: { skill: { rate: 6, error: 1 }, dives: PLAYER_DIVES.steady } },
  easy8: { d: 'easy', seed: 2, player: { skill: { rate: 8, error: 1 }, dives: PLAYER_DIVES.steady } },
} as const satisfies Record<string, BalanceRow>;

const cache = new Map<keyof typeof ROWS, RowOutcomes>();
const outcomes = (key: keyof typeof ROWS) => cache.get(key) ?? cache.set(key, simulateRow(ROWS[key], 80)).get(key)!;

/** Prüft ein Kriterium in allen 6 Disziplinen und nennt im Fehlerfall die Disziplin */
function each(key: keyof typeof ROWS, check: (q: { medal: number; gold: number }) => boolean): void {
  const q = quotas(outcomes(key));
  expect(BALANCE_EVENTS.filter((ev) => !check(q[ev])).map((ev) => `${ev} ${JSON.stringify(q[ev])}`)).toEqual([]);
}

describe('LEICHT', () => {
  it('6/s ordentlich: Medaille ≥ 80 % in jeder Disziplin', TIMEOUT, () => each('easy6', (q) => q.medal >= 0.8));
  it('8/s ordentlich: Gold ≥ 40 % in jeder Disziplin', TIMEOUT, () => each('easy8', (q) => q.gold >= 0.4));
  it('Ø Rookie < Profi < Champion', TIMEOUT, () => {
    const means = opponentMeans(outcomes('easy6'));
    for (const ev of BALANCE_EVENTS) expect([ev, strongerIsBetter(ev, means[ev]), means[ev]]).toEqual([ev, true, means[ev]]);
  });
  it('Wettkampf 6/s: Podest ≥ 90 %', TIMEOUT, () =>
    expect(competitionRates(outcomes('easy6'), 'easy').podium).toBeGreaterThanOrEqual(0.9));
  it('Wettkampf 8/s: Gesamtsieg ≥ 80 %', TIMEOUT, () =>
    expect(competitionRates(outcomes('easy8'), 'easy').win).toBeGreaterThanOrEqual(0.8));
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
      expect([ev, records(ev, { skill: { rate: 8, error: 1 }, dives: PLAYER_DIVES.steady }, 11)]).toEqual([ev, 0]);
    }
  });

  it('10/s nahezu perfekt schafft Hürden oder Weitsprung mindestens einmal', TIMEOUT, () => {
    const perfect: Entrant = { skill: { rate: 10, error: 0.33 }, dives: PLAYER_DIVES.perfect };
    expect(records('110h', perfect, 12) + records('long', perfect, 13)).toBeGreaterThan(0);
  });
});
