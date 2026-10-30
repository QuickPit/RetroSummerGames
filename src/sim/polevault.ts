// Reine Spiellogik für den Stabhochsprung: ein einzelner Sprung (Anlauf,
// Einstich, Schwung, Loslassen, Flug) und der Wettkampf mit Lattenhöhen.

import { PHYSICS, strideLength, type Side } from './hurdles';

export const VAULT = {
  /** Anlauflänge in Metern vor dem Einstichkasten */
  runup: 30,
  /** Höchsttempo mit Stab in m/s */
  maxSpeed: 9.6,
  /** Idealer Absprung: so weit vor dem Kasten wird eingestochen */
  takeoffIdeal: 4.0,
  /** Abweichung, ab der der Einstich gar nichts mehr taugt */
  plantWindow: 1.2,
  /** Wer bis hierhin nicht eingestochen hat, läuft durch */
  runThroughAt: 2.2,
  /** Dauer vom Einstich bis zum senkrechten Stab */
  vaultDuration: 1.3,
  /** Idealer Zeitpunkt zum Loslassen (1 = Stab senkrecht) */
  releaseIdeal: 0.97,
  releaseWindow: 0.35,
  /** Spätestens hier rutscht man ab, ohne losgelassen zu haben */
  hangAt: 1.15,
  /** Früheres Drücken gilt als versehentlicher Doppeldruck beim Einstich */
  earliestRelease: 0.3,
  /** Erst ab hier gibt der Stab seine volle Energie zurück */
  fullEnergyAt: 0.85,
  /** Kraft beim Abdrücken vom Stab in Metern */
  pushMax: 0.35,
  pushMin: -0.6,
  /** Position der Latte hinter dem Kasten */
  barX: 0.5,
  /** Höchster Punkt der Flugkurve – knapp hinter der Latte */
  apexX: 0.75,
  /** Nötiger Abstand zwischen Körper und Latte */
  clearance: 0.03,
  /** Hüfthöhe beim Liegen auf der Matte */
  landHip: 1.05,
  gravity: 9.81,
} as const;

export type VaultPhase = 'ready' | 'runup' | 'vault' | 'flight' | 'landed' | 'runthrough';
export type VaultOutcome = 'clear' | 'knock' | 'runthrough';

export type VaultEvent =
  | { type: 'footstep' }
  | { type: 'plant'; quality: number }
  | { type: 'release'; quality: number }
  | { type: 'hang' }
  | { type: 'clear' }
  | { type: 'knock' }
  | { type: 'land' }
  | { type: 'runthrough' };

interface Flight {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  t: number;
  tLand: number;
}

export interface VaultState {
  phase: VaultPhase;
  /** Hüftposition in Metern (x = 0 ist der Einstichkasten) */
  x: number;
  y: number;
  v: number;
  bar: number;
  lastSide: Side | null;
  stride: number;
  plantX: number | null;
  plantQuality: number;
  /** Erreichbare Höhe ohne Abdrücken */
  baseHeight: number;
  /** Griffhöhe am Stab */
  grip: number;
  /** Fortschritt am Stab: 0 = Einstich, 1 = Stab senkrecht */
  p: number;
  releaseP: number | null;
  releaseQuality: number;
  /** Höchster Punkt der Hüfte im Flug */
  peak: number;
  flight: Flight | null;
  outcome: VaultOutcome | null;
}

export function createVault(bar: number): VaultState {
  return {
    phase: 'ready',
    x: -VAULT.runup,
    y: 0,
    v: 0,
    bar,
    lastSide: null,
    stride: 0,
    plantX: null,
    plantQuality: 0,
    baseHeight: 0,
    grip: 0,
    p: 0,
    releaseP: null,
    releaseQuality: 0,
    peak: 0,
    flight: null,
    outcome: null,
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Anlauf: wie beim Hürdenlauf zählen nur abwechselnde Tipps. */
export function vaultTap(s: VaultState, side: Side): boolean {
  if ((s.phase !== 'ready' && s.phase !== 'runup') || side === s.lastSide) return false;
  s.lastSide = side;
  s.phase = 'runup';
  s.v = Math.min(s.v + PHYSICS.tapImpulse, VAULT.maxSpeed);
  return true;
}

/** Stab einstechen. Gibt die Qualität 0..1 zurück oder null, wenn es nicht geht. */
export function plant(s: VaultState): number | null {
  if (s.phase !== 'runup') return null;
  const distance = -s.x;
  const quality = clamp01(1 - Math.abs(distance - VAULT.takeoffIdeal) / VAULT.plantWindow);
  const efficiency = 0.8 + 0.2 * quality;
  s.plantX = s.x;
  s.plantQuality = quality;
  // Bewegungsenergie wird in Höhe umgesetzt: h = v² / 2g
  s.baseHeight = 1.3 + (efficiency * s.v * s.v) / (2 * VAULT.gravity);
  s.grip = Math.max(3.0, s.baseHeight - 0.55);
  s.phase = 'vault';
  s.p = 0;
  return quality;
}

/** Hüftposition am Stab für einen Fortschritt p. */
export function hipOnPole(s: VaultState, p: number): { x: number; y: number } {
  const plantX = s.plantX ?? -VAULT.takeoffIdeal;
  const t = Math.min(p, 1);
  const ease = Math.sin((t * Math.PI) / 2);
  return {
    x: plantX + (-0.35 - plantX) * ease + 0.25 * Math.max(0, p - 1),
    y: 1.0 + (s.grip + 0.25 - 1.0) * smoothstep(t),
  };
}

/** Vom Stab loslassen und abdrücken. */
export function release(s: VaultState): number | null {
  if (s.phase !== 'vault' || s.p < VAULT.earliestRelease) return null;
  return startFlight(s, s.p);
}

function startFlight(s: VaultState, p: number): number {
  const quality = clamp01(1 - Math.abs(p - VAULT.releaseIdeal) / VAULT.releaseWindow);
  const push = VAULT.pushMin + (VAULT.pushMax - VAULT.pushMin) * quality;
  const start = hipOnPole(s, p);
  s.releaseP = p;
  s.releaseQuality = quality;
  // Wer zu früh loslässt, verschenkt die Energie des gebogenen Stabs
  const energy = clamp01((p - VAULT.earliestRelease) / (VAULT.fullEnergyAt - VAULT.earliestRelease));
  s.peak = Math.max(start.y + (s.baseHeight + push - start.y) * energy, start.y + 0.1);
  const g = VAULT.gravity;
  const tUp = Math.sqrt((2 * (s.peak - start.y)) / g);
  const tDown = Math.sqrt((2 * Math.max(0.05, s.peak - VAULT.landHip)) / g);
  s.flight = {
    x0: start.x,
    y0: start.y,
    vx: Math.max(1.5, (VAULT.apexX - start.x) / tUp),
    vy: g * tUp,
    t: 0,
    tLand: tUp + tDown,
  };
  s.x = start.x;
  s.y = start.y;
  s.phase = 'flight';
  return quality;
}

export function isCleared(s: VaultState): boolean {
  return s.peak >= s.bar + VAULT.clearance;
}

export function stepVault(s: VaultState, dt: number): VaultEvent[] {
  const events: VaultEvent[] = [];
  switch (s.phase) {
    case 'runup': {
      s.v *= Math.exp(-PHYSICS.groundDrag * dt);
      s.x += s.v * dt;
      const before = Math.floor(s.stride * 2);
      s.stride += (s.v * dt) / strideLength(s.v);
      if (Math.floor(s.stride * 2) !== before) events.push({ type: 'footstep' });
      if (s.x >= -VAULT.runThroughAt) {
        s.phase = 'runthrough';
        s.outcome = 'runthrough';
        events.push({ type: 'runthrough' });
      }
      break;
    }
    case 'runthrough': {
      s.v *= Math.exp(-4 * dt);
      s.x += s.v * dt;
      s.stride += (s.v * dt) / strideLength(Math.max(1, s.v));
      break;
    }
    case 'vault': {
      s.p += dt / VAULT.vaultDuration;
      const hip = hipOnPole(s, s.p);
      s.x = hip.x;
      s.y = hip.y;
      if (s.p >= VAULT.hangAt) {
        events.push({ type: 'hang' });
        startFlight(s, s.p);
      }
      break;
    }
    case 'flight': {
      const f = s.flight!;
      const prevX = s.x;
      f.t = Math.min(f.t + dt, f.tLand);
      s.x = f.x0 + f.vx * f.t;
      s.y = f.y0 + f.vy * f.t - (VAULT.gravity * f.t * f.t) / 2;
      if (s.outcome === null && prevX < VAULT.barX && s.x >= VAULT.barX) {
        s.outcome = isCleared(s) ? 'clear' : 'knock';
        events.push({ type: s.outcome });
      }
      if (f.t >= f.tLand) {
        s.y = VAULT.landHip;
        s.phase = 'landed';
        if (s.outcome === null) {
          s.outcome = 'knock';
          events.push({ type: 'knock' });
        }
        events.push({ type: 'land' });
      }
      break;
    }
    default:
      break;
  }
  return events;
}

/** Flugfortschritt 0..1 (für Animation) */
export function flightProgress(s: VaultState): number {
  return s.flight ? s.flight.t / s.flight.tLand : 0;
}

// ---------------------------------------------------------- Wettkampf

/** Lattenhöhen: erst in 20-cm-, dann in 10-cm-Schritten */
export const HEIGHTS: readonly number[] = [
  3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0,
  ...Array.from({ length: 16 }, (_, i) => Math.round((5.1 + i * 0.1) * 100) / 100),
];

export interface VaultCpuProfile {
  name: string;
  /** Typische Sprunghöhe in Metern */
  mean: number;
  sigma: number;
  /** Einstiegshöhe */
  opening: number;
}

export const VAULT_CPU_PROFILES: readonly VaultCpuProfile[] = [
  { name: 'Rookie', mean: 4.6, sigma: 0.2, opening: 4.0 },
  { name: 'Profi', mean: 5.25, sigma: 0.17, opening: 4.6 },
  { name: 'Champion', mean: 5.8, sigma: 0.14, opening: 5.0 },
];

export function cpuAttempt(profile: VaultCpuProfile, bar: number, rng: () => number): boolean {
  const u = Math.max(rng(), 1e-9);
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  return profile.mean + n * profile.sigma >= bar + VAULT.clearance;
}

export interface Vaulter {
  id: number;
  isPlayer: boolean;
  /** Index der ersten Höhe, die angegangen wird */
  opening: number;
  /** Versuche je Höhe: 'O' gültig, 'X' ungültig, '-' ausgelassen */
  marks: string[];
  out: boolean;
}

export function createVaulter(id: number, isPlayer: boolean, openingHeight = HEIGHTS[0]): Vaulter {
  const opening = Math.max(0, HEIGHTS.findIndex((h) => h >= openingHeight - 1e-6));
  return { id, isPlayer, opening, marks: HEIGHTS.map(() => ''), out: false };
}

export function bestHeightIndex(a: Vaulter): number {
  for (let i = a.marks.length - 1; i >= 0; i--) if (a.marks[i].includes('O')) return i;
  return -1;
}

export function totalFails(a: Vaulter): number {
  return a.marks.reduce((n, m) => n + (m.match(/X/g)?.length ?? 0), 0);
}

export class Competition {
  heightIndex = 0;

  constructor(readonly vaulters: Vaulter[]) {}

  get height(): number {
    return HEIGHTS[this.heightIndex];
  }

  private needsAttempt(a: Vaulter): boolean {
    const m = a.marks[this.heightIndex];
    return !a.out && a.opening <= this.heightIndex && m !== '-' && !m.includes('O') && m.length < 3;
  }

  /** Wer springt als Nächstes? null = Wettkampf beendet. */
  nextTurn(): { vaulter: Vaulter; attempt: number } | null {
    while (this.heightIndex < HEIGHTS.length) {
      if (this.vaulters.every((a) => a.out)) return null;
      const candidates = this.vaulters.filter((a) => this.needsAttempt(a));
      if (candidates.length > 0) {
        // Abwechselnd: wer an dieser Höhe die wenigsten Versuche hat, ist dran
        const next = candidates.reduce((best, a) =>
          a.marks[this.heightIndex].length < best.marks[this.heightIndex].length ? a : best,
        );
        return { vaulter: next, attempt: next.marks[this.heightIndex].length + 1 };
      }
      this.heightIndex++;
    }
    for (const a of this.vaulters) a.out = true;
    return null;
  }

  record(a: Vaulter, ok: boolean): void {
    a.marks[this.heightIndex] += ok ? 'O' : 'X';
    if (a.marks[this.heightIndex] === 'XXX') a.out = true;
  }

  canPass(a: Vaulter): boolean {
    return a.marks[this.heightIndex] === '';
  }

  pass(a: Vaulter): void {
    if (this.canPass(a)) a.marks[this.heightIndex] = '-';
  }

  /** Freiwillig aufhören (z. B. als Letzter im Wettkampf) */
  retire(a: Vaulter): void {
    a.out = true;
  }

  /** Sind alle anderen schon ausgeschieden? */
  isLastStanding(a: Vaulter): boolean {
    return !a.out && this.vaulters.every((o) => o === a || o.out);
  }

  /** Rangliste: höchste Höhe, dann weniger Fehlversuche an dieser Höhe, dann insgesamt. */
  ranking(): Vaulter[] {
    const failsAtBest = (a: Vaulter) => {
      const i = bestHeightIndex(a);
      return i < 0 ? 0 : (a.marks[i].match(/X/g)?.length ?? 0);
    };
    return [...this.vaulters].sort(
      (a, b) =>
        bestHeightIndex(b) - bestHeightIndex(a) ||
        failsAtBest(a) - failsAtBest(b) ||
        totalFails(a) - totalFails(b),
    );
  }
}
