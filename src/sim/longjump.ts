// Reine Spiellogik für den Weitsprung: Anlauf, Absprung am Brett mit
// Winkelwahl, Flug, Landung – und der Wettkampf über drei Durchgänge.

import { gaussian } from './cpu';
import { cpuField, cpuJitter, type CpuSkill, type Difficulty } from './difficulty';
import { PHYSICS, strideLength, tapSpeed, type Side } from './hurdles';

export const LJ = {
  /** Anlauflänge in Metern bis zur Vorderkante des Bretts (x = 0) */
  runup: 32,
  /** Mit der Tempo-Kurve aus hurdles.ts: Weltrekord 8,95 m braucht ~10/s und nahezu perfektes Timing */
  maxSpeed: 10.8,
  /** Winkel beim Drücken der Leertaste; steigt, solange sie gehalten wird */
  angleStart: 8,
  angleRate: 70,
  angleMax: 50,
  /** Wer so weit hinter dem Brett noch nicht abgesprungen ist, hat übertreten */
  runThroughAt: 1.0,
  /** Absprung kostet Horizontaltempo – umso mehr, je steiler */
  angleLoss: 0.35,
  /** Abdruck nach oben aus dem Bein */
  liftFactor: 0.95,
  hipHeight: 1.0,
  /** Hüfthöhe, wenn die Füße den Sand berühren */
  landHip: 0.55,
  /** Füße vor der Hüfte: gestreckt, halb gestreckt, nach hinten gefallen */
  feetExtended: 0.7,
  feetEarly: 0.35,
  sitBack: -0.25,
  /** So kurz vor der Landung müssen die Beine nach vorne */
  extendWindow: 0.35,
  gravity: 9.81,
} as const;

export type LjPhase = 'ready' | 'runup' | 'takeoff' | 'flight' | 'landed' | 'runthrough';
export type Landing = 'extended' | 'early' | 'sitback';

export type LjEvent =
  | { type: 'footstep' }
  | { type: 'takeoff'; foul: boolean }
  | { type: 'launch'; angle: number }
  | { type: 'land'; landing: Landing }
  | { type: 'runthrough' };

export interface LjState {
  phase: LjPhase;
  /** Hüftposition in Metern; x = 0 ist die Vorderkante des Absprungbretts */
  x: number;
  y: number;
  v: number;
  /** Geglättetes Anlauftempo – jeder einzelne Tipp soll die Weite nicht zum Glücksspiel machen */
  vAvg: number;
  vx: number;
  vy: number;
  lastSide: Side | null;
  stride: number;
  takeoffX: number | null;
  /** Absprungwinkel in Grad */
  angle: number;
  foul: boolean;
  flightTime: number;
  extendAt: number | null;
  landing: Landing | null;
  /** Gemessene Weite (null = ungültig) */
  distance: number | null;
}

export function createJump(): LjState {
  return {
    phase: 'ready',
    x: -LJ.runup,
    y: LJ.hipHeight,
    v: 0,
    vAvg: 0,
    vx: 0,
    vy: 0,
    lastSide: null,
    stride: 0,
    takeoffX: null,
    angle: LJ.angleStart,
    foul: false,
    flightTime: 0,
    extendAt: null,
    landing: null,
    distance: null,
  };
}

export function ljTap(s: LjState, side: Side): boolean {
  if ((s.phase !== 'ready' && s.phase !== 'runup') || side === s.lastSide) return false;
  s.lastSide = side;
  s.phase = 'runup';
  s.v = tapSpeed(s.v, LJ.maxSpeed);
  return true;
}

/**
 * Leertaste gedrückt: am Brett abspringen bzw. in der Luft die Beine strecken.
 * `lateBy` = wie viele Sekunden der Tastendruck schon zurückliegt – so zählt
 * der echte Moment des Drückens und nicht das nächste Bild.
 */
export function ljPress(s: LjState, lateBy = 0): LjEvent | null {
  if (s.phase === 'runup') {
    s.phase = 'takeoff';
    s.takeoffX = s.x - s.v * Math.min(0.1, Math.max(0, lateBy));
    s.foul = s.takeoffX > 0;
    s.angle = LJ.angleStart;
    return { type: 'takeoff', foul: s.foul };
  }
  if (s.phase === 'flight' && s.extendAt === null) {
    s.extendAt = s.flightTime;
  }
  return null;
}

/** Leertaste losgelassen: mit dem gewählten Winkel abheben. */
export function ljRelease(s: LjState): LjEvent | null {
  return s.phase === 'takeoff' ? launch(s) : null;
}

function launch(s: LjState): LjEvent {
  const a = (s.angle * Math.PI) / 180;
  const loss = 1 - LJ.angleLoss * (s.angle / 45) ** 2;
  s.vx = s.vAvg * Math.cos(a) * loss;
  s.vy = s.vAvg * Math.sin(a) * LJ.liftFactor;
  s.phase = 'flight';
  s.flightTime = 0;
  return { type: 'launch', angle: s.angle };
}

/** Gesamte Flugzeit bis zur Landung (für Animation und Timing) */
export function flightDuration(s: LjState): number {
  const g = LJ.gravity;
  const drop = LJ.hipHeight - LJ.landHip;
  return (s.vy + Math.sqrt(s.vy * s.vy + 2 * g * drop)) / g;
}

export function stepJump(s: LjState, dt: number): LjEvent[] {
  const events: LjEvent[] = [];
  switch (s.phase) {
    case 'runup':
    case 'runthrough': {
      const drag = s.phase === 'runthrough' ? 5 : PHYSICS.groundDrag;
      s.v *= Math.exp(-drag * dt);
      s.vAvg += (s.v - s.vAvg) * (1 - Math.exp(-dt / 0.25));
      s.x += s.v * dt;
      const before = Math.floor(s.stride * 2);
      s.stride += (s.v * dt) / strideLength(Math.max(1, s.v));
      if (s.phase === 'runup' && Math.floor(s.stride * 2) !== before) events.push({ type: 'footstep' });
      if (s.phase === 'runup' && s.x > LJ.runThroughAt) {
        s.phase = 'runthrough';
        s.foul = true;
        events.push({ type: 'runthrough' });
      }
      break;
    }
    case 'takeoff': {
      s.angle = Math.min(LJ.angleMax, s.angle + LJ.angleRate * dt);
      if (s.angle >= LJ.angleMax) events.push(launch(s));
      break;
    }
    case 'flight': {
      s.flightTime += dt;
      const t = s.flightTime;
      s.x = s.takeoffX! + s.vx * t;
      s.y = LJ.hipHeight + s.vy * t - (LJ.gravity * t * t) / 2;
      if (s.y <= LJ.landHip) {
        const total = flightDuration(s);
        const x = s.takeoffX! + s.vx * total;
        let landing: Landing = 'sitback';
        if (s.extendAt !== null) landing = total - s.extendAt <= LJ.extendWindow ? 'extended' : 'early';
        const feet = landing === 'extended' ? LJ.feetExtended : landing === 'early' ? LJ.feetEarly : LJ.sitBack;
        s.x = x;
        s.y = LJ.landHip;
        s.landing = landing;
        s.phase = 'landed';
        // Gemessen wird ab Brettkante bis zum hintersten Abdruck im Sand, auf den Zentimeter abgerundet
        s.distance = s.foul ? null : Math.floor((x + feet) * 100) / 100;
        events.push({ type: 'land', landing });
      }
      break;
    }
    default:
      break;
  }
  return events;
}

// ---------------------------------------------------------- Wettkampf

export const ROUNDS = 3;

export interface JumpCpuProfile {
  name: string;
  /** Gültige Tipps pro Sekunde */
  tapRate: number;
  /** Relative Schwankung des Tipp-Abstands (gleichverteilt ±) */
  tapJitter: number;
  /** σ des Absprungs in Sekunden – gezielt wird 1 σ vor die Brettkante */
  boardError: number;
  /** σ des Absprungwinkels in Grad (Ziel 30°) */
  angleError: number;
  /** σ des Beinestreckens in Sekunden (Ziel 0,15 s vor der Landung) */
  extendError: number;
}

/** Weitsprung-Profil aus Tipprate und Fehlerfaktor */
export function jumpCpuProfile({ rate, error }: CpuSkill, name: string): JumpCpuProfile {
  return {
    name,
    tapRate: rate,
    tapJitter: cpuJitter(error),
    boardError: 0.04 * error,
    angleError: 4 * error,
    extendError: 0.06 * error,
  };
}

/** Die drei Gegner einer Stufe (Rookie/Profi/Champion) */
export function jumpCpuProfiles(d: Difficulty): JumpCpuProfile[] {
  return cpuField(d, jumpCpuProfile);
}

// Reihenfolge Rookie/Profi/Champion – wird in competition.test.ts geprüft!
export const LJ_CPU_PROFILES: readonly JumpCpuProfile[] = jumpCpuProfiles('normal');

/** Ein Computer-Versuch über dieselben Eingaben wie ein Mensch: anlaufen, abspringen, Winkel, Beine. */
export function simulateCpuJump(p: JumpCpuProfile, rng: () => number): LjState {
  const s = createJump();
  const dt = 1 / 120;
  // Sicherheitsabstand zum Brett als Zeit; negativ = übertreten
  const margin = p.boardError + gaussian(rng) * p.boardError;
  const angle = 30 + gaussian(rng) * p.angleError;
  const extend = 0.15 + gaussian(rng) * p.extendError;
  let t = 0;
  let nextTap = 0;
  let side: Side = 'L';
  while (s.phase !== 'landed' && s.phase !== 'runthrough' && t < 20) {
    t += dt;
    while ((s.phase === 'ready' || s.phase === 'runup') && t >= nextTap) {
      ljTap(s, side);
      side = side === 'L' ? 'R' : 'L';
      nextTap += (1 + p.tapJitter * (2 * rng() - 1)) / p.tapRate;
    }
    if (s.phase === 'runup' && s.x >= -s.v * margin) {
      // Wie im Spiel: den Moment des Drückens zurückrechnen
      ljPress(s, (s.x + s.v * margin) / Math.max(1, s.v));
    }
    if (s.phase === 'takeoff' && s.angle >= angle) ljRelease(s);
    if (extend >= 0 && s.phase === 'flight' && s.extendAt === null && flightDuration(s) - s.flightTime <= extend) {
      ljPress(s);
    }
    stepJump(s, dt);
  }
  return s;
}

/** Ein Computer-Versuch: Weite oder null bei Übertreten – mit derselben Sim gerechnet wie der Spieler */
export function cpuJump(p: JumpCpuProfile, rng: () => number): number | null {
  return simulateCpuJump(p, rng).distance;
}

export interface Jumper {
  id: number;
  isPlayer: boolean;
  /** Je Durchgang: Weite, null = ungültig, undefined = noch nicht gesprungen */
  attempts: (number | null | undefined)[];
}

export function createJumper(id: number, isPlayer: boolean): Jumper {
  return { id, isPlayer, attempts: Array(ROUNDS).fill(undefined) };
}

export function bestJump(j: Jumper): number | null {
  const valid = j.attempts.filter((a): a is number => typeof a === 'number');
  return valid.length ? Math.max(...valid) : null;
}

/** Rangliste: beste Weite, bei Gleichstand entscheidet die zweitbeste usw. */
export function rankJumpers(jumpers: Jumper[]): Jumper[] {
  const series = (j: Jumper) =>
    j.attempts.filter((a): a is number => typeof a === 'number').sort((a, b) => b - a);
  return [...jumpers].sort((a, b) => {
    const sa = series(a);
    const sb = series(b);
    for (let i = 0; i < ROUNDS; i++) {
      const d = (sb[i] ?? -1) - (sa[i] ?? -1);
      if (d !== 0) return d;
    }
    return 0;
  });
}

/** Nächster Versuch: Durchgang für Durchgang in fester Reihenfolge. null = fertig. */
export function nextJump(jumpers: Jumper[]): { jumper: Jumper; round: number } | null {
  for (let round = 0; round < ROUNDS; round++) {
    const j = jumpers.find((x) => x.attempts[round] === undefined);
    if (j) return { jumper: j, round };
  }
  return null;
}
