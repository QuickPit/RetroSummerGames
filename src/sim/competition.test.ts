import { describe, expect, it } from 'vitest';
import {
  COMPETITION_ORDER,
  ceremonyPodium,
  createCompetition,
  currentEvent,
  medalTable,
  medalsOf,
  overallWinners,
  placingOf,
  playerStanding,
  recordEvent,
  type CompetitionState,
} from './competition';
import { BMX_CPU_PROFILES } from './bmx';
import { CPU_PROFILES, createRng } from './cpu';
import { DIVE_CPU_PROFILES } from './dive';
import { LJ_CPU_PROFILES } from './longjump';
import { VAULT_CPU_PROFILES } from './polevault';
import { SWIM_CPU_PROFILES } from './swim';

const POOL = ['GER', 'AUT', 'SUI', 'FRA', 'ITA', 'NED', 'ESP', 'SWE', 'POL', 'USA', 'JAM', 'JPN'];

/** Feld mit festen Nationen: Spieler GER, Gegner AUT, FRA, ITA */
function fixed(): CompetitionState {
  return {
    field: [
      { code: 'GER', isPlayer: true, profile: null, lookSeed: 1 },
      { code: 'AUT', isPlayer: false, profile: 0, lookSeed: 2 },
      { code: 'FRA', isPlayer: false, profile: 1, lookSeed: 3 },
      { code: 'ITA', isPlayer: false, profile: 2, lookSeed: 4 },
    ],
    index: 0,
    results: {},
  };
}

/** Reihe gültiger Plätze in der angegebenen Reihenfolge */
const order = (...codes: string[]) => codes.map((code) => ({ code, valid: true }));

/** Spielt alle Disziplinen mit den angegebenen Platzierungen */
function play(...events: { code: string; valid: boolean }[][]): CompetitionState {
  let s = fixed();
  events.forEach((rows, i) => {
    s = recordEvent(s, COMPETITION_ORDER[i], rows);
  });
  return s;
}

describe('Teilnehmerfeld', () => {
  it('zieht nie die Spielernation als Gegner und vergibt jedes Profil genau einmal', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const player = POOL[seed % POOL.length];
      const s = createCompetition(player, POOL, createRng(seed), 7);
      expect(s.field).toHaveLength(4);
      expect(s.field[0]).toMatchObject({ code: player, isPlayer: true, profile: null, lookSeed: 7 });
      const cpus = s.field.filter((f) => !f.isPlayer);
      expect(cpus.map((f) => f.code)).not.toContain(player);
      expect(new Set(cpus.map((f) => f.code)).size).toBe(3);
      expect(cpus.map((f) => f.profile).sort()).toEqual([0, 1, 2]);
    }
  });

  it('ist mit gleichem Startwert reproduzierbar', () => {
    const a = createCompetition('GER', POOL, createRng(42), 3);
    const b = createCompetition('GER', POOL, createRng(42), 3);
    expect(a).toEqual(b);
  });

  it('beginnt mit der ersten Disziplin ohne Ergebnisse', () => {
    const s = createCompetition('GER', POOL, createRng(1), 1);
    expect(currentEvent(s)).toBe('110h');
    expect(medalTable(s).every((r) => r.total === 0)).toBe(true);
    expect(overallWinners(s)).toEqual([]);
  });
});

describe('Medaillen', () => {
  it('gibt es nur für gültige Plätze 1–3', () => {
    const m = medalsOf([...order('GER', 'AUT', 'FRA'), { code: 'ITA', valid: true }]);
    expect(Object.fromEntries(m)).toEqual({ GER: 'gold', AUT: 'silver', FRA: 'bronze' });
  });

  it('ungültiger Platz 3 ergibt keine Bronze, und niemand rückt nach', () => {
    const m = medalsOf([...order('GER', 'AUT'), { code: 'FRA', valid: false }, { code: 'ITA', valid: false }]);
    expect(Object.fromEntries(m)).toEqual({ GER: 'gold', AUT: 'silver' });
  });

  it('gibt keine Medaillen, wenn niemand gültig ist', () => {
    const m = medalsOf(['GER', 'AUT', 'FRA', 'ITA'].map((code) => ({ code, valid: false })));
    expect(m.size).toBe(0);
  });
});

describe('Medaillenspiegel', () => {
  it('sortiert nach Gold, dann Silber, dann Bronze', () => {
    // AUT: 1 Gold · FRA: 3 Silber · ITA: 1 Silber 2 Bronze · GER: 2 Bronze
    const s = play(
      order('AUT', 'FRA', 'ITA', 'GER'),
      order('ITA', 'FRA', 'GER', 'AUT').map((r, i) => (i === 0 ? { ...r, valid: false } : r)),
      order('GER', 'FRA', 'ITA', 'AUT').map((r, i) => (i === 0 ? { ...r, valid: false } : r)),
      order('AUT', 'ITA', 'GER', 'FRA').map((r) => (r.code === 'AUT' ? { ...r, valid: false } : r)),
    );
    const t = medalTable(s);
    expect(t.map((r) => r.code)).toEqual(['AUT', 'FRA', 'ITA', 'GER']);
    expect(t[0]).toMatchObject({ gold: 1, silver: 0, bronze: 0, total: 1, rank: 1 });
    expect(t[1]).toMatchObject({ gold: 0, silver: 3, bronze: 0, total: 3, rank: 2 });
    expect(t[2]).toMatchObject({ gold: 0, silver: 1, bronze: 2, total: 3, rank: 3 });
    expect(t[3]).toMatchObject({ gold: 0, silver: 0, bronze: 2, total: 2, rank: 4 });
  });

  it('Gold schlägt beliebig viel Silber', () => {
    const s = play(order('AUT', 'GER', 'FRA', 'ITA'), order('ITA', 'GER', 'FRA', 'AUT'), order('FRA', 'GER', 'ITA', 'AUT'));
    const t = medalTable(s);
    expect(t.find((r) => r.code === 'GER')).toMatchObject({ silver: 3, rank: 4 });
  });

  it('Gleichstand ergibt den gleichen Rang („1, 2, 2, 4“) und Anzeige A–Z', () => {
    // GER 2 Gold · ITA und AUT je 1 Silber 1 Bronze · FRA nichts
    const s = play(order('GER', 'ITA', 'AUT', 'FRA'), order('GER', 'AUT', 'ITA', 'FRA'), [
      { code: 'GER', valid: false },
      { code: 'FRA', valid: false },
      { code: 'AUT', valid: false },
      { code: 'ITA', valid: false },
    ]);
    const t = medalTable(s);
    expect(t.map((r) => [r.code, r.rank])).toEqual([
      ['GER', 1],
      ['AUT', 2],
      ['ITA', 2],
      ['FRA', 4],
    ]);
  });

  it('zeigt alle 4 Nationen, auch ohne Medaille, und zählt die Gesamtzahl', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'));
    const t = medalTable(s);
    expect(t).toHaveLength(4);
    expect(t.map((r) => r.total)).toEqual([1, 1, 1, 0]);
    expect(t.find((r) => r.code === 'ITA')!.rank).toBe(4);
  });
});

describe('Gesamtsieger', () => {
  it('ist die Nation auf Platz 1', () => {
    const s = play(order('ITA', 'GER', 'FRA', 'AUT'), order('ITA', 'AUT', 'FRA', 'GER'));
    expect(overallWinners(s)).toEqual(['ITA']);
  });

  it('wird bei Gleichstand geteilt', () => {
    const s = play(
      order('GER', 'AUT', 'FRA', 'ITA'),
      order('AUT', 'GER', 'ITA', 'FRA'),
      order('FRA', 'ITA', 'GER', 'AUT'),
      order('ITA', 'FRA', 'AUT', 'GER'),
    );
    // Jede Nation hat je 1 Gold, 1 Silber und 1 Bronze
    expect(overallWinners(s)).toEqual(['AUT', 'FRA', 'GER', 'ITA']);
  });

  it('gibt es nicht ohne Medaillen', () => {
    const none = ['GER', 'AUT', 'FRA', 'ITA'].map((code) => ({ code, valid: false }));
    const s = play(...COMPETITION_ORDER.map(() => none));
    expect(currentEvent(s)).toBeNull();
    expect(overallWinners(s)).toEqual([]);
  });
});

describe('recordEvent', () => {
  it('spielt die Disziplinen in der festen Reihenfolge', () => {
    expect([...COMPETITION_ORDER]).toEqual(['110h', 'long', 'pole', 'swim', 'dive', 'bmx']);
    let s = fixed();
    for (const key of COMPETITION_ORDER) {
      expect(currentEvent(s)).toBe(key);
      s = recordEvent(s, key, order('GER', 'AUT', 'FRA', 'ITA'));
    }
    expect(currentEvent(s)).toBeNull();
    expect(medalTable(s)[0]).toMatchObject({ code: 'GER', gold: COMPETITION_ORDER.length });
  });

  it('ist idempotent', () => {
    const once = recordEvent(fixed(), '110h', order('GER', 'AUT', 'FRA', 'ITA'));
    const twice = recordEvent(once, '110h', order('ITA', 'FRA', 'AUT', 'GER'));
    expect(twice).toBe(once);
    expect(twice.index).toBe(1);
    expect(medalTable(twice).find((r) => r.code === 'GER')!.gold).toBe(1);
  });

  it('lehnt eine falsche Disziplin ab', () => {
    const s = fixed();
    const next = recordEvent(s, 'pole', order('GER', 'AUT', 'FRA', 'ITA'));
    expect(next).toBe(s);
    expect(next.results).toEqual({});
    expect(currentEvent(next)).toBe('110h');
  });

  it('verändert den alten Zustand nicht', () => {
    const s = fixed();
    recordEvent(s, '110h', order('GER', 'AUT', 'FRA', 'ITA'));
    expect(s.index).toBe(0);
    expect(s.results).toEqual({});
  });

  it('merkt sich Platz und Gültigkeit je Nation', () => {
    const s = recordEvent(fixed(), '110h', [...order('AUT', 'GER', 'ITA'), { code: 'FRA', valid: false }]);
    expect(placingOf(s, '110h', 'GER')).toEqual({ code: 'GER', place: 2, valid: true });
    expect(placingOf(s, '110h', 'FRA')).toEqual({ code: 'FRA', place: 4, valid: false });
    expect(placingOf(s, 'long', 'GER')).toBeUndefined();
  });
});

describe('Medaillenspiegel – Grenzfälle (QA)', () => {
  it('zählt über alle Disziplinen genau die Podeste, ungültige Plätze ohne Nachrücken', () => {
    const s = play(
      order('GER', 'AUT', 'FRA', 'ITA'),
      [
        { code: 'AUT', valid: true },
        { code: 'GER', valid: false },
        { code: 'FRA', valid: false },
        { code: 'ITA', valid: false },
      ],
      order('ITA', 'FRA', 'GER', 'AUT'),
      [
        { code: 'FRA', valid: true },
        { code: 'ITA', valid: true },
        { code: 'AUT', valid: false },
        { code: 'GER', valid: false },
      ],
    );
    const byCode = Object.fromEntries(medalTable(s).map((r) => [r.code, [r.gold, r.silver, r.bronze]]));
    expect(byCode).toEqual({ GER: [1, 0, 1], AUT: [1, 1, 0], FRA: [1, 1, 1], ITA: [1, 1, 0] });
    expect(medalTable(s).reduce((n, r) => n + r.total, 0)).toBe(9);
  });

  it('vergibt bei zwei Gleichständen die Ränge 1, 1, 3, 3', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'), order('ITA', 'FRA', 'AUT', 'GER'));
    expect(medalTable(s).map((r) => [r.code, r.rank])).toEqual([
      ['GER', 1],
      ['ITA', 1],
      ['AUT', 3],
      ['FRA', 3],
    ]);
  });

  it('nimmt nur Ergebnisse auf, wenn die Disziplin an der Reihe ist (kein Doppeleintrag nach Wiederholung)', () => {
    let s = play(order('GER', 'AUT', 'FRA', 'ITA'));
    s = recordEvent(s, '110h', order('ITA', 'FRA', 'AUT', 'GER'));
    expect(s.index).toBe(1);
    expect(medalTable(s).find((r) => r.code === 'GER')!.gold).toBe(1);
  });
});

describe('Profile der Computer-Gegner', () => {
  it('stehen in allen Disziplinen in derselben Reihenfolge (Index aus dem Feld)', () => {
    for (const list of [CPU_PROFILES, LJ_CPU_PROFILES, VAULT_CPU_PROFILES, SWIM_CPU_PROFILES, DIVE_CPU_PROFILES, BMX_CPU_PROFILES]) {
      expect(list.map((p) => p.name)).toEqual(['Rookie', 'Profi', 'Champion']);
    }
  });
});

describe('playerStanding', () => {
  const none = ['GER', 'AUT', 'FRA', 'ITA'].map((code) => ({ code, valid: false }));

  it('meldet „noch keine Medaillen“ statt einer geteilten Spitze', () => {
    expect(playerStanding(fixed()).kind).toBe('noMedals');
    expect(playerStanding(play(...COMPETITION_ORDER.map(() => none))).kind).toBe('noMedals');
  });

  it('erkennt die alleinige Führung', () => {
    expect(playerStanding(play(order('GER', 'AUT', 'FRA', 'ITA')))).toEqual({ kind: 'leader', rank: 1 });
  });

  it('erkennt den Gleichstand an der Spitze', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'), order('ITA', 'AUT', 'FRA', 'GER'));
    expect(playerStanding(s)).toEqual({ kind: 'tied', rank: 1 });
  });

  it('nennt den Rang, wenn der Spieler zurückliegt – auch ohne eigene Medaille', () => {
    expect(playerStanding(play(order('AUT', 'GER', 'FRA', 'ITA')))).toEqual({ kind: 'behind', rank: 2 });
    expect(playerStanding(play(order('AUT', 'FRA', 'ITA', 'GER')))).toEqual({ kind: 'behind', rank: 4 });
  });
});

describe('ceremonyPodium', () => {
  const invalid = (...codes: string[]) => codes.map((code) => ({ code, valid: false }));

  it('stellt im Normalfall drei Nationen aufs Podest, Platz 4 bleibt unten', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'), order('GER', 'AUT', 'ITA', 'FRA'), order('AUT', 'GER', 'FRA', 'ITA'));
    expect(ceremonyPodium(s)).toEqual([
      { rank: 1, codes: ['GER'] },
      { rank: 2, codes: ['AUT'] },
      { rank: 3, codes: ['FRA'] },
    ]);
  });

  it('teilt bei Gleichstand auf Platz 1 die Stufe, danach folgt Rang 3 (A–Z innerhalb der Stufe)', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'), order('AUT', 'GER', 'ITA', 'FRA'));
    expect(ceremonyPodium(s)).toEqual([
      { rank: 1, codes: ['AUT', 'GER'] },
      { rank: 3, codes: ['FRA', 'ITA'] },
    ]);
  });

  it('teilt bei Gleichstand auf Platz 2 die Stufe, die Nation ohne Medaille fehlt', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'), order('GER', 'FRA', 'AUT', 'ITA'));
    expect(ceremonyPodium(s)).toEqual([
      { rank: 1, codes: ['GER'] },
      { rank: 2, codes: ['AUT', 'FRA'] },
    ]);
  });

  it('ist ohne jede Medaille leer', () => {
    const none = invalid('GER', 'AUT', 'FRA', 'ITA');
    expect(ceremonyPodium(play(...COMPETITION_ORDER.map(() => none)))).toEqual([]);
    expect(ceremonyPodium(fixed())).toEqual([]);
  });

  it('zeigt nur die eine Nation mit Medaille', () => {
    const rows = [{ code: 'ITA', valid: true }, ...invalid('GER', 'AUT', 'FRA')];
    expect(ceremonyPodium(play(rows))).toEqual([{ rank: 1, codes: ['ITA'] }]);
  });

  it('teilt Platz 3 zwischen zwei Nationen mit Bronze (1, 2, 3, 3)', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'), order('GER', 'AUT', 'ITA', 'FRA'));
    expect(ceremonyPodium(s)).toEqual([
      { rank: 1, codes: ['GER'] },
      { rank: 2, codes: ['AUT'] },
      { rank: 3, codes: ['FRA', 'ITA'] },
    ]);
  });

  it('stellt drei punktgleiche Nationen gemeinsam auf Stufe 2', () => {
    const s = play(order('GER', 'AUT', 'FRA', 'ITA'), order('GER', 'FRA', 'ITA', 'AUT'), order('GER', 'ITA', 'AUT', 'FRA'));
    expect(ceremonyPodium(s)).toEqual([
      { rank: 1, codes: ['GER'] },
      { rank: 2, codes: ['AUT', 'FRA', 'ITA'] },
    ]);
  });

  it('stellt bei vierfachem Gleichstand alle Nationen auf Stufe 1', () => {
    const s = play(
      order('GER', 'AUT', 'FRA', 'ITA'),
      order('AUT', 'FRA', 'ITA', 'GER'),
      order('FRA', 'ITA', 'GER', 'AUT'),
      order('ITA', 'GER', 'AUT', 'FRA'),
    );
    expect(ceremonyPodium(s)).toEqual([{ rank: 1, codes: ['AUT', 'FRA', 'GER', 'ITA'] }]);
    expect(ceremonyPodium(s)[0].codes).toEqual(overallWinners(s));
  });

  it('entspricht für zufällige Wettkämpfe immer den Rängen 1–3 mit Medaille', () => {
    const rng = createRng(4711);
    const codes = ['GER', 'AUT', 'FRA', 'ITA'];
    for (let n = 0; n < 300; n++) {
      const events = COMPETITION_ORDER.map(() =>
        [...codes].sort(() => rng() - 0.5).map((code) => ({ code, valid: rng() > 0.2 })),
      );
      const s = play(...events);
      const table = medalTable(s);
      const podium = ceremonyPodium(s);
      expect(podium.flatMap((p) => p.codes).sort()).toEqual(
        table.filter((r) => r.rank <= 3 && r.total > 0).map((r) => r.code).sort(),
      );
      for (const p of podium) for (const code of p.codes) expect(table.find((r) => r.code === code)!.rank).toBe(p.rank);
      expect(podium.find((p) => p.rank === 1)?.codes ?? []).toEqual(overallWinners(s));
    }
  });

  it('lässt Nationen auf Rang 3 ohne Medaille weg', () => {
    // GER Gold, AUT Silber, FRA und ITA ungültig: Rang 3 geteilt, aber ohne Medaille
    const rows = [...order('GER', 'AUT'), ...invalid('FRA', 'ITA')];
    const s = play(rows);
    expect(medalTable(s).map((r) => r.rank)).toEqual([1, 2, 3, 3]);
    expect(ceremonyPodium(s)).toEqual([
      { rank: 1, codes: ['GER'] },
      { rank: 2, codes: ['AUT'] },
    ]);
  });
});
