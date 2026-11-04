// Reine Spiellogik für das BMX-Rennen: Strecke, Fahrphysik, Tricks und
// Wertung (Trickpunkte + Zeitbonus). Ohne Phaser, damit sie testbar ist.

import { cpuField, type CpuSkill, type Difficulty } from './difficulty';
import { tapSpeed, type Side } from './hurdles';

export const BMX = {
  gravity: 9.81,
  /** Tempo-Kurve wie beim Laufen: Zuwachs je Tritt = tapGain · vmax · (1 − v / (tapSaturation · vmax)) */
  tapGain: 0.225,
  tapSaturation: 1.29,
  drag: 0.8,
  maxSpeed: 10.5,
  /** Hangabtrieb, abgeschwächt – sonst verliert man an jeder Rampe zu viel Tempo */
  slopeGravity: 0.55,
  hopSpeed: 3.8,
  hopCooldown: 0.3,
  /** Drehgeschwindigkeit in der Luft (rad/s) */
  spinSpeed: 6.0,
  /** Ohne Eingabe richtet sich das Rad langsam nach der Flugbahn aus */
  autoPitch: 2.2,
  autoPitchRange: 1.0,
  /** Erlaubter Winkel zwischen Rad und Boden bei der Landung */
  cleanLanding: 0.45,
  sketchyLanding: 0.85,
  sketchySpeedFactor: 0.7,
  crashDuration: 1.8,
  maxCrashes: 3,
  restartSpeed: 2.5,
  logHeight: 0.45,
  puddleDrag: 1.8,
  /** Ab dieser Stufe ist der Boden eine Wand */
  wallStep: 0.25,
  // Wertung
  flipPoints: 1000,
  trickPointsPerSecond: 1000,
  bigAirTime: 1.0,
  bigAirPoints: 200,
  cleanPoints: 50,
  parTime: 60,
  timePointsPerSecond: 100,
} as const;

// ---------------------------------------------------------------- Strecke

type Feature =
  | { kind: 'roller'; x: number; len: number; h: number }
  /** Hohlkehle nach oben, Absprungkante bei x + len, dahinter senkrecht runter */
  | { kind: 'kicker'; x: number; len: number; h: number }
  /** Senkrechte Wand bei x, flaches Deck, dann sanft hinunter */
  | { kind: 'landing'; x: number; deck: number; len: number; h: number }
  | { kind: 'table'; x: number; up: number; top: number; down: number; h: number };

export interface Course {
  length: number;
  features: Feature[];
  logs: number[];
  puddles: [number, number][];
}

/** Kicker mit Lücke und Landehügel */
function gap(x: number, h: number, len: number, gapLen: number): Feature[] {
  return [
    { kind: 'kicker', x, len, h },
    { kind: 'landing', x: x + len + gapLen, deck: 2, len: 6, h },
  ];
}

function rollers(x: number, count: number, h: number): Feature[] {
  return Array.from({ length: count }, (_, i) => ({ kind: 'roller' as const, x: x + i * 5, len: 5, h }));
}

export const COURSE: Course = {
  length: 270,
  features: [
    ...rollers(16, 3, 0.5),
    ...gap(48, 1.0, 3, 3.5),
    { kind: 'table', x: 86, up: 3.5, top: 5, down: 5, h: 1.2 },
    ...gap(122, 1.4, 3.5, 4),
    ...rollers(152, 3, 0.6),
    ...gap(188, 1.2, 3.2, 4),
    ...gap(232, 1.5, 3.5, 4.5),
  ],
  logs: [38, 110, 176],
  puddles: [
    [70, 77],
    [214, 222],
  ],
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

function featureHeight(f: Feature, x: number): number {
  switch (f.kind) {
    case 'roller': {
      const t = (x - f.x) / f.len;
      return t >= 0 && t <= 1 ? f.h * Math.sin(Math.PI * t) ** 2 : 0;
    }
    case 'kicker': {
      const t = (x - f.x) / f.len;
      return t >= 0 && t < 1 ? f.h * t * t : 0;
    }
    case 'landing': {
      if (x < f.x) return 0;
      if (x <= f.x + f.deck) return f.h;
      const t = (x - f.x - f.deck) / f.len;
      return t <= 1 ? f.h * (1 - smoothstep(t)) : 0;
    }
    case 'table': {
      const d = x - f.x;
      if (d < 0) return 0;
      if (d < f.up) return f.h * (d / f.up) ** 2;
      if (d <= f.up + f.top) return f.h;
      const t = (d - f.up - f.top) / f.down;
      return t <= 1 ? f.h * (1 - smoothstep(t)) : 0;
    }
  }
}

export function groundHeight(x: number, course: Course = COURSE): number {
  let h = 0;
  for (const f of course.features) h = Math.max(h, featureHeight(f, x));
  return h;
}

/** Steigung links von x (an Kanten zählt die Seite, von der man kommt) */
export function groundSlope(x: number, course: Course = COURSE): number {
  const d = 0.02;
  return (groundHeight(x, course) - groundHeight(x - d, course)) / d;
}

export function inPuddle(x: number, course: Course = COURSE): boolean {
  return course.puddles.some(([a, b]) => x >= a && x <= b);
}

// ---------------------------------------------------------------- Fahrer

export type RiderPhase = 'ready' | 'ground' | 'air' | 'crashed' | 'finished' | 'out';
export type CrashReason = 'landing' | 'trick' | 'log' | 'wall';

export interface JumpScore {
  points: number;
  flips: number;
  trickTime: number;
  bigAir: boolean;
  clean: boolean;
}

export type RiderEvent =
  | { type: 'takeoff' }
  | { type: 'land'; score: JumpScore }
  | { type: 'crash'; reason: CrashReason }
  | { type: 'splash' }
  | { type: 'finish'; time: number }
  | { type: 'out' };

export interface RiderState {
  phase: RiderPhase;
  /** Position (Mitte zwischen den Rädern) in Metern */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Neigung des Rads; positiv = Vorderrad nach unten (wie auf dem Bildschirm) */
  angle: number;
  lastSide: Side | null;
  /** Kurbelumdrehungen für die Animation */
  crank: number;
  hopCooldown: number;
  airTime: number;
  /** Eigene Drehung in der Luft (für Saltos) */
  spin: number;
  trickTime: number;
  /** Gehaltene Eingaben: Drehrichtung −1/0/1 und Trick */
  rotInput: number;
  trickHeld: boolean;
  crashTimer: number;
  crashes: number;
  points: number;
  flips: number;
  finishTime: number | null;
  wasInPuddle: boolean;
}

export function createRider(): RiderState {
  return {
    phase: 'ready',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    lastSide: null,
    crank: 0,
    hopCooldown: 0,
    airTime: 0,
    spin: 0,
    trickTime: 0,
    rotInput: 0,
    trickHeld: false,
    crashTimer: 0,
    crashes: 0,
    points: 0,
    flips: 0,
    finishTime: null,
    wasInPuddle: false,
  };
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Startgatter fällt – ab jetzt darf getreten werden */
export function startRider(s: RiderState): void {
  if (s.phase === 'ready') s.phase = 'ground';
}

/** Treten: wie beim Laufen zählen nur abwechselnde Tipps, und nur am Boden. */
export function pedal(s: RiderState, side: Side): boolean {
  if (side === s.lastSide || (s.phase !== 'ground' && s.phase !== 'air')) return false;
  s.lastSide = side;
  if (s.phase !== 'ground') return false;
  s.vx = tapSpeed(s.vx, BMX.maxSpeed, 1, BMX.tapGain, BMX.tapSaturation);
  return true;
}

export function hop(s: RiderState): boolean {
  if (s.phase !== 'ground' || s.hopCooldown > 0) return false;
  s.vy = s.vx * groundSlope(s.x) + BMX.hopSpeed;
  takeOff(s);
  return true;
}

function takeOff(s: RiderState): void {
  s.phase = 'air';
  s.airTime = 0;
  s.spin = 0;
  s.trickTime = 0;
}

function crash(s: RiderState, reason: CrashReason, events: RiderEvent[]): void {
  s.phase = 'crashed';
  s.crashes++;
  s.crashTimer = BMX.crashDuration;
  s.vx *= 0.5;
  s.vy = 0;
  s.y = groundHeight(s.x);
  s.trickTime = 0;
  events.push({ type: 'crash', reason });
}

function logCrossed(x0: number, x1: number): number | null {
  for (const l of COURSE.logs) if (x0 < l && x1 >= l) return l;
  return null;
}

/** Wertet eine Landung aus und vergibt Punkte. */
function land(s: RiderState, events: RiderEvent[]): void {
  const ground = -Math.atan(groundSlope(s.x));
  const diff = Math.abs(wrapAngle(s.angle - ground));
  if (s.trickHeld && s.trickTime > 0) {
    crash(s, 'trick', events);
    return;
  }
  if (diff > BMX.sketchyLanding) {
    crash(s, 'landing', events);
    return;
  }
  const clean = diff < BMX.cleanLanding;
  const flips = Math.floor((Math.abs(s.spin) + 0.6) / (2 * Math.PI));
  const bigAir = s.airTime >= BMX.bigAirTime;
  let points = flips * BMX.flipPoints + Math.round((s.trickTime * BMX.trickPointsPerSecond) / 10) * 10;
  if (bigAir) points += BMX.bigAirPoints;
  if (points > 0 && clean) points += BMX.cleanPoints;
  if (!clean) {
    points = Math.round(points / 20) * 10;
    s.vx *= BMX.sketchySpeedFactor;
  }
  s.points += points;
  s.flips += flips;
  s.phase = 'ground';
  s.y = groundHeight(s.x);
  s.vy = 0;
  s.angle = ground;
  s.hopCooldown = 0.15;
  events.push({ type: 'land', score: { points, flips, trickTime: s.trickTime, bigAir, clean } });
}

export function stepRider(s: RiderState, dt: number, time: number): RiderEvent[] {
  const events: RiderEvent[] = [];
  const prevX = s.x;

  switch (s.phase) {
    case 'ground': {
      const slope = groundSlope(s.x);
      const puddle = inPuddle(s.x);
      if (puddle && !s.wasInPuddle && s.vx > 2) events.push({ type: 'splash' });
      s.wasInPuddle = puddle;
      s.vx *= Math.exp(-(BMX.drag + (puddle ? BMX.puddleDrag : 0)) * dt);
      s.vx -= ((BMX.gravity * BMX.slopeGravity * slope) / (1 + slope * slope)) * dt;
      s.vx = Math.max(0, s.vx);
      s.hopCooldown = Math.max(0, s.hopCooldown - dt);
      const nx = s.x + s.vx * dt;
      const ng = groundHeight(nx);
      if (ng - s.y > BMX.wallStep) {
        crash(s, 'wall', events);
        break;
      }
      if (logCrossed(s.x, nx) !== null) {
        s.x = nx;
        crash(s, 'log', events);
        break;
      }
      // Fällt der Boden schneller weg als die Schwerkraft zieht, hebt man ab
      const vy = s.vx * slope;
      const ballistic = s.y + vy * dt - 0.5 * BMX.gravity * dt * dt;
      s.x = nx;
      if (ballistic > ng + 0.01) {
        s.y = ballistic;
        s.vy = vy - BMX.gravity * dt;
        takeOff(s);
        events.push({ type: 'takeoff' });
      } else {
        s.y = ng;
        s.angle = -Math.atan(groundSlope(nx));
      }
      s.crank += (s.vx * dt) / 2.4;
      break;
    }
    case 'air': {
      s.vy -= BMX.gravity * dt;
      const nx = s.x + s.vx * dt;
      const ny = s.y + s.vy * dt;
      s.airTime += dt;
      if (s.rotInput !== 0) {
        const d = s.rotInput * BMX.spinSpeed * dt;
        s.angle += d;
        s.spin += d;
      } else {
        // Die Nase folgt sanft der Flugbahn – aber nur bei kleinen Abweichungen,
        // ein halber Salto rettet sich nicht von selbst
        const target = -0.5 * Math.atan2(s.vy, s.vx);
        const diff = wrapAngle(target - s.angle);
        if (Math.abs(diff) < BMX.autoPitchRange) {
          s.angle += Math.max(-BMX.autoPitch * dt, Math.min(BMX.autoPitch * dt, diff));
        }
      }
      if (s.trickHeld) s.trickTime += dt;
      const ng = groundHeight(nx);
      const log = logCrossed(s.x, nx);
      if (log !== null && ny - groundHeight(log) < BMX.logHeight) {
        s.x = nx;
        crash(s, 'log', events);
        break;
      }
      if (ny <= ng) {
        // Von unten gegen eine Rampenwand oder ganz normal gelandet?
        if (ng - s.y > BMX.wallStep && groundHeight(s.x) < ng - BMX.wallStep) {
          crash(s, 'wall', events);
          break;
        }
        s.x = nx;
        s.y = ng;
        land(s, events);
      } else {
        s.x = nx;
        s.y = ny;
      }
      break;
    }
    case 'crashed': {
      s.crashTimer -= dt;
      s.vx *= Math.exp(-3 * dt);
      s.x += s.vx * dt;
      s.y = groundHeight(s.x);
      if (s.crashTimer <= 0) {
        if (s.crashes >= BMX.maxCrashes) {
          s.phase = 'out';
          events.push({ type: 'out' });
        } else {
          s.phase = 'ground';
          s.vx = BMX.restartSpeed;
          s.angle = -Math.atan(groundSlope(s.x));
          s.hopCooldown = 0.3;
        }
      }
      break;
    }
    case 'finished': {
      s.vx *= Math.exp(-1.5 * dt);
      s.x += s.vx * dt;
      s.y = groundHeight(s.x);
      s.crank += (s.vx * dt) / 2.4;
      break;
    }
    default:
      break;
  }

  if (s.finishTime === null && s.phase !== 'out' && prevX < COURSE.length && s.x >= COURSE.length) {
    const overshoot = s.vx > 0 ? (s.x - COURSE.length) / s.vx : 0;
    s.finishTime = Math.max(0, time - overshoot);
    if (s.phase === 'ground' || s.phase === 'crashed') s.phase = 'finished';
    events.push({ type: 'finish', time: s.finishTime });
  }
  // Im Ziel gelandet: ab dann ausrollen
  if (s.finishTime !== null && s.phase === 'ground') s.phase = 'finished';
  return events;
}

export function timeBonus(s: RiderState): number {
  if (s.finishTime === null) return 0;
  return Math.max(0, Math.round((BMX.parTime - s.finishTime) * BMX.timePointsPerSecond));
}

export function totalScore(s: RiderState): number {
  return s.points + timeBonus(s);
}

/** Wo und in welcher Lage landet man, wenn man jetzt nichts mehr tut? */
export function predictLanding(s: RiderState): { time: number; angle: number } {
  let { x, y, vy } = s;
  for (let t = 0; t < 4; t += 1 / 60) {
    vy -= BMX.gravity / 60;
    x += s.vx / 60;
    y += vy / 60;
    if (y <= groundHeight(x)) return { time: t, angle: -Math.atan(groundSlope(x)) };
  }
  return { time: 4, angle: 0 };
}

// ------------------------------------------------------- Computerfahrer

export interface BmxCpuProfile {
  name: string;
  tapRate: number;
  /** Ungenauigkeit beim Timing (Sekunden) */
  error: number;
  flipChance: number;
  trickChance: number;
  /** Wie oft ein Trick missglückt */
  mistakeChance: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** BMX-Profil aus Tipprate und Fehlerfaktor */
export function bmxCpuProfile({ rate, error: e }: CpuSkill, name: string): BmxCpuProfile {
  return {
    name,
    tapRate: rate,
    error: 0.08 * e,
    flipChance: clamp(0.9 - 0.9 * (e - 0.33), 0, 0.9),
    trickChance: clamp(0.9 - 0.45 * (e - 0.33), 0.2, 0.9),
    mistakeChance: clamp(0.12 * e, 0.02, 0.4),
  };
}

/** Die drei Gegner einer Stufe (Rookie/Profi/Champion) */
export function bmxCpuProfiles(d: Difficulty): BmxCpuProfile[] {
  return cpuField(d, bmxCpuProfile);
}

// Reihenfolge Rookie/Profi/Champion – wird in competition.test.ts geprüft!
export const BMX_CPU_PROFILES: readonly BmxCpuProfile[] = bmxCpuProfiles('normal');

/** Steuert einen Computerfahrer über dieselben Eingaben wie ein Mensch. */
export class BmxCpu {
  private nextTap = 0;
  private side: Side = 'L';
  private plan: 'none' | 'cruise' | 'flip' | 'trick' = 'none';
  private trickUntil = 0;
  private flipDone = false;
  private hopFor: number | null = null;
  private blunder = false;
  private jitter = 0;
  private readonly rate: number;

  constructor(
    readonly rider: RiderState,
    readonly profile: BmxCpuProfile,
    private readonly rng: () => number,
  ) {
    // Jede Fahrt ist etwas anders – auch Computer haben gute und schlechte Tage
    this.rate = profile.tapRate * (0.95 + 0.1 * rng());
    this.nextTap = 0.15 + rng() * 0.15;
  }

  update(time: number): void {
    const s = this.rider;
    if (s.phase === 'ground') {
      while (time >= this.nextTap) {
        pedal(s, this.side);
        this.side = this.side === 'L' ? 'R' : 'L';
        this.nextTap += (1 + (this.rng() - 0.5) * 0.3) / this.rate;
      }
      this.plan = 'none';
      s.rotInput = 0;
      s.trickHeld = false;
      // Über Baumstämme hüpfen
      const log = COURSE.logs.find((l) => l > s.x);
      if (log !== undefined) {
        if (this.hopFor !== log) {
          this.hopFor = log;
          this.jitter = (this.rng() - 0.5) * 2 * this.profile.error;
        }
        const lead = 0.28 + this.jitter;
        if (log - s.x <= s.vx * lead) hop(s);
      }
      return;
    }
    this.nextTap = Math.max(this.nextTap, time);
    if (s.phase !== 'air') return;

    const landing = predictLanding(s);
    if (this.plan === 'none') {
      // Plan für diesen Sprung fassen
      const flipTime = (2 * Math.PI) / BMX.spinSpeed + 0.25;
      this.flipDone = false;
      this.trickUntil = 0;
      this.jitter = (this.rng() - 0.5) * 2 * this.profile.error;
      this.blunder = this.rng() < this.profile.mistakeChance;
      if (landing.time > flipTime && this.rng() < this.profile.flipChance) {
        this.plan = 'flip';
      } else if (landing.time > 0.55 && this.rng() < this.profile.trickChance) {
        this.plan = 'trick';
        this.trickUntil = s.airTime + landing.time * (0.4 + this.rng() * 0.3);
      } else {
        this.plan = 'cruise';
      }
    }

    // Missglückt: Trick zu lange gehalten bzw. Salto zu früh abgebrochen
    s.trickHeld =
      this.plan === 'trick' && (this.blunder || (s.airTime < this.trickUntil && landing.time > 0.2 + this.jitter));
    if (this.plan === 'flip' && !this.flipDone) {
      s.rotInput = -1;
      if (Math.abs(s.spin) >= 2 * Math.PI - (this.blunder ? 1.6 : 0.3)) this.flipDone = true;
      return;
    }
    if (this.plan === 'flip' && this.blunder) {
      s.rotInput = 0;
      return;
    }
    // Rad für die Landung ausrichten
    const diff = wrapAngle(landing.angle - s.angle);
    s.rotInput = Math.abs(diff) > 0.12 + Math.abs(this.jitter) ? Math.sign(diff) : 0;
  }
}
