// Reine Spiellogik für das Turmspringen (10 m): Schwung holen am Turm, Absprung
// im Takt des Armschwungs, Salto halten, öffnen, Eintauchen – und die Wertung
// der fünf Kampfrichter. Ohne Phaser, damit sie testbar ist.

import { createRng, gaussian } from './cpu';
import type { Side } from './hurdles';

export const DIVE = {
  /** Plattformhöhe über dem Wasser in Metern */
  platform: 10,
  /** Hüfthöhe über der Plattform im Stand bzw. über dem Wasser beim Eintauchen */
  standHip: 1.0,
  entryHip: 1.0,
  gravity: 9.81,
  forwardSpeed: 1.2,
  /** Armschwung: fester Takt, erster Hochpunkt so lange nach dem ersten Tipp */
  swingPeriod: 1.0,
  swingFirstPeak: 0.25,
  /** Schwung je gültigem Tipp; Gleichgewicht ≈ Tipprate × swingImpulse / swingDamping */
  swingImpulse: 0.135,
  swingDamping: 1.5,
  /** Zeitkonstante der Glättung in Sekunden */
  swingSmooth: 0.3,
  /** Ohne Leertaste springt der Springer so lange nach dem ersten Tipp von selbst */
  maxSwingTime: 6,
  walkTime: 0.8,
  /** Abstand zum Hochpunkt, ab dem die Absprung-Güte 0 ist */
  takeoffWindow: 0.2,
  takeoffMinFactor: 0.75,
  upSpeedMin: 1.5,
  upSpeedMax: 4.0,
  /** Umdrehungen/s bei Kraft 1 */
  spinRate: { tuck: 2.9, pike: 2.25, straight: 1.5 },
  /** Ausrichten nach dem Öffnen: Grad/s, nur bei Fehlern bis alignRange */
  alignRate: 70,
  alignRange: 60,
  /** So lange vor dem Eintauchen sollte die Linie stehen */
  lineTimeFull: 0.25,
  twistTime: 0.45,
  perfectAngle: 8,
  cleanAngle: 20,
  slapAngle: 75,
  wrongAngle: 270,
  weights: { takeoff: 0.15, height: 0.15, entry: 0.5, line: 0.2 },
  heightLow: 0.5,
  twistPenalty: 2.5,
  failCap: 2.0,
  judgeBias: [-0.4, 0.2, 0, -0.2, 0.4],
  judgeNoise: 0.3,
  rounds: 3,
  worldRecord: 281.0,
  underwaterTime: 1.2,
} as const;

// ---------------------------------------------------------------- Sprungliste

export type DiveId = 'kopf' | '15h' | '15p' | '25h' | '25p' | '15s2' | '35h' | '45h';
export type DivePosition = 'tuck' | 'pike' | 'straight';

export interface DiveDef {
  id: DiveId;
  name: string;
  /** Anzahl Salti (½ = 0.5) */
  somersaults: number;
  position: DivePosition;
  twists: number;
  /** Schwierigkeitsgrad */
  dd: number;
}

export const DIVES: readonly DiveDef[] = [
  { id: 'kopf', name: 'KOPFSPRUNG GESTRECKT', somersaults: 0.5, position: 'straight', twists: 0, dd: 1.2 },
  { id: '15h', name: '1½ SALTI GEHOCKT', somersaults: 1.5, position: 'tuck', twists: 0, dd: 1.6 },
  { id: '15p', name: '1½ SALTI GEHECHTET', somersaults: 1.5, position: 'pike', twists: 0, dd: 1.9 },
  { id: '25h', name: '2½ SALTI GEHOCKT', somersaults: 2.5, position: 'tuck', twists: 0, dd: 2.2 },
  { id: '25p', name: '2½ SALTI GEHECHTET', somersaults: 2.5, position: 'pike', twists: 0, dd: 2.6 },
  { id: '15s2', name: '1½ SALTI 2 SCHRAUBEN', somersaults: 1.5, position: 'straight', twists: 2, dd: 2.6 },
  { id: '35h', name: '3½ SALTI GEHOCKT', somersaults: 3.5, position: 'tuck', twists: 0, dd: 3.2 },
  { id: '45h', name: '4½ SALTI GEHOCKT', somersaults: 4.5, position: 'tuck', twists: 0, dd: 3.7 },
];

export function diveById(id: DiveId): DiveDef {
  return DIVES.find((d) => d.id === id)!;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Ziel-Drehung in Grad (0 = aufrecht, 180 = Kopf unten) */
export function targetRot(def: DiveDef): number {
  return def.somersaults * 360;
}

/** Drehgeschwindigkeit in Grad/s bei gehaltener Sprungposition */
export function spinSpeed(def: DiveDef, power: number): number {
  return power * DIVE.spinRate[def.position] * 360;
}

export function upSpeed(power: number): number {
  return lerp(DIVE.upSpeedMin, DIVE.upSpeedMax, power);
}

/** Flugzeit vom Absprung bis zum Eintauchen */
export function flightTime(power: number): number {
  const vy = upSpeed(power);
  const drop = DIVE.platform + DIVE.standHip - DIVE.entryHip;
  return (vy + Math.sqrt(vy * vy + 2 * DIVE.gravity * drop)) / DIVE.gravity;
}

/** Kleinste Kraft, bei der das Ziel lineTimeFull vor dem Eintauchen erreicht ist */
export function minPower(def: DiveDef): number {
  const reached = (p: number) => spinSpeed(def, p) * (flightTime(p) - DIVE.lineTimeFull) >= targetRot(def);
  let lo = 0;
  let hi = 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (reached(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// ---------------------------------------------------------------- Springer

export type DivePhase = 'walk' | 'ready' | 'swing' | 'air' | 'water' | 'done';
export type EntryRating = 'perfect' | 'clean' | 'early' | 'late' | 'belly' | 'back' | 'bomb' | 'wrong';

export type DiveEvent =
  | { type: 'ready' }
  | { type: 'peak' }
  | { type: 'takeoff'; quality: number; power: number; auto: boolean }
  | { type: 'halfTurn'; n: number }
  | { type: 'open' }
  | { type: 'tuck' }
  | { type: 'twistStart'; n: number }
  | { type: 'twistEnd'; n: number }
  | { type: 'entry'; rating: EntryRating; splash: number }
  | { type: 'surface' };

export interface DiveState {
  def: DiveDef;
  phase: DivePhase;
  /** Sim-Zeit in Sekunden ab createDive */
  time: number;
  phaseStart: number;
  lastSide: Side | null;
  /** Schwung: ungeglättet, geglättet (ohne Deckel) und angezeigt (0..1, nach dem Absprung eingefroren) */
  raw: number;
  swingAvg: number;
  swing: number;
  /** Zeit des ersten Tipps – Bezug für den Takt der Hochpunkte */
  t0: number | null;
  takeoffAt: number | null;
  /** Absprung-Güte 0..1 und Abstand zum Hochpunkt (negativ = zu früh) */
  quality: number;
  takeoffOffset: number;
  autoTakeoff: boolean;
  power: number;
  vx: number;
  vy0: number;
  /** x ab Plattformkante, y = Hüfthöhe über dem Wasser */
  x: number;
  y: number;
  airTime: number;
  held: boolean;
  /** Drehung in Grad, vorwärts positiv */
  rot: number;
  /** Zeit des letzten Öffnens (null = Position gehalten) */
  openAt: number | null;
  twistsDone: number;
  twistStart: number | null;
  entryAt: number | null;
  rating: EntryRating | null;
  splash: number;
  /** Messwerte beim Eintauchen */
  delta: number;
  line: number;
  twistOpen: boolean;
  /** Ereignisse aus Eingaben, die stepDive mit zurückgibt */
  pending: DiveEvent[];
}

export function createDive(def: DiveDef): DiveState {
  return {
    def,
    phase: 'walk',
    time: 0,
    phaseStart: 0,
    lastSide: null,
    raw: 0,
    swingAvg: 0,
    swing: 0,
    t0: null,
    takeoffAt: null,
    quality: 0,
    takeoffOffset: 0,
    autoTakeoff: false,
    power: 0,
    vx: 0,
    vy0: 0,
    x: 0,
    y: DIVE.platform + DIVE.standHip,
    airTime: 0,
    held: false,
    rot: 0,
    openAt: null,
    twistsDone: 0,
    twistStart: null,
    entryAt: null,
    rating: null,
    splash: 0,
    delta: 0,
    line: 0,
    twistOpen: false,
    pending: [],
  };
}

const EPS = 1e-9;
const MAX_SUBSTEP = 1 / 120;

function peakTime(s: DiveState, k: number): number {
  return s.t0! + DIVE.swingFirstPeak + k * DIVE.swingPeriod;
}

/** Nächste Zeit, an der die Sim exakt anhalten muss (Phasenwechsel, Schraubenende, Eintauchen) */
function boundary(s: DiveState): number {
  switch (s.phase) {
    case 'walk':
      return s.phaseStart + DIVE.walkTime;
    case 'swing':
      return s.t0! + DIVE.maxSwingTime;
    case 'air': {
      const entry = s.takeoffAt! + flightTime(s.power);
      return s.twistStart !== null ? Math.min(entry, s.twistStart + DIVE.twistTime) : entry;
    }
    case 'water':
      return s.entryAt! + DIVE.underwaterTime;
    default:
      return Infinity;
  }
}

function setPhase(s: DiveState, phase: DivePhase): void {
  s.phase = phase;
  s.phaseStart = s.time;
}

function launch(s: DiveState, quality: number, offset: number, auto: boolean, out: DiveEvent[]): void {
  s.quality = quality;
  s.takeoffOffset = offset;
  s.autoTakeoff = auto;
  s.swing = Math.min(1, s.swingAvg);
  s.power = s.swing * lerp(DIVE.takeoffMinFactor, 1, quality);
  s.vx = DIVE.forwardSpeed;
  s.vy0 = upSpeed(s.power);
  s.takeoffAt = s.time;
  s.airTime = 0;
  // Die Leertaste, die abspringt, ist gleichzeitig der Beginn des Haltens
  s.held = !auto;
  s.openAt = auto ? s.time : null;
  setPhase(s, 'air');
  out.push({ type: 'takeoff', quality, power: s.power, auto });
}

function enterWater(s: DiveState, out: DiveEvent[]): void {
  const target = targetRot(s.def);
  const delta = s.rot - target;
  const e = Math.abs(delta);
  s.y = DIVE.entryHip;
  s.entryAt = s.time;
  s.delta = delta;
  s.line = s.held ? 0 : s.time - s.openAt!;
  s.twistOpen = s.twistStart !== null;
  let rating: EntryRating;
  let splash: number;
  if (s.held) [rating, splash] = ['bomb', 3];
  else if (e >= DIVE.wrongAngle) [rating, splash] = ['wrong', 2];
  else if (delta <= -DIVE.slapAngle) [rating, splash] = ['belly', 3];
  else if (delta >= DIVE.slapAngle) [rating, splash] = ['back', 3];
  else if (e <= DIVE.perfectAngle) {
    rating = 'perfect';
    splash = s.line < DIVE.lineTimeFull || s.twistOpen ? 1 : 0;
  } else if (e <= DIVE.cleanAngle) [rating, splash] = ['clean', 1];
  else [rating, splash] = [delta < 0 ? 'early' : 'late', 2];
  s.rating = rating;
  s.splash = splash;
  setPhase(s, 'water');
  out.push({ type: 'entry', rating, splash });
}

/** Integriert bis `to`, ohne eine Grenze aus boundary() zu überspringen. */
function integrate(s: DiveState, to: number, out: DiveEvent[]): void {
  const h = to - s.time;
  switch (s.phase) {
    case 'swing': {
      for (let k = Math.max(0, Math.floor((s.time - peakTime(s, 0)) / DIVE.swingPeriod) + 1); ; k++) {
        const p = peakTime(s, k);
        if (p > to) break;
        if (p > s.time) out.push({ type: 'peak' });
      }
      s.raw *= Math.exp(-DIVE.swingDamping * h);
      s.swingAvg += (s.raw - s.swingAvg) * (1 - Math.exp(-h / DIVE.swingSmooth));
      s.swing = Math.min(1, s.swingAvg);
      break;
    }
    case 'air': {
      const target = targetRot(s.def);
      if (s.held) {
        const before = Math.floor(s.rot / 180);
        s.rot += spinSpeed(s.def, s.power) * h;
        for (let n = before + 1; n <= Math.floor(s.rot / 180); n++) out.push({ type: 'halfTurn', n });
      } else if (s.twistStart === null && Math.abs(s.rot - target) <= DIVE.alignRange) {
        const d = target - s.rot;
        s.rot += Math.sign(d) * Math.min(Math.abs(d), DIVE.alignRate * h);
      }
      const a = to - s.takeoffAt!;
      s.airTime = a;
      s.x = s.vx * a;
      s.y = DIVE.platform + DIVE.standHip + s.vy0 * a - (DIVE.gravity * a * a) / 2;
      break;
    }
    default:
      break;
  }
  s.time = to;

  // Grenzen exakt behandeln
  switch (s.phase) {
    case 'walk':
      if (s.time >= s.phaseStart + DIVE.walkTime - EPS) {
        setPhase(s, 'ready');
        out.push({ type: 'ready' });
      }
      break;
    case 'swing':
      if (s.time >= s.t0! + DIVE.maxSwingTime - EPS) launch(s, 0, 0, true, out);
      break;
    case 'air':
      if (s.twistStart !== null && s.time >= s.twistStart + DIVE.twistTime - EPS) {
        s.twistStart = null;
        s.twistsDone++;
        out.push({ type: 'twistEnd', n: s.twistsDone });
      }
      if (s.time >= s.takeoffAt! + flightTime(s.power) - EPS) enterWater(s, out);
      break;
    case 'water':
      if (s.time >= s.entryAt! + DIVE.underwaterTime - EPS) {
        setPhase(s, 'done');
        out.push({ type: 'surface' });
      }
      break;
    default:
      break;
  }
}

/** Läuft bis zur Zeit `until`; Eingaben wirken so exakt zu ihrem Zeitstempel. */
function advance(s: DiveState, until: number, out: DiveEvent[]): void {
  while (s.time < until - EPS) {
    const to = Math.min(until, s.time + MAX_SUBSTEP, Math.max(s.time, boundary(s)));
    integrate(s, to, out);
  }
}

/** Ein Schritt mit festem dt. Liefert auch die Ereignisse, die Eingaben seit dem letzten Schritt ausgelöst haben. */
export function stepDive(s: DiveState, dt: number): DiveEvent[] {
  const out = s.pending;
  s.pending = [];
  advance(s, s.time + dt, out);
  return out;
}

/** Abwechselnder Tipp am Turm. Der erste gültige Tipp startet den Armschwung. */
export function swingTap(s: DiveState, side: Side, t = s.time): boolean {
  advance(s, t, s.pending);
  if ((s.phase !== 'ready' && s.phase !== 'swing') || side === s.lastSide) return false;
  s.lastSide = side;
  if (s.phase === 'ready') {
    setPhase(s, 'swing');
    s.t0 = s.time;
  }
  s.raw += DIVE.swingImpulse;
  return true;
}

/** Leertaste gedrückt am Turm: Absprung. false = noch kein Schwung (Hinweis anzeigen). */
export function takeoff(s: DiveState, t = s.time): boolean {
  advance(s, t, s.pending);
  if (s.phase !== 'swing') return false;
  const offset = -timeToPeak(s, t)!;
  const quality = clamp01(1 - Math.abs(offset) / DIVE.takeoffWindow);
  launch(s, quality, offset, false, s.pending);
  return true;
}

/** Leertaste gehalten (Sprungposition) bzw. losgelassen (öffnen) – wirkt nur in der Luft. */
export function setHold(s: DiveState, held: boolean, t = s.time): void {
  advance(s, t, s.pending);
  if (s.phase !== 'air' || s.held === held) return;
  s.held = held;
  s.openAt = held ? null : s.time;
  s.pending.push({ type: held ? 'tuck' : 'open' });
}

/** PFEIL HOCH in der Luft: eine Schraube starten. false = nicht erlaubt (Taste blinkt rot). */
export function twist(s: DiveState, t = s.time): boolean {
  advance(s, t, s.pending);
  if (s.phase !== 'air' || s.twistStart !== null || s.twistsDone >= s.def.twists) return false;
  s.twistStart = s.time;
  s.pending.push({ type: 'twistStart', n: s.twistsDone + 1 });
  return true;
}

/** Abstand zum nächstgelegenen Hochpunkt der Arme (positiv = Hochpunkt kommt noch); null außerhalb des Schwungs. */
export function timeToPeak(s: DiveState, t = s.time): number | null {
  if (s.t0 === null || s.phase === 'walk' || s.phase === 'ready') return null;
  const k = Math.max(0, Math.round((t - peakTime(s, 0)) / DIVE.swingPeriod));
  return peakTime(s, k) - t;
}

/** Armstellung im Takt: 1 = Hochpunkt, 0 = ganz hinten (Dreieckswelle). Vor dem ersten Tipp 0. */
export function armLift(s: DiveState, t = s.time): number {
  if (s.t0 === null) return 0;
  const u = (((t - peakTime(s, 0)) / DIVE.swingPeriod) % 1 + 1) % 1;
  return Math.abs(1 - 2 * u);
}

/** Schrauben als Fortschritt (z. B. 1.4 = erste fertig, zweite zu 40 %) */
export function twistProgress(s: DiveState): number {
  const running = s.twistStart !== null ? Math.min(1, (s.time - s.twistStart) / DIVE.twistTime) : 0;
  return s.twistsDone + running;
}

// ---------------------------------------------------------------- Wertung

/** Tipps in der Reihenfolge ihrer Priorität (der erste zutreffende wird angezeigt) */
export const DIVE_TIPS = [
  'missedTakeoff',
  'notOpened',
  'lowPower',
  'wrongShort',
  'wrongLong',
  'openEarly',
  'openLate',
  'twistOpen',
  'twistMissing',
  'takeoffEarly',
  'takeoffLate',
  'moreHeight',
  'dream',
  'clean',
] as const;
export type DiveTip = (typeof DIVE_TIPS)[number];

export interface Judgement {
  dive: DiveId;
  dd: number;
  /** Noten der 5 Richter (0..10 in 0,5er-Schritten) */
  notes: number[];
  /** Indizes der gestrichenen Noten: [höchste, niedrigste] */
  dropped: [number, number];
  sum: number;
  points: number;
  /** Basisnote 0..10 (nach Abzügen und Deckelung) */
  base: number;
  rating: EntryRating;
  splash: number;
  fail: boolean;
  tip: DiveTip;
  missingTwists: number;
  twistOpen: boolean;
  quality: number;
  swing: number;
  power: number;
  /** Abweichung beim Eintauchen in Grad (negativ = zu wenig gedreht) */
  delta: number;
  line: number;
}

const FAILS: readonly EntryRating[] = ['bomb', 'wrong', 'belly', 'back'];

export function isFail(rating: EntryRating): boolean {
  return FAILS.includes(rating);
}

export function missingTwists(s: DiveState): number {
  return s.def.twists - s.twistsDone;
}

export function baseScore(s: DiveState): number {
  const w = DIVE.weights;
  const qTakeoff = s.quality;
  const qHeight = clamp01((s.power - DIVE.heightLow) / (1 - DIVE.heightLow));
  const qEntry = clamp01(1 - Math.abs(s.delta) / DIVE.slapAngle);
  const qLine = clamp01(s.line / DIVE.lineTimeFull);
  let base = 10 * (w.takeoff * qTakeoff + w.height * qHeight + w.entry * qEntry + w.line * qLine);
  base -= DIVE.twistPenalty * missingTwists(s);
  if (isFail(s.rating!)) base = Math.min(base, DIVE.failCap);
  return Math.min(10, Math.max(0, base));
}

function diveTip(s: DiveState, base: number): DiveTip {
  const d = s.delta;
  // Ohne eigenen Absprung sagen Tipps zu Öffnen oder Salto nichts – erst den Absprung treffen
  if (s.autoTakeoff) return 'missedTakeoff';
  if (s.rating === 'bomb') return 'notOpened';
  if (d < -DIVE.cleanAngle && s.power < minPower(s.def)) return 'lowPower';
  if (s.rating === 'wrong') return d < 0 ? 'wrongShort' : 'wrongLong';
  if (d < -DIVE.cleanAngle) return 'openEarly';
  if (d > DIVE.cleanAngle || s.line < DIVE.lineTimeFull) return 'openLate';
  if (s.twistOpen) return 'twistOpen';
  if (missingTwists(s) > 0) return 'twistMissing';
  if (s.quality < 0.6) return s.takeoffOffset < 0 ? 'takeoffEarly' : 'takeoffLate';
  if (s.swing < 0.85) return 'moreHeight';
  return base >= 9 ? 'dream' : 'clean';
}

/** Deterministischer Seed aus den Messwerten – gleiche Ausführung, gleiche Noten. */
function judgeSeed(s: DiveState): number {
  const parts = [
    Math.round(s.delta * 10),
    Math.round(s.quality * 1000),
    Math.round(s.power * 1000),
    Math.round(s.line * 1000),
    s.twistsDone,
    s.def.id,
  ];
  let h = 2166136261;
  for (const c of parts.join('|')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const round2 = (v: number) => Math.round(v * 2) / 2;

/** Fünf Kampfrichter werten den Sprung; höchste und niedrigste Note fallen weg, Summe × SG. */
export function judge(s: DiveState): Judgement {
  if (s.rating === null) throw new Error('judge: Sprung noch nicht eingetaucht');
  const base = baseScore(s);
  const rng = createRng(judgeSeed(s));
  const notes = DIVE.judgeBias.map((bias) =>
    Math.min(10, Math.max(0, round2(base + bias + DIVE.judgeNoise * (2 * rng() - 1)))),
  );
  const hi = notes.indexOf(Math.max(...notes));
  const lowest = Math.min(...notes.filter((_, i) => i !== hi));
  const lo = notes.findIndex((n, i) => i !== hi && n === lowest);
  const sum = notes.reduce((a, n, i) => (i === hi || i === lo ? a : a + n), 0);
  return {
    dive: s.def.id,
    dd: s.def.dd,
    notes,
    dropped: [hi, lo],
    sum,
    points: Math.round(sum * s.def.dd * 100) / 100,
    base,
    rating: s.rating,
    splash: s.splash,
    fail: isFail(s.rating),
    tip: diveTip(s, base),
    missingTwists: missingTwists(s),
    twistOpen: s.twistOpen,
    quality: s.quality,
    swing: s.swing,
    power: s.power,
    delta: s.delta,
    line: s.line,
  };
}

// ---------------------------------------------------------------- Wettkampf

export interface DiveAttempt {
  dive: DiveId;
  points: number;
}

export interface Diver {
  id: number;
  isPlayer: boolean;
  /** Je Durchgang: Sprung und Punkte, undefined = noch nicht gesprungen */
  attempts: (DiveAttempt | undefined)[];
}

export function createDiver(id: number, isPlayer: boolean): Diver {
  return { id, isPlayer, attempts: Array<DiveAttempt | undefined>(DIVE.rounds).fill(undefined) };
}

export function diverTotal(d: Diver): number {
  const sum = d.attempts.reduce((a, x) => a + (x?.points ?? 0), 0);
  return Math.round(sum * 100) / 100;
}

/** Bereits gesprungene Sprünge – jeder ist je Wettkampf nur einmal erlaubt */
export function usedDives(d: Diver): DiveId[] {
  return d.attempts.filter((a): a is DiveAttempt => a !== undefined).map((a) => a.dive);
}

/** Rangliste: Gesamtpunkte, dann bester Einzelsprung, dann zweitbester. */
export function rankDivers(divers: Diver[]): Diver[] {
  const series = (d: Diver) =>
    d.attempts.filter((a): a is DiveAttempt => a !== undefined).map((a) => a.points).sort((a, b) => b - a);
  return [...divers].sort((a, b) => {
    const d = diverTotal(b) - diverTotal(a);
    if (Math.abs(d) > 1e-9) return d;
    const sa = series(a);
    const sb = series(b);
    for (let i = 0; i < DIVE.rounds; i++) {
      const di = (sb[i] ?? -1) - (sa[i] ?? -1);
      if (Math.abs(di) > 1e-9) return di;
    }
    return 0;
  });
}

/** Nächster Sprung: Durchgang für Durchgang in fester Reihenfolge. null = fertig. */
export function nextDive(divers: Diver[]): { diver: Diver; round: number } | null {
  for (let round = 0; round < DIVE.rounds; round++) {
    const d = divers.find((x) => x.attempts[round] === undefined);
    if (d) return { diver: d, round };
  }
  return null;
}

// ---------------------------------------------------------------- Computer-Gegner

export interface DiveCpuProfile {
  name: string;
  /** Gültige Tipps pro Sekunde */
  tapRate: number;
  /** Relative Schwankung des Tipp-Abstands (0..1) */
  tapJitter: number;
  /** σ des Absprungs um den Hochpunkt in Sekunden */
  takeoffError: number;
  /** σ des Öffnens in Sekunden */
  releaseError: number;
  /** Sprung je Durchgang */
  dives: readonly DiveId[];
}

// Reihenfolge Rookie/Profi/Champion – wird in competition.test.ts geprüft!
export const DIVE_CPU_PROFILES: readonly DiveCpuProfile[] = [
  { name: 'Rookie', tapRate: 8.0, tapJitter: 0.2, takeoffError: 0.07, releaseError: 0.05, dives: ['15h', '25h', '15s2'] },
  { name: 'Profi', tapRate: 9.6, tapJitter: 0.15, takeoffError: 0.05, releaseError: 0.038, dives: ['25p', '15s2', '35h'] },
  { name: 'Champion', tapRate: 10.8, tapJitter: 0.1, takeoffError: 0.035, releaseError: 0.03, dives: ['15s2', '35h', '45h'] },
];

/** Tipprate eines Gegners für einen Wettkampf – auch Computer haben gute und schlechte Tage. */
export function cpuDiveRate(p: DiveCpuProfile, rng: () => number): number {
  return p.tapRate * (0.95 + 0.1 * rng());
}

/** Zielt beim Öffnen so viele Grad vor das Ziel – das Ausrichten erledigt den Rest */
const RELEASE_LEAD = 15;

/**
 * Ein Sprung ohne Grafik über dieselben Eingaben wie ein Mensch: tippen,
 * am Hochpunkt abspringen, halten, öffnen, Schrauben. Liefert den Endzustand.
 */
export function runCpuDive(p: DiveCpuProfile, def: DiveDef, rng: () => number, rate = p.tapRate): DiveState {
  const s = createDive(def);
  const dt = 1 / 120;
  const startAt = DIVE.walkTime + 0.15 + 0.2 * rng();
  const firstPeak = startAt + DIVE.swingFirstPeak;
  const decideAt = startAt + 2.5 + 0.5 * rng();
  const k = Math.max(0, Math.ceil((decideAt - firstPeak) / DIVE.swingPeriod));
  const pressAt = firstPeak + k * DIVE.swingPeriod + gaussian(rng) * p.takeoffError;
  let nextTap = startAt;
  let side: Side = 'L';
  let releaseAt: number | null = null;
  let twistAt: number | null = null;
  let planned = false;

  const nextInput = (): { t: number; run: () => void } | null => {
    const list: { t: number; run: () => void }[] = [];
    if (s.phase === 'ready' || s.phase === 'swing') {
      list.push({
        t: nextTap,
        run: () => {
          swingTap(s, side, nextTap);
          side = side === 'L' ? 'R' : 'L';
          nextTap += (1 + p.tapJitter * (2 * rng() - 1)) / rate;
        },
      });
    }
    if (s.phase === 'swing') list.push({ t: pressAt, run: () => void takeoff(s, Math.max(pressAt, s.time)) });
    if (s.phase === 'air' && releaseAt !== null && s.held) {
      const at = releaseAt;
      list.push({ t: at, run: () => setHold(s, false, at) });
    }
    if (s.phase === 'air' && twistAt !== null) {
      const at = twistAt;
      list.push({
        t: at,
        run: () => {
          twist(s, at);
          twistAt = null;
        },
      });
    }
    list.sort((a, b) => a.t - b.t);
    return list[0] ?? null;
  };

  while (s.phase !== 'done' && s.time < 30) {
    const end = s.time + dt;
    for (let input = nextInput(); input && input.t < end; input = nextInput()) input.run();
    for (const ev of stepDive(s, end - s.time)) {
      if (ev.type === 'twistEnd' && s.twistsDone < def.twists) {
        twistAt = s.time + 0.05 + Math.abs(gaussian(rng) * 0.05);
      }
    }
    if (s.phase === 'air' && !planned) {
      planned = true;
      const reach = (targetRot(def) - RELEASE_LEAD) / Math.max(1e-6, spinSpeed(def, s.power));
      releaseAt = s.takeoffAt! + Math.max(0.05, reach + gaussian(rng) * p.releaseError);
      if (def.twists > 0) twistAt = s.takeoffAt! + 0.15;
    }
  }
  return s;
}

/** Computer-Sprung für die Anzeigetafel – mit derselben Sim gerechnet wie der Spieler. */
export function simulateCpuDive(p: DiveCpuProfile, def: DiveDef, rng: () => number, rate = p.tapRate): Judgement {
  return judge(runCpuDive(p, def, rng, rate));
}
