import { describe, expect, it } from 'vitest';
import { createRng } from './cpu';
import {
  LJ,
  LJ_CPU_PROFILES,
  ROUNDS,
  bestJump,
  cpuJump,
  createJump,
  createJumper,
  flightDuration,
  ljPress,
  ljRelease,
  ljTap,
  nextJump,
  rankJumpers,
  stepJump,
  type LjState,
} from './longjump';

const DT = 1 / 120;

interface Plan {
  rate?: number;
  /** Absprung so weit vor (+) bzw. hinter (−) der Brettkante */
  board?: number | null;
  angle?: number;
  /** Beine strecken so lange vor der Landung (null = gar nicht) */
  extend?: number | null;
}

function jump({ rate = 11, board = 0.05, angle = 28, extend = 0.15 }: Plan = {}): LjState {
  const s = createJump();
  let t = 0;
  let next = 0;
  let side: 'L' | 'R' = 'L';
  while (s.phase !== 'landed' && s.phase !== 'runthrough' && t < 20) {
    t += DT;
    if ((s.phase === 'ready' || s.phase === 'runup') && t >= next) {
      ljTap(s, side);
      side = side === 'L' ? 'R' : 'L';
      next += 1 / rate;
    }
    if (board !== null && s.phase === 'runup' && s.x >= -board) {
      // Wie im Spiel: den Moment des Drückens zurückrechnen
      ljPress(s, (s.x + board) / Math.max(1, s.v));
    }
    if (s.phase === 'takeoff' && s.angle >= angle) ljRelease(s);
    if (extend !== null && s.phase === 'flight' && s.extendAt === null && flightDuration(s) - s.flightTime <= extend) {
      ljPress(s);
    }
    stepJump(s, DT);
  }
  return s;
}

describe('Sprung', () => {
  it('ergibt bei gutem Anlauf eine realistische Weite', () => {
    const s = jump();
    expect(s.landing).toBe('extended');
    expect(s.distance!).toBeGreaterThan(7);
    expect(s.distance!).toBeLessThan(9.2);
  });

  it('springt weiter, je schneller angelaufen wird', () => {
    expect(jump({ rate: 12 }).distance!).toBeGreaterThan(jump({ rate: 9 }).distance! + 1.5);
  });

  it('ist ungültig bei Übertreten', () => {
    const s = jump({ board: -0.1 });
    expect(s.foul).toBe(true);
    expect(s.distance).toBeNull();
  });

  it('ist ungültig, wenn man gar nicht abspringt', () => {
    const s = jump({ board: null });
    expect(s.phase).toBe('runthrough');
    expect(s.distance).toBeNull();
  });

  it('verschenkt Weite bei frühem Absprung vor dem Brett', () => {
    expect(jump({ board: 0.6 }).distance!).toBeLessThan(jump({ board: 0.02 }).distance! - 0.4);
  });

  it('hat einen besten Winkel im mittleren Bereich', () => {
    const flat = jump({ angle: 10 }).distance!;
    const good = jump({ angle: 28 }).distance!;
    const steep = jump({ angle: 48 }).distance!;
    expect(good).toBeGreaterThan(flat + 1);
    expect(good).toBeGreaterThan(steep + 0.3);
  });

  it('belohnt rechtzeitiges Beinestrecken', () => {
    const extended = jump({ extend: 0.15 });
    const early = jump({ extend: 0.6 });
    const none = jump({ extend: null });
    expect(early.landing).toBe('early');
    expect(none.landing).toBe('sitback');
    expect(extended.distance!).toBeGreaterThan(early.distance!);
    expect(early.distance!).toBeGreaterThan(none.distance!);
  });

  it('springt automatisch ab, wenn die Taste zu lange gehalten wird', () => {
    const s = createJump();
    s.phase = 'runup';
    s.v = 10;
    s.x = -0.1;
    ljPress(s);
    const phase = (): string => s.phase;
    for (let i = 0; i < 120 && phase() === 'takeoff'; i++) stepJump(s, DT);
    expect(s.phase).toBe('flight');
    expect(s.angle).toBe(LJ.angleMax);
  });
});

describe('Wettkampf', () => {
  it('springt Durchgang für Durchgang und wertet den besten Versuch', () => {
    const a = createJumper(0, true);
    const b = createJumper(1, false);
    const order: number[] = [];
    for (let turn = nextJump([a, b]); turn; turn = nextJump([a, b])) {
      order.push(turn.jumper.id);
      turn.jumper.attempts[turn.round] = turn.jumper.id === 0 ? 7 + turn.round * 0.1 : null;
    }
    expect(order).toEqual([0, 1, 0, 1, 0, 1].slice(0, ROUNDS * 2));
    expect(bestJump(a)).toBeCloseTo(7.2);
    expect(bestJump(b)).toBeNull();
    expect(rankJumpers([b, a])[0]).toBe(a);
  });

  it('entscheidet bei gleicher Bestweite die zweitbeste', () => {
    const a = createJumper(0, true);
    const b = createJumper(1, false);
    a.attempts = [7.5, 7.0, null];
    b.attempts = [7.5, 7.2, null];
    expect(rankJumpers([a, b])[0]).toBe(b);
  });

  it('Computer-Gegner springen je nach Stärke unterschiedlich weit', () => {
    const rng = createRng(3);
    const avg = LJ_CPU_PROFILES.map((p) => {
      const jumps = Array.from({ length: 200 }, () => cpuJump(p, rng)).filter((d): d is number => d !== null);
      return jumps.reduce((x, y) => x + y, 0) / jumps.length;
    });
    expect(avg[0]).toBeLessThan(avg[1]);
    expect(avg[1]).toBeLessThan(avg[2]);
  });
});
