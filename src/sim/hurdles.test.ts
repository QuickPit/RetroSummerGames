import { describe, expect, it } from 'vitest';
import { CPU_PROFILES, CpuController, createRng, hurdleCpuProfiles, type CpuProfile } from './cpu';
import { HURDLE_POSITIONS, PHYSICS, TRACK, createRunner, hurdlesHit, jump, step, tap, tapSpeed } from './hurdles';

const DT = 1 / 120;

function runRace(profile: CpuProfile, seed: number) {
  const runner = createRunner();
  const cpu = new CpuController(runner, profile, createRng(seed));
  let t = 0;
  while (runner.finishTime === null && t < 60) {
    t += DT;
    cpu.update(t);
    step(runner, DT, t);
  }
  return runner;
}

describe('Tippen', () => {
  it('beschleunigt nur bei abwechselnden Tasten', () => {
    const r = createRunner();
    expect(tap(r, 'L', 0)).toBe(true);
    expect(tap(r, 'L', 0.1)).toBe(false);
    expect(tap(r, 'L', 0.2)).toBe(false);
    expect(r.v).toBeCloseTo(PHYSICS.tapGain * PHYSICS.maxSpeed);
    expect(tap(r, 'R', 0.3)).toBe(true);
    expect(r.v).toBeCloseTo(tapSpeed(PHYSICS.tapGain * PHYSICS.maxSpeed, PHYSICS.maxSpeed));
  });

  it('beschleunigt nicht in der Luft', () => {
    const r = createRunner();
    tap(r, 'L', 0);
    jump(r);
    expect(tap(r, 'R', 0.1)).toBe(false);
    expect(r.v).toBeCloseTo(PHYSICS.tapGain * PHYSICS.maxSpeed);
  });

  it('begrenzt die Höchstgeschwindigkeit', () => {
    const r = createRunner();
    for (let i = 0; i < 100; i++) tap(r, i % 2 ? 'R' : 'L', i * 0.01);
    expect(r.v).toBe(PHYSICS.maxSpeed);
    expect(PHYSICS.maxSpeed).toBe(9.55);
  });
});

describe('Tempo-Kurve', () => {
  /** Mittleres Tempo (Anteil am Höchsttempo) nach 6 s gleichmäßigem Tippen, ohne Hürden */
  function share(rate: number): number {
    const r = createRunner();
    r.nextHurdle = TRACK.hurdleCount;
    let t = 0;
    let next = 0;
    let sum = 0;
    let n = 0;
    while (t < 8) {
      t += DT;
      while (next <= t) {
        tap(r, r.lastSide === 'L' ? 'R' : 'L', next);
        next += 1 / rate;
      }
      step(r, DT, t);
      if (t >= 6) {
        sum += r.v;
        n++;
      }
    }
    return sum / n / PHYSICS.maxSpeed;
  }

  it('sättigt: 6/s ≈ 80 %, 8/s ≈ 90 %, 10/s ≈ 96 % des Höchsttempos', () => {
    expect(share(6)).toBeGreaterThan(0.76);
    expect(share(6)).toBeLessThan(0.84);
    expect(share(8)).toBeGreaterThan(0.86);
    expect(share(8)).toBeLessThan(0.93);
    expect(share(10)).toBeGreaterThan(0.93);
    expect(share(10)).toBeLessThan(0.99);
    // Hämmern bringt kaum noch etwas
    expect(share(13) - share(10)).toBeLessThan(0.05);
  });

  it('bringt nahe am Höchsttempo weniger je Tipp als aus dem Stand', () => {
    const v = PHYSICS.maxSpeed;
    expect(tapSpeed(0, v) - 0).toBeGreaterThan(tapSpeed(0.8 * v, v) - 0.8 * v);
    expect(tapSpeed(0.8 * v, v, 0.5) - 0.8 * v).toBeCloseTo((tapSpeed(0.8 * v, v) - 0.8 * v) / 2, 9);
    expect(tapSpeed(v, v)).toBe(v);
  });
});

describe('Hürden', () => {
  function runTo(x: number, speed: number, jumpLead: number | null) {
    const r = createRunner();
    r.x = x;
    r.v = speed;
    let t = 0;
    let jumped = false;
    while (r.nextHurdle === 0 && t < 5) {
      if (jumpLead !== null && !jumped && HURDLE_POSITIONS[0] - r.x <= speed * jumpLead) {
        jump(r);
        jumped = true;
      }
      r.v = speed; // konstante Geschwindigkeit für einen sauberen Test
      t += DT;
      step(r, DT, t);
    }
    return r;
  }

  it('wird übersprungen, wenn der Scheitelpunkt über der Hürde liegt', () => {
    const r = runTo(5, 9, PHYSICS.jumpDuration / 2);
    expect(r.hurdles[0]).toBe('clear');
  });

  it('wird gerissen ohne Sprung', () => {
    const r = runTo(5, 9, null);
    expect(r.hurdles[0]).toBe('hit');
    expect(r.stumble).toBeGreaterThan(0);
  });

  it('wird gerissen bei viel zu frühem Absprung', () => {
    const r = runTo(5, 9, PHYSICS.jumpDuration * 1.1);
    expect(r.hurdles[0]).toBe('hit');
  });
});

describe('Ziel', () => {
  it('interpoliert die Zielzeit', () => {
    const r = createRunner();
    r.x = TRACK.distance - 0.05;
    r.v = 10;
    r.nextHurdle = TRACK.hurdleCount;
    step(r, 0.01, 12);
    expect(r.finishTime).toBeCloseTo(11.995, 3);
  });
});

describe('Computer-Gegner', () => {
  it('erzielen realistische Zeiten je nach Stärke (NORMAL Ø 15,2 / 14,2 / 13,4 s)', () => {
    expect(hurdleCpuProfiles('normal')).toEqual(CPU_PROFILES);
    const avg = CPU_PROFILES.map((p) => {
      const times = Array.from({ length: 40 }, (_, i) => runRace(p, i + 1).finishTime!);
      return times.reduce((a, b) => a + b, 0) / times.length;
    });
    // Stärkere Gegner sind im Schnitt schneller …
    expect(avg[0]).toBeGreaterThan(avg[1]);
    expect(avg[1]).toBeGreaterThan(avg[2]);
    // … und alle liegen im Bereich echter Hürdenläufe (Weltrekord 12,80 s).
    expect(avg[2]).toBeGreaterThan(12);
    expect(avg[0]).toBeLessThan(18);
    expect(avg[0]).toBeGreaterThan(14.7);
    expect(avg[0]).toBeLessThan(15.8);
    expect(avg[1]).toBeGreaterThan(13.7);
    expect(avg[1]).toBeLessThan(14.7);
    expect(avg[2]).toBeGreaterThan(13.0);
    expect(avg[2]).toBeLessThan(13.9);
  });

  it('reißen selten Hürden, wenn sie gut sind', () => {
    let hits = 0;
    for (let i = 0; i < 40; i++) hits += hurdlesHit(runRace(CPU_PROFILES[2], i + 100));
    expect(hits / 40).toBeLessThan(1);
  });
});
