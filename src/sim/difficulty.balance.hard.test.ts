// Zielwerte SCHWER (Spec RSG-02): Spieler-Modelle aus derselben Fabrik wie die Gegner,
// 80 Wettbewerbe je Zeile mit festem Seed (siehe difficulty.balance.easy.test.ts).

import { describe, expect, it } from 'vitest';
import {
  BALANCE_EVENTS,
  PLAYER_DIVES,
  competitionRates,
  opponentMeans,
  quotas,
  simulateRow,
  strongerIsBetter,
  type BalanceRow,
  type RowOutcomes,
} from './balance';

const TIMEOUT = { timeout: 60_000 };
const ROWS = {
  hard8: { d: 'hard', seed: 5, player: { skill: { rate: 8, error: 1 }, dives: PLAYER_DIVES.steady } },
  hard10: { d: 'hard', seed: 6, player: { skill: { rate: 10, error: 1 }, dives: PLAYER_DIVES.steady } },
  hard10good: { d: 'hard', seed: 7, player: { skill: { rate: 10, error: 0.67 }, dives: PLAYER_DIVES.good } },
  hard10perfect: { d: 'hard', seed: 8, player: { skill: { rate: 10, error: 0.33 }, dives: PLAYER_DIVES.perfect } },
} as const satisfies Record<string, BalanceRow>;

const cache = new Map<keyof typeof ROWS, RowOutcomes>();
const outcomes = (key: keyof typeof ROWS) => cache.get(key) ?? cache.set(key, simulateRow(ROWS[key], 80)).get(key)!;

/** Prüft ein Kriterium in allen 6 Disziplinen und nennt im Fehlerfall die Disziplin */
function each(key: keyof typeof ROWS, check: (q: { medal: number; gold: number }) => boolean): void {
  const q = quotas(outcomes(key));
  expect(BALANCE_EVENTS.filter((ev) => !check(q[ev])).map((ev) => `${ev} ${JSON.stringify(q[ev])}`)).toEqual([]);
}

describe('SCHWER', () => {
  it('8/s ordentlich: Medaille ≤ 50 % in jeder Disziplin', TIMEOUT, () => each('hard8', (q) => q.medal <= 0.5));
  it('10/s ordentlich: Gold ≤ 30 % in jeder Disziplin', TIMEOUT, () => each('hard10', (q) => q.gold <= 0.3));
  it('10/s nahezu perfekt: Gold 30–85 % in jeder Disziplin', TIMEOUT, () =>
    each('hard10perfect', (q) => q.gold >= 0.3 && q.gold <= 0.85));
  it('Ø Rookie < Profi < Champion', TIMEOUT, () => {
    const means = opponentMeans(outcomes('hard8'));
    for (const ev of BALANCE_EVENTS) expect([ev, strongerIsBetter(ev, means[ev]), means[ev]]).toEqual([ev, true, means[ev]]);
  });
  it('Wettkampf 8/s: Podest ≤ 35 %', TIMEOUT, () =>
    expect(competitionRates(outcomes('hard8'), 'hard').podium).toBeLessThanOrEqual(0.35));
  it('Wettkampf 10/s gut: Gesamtsieg ≤ 35 %', TIMEOUT, () =>
    expect(competitionRates(outcomes('hard10good'), 'hard').win).toBeLessThanOrEqual(0.35));
  it('Wettkampf 10/s nahezu perfekt: Gesamtsieg ≥ 50 %', TIMEOUT, () =>
    expect(competitionRates(outcomes('hard10perfect'), 'hard').win).toBeGreaterThanOrEqual(0.5));
});
