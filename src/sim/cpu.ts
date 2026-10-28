import { HURDLE_POSITIONS, PHYSICS, isAirborne, isFinished, jump, tap, type RunnerState, type Side } from './hurdles';

export interface CpuProfile {
  name: string;
  /** Gültige Tipps pro Sekunde */
  tapRate: number;
  /** Relative Schwankung des Tipp-Abstands (0..1) */
  tapJitter: number;
  /** Reaktionszeit auf den Startschuss in Sekunden */
  reaction: number;
  /** Standardabweichung des Absprung-Timings in Sekunden */
  jumpError: number;
}

export const CPU_PROFILES: readonly CpuProfile[] = [
  { name: 'Rookie', tapRate: 8.5, tapJitter: 0.25, reaction: 0.24, jumpError: 0.08 },
  { name: 'Profi', tapRate: 10, tapJitter: 0.18, reaction: 0.19, jumpError: 0.055 },
  { name: 'Champion', tapRate: 11.4, tapJitter: 0.12, reaction: 0.15, jumpError: 0.04 },
];

/** Kleiner deterministischer Zufallsgenerator (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Steuert einen Computer-Gegner über dieselben Eingaben wie ein Mensch. */
export class CpuController {
  private nextTapAt: number;
  private side: Side = 'L';
  private plannedHurdle = -1;
  private timingOffset = 0;
  private readonly rate: number;

  constructor(
    readonly runner: RunnerState,
    readonly profile: CpuProfile,
    private readonly rng: () => number,
  ) {
    // Jeder Lauf ist etwas anders – auch Computer haben gute und schlechte Tage.
    this.rate = profile.tapRate * (0.95 + 0.1 * rng());
    this.nextTapAt = profile.reaction * (0.85 + 0.3 * rng());
  }

  update(time: number): void {
    const r = this.runner;
    if (isFinished(r)) return;

    while (time >= this.nextTapAt) {
      tap(r, this.side, this.nextTapAt);
      this.side = this.side === 'L' ? 'R' : 'L';
      const jitter = 1 + this.profile.tapJitter * (this.rng() * 2 - 1);
      this.nextTapAt += jitter / this.rate;
    }

    const h = r.nextHurdle;
    if (h >= HURDLE_POSITIONS.length || isAirborne(r)) return;
    if (this.plannedHurdle !== h) {
      this.plannedHurdle = h;
      this.timingOffset = gaussian(this.rng) * this.profile.jumpError;
    }
    // Ideal: Scheitelpunkt des Sprungs genau über der Hürde.
    const lead = PHYSICS.jumpDuration / 2 + this.timingOffset;
    if (HURDLE_POSITIONS[h] - r.x <= r.v * lead) jump(r);
  }
}
