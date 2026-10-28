import { describe, expect, it } from 'vitest';
import { CPU_PROFILES, CpuController, createRng, type CpuProfile } from './cpu';
import { HURDLE_POSITIONS, PHYSICS, TRACK, createRunner, hurdlesHit, jump, step, tap } from './hurdles';

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
    expect(r.v).toBeCloseTo(PHYSICS.tapImpulse);
    expect(tap(r, 'R', 0.3)).toBe(true);
    expect(r.v).toBeCloseTo(2 * PHYSICS.tapImpulse);
  });

  it('beschleunigt nicht in der Luft', () => {
    const r = createRunner();
    tap(r, 'L', 0);
    jump(r);
    expect(tap(r, 'R', 0.1)).toBe(false);
    expect(r.v).toBeCloseTo(PHYSICS.tapImpulse);
  });

  it('begrenzt die Höchstgeschwindigkeit', () => {
    const r = createRunner();
    for (let i = 0; i < 100; i++) tap(r, i % 2 ? 'R' : 'L', i * 0.01);
    expect(r.v).toBe(PHYSICS.maxSpeed);
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
  it('erzielen realistische Zeiten je nach Stärke', () => {
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
  });

  it('reißen selten Hürden, wenn sie gut sind', () => {
    let hits = 0;
    for (let i = 0; i < 40; i++) hits += hurdlesHit(runRace(CPU_PROFILES[2], i + 100));
    expect(hits / 40).toBeLessThan(1);
  });
});
