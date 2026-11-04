import { describe, expect, it } from 'vitest';
import { createRng } from './cpu';
import {
  BMX,
  BMX_CPU_PROFILES,
  BmxCpu,
  bmxCpuProfiles,
  COURSE,
  createRider,
  groundHeight,
  hop,
  pedal,
  startRider,
  stepRider,
  totalScore,
  type RiderEvent,
  type RiderState,
} from './bmx';

const DT = 1 / 120;

/** Fährt mit fester Tipprate, hüpft über Stämme, macht keine Tricks. */
function ride(tapRate: number, opts: { hopLogs?: boolean; maxTime?: number } = {}) {
  const s = createRider();
  startRider(s);
  const events: RiderEvent[] = [];
  let t = 0;
  let nextTap = 0;
  let side: 'L' | 'R' = 'L';
  while (s.phase !== 'finished' && s.phase !== 'out' && t < (opts.maxTime ?? 90)) {
    t += DT;
    if (t >= nextTap) {
      pedal(s, side);
      side = side === 'L' ? 'R' : 'L';
      nextTap += 1 / tapRate;
    }
    if (opts.hopLogs !== false) {
      const log = COURSE.logs.find((l) => l > s.x);
      if (log !== undefined && log - s.x <= s.vx * 0.28) hop(s);
    }
    events.push(...stepRider(s, DT, t));
  }
  return { s, events };
}

describe('Strecke', () => {
  it('hat Rampen und flache Stücke', () => {
    expect(groundHeight(0)).toBe(0);
    expect(groundHeight(48 + 2.9)).toBeGreaterThan(0.8);
    expect(groundHeight(48 + 3.2)).toBe(0);
  });
});

describe('Fahren', () => {
  it('beschleunigt nur bei abwechselnden Tritten', () => {
    const s = createRider();
    startRider(s);
    expect(pedal(s, 'L')).toBe(true);
    expect(pedal(s, 'L')).toBe(false);
    expect(s.vx).toBeCloseTo(BMX.tapGain * BMX.maxSpeed);
    // Gesättigt: der zweite Tritt bringt weniger
    pedal(s, 'R');
    expect(s.vx).toBeLessThan(2 * BMX.tapGain * BMX.maxSpeed);
  });

  it('kommt mit gutem Tempo (8/s) sturzfrei ins Ziel', () => {
    const { s, events } = ride(8);
    expect(s.phase).toBe('finished');
    expect(s.crashes).toBe(0);
    expect(events.some((e) => e.type === 'takeoff')).toBe(true);
    expect(s.finishTime!).toBeGreaterThan(25);
    expect(s.finishTime!).toBeLessThan(45);
  });

  it('stürzt am Baumstamm, wenn man nicht hüpft', () => {
    const { events } = ride(10, { hopLogs: false, maxTime: 8 });
    expect(events.some((e) => e.type === 'crash' && e.reason === 'log')).toBe(true);
  });

  it('scheidet nach drei Stürzen aus', () => {
    const { s } = ride(10, { hopLogs: false });
    expect(s.phase).toBe('out');
    expect(s.crashes).toBe(BMX.maxCrashes);
    expect(totalScore(s)).toBe(s.points);
  });
});

describe('Tricks', () => {
  function airborne(): RiderState {
    const s = createRider();
    s.phase = 'air';
    s.x = 0;
    s.y = 4;
    s.vx = 6;
    s.vy = 6;
    return s;
  }

  function fly(s: RiderState, control: (s: RiderState) => void): RiderEvent[] {
    const events: RiderEvent[] = [];
    for (let t = 0; t < 4 && s.phase === 'air'; t += DT) {
      control(s);
      events.push(...stepRider(s, DT, t));
    }
    return events;
  }

  /** Für die Landung auf flachem Boden ausrichten */
  function align(r: RiderState): void {
    const a = Math.atan2(Math.sin(r.angle), Math.cos(r.angle));
    r.rotInput = Math.abs(a) > 0.1 ? -Math.sign(a) : 0;
  }

  it('zählt einen gestandenen Rückwärtssalto', () => {
    const s = airborne();
    const events = fly(s, (r) => {
      if (Math.abs(r.spin) < 2 * Math.PI) r.rotInput = -1;
      else align(r);
    });
    const land = events.find((e) => e.type === 'land');
    expect(land && land.type === 'land' && land.score.flips).toBe(1);
    expect(s.points).toBeGreaterThanOrEqual(BMX.flipPoints);
  });

  it('stürzt bei der Landung kopfüber', () => {
    const s = airborne();
    const events = fly(s, (r) => {
      r.rotInput = Math.abs(r.spin) < Math.PI ? -1 : 0;
    });
    expect(events.some((e) => e.type === 'crash')).toBe(true);
  });

  it('stürzt, wenn der Trick bei der Landung noch gehalten wird', () => {
    const s = airborne();
    const events = fly(s, (r) => {
      r.trickHeld = true;
    });
    expect(events.some((e) => e.type === 'crash' && e.reason === 'trick')).toBe(true);
  });

  it('gibt Punkte für einen rechtzeitig beendeten Trick', () => {
    const s = airborne();
    fly(s, (r) => {
      r.trickHeld = r.airTime < 0.5;
      align(r);
    });
    expect(s.points).toBeGreaterThan(300);
  });
});

describe('Computerfahrer', () => {
  it('fahren je nach Stärke unterschiedlich gut', () => {
    expect(bmxCpuProfiles('normal')).toEqual(BMX_CPU_PROFILES);
    const scores = BMX_CPU_PROFILES.map((p) => {
      let total = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const s = createRider();
        startRider(s);
        const cpu = new BmxCpu(s, p, createRng(seed));
        let t = 0;
        while (s.phase !== 'finished' && s.phase !== 'out' && t < 90) {
          t += DT;
          cpu.update(t);
          stepRider(s, DT, t);
        }
        total += totalScore(s);
      }
      return total / 12;
    });
    expect(scores[2]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[0]);
    expect(scores[0]).toBeGreaterThan(500);
  });
});
