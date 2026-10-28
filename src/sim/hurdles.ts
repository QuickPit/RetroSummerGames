// Reine Spiellogik für 110 m Hürden – ohne Phaser, damit sie testbar ist
// und später unverändert für den Multiplayer verwendet werden kann.

export const TRACK = {
  distance: 110,
  firstHurdle: 13.72,
  hurdleSpacing: 9.14,
  hurdleCount: 10,
  hurdleHeight: 1.067,
} as const;

export const HURDLE_POSITIONS: readonly number[] = Array.from(
  { length: TRACK.hurdleCount },
  (_, i) => TRACK.firstHurdle + i * TRACK.hurdleSpacing,
);

// Alle Stellschrauben für das Spielgefühl an einem Ort.
// Gleichgewichtstempo am Boden ≈ Tipprate × tapImpulse / groundDrag.
export const PHYSICS = {
  /** Geschwindigkeitszuwachs pro gültigem (abwechselndem) Tipp in m/s */
  tapImpulse: 0.85,
  /** Abbremsung am Boden pro Sekunde (exponentiell) */
  groundDrag: 0.95,
  /** Abbremsung in der Luft – dort kann man nicht beschleunigen */
  airDrag: 0.15,
  /** Abbremsung nach dem Zieleinlauf */
  finishDrag: 1.6,
  maxSpeed: 11.3,
  /** Flugzeit eines Sprungs in Sekunden */
  jumpDuration: 0.44,
  /** Maximale Fußhöhe im Sprung in Metern */
  jumpPeak: 1.3,
  /** Mindesthöhe beim Überqueren, um die Hürde nicht zu reißen */
  clearHeight: 0.9,
  /** Tempo-Faktor beim Reißen einer Hürde */
  hitSpeedFactor: 0.55,
  stumbleDuration: 0.4,
  /** Tipps während des Stolperns wirken nur abgeschwächt */
  stumbleImpulseFactor: 0.5,
} as const;

export type Side = 'L' | 'R';
export type HurdleResult = 'clear' | 'hit';

export type RunnerEvent =
  | { type: 'footstep' }
  | { type: 'land' }
  | { type: 'clear'; hurdle: number }
  | { type: 'hit'; hurdle: number }
  | { type: 'finish'; time: number };

export interface RunnerState {
  /** Position in Metern ab Startlinie */
  x: number;
  /** Geschwindigkeit in m/s */
  v: number;
  lastSide: Side | null;
  /** Zeit seit dem Absprung in Sekunden, negativ = am Boden */
  air: number;
  /** Verbleibende Stolperzeit in Sekunden */
  stumble: number;
  nextHurdle: number;
  hurdles: (HurdleResult | null)[];
  finishTime: number | null;
  firstTapTime: number | null;
  /** Laufzyklus in Doppelschritten (für Animation und Schrittgeräusche) */
  stride: number;
  validTaps: number;
}

export function createRunner(): RunnerState {
  return {
    x: 0,
    v: 0,
    lastSide: null,
    air: -1,
    stumble: 0,
    nextHurdle: 0,
    hurdles: Array<HurdleResult | null>(TRACK.hurdleCount).fill(null),
    finishTime: null,
    firstTapTime: null,
    stride: 0,
    validTaps: 0,
  };
}

export function isAirborne(r: RunnerState): boolean {
  return r.air >= 0;
}

export function isFinished(r: RunnerState): boolean {
  return r.finishTime !== null;
}

/** Fußhöhe über dem Boden zu einem Zeitpunkt t seit Absprung (Parabel). */
export function jumpHeightAt(t: number): number {
  const T = PHYSICS.jumpDuration;
  if (t < 0 || t > T) return 0;
  return (4 * PHYSICS.jumpPeak * t * (T - t)) / (T * T);
}

export function jumpHeight(r: RunnerState): number {
  return jumpHeightAt(r.air);
}

/**
 * Ein Tipp auf eine Lauftaste. Nur abwechselndes Tippen (L, R, L, …) zählt –
 * wie früher das Joystick-Rütteln. Gibt zurück, ob der Tipp gewertet wurde.
 */
export function tap(r: RunnerState, side: Side, time: number): boolean {
  if (isFinished(r) || side === r.lastSide) return false;
  r.lastSide = side;
  if (r.firstTapTime === null) r.firstTapTime = time;
  if (isAirborne(r)) return false;
  const factor = r.stumble > 0 ? PHYSICS.stumbleImpulseFactor : 1;
  r.v = Math.min(r.v + PHYSICS.tapImpulse * factor, PHYSICS.maxSpeed);
  r.validTaps++;
  return true;
}

export function jump(r: RunnerState): boolean {
  if (isFinished(r) || isAirborne(r) || r.x >= TRACK.distance) return false;
  r.air = 0;
  return true;
}

/** Länge eines Doppelschritts in Metern – wird mit dem Tempo länger. */
export function strideLength(v: number): number {
  return 1.6 + 0.25 * v;
}

/**
 * Bewegt den Läufer um dt Sekunden weiter. `time` ist die Rennzeit am Ende
 * des Schritts (Sekunden seit dem Startschuss).
 */
export function step(r: RunnerState, dt: number, time: number): RunnerEvent[] {
  const events: RunnerEvent[] = [];
  const airborne = isAirborne(r);

  const drag = isFinished(r)
    ? PHYSICS.finishDrag
    : airborne
      ? PHYSICS.airDrag
      : PHYSICS.groundDrag;
  r.v *= Math.exp(-drag * dt);
  if (r.v < 0.01) r.v = 0;

  if (airborne) r.air += dt;
  if (r.stumble > 0) r.stumble = Math.max(0, r.stumble - dt);

  const prevX = r.x;
  r.x += r.v * dt;

  // Hürden prüfen, die in diesem Schritt überquert wurden.
  while (r.nextHurdle < TRACK.hurdleCount && r.x >= HURDLE_POSITIONS[r.nextHurdle]) {
    const index = r.nextHurdle;
    const overshoot = r.v > 0 ? (r.x - HURDLE_POSITIONS[index]) / r.v : 0;
    const height = airborne ? jumpHeightAt(r.air - overshoot) : 0;
    if (height >= PHYSICS.clearHeight) {
      r.hurdles[index] = 'clear';
      events.push({ type: 'clear', hurdle: index });
    } else {
      r.hurdles[index] = 'hit';
      r.v *= PHYSICS.hitSpeedFactor;
      r.stumble = PHYSICS.stumbleDuration;
      events.push({ type: 'hit', hurdle: index });
    }
    r.nextHurdle++;
  }

  if (airborne && r.air >= PHYSICS.jumpDuration) {
    r.air = -1;
    events.push({ type: 'land' });
  }

  if (!isAirborne(r) && r.v > 0) {
    const before = Math.floor(r.stride * 2);
    r.stride += (r.v * dt) / strideLength(r.v);
    if (Math.floor(r.stride * 2) !== before) events.push({ type: 'footstep' });
  }

  if (!isFinished(r) && prevX < TRACK.distance && r.x >= TRACK.distance) {
    // Genaue Zielzeit durch Interpolation innerhalb des Schritts.
    const overshoot = r.v > 0 ? (r.x - TRACK.distance) / r.v : 0;
    r.finishTime = Math.max(0, time - overshoot);
    events.push({ type: 'finish', time: r.finishTime });
  }

  return events;
}

export function hurdlesHit(r: RunnerState): number {
  return r.hurdles.filter((h) => h === 'hit').length;
}
