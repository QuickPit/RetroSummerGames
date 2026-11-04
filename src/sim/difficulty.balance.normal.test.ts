// Zielwerte NORMAL (Spec RSG-02): Spieler-Modelle aus derselben Fabrik wie die Gegner,
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
import { createRng } from './cpu';
import { DIFFICULTIES } from './difficulty';
import { DIVES, cpuDiveRate, diveCpuProfiles, simulateCpuDive } from './dive';

const TIMEOUT = { timeout: 60_000 };
const ROWS = {
  normal8: { d: 'normal', seed: 3, player: { skill: { rate: 8, error: 1 }, dives: PLAYER_DIVES.steady } },
  normal9good: { d: 'normal', seed: 4, player: { skill: { rate: 9, error: 0.67 }, dives: PLAYER_DIVES.good } },
} as const satisfies Record<string, BalanceRow>;

const cache = new Map<keyof typeof ROWS, RowOutcomes>();
const outcomes = (key: keyof typeof ROWS) => cache.get(key) ?? cache.set(key, simulateRow(ROWS[key], 80)).get(key)!;

/** Prüft ein Kriterium in allen 6 Disziplinen und nennt im Fehlerfall die Disziplin */
function each(key: keyof typeof ROWS, check: (q: { medal: number; gold: number }) => boolean): void {
  const q = quotas(outcomes(key));
  expect(BALANCE_EVENTS.filter((ev) => !check(q[ev])).map((ev) => `${ev} ${JSON.stringify(q[ev])}`)).toEqual([]);
}

describe('NORMAL', () => {
  it('8/s ordentlich: Medaille ≥ 65 %, Gold ≤ 30 % in jeder Disziplin', TIMEOUT, () =>
    each('normal8', (q) => q.medal >= 0.65 && q.gold <= 0.3));
  it('9/s gut: Gold 25–75 % in jeder Disziplin', TIMEOUT, () =>
    each('normal9good', (q) => q.gold >= 0.25 && q.gold <= 0.75));
  it('Ø Rookie < Profi < Champion', TIMEOUT, () => {
    const means = opponentMeans(outcomes('normal8'));
    for (const ev of BALANCE_EVENTS) expect([ev, strongerIsBetter(ev, means[ev]), means[ev]]).toEqual([ev, true, means[ev]]);
  });
  it('Wettkampf 8/s: Podest ≥ 80 %, Gesamtsieg ≤ 10 %', TIMEOUT, () => {
    const r = competitionRates(outcomes('normal8'), 'normal');
    expect(r.podium).toBeGreaterThanOrEqual(0.8);
    expect(r.win).toBeLessThanOrEqual(0.1);
  });
  it('Wettkampf 9/s gut: Gesamtsieg 35–85 %', TIMEOUT, () => {
    const r = competitionRates(outcomes('normal9good'), 'normal');
    expect(r.win).toBeGreaterThanOrEqual(0.35);
    expect(r.win).toBeLessThanOrEqual(0.85);
  });
});

describe('Turm-Sprunglisten (DIVE_CPU_DIVES)', () => {
  it('sind die Sprünge mit dem besten Erwartungswert (Toleranz 5 Punkte)', TIMEOUT, () => {
    // Je Profil und Sprung 100 Versuche mit Tagesform; gewählt sein sollen die besten drei
    for (const d of DIFFICULTIES) {
      for (const p of diveCpuProfiles(d)) {
        const rng = createRng(21);
        const ev = new Map(
          DIVES.map((def) => {
            let sum = 0;
            for (let i = 0; i < 100; i++) sum += simulateCpuDive(p, def, rng, cpuDiveRate(p, rng)).points;
            return [def.id, sum / 100] as const;
          }),
        );
        const third = [...ev.values()].sort((a, b) => b - a)[2];
        const weak = p.dives.filter((id) => ev.get(id)! < third - 5);
        expect([d, p.name, weak]).toEqual([d, p.name, []]);
      }
    }
  });
});
