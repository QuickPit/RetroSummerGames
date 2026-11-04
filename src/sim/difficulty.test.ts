import { describe, expect, it } from 'vitest';
import { BMX_CPU_PROFILES, bmxCpuProfiles } from './bmx';
import { CPU_PROFILES, createRng, hurdleCpuProfiles } from './cpu';
import {
  CPU_NAMES,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  DIFFICULTY_SCALE,
  cpuJitter,
  cpuReaction,
  isDifficulty,
  withForm,
  type Difficulty,
} from './difficulty';
import { DIVE_CPU_DIVES, DIVE_CPU_PROFILES, DIVES, diveCpuProfiles } from './dive';
import { LJ_CPU_PROFILES, jumpCpuProfiles } from './longjump';
import { HEIGHTS, VAULT_CPU_PROFILES, vaultCpuProfiles } from './polevault';
import { SWIM_CPU_PROFILES, swimCpuProfiles } from './swim';

/** Alle Fabriken mit ihrer NORMAL-Konstante */
const FACTORIES: [string, (d: Difficulty) => readonly { name: string; tapRate: number }[], readonly { name: string }[]][] = [
  ['Hürden', hurdleCpuProfiles, CPU_PROFILES],
  ['Weitsprung', jumpCpuProfiles, LJ_CPU_PROFILES],
  ['Stabhoch', vaultCpuProfiles, VAULT_CPU_PROFILES],
  ['Schwimmen', swimCpuProfiles, SWIM_CPU_PROFILES],
  ['Turm', diveCpuProfiles, DIVE_CPU_PROFILES],
  ['BMX', bmxCpuProfiles, BMX_CPU_PROFILES],
];

describe('Stufen', () => {
  it('heißen LEICHT/NORMAL/SCHWER, Standard ist NORMAL', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard']);
    expect(DIFFICULTIES.map((d) => DIFFICULTY_LABEL[d])).toEqual(['LEICHT', 'NORMAL', 'SCHWER']);
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    expect(isDifficulty('hard')).toBe(true);
    expect(isDifficulty('extrem')).toBe(false);
    expect(isDifficulty(null)).toBe(false);
  });

  it('sind geordnet: in jeder Stufe steigt die Tipprate und fällt der Fehler von Rookie zu Champion', () => {
    for (const d of DIFFICULTIES) {
      const s = DIFFICULTY_SCALE[d];
      expect(s).toHaveLength(3);
      for (let i = 1; i < 3; i++) {
        expect(s[i].rate).toBeGreaterThan(s[i - 1].rate);
        expect(s[i].error).toBeLessThan(s[i - 1].error);
      }
    }
  });

  it('sind über die Stufen geordnet: easy < normal < hard bei der Rate, umgekehrt beim Fehler', () => {
    for (let i = 0; i < 3; i++) {
      const [e, n, h] = DIFFICULTIES.map((d) => DIFFICULTY_SCALE[d][i]);
      expect(e.rate).toBeLessThan(n.rate);
      expect(n.rate).toBeLessThan(h.rate);
      expect(e.error).toBeGreaterThan(n.error);
      expect(n.error).toBeGreaterThan(h.error);
    }
  });
});

describe('Gegner-Modell', () => {
  it('leitet Tipp-Schwankung und Reaktion aus dem Fehlerfaktor ab (begrenzt)', () => {
    expect(cpuJitter(1)).toBeCloseTo(0.2, 9);
    expect(cpuJitter(0.4)).toBeCloseTo(0.092, 9);
    expect(cpuJitter(0)).toBe(0.04);
    expect(cpuJitter(5)).toBe(0.3);
    expect(cpuReaction(1)).toBeCloseTo(0.3, 9);
    expect(cpuReaction(0.4)).toBeCloseTo(0.201, 9);
    expect(cpuReaction(0)).toBe(0.15);
    expect(cpuReaction(5)).toBe(0.4);
  });

  it('Tagesform: Tipprate × 0,95–1,05, sonst unverändert', () => {
    const rng = createRng(1);
    const p = { name: 'X', tapRate: 8, other: 3 };
    for (let i = 0; i < 200; i++) {
      const f = withForm(p, rng);
      expect(f.tapRate).toBeGreaterThanOrEqual(8 * 0.95);
      expect(f.tapRate).toBeLessThanOrEqual(8 * 1.05);
      expect(f.other).toBe(3);
    }
    expect(p.tapRate).toBe(8);
  });
});

describe('Fabriken', () => {
  it('liefern je Stufe 3 Profile Rookie/Profi/Champion, NORMAL gleich der Konstante', () => {
    for (const [label, make, constant] of FACTORIES) {
      for (const d of DIFFICULTIES) {
        const list = make(d);
        expect([label, list.map((p) => p.name)]).toEqual([label, [...CPU_NAMES]]);
        expect(list.map((p) => p.tapRate)).toEqual(DIFFICULTY_SCALE[d].map((s) => s.rate));
      }
      expect([label, make('normal')]).toEqual([label, constant]);
    }
  });

  it('LEICHT: kein Gegner tippt schneller als 7,0/s', () => {
    for (const [, make] of FACTORIES) {
      expect(Math.max(...make('easy').map((p) => p.tapRate))).toBeLessThanOrEqual(7);
    }
  });

  it('abgeleitete Fehler fallen mit der Stufe', () => {
    const falling = (values: number[]) => {
      expect(values[0]).toBeGreaterThan(values[1]);
      expect(values[1]).toBeGreaterThan(values[2]);
    };
    for (let i = 0; i < 3; i++) {
      falling(DIFFICULTIES.map((d) => hurdleCpuProfiles(d)[i].jumpError));
      falling(DIFFICULTIES.map((d) => hurdleCpuProfiles(d)[i].reaction));
      falling(DIFFICULTIES.map((d) => jumpCpuProfiles(d)[i].boardError));
      falling(DIFFICULTIES.map((d) => swimCpuProfiles(d)[i].turnError));
      falling(DIFFICULTIES.map((d) => diveCpuProfiles(d)[i].takeoffError));
      falling(DIFFICULTIES.map((d) => bmxCpuProfiles(d)[i].mistakeChance));
      // Stabhoch: der Fehler steckt im Einstich; die Einstiegshöhe steigt mit der Stufe
      falling(DIFFICULTIES.map((d) => vaultCpuProfiles(d)[i].plantError));
    }
  });

  it('Stabhoch: Einstiegshöhen sind Lattenhöhen und steigen mit Stärke und Stufe', () => {
    for (const d of DIFFICULTIES) {
      const o = vaultCpuProfiles(d).map((p) => p.opening);
      for (const h of o) expect(HEIGHTS).toContain(h);
      expect(o[0]).toBeLessThanOrEqual(o[1]);
      expect(o[1]).toBeLessThan(o[2]);
    }
    const champ = DIFFICULTIES.map((d) => vaultCpuProfiles(d)[2].opening);
    expect(champ[0]).toBeLessThan(champ[1]);
    expect(champ[1]).toBeLessThan(champ[2]);
  });

  it('Turm: Sprunglisten aus DIVE_CPU_DIVES – je 3 verschiedene Sprünge, nach SG geordnet', () => {
    for (const d of DIFFICULTIES) {
      diveCpuProfiles(d).forEach((p, i) => {
        expect(p.dives).toEqual(DIVE_CPU_DIVES[d][i]);
        expect(new Set(p.dives).size).toBe(3);
        const dd = p.dives.map((id) => DIVES.find((x) => x.id === id)!.dd);
        for (let k = 1; k < 3; k++) expect(dd[k]).toBeGreaterThanOrEqual(dd[k - 1]);
      });
    }
  });

  it('BMX: Salto- und Trickfreude steigen mit der Stufe, im Rahmen der Grenzen', () => {
    for (const d of DIFFICULTIES) {
      for (const p of bmxCpuProfiles(d)) {
        expect(p.flipChance).toBeGreaterThanOrEqual(0);
        expect(p.flipChance).toBeLessThanOrEqual(0.9);
        expect(p.trickChance).toBeGreaterThanOrEqual(0.2);
        expect(p.trickChance).toBeLessThanOrEqual(0.9);
        expect(p.mistakeChance).toBeGreaterThanOrEqual(0.02);
        expect(p.mistakeChance).toBeLessThanOrEqual(0.4);
      }
    }
    expect(bmxCpuProfiles('hard')[2].flipChance).toBeGreaterThan(bmxCpuProfiles('easy')[2].flipChance);
  });
});
