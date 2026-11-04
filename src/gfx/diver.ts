import type Phaser from 'phaser';
import { COLORS } from '../config';
import type { DivePosition } from '../sim/dive';
import {
  BODY,
  along,
  dot,
  drawPieces,
  drawRunner,
  lerpPose,
  runPose,
  seg,
  shade,
  standPose,
  wavePose,
  type Mood,
  type Piece,
  type Pose,
  type RunnerLook,
} from './runner';
import { divePose, drawSplashCrown, drawWaterRing, type Drop } from './swimmer';

// Turmspringer: Posen für Turm, Luft und Wasser, gedreht um die Hüfte gezeichnet.
// Badeanzug in Trikotfarbe, barfuß, ohne Kappe. Dazu Spritzer und Kampfrichter.

type Gfx = Phaser.GameObjects.Graphics;

/** Der Springer wird etwas größer gezeichnet als die übrigen Figuren, damit er vor der Halle gut lesbar bleibt */
export const DIVER_SCALE = 1.15;

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

/**
 * Hecht: Beine durchgestreckt schräg nach vorne, der Oberkörper klappt über die Oberschenkel
 * (Hüftwinkel gut 30°, das V bleibt sichtbar), die Hände fassen die Schienbeine.
 */
export function pikePose(): Pose {
  return {
    hip: 25,
    lean: 1.6,
    nearLeg: { upper: 1.0, lower: 1.0 },
    farLeg: { upper: 0.95, lower: 0.95 },
    nearArm: { upper: -0.15, lower: 0.9 },
    farArm: { upper: -0.22, lower: 0.85 },
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

/**
 * Gleiten unter Wasser: Linie mit Delfin-Beinschlag, `time` in Sekunden seit dem Eintauchen.
 * Der Schlag wird mit der Zeit ruhiger.
 */
export function glidePose(time: number): Pose {
  const p = divePose();
  const amp = Math.max(0.1, 0.3 - time * 0.08);
  const kick = Math.sin(time * 11) * amp;
  p.nearLeg = { upper: kick, lower: kick - Math.max(0, Math.sin(time * 11 + 0.8)) * amp * 1.6 };
  p.farLeg = { upper: kick + 0.04, lower: kick - Math.max(0, Math.sin(time * 11 + 0.8)) * amp * 1.6 + 0.04 };
  return p;
}

/**
 * Wassertreten nach dem Auftauchen. Zufrieden: winken. Sonst paddeln, und beim Kopfschütteln
 * (`shake` > 0) streichen die Hände das Wasser aus dem Gesicht.
 */
export function treadPose(time: number, happy: boolean, shake = 0): Pose {
  const p = happy ? wavePose(time) : standPose();
  p.lean = happy ? 0.02 : 0.12;
  const kick = Math.sin(time * 6) * 0.25;
  p.nearLeg = { upper: 0.6 + kick, lower: -0.5 + kick };
  p.farLeg = { upper: 0.25 - kick, lower: -0.8 - kick };
  // Die freie Hand paddelt knapp unter der Oberfläche
  const scull = Math.sin(time * 5) * 0.3;
  p.farArm = { upper: 1.1 - scull, lower: 1.5 - scull };
  if (!happy) {
    p.nearArm = shake > 0 ? { upper: 2.3, lower: 3.4 } : { upper: 1.2 + scull, lower: 1.5 + scull };
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
  /** Gestreckte Fußspitzen (in der Luft) */
  pointToes?: boolean;
  /** Vergrößerung um die Hüfte (Standard DIVER_SCALE) */
  scale?: number;
  /** Wasserlinie (Bildschirm-Y, nur ohne Drehung): Teile darunter wirken bläulich und gestaucht */
  waterY?: number;
}

/**
 * Schraube in 4 Bildern um die Längsachse: Profil, von vorne, Profil gespiegelt, von hinten.
 * Vorder- und Rückansicht werden eigens gezeichnet (Arme vor der Brust verschränkt).
 */
const TWIST_FRAMES: readonly ('side' | 'front' | 'mirror' | 'back')[] = ['side', 'front', 'mirror', 'back'];

/** Zeichnet den Springer; (x, hipY) ist die Hüfte. */
export function drawDiver(g: Gfx, x: number, hipY: number, pose: Pose, look: RunnerLook, opts: DiverDrawOptions): void {
  const frame = opts.twist != null ? TWIST_FRAMES[Math.floor((((opts.twist % 1) + 1) % 1) * 4) % 4] : 'side';
  const k = opts.scale ?? DIVER_SCALE;
  const mood = opts.mood ?? 'neutral';
  g.save();
  g.translateCanvas(Math.round(x), Math.round(hipY));
  if (opts.rotation) g.rotateCanvas(opts.rotation);
  const sx = (frame === 'mirror' ? -1 : 1) * (opts.dir ?? 1);
  if (sx !== 1 || k !== 1) g.scaleCanvas(sx * k, k);
  if (frame === 'front' || frame === 'back') {
    drawDiverFront(g, look, frame === 'back', mood, opts.time);
  } else {
    // Wasserlinie in die gedrehten/skalierten Koordinaten umrechnen (nur ohne Drehung sinnvoll)
    const waterY = opts.waterY !== undefined && !opts.rotation ? (opts.waterY - Math.round(hipY)) / k : undefined;
    drawRunner(g, 0, pose.hip, pose, look, { barefoot: true, mood, time: opts.time, pointToes: opts.pointToes, waterY });
  }
  g.restore();
}

/**
 * Springer von vorne bzw. hinten, gestreckt mit verschränkten Armen (Schraube).
 * Hüfte bei (0, 0), Kopf oben; Licht von links, die rechte Körperseite ist dunkler.
 */
function drawDiverFront(g: Gfx, look: RunnerLook, back: boolean, mood: Mood, time: number): void {
  const { THIGH, SHIN, TORSO, NECK, HEAD_R } = BODY;
  const skin = look.skin;
  const dark = shade(skin, 0.78);
  const legY = THIGH + SHIN;
  const pieces: Piece[] = [
    // Beine dicht nebeneinander, Fußspitzen gestreckt
    seg(-2, 0, -1.6, legY, 4.6, 3, skin),
    seg(2, 0, 1.6, legY, 4.6, 3, dark),
    seg(-1.6, legY - 1, -1.4, legY + 4, 2.6, 1.8, skin),
    seg(1.6, legY - 1, 1.4, legY + 4, 2.6, 1.8, dark),
    // Rumpf: Badeanzug, an der Hüfte schmal, an den Schultern breit
    seg(0, 1, 0, -TORSO + 1, 9, 11, look.jersey),
    seg(0, 2, 0, -2, 9, 9.5, look.shorts, false, true),
    dot(-5.5, -TORSO + 2, 2, skin),
    dot(5.5, -TORSO + 2, 2, dark),
    seg(0, -TORSO + 1, 0, -TORSO - NECK, 3.4, 3, skin),
  ];
  // Beinausschnitt des Badeanzugs und Seitenstreifen
  pieces.push(seg(-3.6, 1.5, -1.2, -1, 1.6, 1.2, skin, false, false), seg(3.6, 1.5, 1.2, -1, 1.6, 1.2, dark, false, false));
  pieces.push(seg(-4.6, 0, -5.4, -TORSO + 3, 1, 1, look.accent, false, false));
  if (back) {
    // Rückenausschnitt mit Trägern
    pieces.push(seg(0, -TORSO + 2, 0, -TORSO + 7, 5, 3, skin, false, false));
    // Oberarme hängen seitlich, die Unterarme liegen vorne vor der Brust
    pieces.push(seg(-5.5, -TORSO + 2, -6.2, -5, 3, 2.6, skin), seg(5.5, -TORSO + 2, 6.2, -5, 3, 2.6, dark));
  } else {
    pieces.push(
      seg(5.5, -TORSO + 2, 6.2, -5, 3, 2.6, dark),
      seg(6.2, -5, -3, -9, 2.6, 2.4, dark),
      seg(-5.5, -TORSO + 2, -6.2, -5.5, 3, 2.6, skin),
      seg(-6.2, -5.5, 3.2, -8, 2.6, 2.4, skin),
    );
  }
  drawPieces(g, pieces);

  // Kopf
  const hy = -TORSO - NECK - HEAD_R;
  const bald = look.hairStyle === 'bald';
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(0, hy, HEAD_R + 1);
  g.fillStyle(back && !bald ? look.hair : skin, 1);
  g.fillCircle(0, hy, HEAD_R);
  if (look.hairStyle === 'bun' || look.hairStyle === 'ponytail') {
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(0, hy - HEAD_R, 2.6);
    g.fillStyle(look.hair, 1);
    g.fillCircle(0, hy - HEAD_R, 1.8);
  }
  if (back) {
    g.fillStyle(skin, 1);
    g.fillRect(-HEAD_R - 1, hy, 1, 2);
    g.fillRect(HEAD_R, hy, 1, 2);
    return;
  }
  if (!bald) {
    // Haaransatz als Kappe oben
    g.fillStyle(look.hair, 1);
    g.fillRect(-HEAD_R + 1, hy - HEAD_R, HEAD_R * 2 - 2, 3);
    g.fillRect(-HEAD_R, hy - HEAD_R + 1, 2, 3);
    g.fillRect(HEAD_R - 2, hy - HEAD_R + 1, 2, 3);
  }
  g.fillStyle(shade(skin, 0.85), 1);
  g.fillRect(1, hy, 4, 4);
  // Augen zusammengekniffen vor Anstrengung, Mund
  g.fillStyle(COLORS.outline, 1);
  const blink = mood === 'effort' || (time * 3) % 3.4 < 0.15;
  g.fillRect(-3, hy - 0.5, 2, blink ? 1 : 2);
  g.fillRect(1, hy - 0.5, 2, blink ? 1 : 2);
  g.fillStyle(0x7a1f1f, 1);
  g.fillRect(-1, hy + 2.5, 2, 1);
}

// --------------------------------------------------------------- Spritzer

/** Pseudozufall 0..1 aus einer Zahl – Spritzer sehen in jedem Bild gleich aus */
function hash(n: number): number {
  const h = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * Tropfen beim Eintauchen je Spritzer-Stufe (0 = „Rip“ … 3 = Fontäne).
 * x ist die Eintauchstelle in Bildschirm-Pixeln, h zählt ab der Wasserlinie.
 */
export function splashDrops(level: number, x: number, rng: () => number = Math.random): Drop[] {
  const [count, power, spread] = [
    [3, 0.3, 2],
    [12, 0.7, 10],
    [26, 1.0, 18],
    [64, 1.75, 34],
  ][Math.max(0, Math.min(3, level))];
  const drops: Drop[] = [];
  for (let i = 0; i < count; i++) {
    // Bei der Fontäne fliegt ein Teil der Tropfen erst später aus der zusammenfallenden Säule
    const late = level === 3 && i % 3 === 0;
    drops.push({
      x: x + (rng() - 0.5) * spread,
      h: late ? 20 + rng() * 40 : 1,
      vx: (rng() - 0.5) * 70 * power * (late ? 1.3 : 1),
      vh: (40 + rng() * 60) * power * (late ? 0.5 : 1),
      life: 0.5 + rng() * 0.4 * power,
      size: rng() < 0.3 ? 1 : rng() < 0.75 ? 2 : 3,
    });
  }
  return drops;
}

/** Blasen, die an der Oberfläche aufploppen (um x, Breite `w`) */
function drawBoil(g: Gfx, x: number, waterY: number, w: number, count: number, age: number, until: number): void {
  if (age > until) return;
  const fade = 1 - age / until;
  for (let i = 0; i < count; i++) {
    const r = hash(i + 1);
    const life = (age * (1.6 + r) + r * 3) % 1;
    const bx = Math.round(x + (hash(i * 7 + 3) - 0.5) * w);
    const by = waterY + Math.floor(hash(i * 5 + 2) * 3);
    if (life < 0.6) {
      g.fillStyle(0xffffff, 0.9 * fade);
      g.fillRect(bx, by, life < 0.3 ? 1 : 2, 1);
    } else if (life < 0.75) {
      // Platzt: kleiner Ring
      g.fillStyle(0xeaf8ff, 0.7 * fade);
      g.fillRect(bx - 1, by, 1, 1);
      g.fillRect(bx + 2, by, 1, 1);
    }
  }
}

/** Fontäne beim Klatscher: Säule mit Wasserkopf, seitliche Fahnen und Gischt */
function drawFountain(g: Gfx, x: number, waterY: number, age: number): void {
  if (age >= 1.0) return;
  const u = age / 1.0;
  const rise = Math.sin(Math.PI * Math.min(1, u * 1.15));
  const h = Math.round(rise * 58);
  const fade = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
  // Säule aus Scheiben: unten breit, oben schmal, mit Wackeln
  for (let y = 0; y < h; y += 2) {
    const k = y / Math.max(1, h);
    const w = Math.round(14 - 9 * k + Math.sin(age * 30 + y * 0.5) * 1.5);
    const cx = Math.round(x + Math.sin(y * 0.25 + age * 9) * 1.2 * k);
    g.fillStyle(0x2f78b8, 0.55 * fade);
    g.fillRect(cx - Math.ceil(w / 2) - 1, waterY - y - 2, w + 2, 2);
    g.fillStyle(0xffffff, 0.95 * fade);
    g.fillRect(cx - Math.ceil(w / 2), waterY - y - 2, w, 2);
    g.fillStyle(0xbfeaff, 0.95 * fade);
    g.fillRect(cx - Math.ceil(w / 2) + 1, waterY - y - 2, 2, 2);
  }
  // Wasserkopf zerfällt oben in Klumpen
  if (h > 8) {
    const top = waterY - h;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + age * 3;
      const spread = 3 + u * 10;
      const bx = Math.round(x + Math.cos(a) * spread);
      const by = Math.round(top + Math.sin(a) * spread * 0.5 - 2);
      const sz = i % 2 === 0 ? 3 : 2;
      g.fillStyle(0x2f78b8, 0.6 * fade);
      g.fillRect(bx, by + sz, sz, 1);
      g.fillStyle(0xffffff, fade);
      g.fillRect(bx, by, sz, sz);
    }
  }
  // Seitliche Fahnen: schräg nach außen
  if (age < 0.7) {
    const v = age / 0.7;
    const len = Math.round(Math.sin(Math.PI * Math.min(1, v * 1.3)) * 24);
    for (const side of [-1, 1]) {
      for (let i = 0; i < len; i += 2) {
        const px = Math.round(x + side * (5 + i * 0.8 + v * 6));
        const py = Math.round(waterY - 2 - i * 1.5 + (i * i) / 28);
        const w = i < len - 4 ? 3 : 2;
        g.fillStyle(0x2f78b8, 0.5 * (1 - v));
        g.fillRect(px, py + 2, w, 1);
        g.fillStyle(0xffffff, 0.95 * (1 - v * v));
        g.fillRect(px, py, w, 2);
      }
    }
  }
  // Gischt: feiner Nebel um die Säule
  for (let i = 0; i < 18; i++) {
    const r = hash(i + 40);
    const life = (age * 1.4 + r) % 1;
    const mx = Math.round(x + (hash(i * 3 + 11) - 0.5) * (20 + age * 40));
    const my = Math.round(waterY - h * hash(i * 13 + 5) - life * 8);
    g.fillStyle(0xffffff, 0.5 * fade * (1 - life));
    g.fillRect(mx, my, 1, 1);
  }
}

/**
 * Krone, Fontäne, Ringe und Blasensäule nach dem Eintauchen.
 * `age` in Sekunden seit dem Eintauchen.
 */
export function drawEntrySplash(g: Gfx, x: number, waterY: number, level: number, age: number, time: number): void {
  // Blasensäule entlang der Eintauchbahn – beim „Rip“ dicht und lang
  if (age < 1.6) {
    const n = level === 0 ? 12 : 4 + level * 2;
    for (let i = 0; i < n; i++) {
      const t = (age * 1.3 + i / n) % 1;
      const depth = 6 + (1 - t) * (level === 0 ? 50 : 36);
      const bx = x + Math.sin(time * 7 + i * 1.9) * (1.5 + level);
      g.fillStyle(0xd8f4ff, 0.85 * (1 - age / 1.6));
      g.fillRect(Math.round(bx), Math.round(waterY + depth), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
  }
  if (level === 0) {
    // „Rip“: nur ein schmaler Zipfel schießt hoch, dann blubbert es leise
    if (age < 0.2) {
      const u = age / 0.2;
      const h = Math.round(Math.sin(Math.PI * u) * 9);
      g.fillStyle(0x2f78b8, 0.6);
      g.fillRect(Math.round(x) - 2, waterY - h, 1, h);
      g.fillStyle(0xffffff, 0.95);
      g.fillRect(Math.round(x) - 1, waterY - h, 2, h);
      g.fillRect(Math.round(x) - 3, waterY - 1, 1, 1);
      g.fillRect(Math.round(x) + 2, waterY - 1, 1, 1);
    }
    if (age < 0.6) drawWaterRing(g, x, waterY, 2 + age * 9, time);
    drawBoil(g, x, waterY, 10, 8, age, 1.4);
    return;
  }
  const crownLife = [0, 0.5, 0.7, 1.0][level];
  if (age < crownLife) drawSplashCrown(g, x, waterY, age / crownLife, [0, 0.7, 1.1, 1.9][level]);
  if (level >= 2 && age < 1.2) drawWaterRing(g, x, waterY, 6 + age * 22, time);
  drawBoil(g, x, waterY, 8 + level * 8, 4 + level * 4, age, 0.8 + level * 0.4);
  if (level === 3) {
    // Schaumteppich bleibt lange liegen
    if (age < 2.2) {
      const f = 1 - age / 2.2;
      g.fillStyle(0xffffff, 0.55 * f);
      g.fillEllipse(Math.round(x), waterY + 2, 46 + age * 18, 7 + age * 2);
      g.fillStyle(0xd8f4ff, 0.6 * f);
      g.fillEllipse(Math.round(x), waterY + 2, 30 + age * 12, 4);
    }
    if (age > 0.15 && age < 1.6) drawWaterRing(g, x, waterY, 4 + (age - 0.15) * 34, time);
    if (age > 0.4 && age < 1.8) drawWaterRing(g, x, waterY, 3 + (age - 0.4) * 26, time + 1);
    drawFountain(g, x, waterY, age);
    // Welle läuft nach beiden Seiten
    if (age < 1.8) {
      const r = 12 + age * 62;
      g.fillStyle(0xffffff, 0.7 * (1 - age / 1.8));
      for (const side of [-1, 1]) {
        g.fillRect(Math.round(x + side * r - 5), waterY - 1, 10, 2);
        g.fillRect(Math.round(x + side * r - 2), waterY - 2, 4, 1);
      }
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

/** Reaktion eines Kampfrichters auf das Eintauchen; `age` in Sekunden */
export interface JudgeReaction {
  kind: 'nod' | 'shake';
  age: number;
}

/**
 * Kampfrichter auf dem Hochstuhl, Blick zum Turm (nach links).
 * `raise` 0..1 hebt die Tafel mit beiden Händen über den Kopf; vorher liegt sie umgedreht auf dem Schoß.
 * Nicken bei einem guten Sprung, Kopfschütteln bei einem Klatscher. (x, seatY) ist die Sitzfläche.
 */
export function drawJudge(
  g: Gfx,
  x: number,
  seatY: number,
  look: RunnerLook,
  raise: number,
  time: number,
  react: JudgeReaction | null = null,
): void {
  const k = Math.max(0, Math.min(1, raise));
  // Ease: die Tafel geht schwungvoll hoch und bleibt ruhig oben
  const e = 1 - (1 - k) * (1 - k);
  const arm = (base: number) => ({
    upper: 0.42 + (Math.PI - 0.25 - 0.42) * e + base,
    lower: 1.5 + (Math.PI - 0.08 - 1.5) * e + base,
  });
  const active = react !== null && react.age < 1.2;
  const nod = active && react.kind === 'nod' ? Math.max(0, Math.sin(react.age * 14)) * 0.14 * (1 - react.age / 1.2) : 0;
  // Gespannt nach vorne gebeugt, solange der Springer in der Luft ist; leichtes Atmen
  const lean = 0.1 + nod + Math.sin(time * 1.7) * 0.015;
  const pose: Pose = {
    hip: 2,
    lean,
    nearLeg: { upper: 1.5, lower: 0.06 },
    farLeg: { upper: 1.42, lower: 0 },
    nearArm: arm(0),
    farArm: arm(0.08),
  };
  const hx = Math.sin(lean) * (BODY.TORSO + BODY.NECK + BODY.HEAD_R);
  const hy = seatY - Math.cos(lean) * (BODY.TORSO + BODY.NECK + BODY.HEAD_R);
  g.save();
  g.translateCanvas(Math.round(x), 0);
  g.scaleCanvas(-1, 1);
  drawRunner(g, 0, seatY + pose.hip, pose, look, { time, mood: 'neutral' });
  // Lange Ärmel des Blazers über dem vorderen Arm
  const shX = Math.sin(lean) * BODY.TORSO;
  const shY = seatY - Math.cos(lean) * BODY.TORSO;
  const [ex, ey] = along(shX, shY, pose.nearArm.upper, BODY.UPPER_ARM);
  const [cx0, cy0] = along(ex, ey, pose.nearArm.lower, BODY.FOREARM * 0.62);
  drawPieces(g, [seg(shX, shY, ex, ey, 3.8, 3.4, look.jersey), seg(ex, ey, cx0, cy0, 3.4, 3.2, look.jersey)]);
  g.fillStyle(look.accent, 1);
  g.fillRect(Math.round(cx0) - 1, Math.round(cy0) - 1, 2, 2);
  // Kopfschütteln: abwechselnd zum Turm und weg vom Turm schauen
  if (active && react.kind === 'shake' && Math.floor(react.age * 8) % 2 === 1) {
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(hx, hy, BODY.HEAD_R + 1);
    g.fillStyle(look.hairStyle === 'bald' ? look.skin : look.hair, 1);
    g.fillCircle(hx, hy, BODY.HEAD_R);
    g.fillStyle(look.skin, 1);
    g.fillRect(hx - 2, hy + 1, 4, 3);
    g.fillRect(hx - BODY.HEAD_R - 1, hy, 2, 2);
  }
  // Umgedrehte Tafel auf dem Schoß, solange sie nicht gehoben ist
  if (k < 0.25) {
    const cx = 10;
    const cy = Math.round(seatY - 4);
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(cx - 4, cy - 1, 9, 3);
    g.fillStyle(0xd8dce6, 1);
    g.fillRect(cx - 3, cy, 7, 1);
  }
  g.restore();
}
