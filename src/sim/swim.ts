// Reine Spiellogik für 100 m Freistil: Startsprung, Kraulen im Takt (je Arm
// gemessen), Atmen, Rollwende an der 50-m-Wand und Anschlag im Ziel.

import { createRng, gaussian } from './cpu';
import { cpuField, cpuJitter, cpuReaction, type CpuSkill, type Difficulty } from './difficulty';
import type { Side } from './hurdles';

export const SWIM = {
  poolLength: 50,
  distance: 100,
  /** Startsprung: Flugzeit, Eintauchpunkt und Tempo beim Eintauchen */
  diveFlight: 0.55,
  diveDistance: 4.0,
  diveSpeed: 3.0,
  /** Ohne Sprung springt der Schwimmer so lange nach dem Signal von selbst */
  autoDiveAfter: 3,
  /** Tempozuwachs eines vollen Zugs in m/s – gesättigt: × (1 − v / (strokeSaturation · maxSpeed)) */
  strokeImpulse: 0.29,
  strokeSaturation: 1.2,
  /** Wasserwiderstand: dv/dt = −(dragLinear·v + dragQuad·v²) */
  dragLinear: 0.2,
  dragQuad: 0.136,
  maxSpeed: 2.6,
  /** Armzyklus (gleicher Arm) für einen vollen Zug */
  fullCycle: 0.19,
  /** Ab hier gilt ein Zug in der Anzeige als „im Takt“ */
  inTaktCycle: 0.18,
  /** Darunter verschluckt sich der Schwimmer */
  chokeCycle: 0.13,
  /** Wirkung eines Zugs knapp über `chokeCycle` */
  hastyFactor: 0.35,
  chokeSpeedFactor: 0.9,
  chokeAir: 0.05,
  /** Husten: so lange kein Vortrieb */
  chokeStun: 0.4,
  /**
   * Frühestens so lange nach dem letzten Verschlucken wieder. Mit den milderen Werten
   * für Husten und Luftschnappen bleibt auch Hämmern ohne Atmen unter 90 s.
   */
  chokeCooldown: 2.5,
  /** Luft je vollem Zug; hektische Züge kosten anteilig weniger */
  airPerStroke: 0.012,
  lowAir: 0.25,
  /** Atmen oberhalb dieser Luft zählt als „früh geatmet“ */
  earlyBreathAbove: 0.6,
  breathTime: 0.4,
  breathSpeedFactor: 0.9,
  gaspSpeedFactor: 0.5,
  /** Luftschnappen: so lange kein Vortrieb – lang genug, dass sich Atmen auch mit der Tempo-Kurve lohnt */
  gaspStun: 0.7,
  /** Wende: Leertaste wirkt erst so nah an der Wand */
  turnZone: 3.0,
  /** Dauer der Rolle in Sekunden */
  flipTime: 0.45,
  flipMinSpeed: 0.5,
  /** Abweichung vom Idealabstand, bei der die Güte 0 erreicht */
  turnTolerance: 0.8,
  turnPerfect: 0.75,
  turnGood: 0.4,
  turnPushMax: 2.9,
  turnPushMin: 1.6,
  /** Anschlagen ohne Rolle: Wartezeit bis zum Abstoß */
  openTurnDelay: 1.0,
  finishDrag: 1.6,
  worldRecord: 46.5,
} as const;

export type SwimPhase = 'block' | 'dive' | 'swim' | 'flip' | 'wall' | 'open' | 'done';
export type StrokeQuality = 'full' | 'hasty' | 'choke';
export type TurnRating = 'perfect' | 'good' | 'early' | 'late' | 'open';

export type SwimEvent =
  | { type: 'dive'; auto: boolean }
  | { type: 'entry' }
  | { type: 'stroke'; side: Side; quality: StrokeQuality; inTakt: boolean }
  | { type: 'choke' }
  | { type: 'breath' }
  | { type: 'breathDone' }
  | { type: 'lowAir' }
  | { type: 'gasp' }
  | { type: 'turn'; rating: TurnRating }
  | { type: 'wall' }
  | { type: 'push' }
  | { type: 'finish'; time: number };

export interface SwimmerState {
  phase: SwimPhase;
  /** Geschwommene Strecke in Metern (0..100) */
  d: number;
  v: number;
  lastSide: Side | null;
  /** Zeitpunkt des letzten Zugs je Arm */
  armAt: Record<Side, number>;
  air: number;
  lowAirWarned: boolean;
  /** Restzeit des Atemzugs, 0 = atmet nicht */
  breathing: number;
  /** Restzeit ohne Vortrieb (Husten oder Luftschnappen) */
  stun: number;
  stunKind: 'choke' | 'gasp' | null;
  lastChokeAt: number;
  diveAt: number | null;
  /** Zeitpunkt des Wende-Drucks bzw. des Anschlags an der Wende */
  flipAt: number | null;
  flipSpeed: number;
  turnQuality: number;
  turnRating: TurnRating | null;
  turned: boolean;
  finishTime: number | null;
  /** Zeit seit Beginn der aktuellen Phase (für die Animation) */
  phaseTime: number;
  /** Rennzeit am Ende des letzten Schritts – Eingaben dazwischen werden hochgerechnet */
  time: number;
  /** Zeitpunkt des letzten gültigen Zugs (Animation) */
  lastStrokeAt: number;
  /** Zeit im Wasser beim Schwimmen (ohne Sprung und Wende) – für die Zugrate */
  swimTime: number;
  // Zähler für die Rückmeldung
  strokes: number;
  inTakt: number;
  chokes: number;
  breaths: number;
  earlyBreaths: number;
  gasps: number;
  reaction: number | null;
  /** Ereignisse aus Eingaben zwischen zwei Schritten */
  queued: SwimEvent[];
}

export function createSwimmer(): SwimmerState {
  return {
    phase: 'block',
    d: 0,
    v: 0,
    lastSide: null,
    armAt: { L: -Infinity, R: -Infinity },
    air: 1,
    lowAirWarned: false,
    breathing: 0,
    stun: 0,
    stunKind: null,
    lastChokeAt: -Infinity,
    diveAt: null,
    flipAt: null,
    flipSpeed: 0,
    turnQuality: 0,
    turnRating: null,
    turned: false,
    finishTime: null,
    phaseTime: 0,
    time: 0,
    lastStrokeAt: -Infinity,
    swimTime: 0,
    strokes: 0,
    inTakt: 0,
    chokes: 0,
    breaths: 0,
    earlyBreaths: 0,
    gasps: 0,
    reaction: null,
    queued: [],
  };
}

/** Position im Becken in Metern ab der Startwand */
export function poolX(s: SwimmerState): number {
  return s.d <= SWIM.poolLength ? s.d : SWIM.distance - s.d;
}

/** Schwimmrichtung: +1 auf der Hinbahn, −1 auf der Rückbahn */
export function heading(s: SwimmerState): 1 | -1 {
  return s.d < SWIM.poolLength || (s.d === SWIM.poolLength && !s.turned) ? 1 : -1;
}

/** Abstand zur Wand, auf die der Schwimmer zuschwimmt */
export function toWall(s: SwimmerState): number {
  return s.turned || s.d > SWIM.poolLength ? SWIM.distance - s.d : SWIM.poolLength - s.d;
}

export function isFinished(s: SwimmerState): boolean {
  return s.finishTime !== null;
}

function setPhase(s: SwimmerState, phase: SwimPhase): void {
  s.phase = phase;
  s.phaseTime = 0;
}

/** Idealer Wandabstand für den Druck auf die Leertaste beim aktuellen Tempo */
export function idealTurnDistance(v: number): number {
  return Math.max(v, SWIM.flipMinSpeed) * SWIM.flipTime;
}

/** Startsprung zum Zeitpunkt t (Sekunden seit dem Signal) */
export function dive(s: SwimmerState, t: number, auto = false): boolean {
  if (s.phase !== 'block') return false;
  setPhase(s, 'dive');
  s.diveAt = t;
  s.reaction = t;
  s.queued.push({ type: 'dive', auto });
  return true;
}

/** Ein Armzug. Nur abwechselnde Seiten zählen; Rückgabe null = ohne Wirkung. */
export function stroke(s: SwimmerState, side: Side, t: number): StrokeQuality | null {
  if (isFinished(s) || side === s.lastSide) return null;
  s.lastSide = side;
  if (s.phase !== 'swim' || s.stun > 0) return null;

  const cycle = t - s.armAt[side];
  s.armAt[side] = t;
  let quality: StrokeQuality;
  let factor = 1;
  if (cycle >= SWIM.fullCycle) {
    quality = 'full';
  } else if (cycle >= SWIM.chokeCycle) {
    quality = 'hasty';
    const u = (cycle - SWIM.chokeCycle) / (SWIM.fullCycle - SWIM.chokeCycle);
    factor = SWIM.hastyFactor + (1 - SWIM.hastyFactor) * u;
  } else if (t - s.lastChokeAt >= SWIM.chokeCooldown) {
    quality = 'choke';
  } else {
    // In der Sperrzeit: je kürzer der Armzyklus, desto weniger bringt der Zug – Hämmern lohnt nie
    quality = 'hasty';
    factor = SWIM.hastyFactor * Math.max(0, cycle) / SWIM.chokeCycle;
  }

  const inTakt = cycle >= SWIM.inTaktCycle;
  s.strokes++;
  if (inTakt) s.inTakt++;
  s.lastStrokeAt = t;
  s.queued.push({ type: 'stroke', side, quality, inTakt });

  if (quality === 'choke') {
    s.chokes++;
    s.lastChokeAt = t;
    s.v *= SWIM.chokeSpeedFactor;
    s.stun = SWIM.chokeStun;
    s.stunKind = 'choke';
    s.queued.push({ type: 'choke' });
    useAir(s, SWIM.chokeAir);
    return quality;
  }

  // Die Höchstgeschwindigkeit kappt nur den Zuwachs, nicht Tempo aus Sprung oder Abstoß
  s.v = Math.max(s.v, Math.min(SWIM.maxSpeed, s.v + strokeGain(s.v, factor)));
  // Ein halber Zug kostet auch nur einen Teil der Luft
  useAir(s, SWIM.airPerStroke * factor);
  return quality;
}

/** Tempozuwachs eines Zugs mit Wirkung `factor` beim Tempo v (gesättigt) */
export function strokeGain(v: number, factor = 1): number {
  return SWIM.strokeImpulse * factor * Math.max(0, 1 - v / (SWIM.strokeSaturation * SWIM.maxSpeed));
}

function useAir(s: SwimmerState, amount: number): void {
  // Während des Atemzugs strömt Luft nach – kein Verbrauch, kein Luftschnappen
  if (s.breathing > 0) return;
  s.air = Math.max(0, s.air - amount);
  if (s.air < SWIM.lowAir && !s.lowAirWarned) {
    s.lowAirWarned = true;
    s.queued.push({ type: 'lowAir' });
  }
  if (s.air <= 0) {
    // Luft aus: automatisch nach Luft schnappen
    s.gasps++;
    s.v *= SWIM.gaspSpeedFactor;
    s.stun = SWIM.gaspStun;
    s.stunKind = 'gasp';
    refillAir(s);
    s.queued.push({ type: 'gasp' });
  }
}

function refillAir(s: SwimmerState): void {
  s.air = 1;
  s.lowAirWarned = false;
}

/** Bricht Atemzug und Husten ab (Wende, Anschlag, Ziel); ein laufender Atemzug zählt als vollendet */
function settleBreath(s: SwimmerState): void {
  if (s.breathing > 0) refillAir(s);
  s.breathing = 0;
  s.stun = 0;
  s.stunKind = null;
}

/** Atmen (↑): kostet Tempo, füllt nach `breathTime` die Luft. */
export function breathe(s: SwimmerState): boolean {
  if (s.phase !== 'swim' || s.stun > 0 || s.breathing > 0 || isFinished(s)) return false;
  s.breaths++;
  if (s.air > SWIM.earlyBreathAbove) s.earlyBreaths++;
  s.v *= SWIM.breathSpeedFactor;
  s.breathing = SWIM.breathTime;
  s.queued.push({ type: 'breath' });
  return true;
}

/** Güte einer Rolle bei Wandabstand w und Tempo v (0..1) */
export function turnQuality(w: number, v: number): number {
  const q = 1 - Math.abs(w - idealTurnDistance(v)) / SWIM.turnTolerance;
  return Math.max(0, Math.min(1, q));
}

export function rateTurn(w: number, v: number): TurnRating {
  const q = turnQuality(w, v);
  if (q >= SWIM.turnPerfect) return 'perfect';
  if (q >= SWIM.turnGood) return 'good';
  return w > idealTurnDistance(v) ? 'early' : 'late';
}

/**
 * Rollwende (Leertaste). Wirkt nur auf der Hinbahn innerhalb der Wendezone.
 * Der Wandabstand wird vom letzten Schritt auf den Tastenzeitpunkt t hochgerechnet.
 */
export function flipTurn(s: SwimmerState, t: number): boolean {
  if (s.phase !== 'swim' || s.turned) return false;
  const ahead = Math.min(toWall(s), s.v * Math.max(0, t - s.time));
  const w = toWall(s) - ahead;
  if (w > SWIM.turnZone) return false;
  s.d += ahead;
  s.turnQuality = turnQuality(w, s.v);
  s.turnRating = rateTurn(w, s.v);
  s.flipAt = t;
  s.flipSpeed = Math.max(s.v, SWIM.flipMinSpeed);
  settleBreath(s);
  setPhase(s, 'flip');
  s.queued.push({ type: 'turn', rating: s.turnRating });
  return true;
}

function pushOff(s: SwimmerState, speed: number, events: SwimEvent[]): void {
  s.turned = true;
  s.d = SWIM.poolLength;
  s.v = speed;
  s.armAt = { L: -Infinity, R: -Infinity };
  setPhase(s, 'swim');
  events.push({ type: 'push' });
}

/**
 * Bewegt den Schwimmer um dt weiter. `time` ist die Rennzeit am Ende des
 * Schritts (Sekunden seit dem Startsignal).
 */
export function step(s: SwimmerState, dt: number, time: number): SwimEvent[] {
  const events: SwimEvent[] = s.queued;
  s.queued = [];
  s.phaseTime += dt;
  s.time = time;

  if (s.phase === 'block') {
    if (time >= SWIM.autoDiveAfter) {
      dive(s, SWIM.autoDiveAfter, true);
      events.push(...s.queued);
      s.queued = [];
    } else {
      return events;
    }
  }

  if (s.phase === 'dive') {
    const u = (time - s.diveAt!) / SWIM.diveFlight;
    if (u < 1) {
      s.d = SWIM.diveDistance * Math.max(0, u);
      s.v = SWIM.diveSpeed;
      return events;
    }
    s.d = SWIM.diveDistance;
    s.v = SWIM.diveSpeed;
    setPhase(s, 'swim');
    events.push({ type: 'entry' });
  }

  if (s.phase === 'flip') {
    // Die Rolle beginnt erst beim Tastendruck, nicht am Schrittanfang
    const from = Math.max(time - dt, s.flipAt!);
    s.d = Math.min(SWIM.poolLength, s.d + s.flipSpeed * Math.max(0, time - from));
    s.v = s.flipSpeed;
    if (s.d >= SWIM.poolLength) {
      s.v = 0;
      setPhase(s, 'wall');
      events.push({ type: 'wall' });
    }
  }
  if (s.phase === 'wall' && time - s.flipAt! >= SWIM.flipTime) {
    const push = SWIM.turnPushMin + (SWIM.turnPushMax - SWIM.turnPushMin) * s.turnQuality;
    pushOff(s, push, events);
    return events;
  }
  if (s.phase === 'open') {
    if (time - s.flipAt! >= SWIM.openTurnDelay) pushOff(s, SWIM.turnPushMin, events);
    return events;
  }
  if (s.phase === 'wall' || s.phase === 'flip') return events;

  // Schwimmen bzw. nach dem Anschlag austrudeln
  const drag = SWIM.dragLinear * s.v + SWIM.dragQuad * s.v * s.v;
  s.v = Math.max(0, s.v - drag * dt);
  if (s.phase === 'done') {
    s.v *= Math.exp(-SWIM.finishDrag * dt);
    return events;
  }
  s.swimTime += dt;
  if (s.stun > 0) {
    s.stun = Math.max(0, s.stun - dt);
    if (s.stun === 0) s.stunKind = null;
  }
  if (s.breathing > 0) {
    s.breathing = Math.max(0, s.breathing - dt);
    if (s.breathing === 0) {
      refillAir(s);
      events.push({ type: 'breathDone' });
    }
  }

  const prevD = s.d;
  s.d += s.v * dt;

  if (!s.turned && s.d >= SWIM.poolLength) {
    // Ohne Rolle an die Wand: anschlagen und abstoßen
    const overshoot = s.v > 0 ? (s.d - SWIM.poolLength) / s.v : 0;
    s.d = SWIM.poolLength;
    s.v = 0;
    s.flipAt = time - overshoot;
    s.turnRating = 'open';
    s.turnQuality = 0;
    settleBreath(s);
    setPhase(s, 'open');
    events.push({ type: 'turn', rating: 'open' });
    return events;
  }

  if (prevD < SWIM.distance && s.d >= SWIM.distance) {
    // Genaue Zielzeit durch Interpolation innerhalb des Schritts
    const overshoot = s.v > 0 ? (s.d - SWIM.distance) / s.v : 0;
    s.finishTime = Math.max(0, time - overshoot);
    s.d = SWIM.distance;
    settleBreath(s);
    setPhase(s, 'done');
    events.push({ type: 'finish', time: s.finishTime });
  }
  return events;
}

/** Anteil der Züge im Takt (0..1); ohne Züge 0 */
export function taktRatio(s: SwimmerState): number {
  return s.strokes > 0 ? s.inTakt / s.strokes : 0;
}

// ------------------------------------------------------- Computer-Gegner

export interface SwimCpuProfile {
  name: string;
  /** Tipps pro Sekunde (beide Arme zusammen) */
  tapRate: number;
  /** Relative Schwankung des Tipp-Abstands (gleichverteilt ±) */
  tapJitter: number;
  /** Reaktionszeit auf das Startsignal in Sekunden */
  reaction: number;
  /** Standardabweichung des Wendeabstands in Metern */
  turnError: number;
  /** Atmet, sobald die Luft darunter fällt */
  breathAt: number;
}

/** Schwimm-Profil aus Tipprate und Fehlerfaktor */
export function swimCpuProfile({ rate, error }: CpuSkill, name: string): SwimCpuProfile {
  return {
    name,
    tapRate: rate,
    tapJitter: cpuJitter(error),
    reaction: cpuReaction(error),
    turnError: 0.35 * error,
    breathAt: 0.25,
  };
}

/** Die drei Gegner einer Stufe (Rookie/Profi/Champion) */
export function swimCpuProfiles(d: Difficulty): SwimCpuProfile[] {
  return cpuField(d, swimCpuProfile);
}

// Reihenfolge Rookie/Profi/Champion – wird in competition.test.ts geprüft!
export const SWIM_CPU_PROFILES: readonly SwimCpuProfile[] = swimCpuProfiles('normal');

/** Steuert einen Computer-Schwimmer über dieselben Eingaben wie ein Mensch. */
export class SwimCpu {
  private nextTapAt = 0;
  private side: Side = 'L';
  private readonly rate: number;
  private readonly reaction: number;
  private turnAt: number | null = null;

  constructor(
    readonly swimmer: SwimmerState,
    readonly profile: SwimCpuProfile,
    private readonly rng: () => number,
  ) {
    // Jeder Lauf ist etwas anders
    this.rate = profile.tapRate * (0.95 + 0.1 * rng());
    this.reaction = profile.reaction * (0.85 + 0.3 * rng());
  }

  update(time: number): void {
    const s = this.swimmer;
    if (isFinished(s)) return;
    if (s.phase === 'block') {
      if (time >= this.reaction) dive(s, this.reaction);
      return;
    }
    if (s.phase !== 'swim') {
      this.nextTapAt = Math.max(this.nextTapAt, time);
      return;
    }

    while (time >= this.nextTapAt) {
      stroke(s, this.side, this.nextTapAt);
      this.side = this.side === 'L' ? 'R' : 'L';
      const jitter = 1 + this.profile.tapJitter * (this.rng() * 2 - 1);
      this.nextTapAt += jitter / this.rate;
      if (s.phase !== 'swim') break;
    }

    if (s.air < this.profile.breathAt) breathe(s);

    if (!s.turned && s.phase === 'swim') {
      const w = toWall(s);
      if (w <= SWIM.turnZone) {
        // Beim Eintritt in die Wendezone den Abstand planen – mit menschlicher Ungenauigkeit
        if (this.turnAt === null) this.turnAt = idealTurnDistance(s.v) + gaussian(this.rng) * this.profile.turnError;
        if (w <= this.turnAt) flipTurn(s, time);
      }
    }
  }
}

/** Ganzes Rennen eines Computer-Profils ohne Szene – für Tests und Balancing. */
export function simulateRace(profile: SwimCpuProfile, seed: number, dt = 1 / 120): SwimmerState {
  const s = createSwimmer();
  const cpu = new SwimCpu(s, profile, createRng(seed));
  let t = 0;
  while (!isFinished(s) && t < 200) {
    t += dt;
    cpu.update(t);
    step(s, dt, t);
  }
  return s;
}
