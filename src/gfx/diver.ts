import type Phaser from 'phaser';
import type { DivePosition } from '../sim/dive';
import { drawRunner, lerpPose, runPose, standPose, wavePose, type Mood, type Pose, type RunnerLook } from './runner';
import { divePose, drawSplashCrown, drawWaterRing, type Drop } from './swimmer';

// Turmspringer: Posen für Turm, Luft und Wasser, gedreht um die Hüfte gezeichnet.
// Badeanzug in Trikotfarbe, barfuß, ohne Kappe. Dazu Spritzer und Kampfrichter.

type Gfx = Phaser.GameObjects.Graphics;

// ------------------------------------------------------------------ Posen

/** Ruhig an der Kante, Arme hängen */
export function diverStandPose(): Pose {
  const p = standPose();
  p.lean = 0;
  p.nearArm = { upper: 0.04, lower: 0.04 };
  p.farArm = { upper: -0.04, lower: -0.02 };
  return p;
}

/** Gehen zur Kante; u = Fortschritt 0..1 */
export function diverWalkPose(u: number): Pose {
  const p = runPose(u * 1.6, 0.12);
  p.lean = 0.02;
  return p;
}

/**
 * Armschwung am Turm: `lift` 1 = Arme oben (Hochpunkt), 0 = ganz hinten.
 * Die Amplitude wächst mit dem Schwung, hinten federn die Knie ein.
 */
export function diverSwingPose(lift: number, swing: number): Pose {
  const amp = 0.25 + 0.75 * Math.max(0, Math.min(1, swing));
  const a = amp * (-0.9 + (Math.PI - 0.15 + 0.9) * lift);
  const dip = (1 - lift) * 0.5 * amp;
  return {
    hip: 25 - dip * 6,
    lean: 0.04 + dip * 0.55,
    nearLeg: { upper: dip * 0.9, lower: -dip * 0.6 },
    farLeg: { upper: dip * 0.8 - 0.04, lower: -dip * 0.7 },
    nearArm: { upper: a, lower: a + 0.12 },
    farArm: { upper: a - 0.06, lower: a + 0.04 },
  };
}

/** Abdruck: gestreckt auf den Zehen, Arme über dem Kopf */
export function diverTakeoffPose(): Pose {
  return {
    hip: 26,
    lean: -0.05,
    nearLeg: { upper: -0.1, lower: -0.18 },
    farLeg: { upper: -0.14, lower: -0.22 },
    nearArm: { upper: Math.PI - 0.12, lower: Math.PI - 0.05 },
    farArm: { upper: Math.PI - 0.02, lower: Math.PI + 0.04 },
  };
}

/** Hocke: Knie an der Brust, Hände an den Schienbeinen */
export function tuckPose(): Pose {
  return {
    hip: 25,
    lean: 0.55,
    nearLeg: { upper: 2.3, lower: 0.15 },
    farLeg: { upper: 2.2, lower: 0.05 },
    nearArm: { upper: 0.9, lower: -0.66 },
    farArm: { upper: 0.8, lower: -0.7 },
  };
}

/** Hecht: Beine gestreckt nach vorne, Oberkörper darübergeklappt, Hände an den Knöcheln */
export function pikePose(): Pose {
  return {
    hip: 25,
    lean: 1.3,
    nearLeg: { upper: 1.5, lower: 1.5 },
    farLeg: { upper: 1.45, lower: 1.45 },
    nearArm: { upper: 1.2, lower: 0.41 },
    farArm: { upper: 1.15, lower: 0.36 },
  };
}

/** Gestreckt, Arme seitlich am Körper */
export function straightPose(): Pose {
  return {
    hip: 25,
    lean: 0,
    nearLeg: { upper: 0.02, lower: 0.02 },
    farLeg: { upper: -0.02, lower: -0.02 },
    nearArm: { upper: 0.06, lower: 0.06 },
    farArm: { upper: -0.04, lower: -0.04 },
  };
}

/** Sprungposition in der Luft (nur solange die Leertaste gehalten wird) */
export function positionPose(position: DivePosition): Pose {
  return position === 'tuck' ? tuckPose() : position === 'pike' ? pikePose() : straightPose();
}

/** Linie zum Eintauchen: Arme über dem Kopf, Hände übereinander */
export function linePose(): Pose {
  return divePose();
}

/** Schraube: gestreckt, Arme vor der Brust verschränkt */
export function twistPose(): Pose {
  const p = straightPose();
  p.nearArm = { upper: 0.35, lower: Math.PI - 0.5 };
  p.farArm = { upper: 0.3, lower: Math.PI - 0.6 };
  return p;
}

/** Arschbombe: Kugel, die Arme umschlingen die Knie */
export function bombPose(): Pose {
  return {
    hip: 25,
    lean: 0.75,
    nearLeg: { upper: 2.5, lower: 0.3 },
    farLeg: { upper: 2.4, lower: 0.2 },
    nearArm: { upper: 1.1, lower: -0.5 },
    farArm: { upper: 1.0, lower: -0.55 },
  };
}

/** Klatscher: flach ausgestreckt, Arme und Beine leicht gespreizt */
export function flatPose(): Pose {
  return {
    hip: 25,
    lean: 0,
    nearLeg: { upper: 0.15, lower: 0.1 },
    farLeg: { upper: -0.15, lower: -0.2 },
    nearArm: { upper: Math.PI - 0.6, lower: Math.PI - 0.5 },
    farArm: { upper: Math.PI + 0.5, lower: Math.PI + 0.4 },
  };
}

/** Wassertreten nach dem Auftauchen: winken oder mit den Armen paddeln */
export function treadPose(time: number, happy: boolean): Pose {
  const p = happy ? wavePose(time) : standPose();
  const kick = Math.sin(time * 6) * 0.25;
  p.nearLeg = { upper: 0.6 + kick, lower: -0.5 + kick };
  p.farLeg = { upper: 0.25 - kick, lower: -0.8 - kick };
  if (!happy) {
    const scull = Math.sin(time * 5) * 0.3;
    p.nearArm = { upper: 1.2 + scull, lower: 1.5 + scull };
    p.farArm = { upper: 1.0 - scull, lower: 1.4 - scull };
  }
  return p;
}

/** Weicher Übergang zwischen zwei Posen */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  return lerpPose(a, b, Math.max(0, Math.min(1, t)));
}

// --------------------------------------------------------------- Zeichnen

export interface DiverDrawOptions {
  /** Drehung um die Hüfte im Bogenmaß (vorwärts positiv) */
  rotation?: number;
  /** Laufende Schraube: Phase 0..1, sonst null */
  twist?: number | null;
  mood?: Mood;
  time: number;
  /** −1 = nach links schauen (z. B. Kopfschütteln) */
  dir?: 1 | -1;
}

/** Schraube in 4 Bildern: von vorne, schmal, von hinten (gespiegelt), schmal */
const TWIST_SCALE = [1, 0.45, -1, -0.45];

/** Zeichnet den Springer; (x, hipY) ist die Hüfte. */
export function drawDiver(g: Gfx, x: number, hipY: number, pose: Pose, look: RunnerLook, opts: DiverDrawOptions): void {
  const frame = opts.twist != null ? Math.floor(((opts.twist % 1) + 1) % 1 * 4) % 4 : 0;
  g.save();
  g.translateCanvas(Math.round(x), Math.round(hipY));
  if (opts.rotation) g.rotateCanvas(opts.rotation);
  const sx = TWIST_SCALE[frame] * (opts.dir ?? 1);
  if (sx !== 1) g.scaleCanvas(sx, 1);
  drawRunner(g, 0, pose.hip, pose, look, { barefoot: true, mood: opts.mood ?? 'neutral', time: opts.time });
  g.restore();
}

// --------------------------------------------------------------- Spritzer

/**
 * Tropfen beim Eintauchen je Spritzer-Stufe (0 = „Rip“ … 3 = Fontäne).
 * x ist die Eintauchstelle in Bildschirm-Pixeln, h zählt ab der Wasserlinie.
 */
export function splashDrops(level: number, x: number, rng: () => number = Math.random): Drop[] {
  const [count, power, spread] = [
    [4, 0.35, 4],
    [12, 0.7, 10],
    [24, 1.0, 18],
    [46, 1.6, 30],
  ][Math.max(0, Math.min(3, level))];
  const drops: Drop[] = [];
  for (let i = 0; i < count; i++) {
    drops.push({
      x: x + (rng() - 0.5) * spread,
      h: 1,
      vx: (rng() - 0.5) * 70 * power,
      vh: (40 + rng() * 60) * power,
      life: 0.5 + rng() * 0.4 * power,
      size: rng() < 0.3 ? 1 : rng() < 0.8 ? 2 : 3,
    });
  }
  return drops;
}

/**
 * Krone, Fontäne, Ringe und Blasensäule nach dem Eintauchen.
 * `age` in Sekunden seit dem Eintauchen.
 */
export function drawEntrySplash(g: Gfx, x: number, waterY: number, level: number, age: number, time: number): void {
  // Blasensäule entlang der Eintauchbahn
  if (age < 1.4) {
    const n = level === 0 ? 7 : 4 + level * 2;
    for (let i = 0; i < n; i++) {
      const t = (age * 1.3 + i / n) % 1;
      const depth = 6 + (1 - t) * (level === 0 ? 46 : 36);
      const bx = x + Math.sin(time * 7 + i * 1.9) * (1.5 + level);
      g.fillStyle(0xd8f4ff, 0.8 * (1 - age / 1.4));
      g.fillRect(Math.round(bx), Math.round(waterY + depth), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
  }
  if (level === 0) {
    if (age < 0.5) drawWaterRing(g, x, waterY, 3 + age * 10, time);
    return;
  }
  const crownLife = [0, 0.5, 0.7, 0.9][level];
  if (age < crownLife) drawSplashCrown(g, x, waterY, age / crownLife, [0, 0.7, 1.1, 1.6][level]);
  if (level >= 2 && age < 1.2) drawWaterRing(g, x, waterY, 6 + age * 22, time);
  if (level === 3) {
    if (age > 0.15 && age < 1.4) drawWaterRing(g, x, waterY, 4 + (age - 0.15) * 34, time);
    // Fontäne: Säule schießt hoch und fällt in sich zusammen
    if (age < 0.8) {
      const u = age / 0.8;
      const h = Math.round(Math.sin(Math.PI * Math.min(1, u * 1.2)) * 46);
      const w = 6 + Math.round(u * 6);
      g.fillStyle(0x2f78b8, 0.6 * (1 - u));
      g.fillRect(Math.round(x - w / 2) - 1, waterY - h, w + 2, h);
      g.fillStyle(0xffffff, 0.9 * (1 - u * u));
      g.fillRect(Math.round(x - w / 2), waterY - h, w, h);
      g.fillStyle(0xbfeaff, 0.9 * (1 - u * u));
      g.fillRect(Math.round(x - w / 2) + 1, waterY - h + 2, 2, Math.max(0, h - 4));
    }
    // Welle läuft nach beiden Seiten
    if (age < 1.6) {
      const r = 10 + age * 60;
      g.fillStyle(0xffffff, 0.6 * (1 - age / 1.6));
      for (const side of [-1, 1]) g.fillRect(Math.round(x + side * r - 4), waterY - 1, 8, 2);
    }
  }
}

/** Aufsteigende Luftbläschen um einen Punkt unter Wasser */
export function drawBubbles(g: Gfx, x: number, y: number, time: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const t = (time * 1.4 + i / count) % 1;
    g.fillStyle(0xd8f4ff, 0.9 * (1 - t));
    const size = i % 3 === 0 ? 2 : 1;
    g.fillRect(Math.round(x + Math.sin(time * 5 + i * 2.3) * 3 + (i % 3) * 2), Math.round(y - t * 14), size, size);
  }
}

// ---------------------------------------------------------- Kampfrichter

/** Look der Kampfrichter: Blazer und weiße Hose wie der Offizielle im Weitsprung */
export function judgeLook(base: RunnerLook): RunnerLook {
  return { ...base, jersey: 0x24346b, shorts: 0xf0f0f0, accent: 0xf7d038, headband: false, shoe: 0x2a2a30 };
}

/**
 * Kampfrichter auf dem Hochstuhl, Blick zum Turm (nach links).
 * `raise` 0..1 hebt die Tafel über den Kopf; (x, seatY) ist die Sitzfläche.
 */
export function drawJudge(g: Gfx, x: number, seatY: number, look: RunnerLook, raise: number, time: number): void {
  const k = Math.max(0, Math.min(1, raise));
  const arm = (base: number) => ({ upper: 0.5 + (Math.PI - 0.22 - 0.5) * k + base, lower: 1.3 + (Math.PI - 0.12 - 1.3) * k + base });
  const pose: Pose = {
    hip: 2,
    lean: 0.05,
    nearLeg: { upper: 1.45, lower: 0.12 },
    farLeg: { upper: 1.35, lower: 0.05 },
    nearArm: arm(0),
    farArm: arm(0.08),
  };
  g.save();
  g.translateCanvas(Math.round(x), 0);
  g.scaleCanvas(-1, 1);
  drawRunner(g, 0, seatY + pose.hip, pose, look, { time, mood: 'neutral' });
  g.restore();
}
