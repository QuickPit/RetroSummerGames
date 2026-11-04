// Balancing-Werkzeug: ganze Wettbewerbe einer Disziplin ohne Grafik, in denen auch der
// „Spieler“ ein Profil aus derselben Fabrik ist ({rate, error}). Grundlage der Zielwerte in
// difficulty.balance.test.ts – das Spiel selbst importiert diese Datei nicht.

import { BmxCpu, bmxCpuProfile, createRider, startRider, stepRider, totalScore } from './bmx';
import { CpuController, hurdleCpuProfile } from './cpu';
import { DIFFICULTY_SCALE, withForm, type CpuSkill, type Difficulty } from './difficulty';
import { cpuDiveRate, diveById, diveCpuProfile, DIVE_CPU_DIVES, simulateCpuDive, type DiveId } from './dive';
import { createRunner, step } from './hurdles';
import { cpuJump, createJumper, jumpCpuProfile, rankJumpers, ROUNDS } from './longjump';
import { bestHeightIndex, Competition, cpuAttempt, createVaulter, HEIGHTS, vaultCpuProfile } from './polevault';
import { simulateRace, swimCpuProfile } from './swim';

export const BALANCE_EVENTS = ['110h', 'long', 'pole', 'swim', 'dive', 'bmx'] as const;
export type BalanceEvent = (typeof BALANCE_EVENTS)[number];

/** Ein Teilnehmer: Stärke und (nur Turm) die eigene Sprungliste */
export interface Entrant {
  skill: CpuSkill;
  dives?: readonly DiveId[];
}

export interface EventOutcome {
  /** Teilnehmer-Indizes in der Reihenfolge der Plätze */
  order: number[];
  /** Je Teilnehmer: gültige Leistung? */
  valid: boolean[];
  /** Je Teilnehmer: Zeit, Weite, Höhe oder Punkte (null = ungültig) */
  values: (number | null)[];
}

const DT = 1 / 120;

/** Spieler (Index 0) gegen das Feld einer Stufe */
export function versusField(player: Entrant, d: Difficulty): Entrant[] {
  return [player, ...DIFFICULTY_SCALE[d].map((skill, i) => ({ skill, dives: DIVE_CPU_DIVES[d][i] }))];
}

/** Plätze nach Wert; `better(a, b)` = a liegt vor b. Bei Gleichstand behält der kleinere Index den Vortritt. */
function placeBy(values: (number | null)[], better: (a: number, b: number) => boolean): number[] {
  const idx = values.map((_, i) => i);
  return idx.sort((a, b) => {
    const va = values[a];
    const vb = values[b];
    if (va === null || vb === null) return (va === null ? 1 : 0) - (vb === null ? 1 : 0);
    return better(va, vb) ? -1 : better(vb, va) ? 1 : 0;
  });
}

/**
 * Baut die Profile einmal (Stab: Einstiegshöhe über 40 Probesprünge) und liefert eine
 * Funktion, die einen ganzen Wettbewerb simuliert.
 */
export function eventRunner(event: BalanceEvent, entrants: readonly Entrant[]): (rng: () => number) => EventOutcome {
  const name = (i: number) => `T${i}`;
  switch (event) {
    case '110h': {
      const profiles = entrants.map((e, i) => hurdleCpuProfile(e.skill, name(i)));
      return (rng) => {
        const runners = profiles.map(() => createRunner());
        const cpus = profiles.map((p, i) => new CpuController(runners[i], p, rng));
        let t = 0;
        while (runners.some((r) => r.finishTime === null) && t < 60) {
          t += DT;
          cpus.forEach((c, i) => {
            c.update(t);
            step(runners[i], DT, t);
          });
        }
        const values = runners.map((r) => r.finishTime);
        return { order: placeBy(values, (a, b) => a < b), valid: values.map((v) => v !== null), values };
      };
    }
    case 'long': {
      const profiles = entrants.map((e, i) => jumpCpuProfile(e.skill, name(i)));
      return (rng) => {
        const jumpers = profiles.map((p, i) => {
          const j = createJumper(i, i === 0);
          const formed = withForm(p, rng);
          for (let r = 0; r < ROUNDS; r++) j.attempts[r] = cpuJump(formed, rng);
          return j;
        });
        const best = jumpers.map((j) => {
          const valid = j.attempts.filter((a): a is number => typeof a === 'number');
          return valid.length ? Math.max(...valid) : null;
        });
        return { order: rankJumpers(jumpers).map((j) => j.id), valid: best.map((b) => b !== null), values: best };
      };
    }
    case 'pole': {
      const profiles = entrants.map((e, i) => vaultCpuProfile(e.skill, name(i)));
      return (rng) => {
        const formed = profiles.map((p) => withForm(p, rng));
        const vaulters = formed.map((p, i) => createVaulter(i, i === 0, p.opening));
        const c = new Competition(vaulters);
        for (let turn = c.nextTurn(); turn; turn = c.nextTurn()) {
          c.record(turn.vaulter, cpuAttempt(formed[turn.vaulter.id], c.height, rng));
        }
        const values = vaulters.map((v) => {
          const i = bestHeightIndex(v);
          return i < 0 ? null : HEIGHTS[i];
        });
        return { order: c.ranking().map((v) => v.id), valid: values.map((v) => v !== null), values };
      };
    }
    case 'swim': {
      const profiles = entrants.map((e, i) => swimCpuProfile(e.skill, name(i)));
      return (rng) => {
        const values = profiles.map((p) => simulateRace(p, Math.floor(rng() * 2 ** 31)).finishTime);
        return { order: placeBy(values, (a, b) => a < b), valid: values.map((v) => v !== null), values };
      };
    }
    case 'dive': {
      const profiles = entrants.map((e, i) => diveCpuProfile(e.skill, name(i), e.dives ?? ['15s2', '35h', '25p']));
      return (rng) => {
        const values = profiles.map((p) => {
          const rate = cpuDiveRate(p, rng);
          return p.dives.reduce((sum, id) => sum + simulateCpuDive(p, diveById(id), rng, rate).points, 0);
        });
        return { order: placeBy(values, (a, b) => a > b), valid: values.map(() => true), values };
      };
    }
    case 'bmx': {
      const profiles = entrants.map((e, i) => bmxCpuProfile(e.skill, name(i)));
      return (rng) => {
        const values = profiles.map((p) => {
          const s = createRider();
          startRider(s);
          const cpu = new BmxCpu(s, p, rng);
          let t = 0;
          while (s.phase !== 'finished' && s.phase !== 'out' && t < 90) {
            t += DT;
            cpu.update(t);
            stepRider(s, DT, t);
          }
          return s.finishTime !== null ? totalScore(s) : null;
        });
        return { order: placeBy(values, (a, b) => a > b), valid: values.map((v) => v !== null), values };
      };
    }
  }
}

/** Platz des Teilnehmers (1..n) */
export function placeOf(o: EventOutcome, index = 0): number {
  return o.order.indexOf(index) + 1;
}

/** Medaille = gültig und Platz 1–3, Gold = gültig und Platz 1 */
export function hasMedal(o: EventOutcome, index = 0): boolean {
  return o.valid[index] && placeOf(o, index) <= 3;
}

export function hasGold(o: EventOutcome, index = 0): boolean {
  return o.valid[index] && placeOf(o, index) === 1;
}
