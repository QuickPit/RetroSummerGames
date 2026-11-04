import type Phaser from 'phaser';
import { COLORS } from '../config';
import {
  BODY,
  WATER_TINT,
  cheerPose,
  dot,
  drawPieces,
  drawRunner,
  drawSwimCap,
  mixColor,
  seg,
  shade,
  standPose,
  type Mood,
  type Piece,
  type Pose,
  type RunnerLook,
  type WaterTint,
} from './runner';

// Schwimmer: aufrechte Posen (Block, Sprung, Jubel) über drawRunner mit Badekappe,
// waagerechte Posen (Kraulen, Atmen, Wende …) eigenständig. Alle Posen blicken nach
// rechts und werden für die Rückbahn gespiegelt (dir = −1).

type Gfx = Phaser.GameObjects.Graphics;

/** So weit liegt die Kopfspitze vor der Schulter (Pixel) */
export const SWIMMER_HEAD_LEAD = 12;

export type SwimKind = 'crawl' | 'breath' | 'choke' | 'gasp' | 'glide' | 'touch';

export interface SwimDrawOptions {
  dir: 1 | -1;
  /** Armzyklus: +1 = beide Arme einmal herum (jeder Zug = ½) */
  cycle: number;
  /** Beinschlag-Phase in Radiant */
  kick: number;
  time: number;
}

// ------------------------------------------------------- Aufrechte Posen

/** Auf dem Block: Arme kreisen zum Lockern */
export function armCirclePose(time: number, seed: number): Pose {
  const p = standPose();
  const a = -(time * 6 + seed);
  p.nearArm = { upper: a, lower: a - 0.15 };
  p.farArm = { upper: a + Math.PI, lower: a + Math.PI - 0.15 };
  return p;
}

/** Startposition auf dem Block: tief gebeugt, Hände an der Blockkante */
export function blockCrouchPose(): Pose {
  return {
    hip: 19,
    lean: 1.4,
    nearLeg: { upper: 0.9, lower: -0.5 },
    farLeg: { upper: 0.75, lower: -0.6 },
    nearArm: { upper: 0.15, lower: 0.05 },
    farArm: { upper: 0.05, lower: -0.05 },
  };
}

/** Gestreckt im Startsprung – wird um ~90° gedreht gezeichnet */
export function divePose(): Pose {
  return {
    hip: 25,
    lean: 0,
    nearLeg: { upper: -0.05, lower: -0.1 },
    farLeg: { upper: 0.05, lower: 0 },
    nearArm: { upper: Math.PI - 0.05, lower: Math.PI - 0.08 },
    farArm: { upper: Math.PI + 0.05, lower: Math.PI + 0.02 },
  };
}

/** Wassertreten mit hochgerissenen Armen nach dem Sieg */
export function waterCheerPose(time: number): Pose {
  const p = cheerPose(time);
  const kick = Math.sin(time * 7) * 0.2;
  p.nearLeg = { upper: 0.35 + kick, lower: -0.9 + kick };
  p.farLeg = { upper: 0.1 - kick, lower: -1.1 - kick };
  return p;
}

/** Erschöpft an der Leine: Arme vorne aufgelegt, Kopf hängt */
export function ropeRestPose(time: number): Pose {
  const breath = Math.sin(time * 4) * 0.04;
  return {
    hip: 25,
    lean: 0.35 + breath,
    nearLeg: { upper: 0.3, lower: -0.8 },
    farLeg: { upper: 0.05, lower: -0.9 },
    nearArm: { upper: 1.45, lower: 1.65 },
    farArm: { upper: 1.3, lower: 1.55 },
  };
}

export interface UprightOptions {
  dir: 1 | -1;
  mood?: Mood;
  time: number;
  /** Drehung um die Hüfte (Startsprung) */
  rotation?: number;
  lift?: number;
  /** Wasseroberfläche, falls der Schwimmer im Wasser steht */
  waterY?: number;
}

/** Aufrechte Pose mit Badekappe; (x, y) ist der Bodenpunkt unter der Hüfte. */
export function drawSwimmerUpright(g: Gfx, x: number, y: number, pose: Pose, look: RunnerLook, opts: UprightOptions): void {
  g.save();
  g.translateCanvas(Math.round(x), 0);
  if (opts.dir < 0) g.scaleCanvas(-1, 1);
  drawRunner(g, 0, y, pose, look, {
    cap: look.jersey,
    mood: opts.mood ?? 'neutral',
    time: opts.time,
    rotation: opts.rotation,
    lift: opts.lift,
    waterY: opts.waterY,
  });
  g.restore();
  if (opts.waterY !== undefined) drawWaterRing(g, x, opts.waterY, 12, opts.time);
}

// ----------------------------------------------------- Waagerechte Posen

const WET: WaterTint = { y: 0.5, color: WATER_TINT, amount: 0.55 };
const DEEP: WaterTint = { y: -100, color: WATER_TINT, amount: 0.7 };

interface ArmShape {
  upper: number;
  lower: number;
}

/** Armwinkel im Kraulzyklus (φ 0..1: Zug unter Wasser, dann Rückholen über Wasser) */
function crawlArm(phi: number): ArmShape {
  const f = ((phi % 1) + 1) % 1;
  if (f < 0.5) {
    const u = f / 0.5;
    const upper = 0.12 + (Math.PI - 0.4) * u;
    return { upper, lower: upper + 0.45 * Math.sin(Math.PI * u) };
  }
  const u = (f - 0.5) / 0.5;
  const upper = Math.PI - 0.28 + (Math.PI + 0.4) * u;
  return { upper, lower: upper + 2.1 * Math.sin(Math.PI * u) };
}

function armPieces(sx: number, sy: number, arm: ArmShape, skin: number): Piece[] {
  const ex = sx + Math.cos(arm.upper) * BODY.UPPER_ARM;
  const ey = sy + Math.sin(arm.upper) * BODY.UPPER_ARM;
  const hx = ex + Math.cos(arm.lower) * BODY.FOREARM;
  const hy = ey + Math.sin(arm.lower) * BODY.FOREARM;
  return [seg(sx, sy, ex, ey, 3.4, 2.8, skin), seg(ex, ey, hx, hy, 2.8, 2.4, skin), dot(hx, hy, 1.8, skin)];
}

function legPieces(hx: number, hy: number, a: number, bend: number, skin: number): Piece[] {
  const kx = hx + Math.cos(a) * BODY.THIGH;
  const ky = hy + Math.sin(a) * BODY.THIGH;
  const a2 = a + bend;
  const ax = kx + Math.cos(a2) * BODY.SHIN;
  const ay = ky + Math.sin(a2) * BODY.SHIN;
  // Gestreckte Fußspitzen
  const fx = ax + Math.cos(a2 + 0.35) * BODY.FOOT;
  const fy = ay + Math.sin(a2 + 0.35) * BODY.FOOT;
  return [seg(hx, hy, kx, ky, 5.5, 4, skin), seg(kx, ky, ax, ay, 4, 3, skin), seg(ax, ay, fx, fy, 3, 2, skin)];
}

/** Halbe Scheibe in Wasserfarbe über den Teil des Kopfes unter der Oberfläche */
function submergeHead(g: Gfx, hx: number, hy: number, r: number): void {
  const level = WET.y;
  if (hy + r <= level) return;
  const a0 = Math.asin(Math.max(-1, Math.min(1, (level - hy) / r)));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((Math.PI - 2 * a0) * i) / 12;
    pts.push({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r });
  }
  g.fillStyle(WATER_TINT, 0.5);
  g.fillPoints(pts, true);
}

/** Kopf im Profil (Blick nach vorne/unten) oder zur Kamera gedreht (Atmen, Luftschnappen) */
function drawHead(g: Gfx, hx: number, hy: number, look: RunnerLook, kind: SwimKind, time: number, deep: boolean): void {
  const r = BODY.HEAD_R;
  const skin = deep ? mixColor(look.skin, WATER_TINT, DEEP.amount) : look.skin;
  const cap = deep ? mixColor(look.jersey, WATER_TINT, DEEP.amount) : look.jersey;
  g.fillStyle(deep ? mixColor(COLORS.outline, WATER_TINT, 0.5) : COLORS.outline, 1);
  g.fillCircle(hx, hy, r + 1);
  g.fillStyle(skin, 1);
  g.fillCircle(hx, hy, r);

  if (kind === 'breath' || kind === 'gasp') {
    // Gesicht zur Kamera: Kappe oben, Brille quer, Mund „O“
    g.fillStyle(cap, 1);
    g.fillRect(hx - r, hy - r, r * 2, 4);
    g.fillRect(hx - r + 1, hy - r - 1, r * 2 - 2, 1);
    g.fillStyle(shade(cap, 1.35), 1);
    g.fillRect(hx - 2, hy - r, 3, 1);
    g.fillStyle(look.accent, 1);
    g.fillRect(hx - r, hy - 1, r * 2, 1);
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(hx - 4, hy - 2, 3, 3);
    g.fillRect(hx + 1, hy - 2, 3, 3);
    g.fillStyle(0x6fd3ff, 1);
    g.fillRect(hx - 3, hy - 1, 1, 1);
    g.fillRect(hx + 2, hy - 1, 1, 1);
    const big = kind === 'gasp';
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(hx, hy + 3, big ? 2 : 1.5);
    g.fillStyle(0x7a1f1f, 1);
    g.fillCircle(hx, hy + 3, big ? 1.2 : 0.8);
    return;
  }

  drawSwimCap(g, hx, hy, cap, look.accent);
  if (kind === 'choke') {
    // Augen zu, Mund auf, Wasserstrahl
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(hx + 2, hy - 1, 4, 1);
    g.fillRect(hx + 3, hy + 2, 2, 2);
    const t = (time * 3) % 1;
    g.fillStyle(0xbfeaff, 1);
    for (let i = 0; i < 4; i++) {
      const s = i * 2.5 + t * 2.5;
      g.fillRect(Math.round(hx + 6 + s), Math.round(hy + 2 - s * 0.9 + s * s * 0.08), 1, 1);
    }
  } else if (kind === 'touch') {
    g.fillStyle(shade(look.skin, 0.55), 1);
    g.fillRect(hx + 3, hy + 2.5, 2, 1);
  }
  if (!deep) submergeHead(g, hx, hy, r + 1);
}

/**
 * Schwimmer waagerecht im Wasser. (x, y) ist die Wasserlinie unter der Schulter.
 */
export function drawSwimmer(g: Gfx, x: number, y: number, kind: SwimKind, look: RunnerLook, opts: SwimDrawOptions): void {
  g.save();
  g.translateCanvas(Math.round(x), Math.round(y) + (kind === 'glide' ? 7 : 0));
  if (opts.dir < 0) g.scaleCanvas(-1, 1);

  const deep = kind === 'glide';
  const water = deep ? DEEP : WET;
  const headUp = kind === 'choke' ? -4.5 : kind === 'gasp' ? -6 : kind === 'breath' ? -2.5 : kind === 'touch' ? -3 : -0.5;
  const sx = 0;
  const sy = 1.5;
  const hipX = -15;
  const hipY = kind === 'touch' || kind === 'gasp' ? 5 : 3;
  const headX = kind === 'gasp' ? 5 : 7;

  let near: ArmShape;
  let far: ArmShape;
  if (kind === 'glide') {
    near = { upper: -0.05, lower: -0.05 };
    far = { upper: 0.02, lower: 0.02 };
  } else if (kind === 'touch') {
    near = { upper: -0.2, lower: -0.25 };
    far = { upper: Math.PI / 2 + 0.4, lower: Math.PI / 2 + 0.6 };
  } else if (kind === 'gasp') {
    const flail = Math.sin(opts.time * 18) * 0.5;
    near = { upper: -1.2 + flail, lower: -0.6 + flail };
    far = { upper: 1.2 - flail, lower: 1.6 - flail };
  } else {
    near = crawlArm(opts.cycle);
    far = crawlArm(opts.cycle + 0.5);
  }

  const kick = Math.sin(opts.kick);
  const legDrop = kind === 'touch' ? 0.35 : kind === 'glide' ? 0 : 0.06;
  const farSkin = shade(look.skin, 0.72);

  // Hinterer Arm und hinteres Bein
  drawPieces(g, armPieces(sx, sy - 1, far, farSkin), water);
  drawPieces(g, legPieces(hipX, hipY - 1, Math.PI - legDrop - 0.12 * kick, 0.25 * Math.sin(opts.kick + 2), farSkin), water);

  // Rumpf: Badeanzug unter Wasser, der Rücken schaut heraus
  drawPieces(
    g,
    [
      seg(sx, sy, headX - 2, headUp + 1, 3.4, 3, look.skin),
      seg(hipX, hipY, sx, sy, 8, 9.5, look.jersey),
      seg(hipX, hipY, hipX + 5, hipY - 0.3, 9, 8.6, look.shorts, false),
    ],
    water,
  );
  if (!deep) {
    drawPieces(g, [
      seg(hipX + 1, hipY - 3.2, sx - 1, sy - 3.8, 2.4, 2.4, look.jersey, false),
      seg(hipX + 2, hipY - 3.6, sx - 3, sy - 4.3, 1, 1, shade(look.jersey, 1.3), false, false),
    ]);
  }

  drawHead(g, headX, headUp, look, kind, opts.time, deep);

  // Vorderes Bein und vorderer Arm
  drawPieces(g, legPieces(hipX, hipY, Math.PI - legDrop + 0.12 * kick, 0.25 * Math.sin(opts.kick - 1), look.skin), water);
  drawPieces(g, armPieces(sx, sy, near, look.skin), water);

  if (deep) {
    // Bläschen steigen auf
    for (let i = 0; i < 3; i++) {
      const t = (opts.time * 1.5 + i / 3) % 1;
      g.fillStyle(0xd8f4ff, 1 - t);
      g.fillRect(Math.round(headX + 4 + i * 2), Math.round(-2 - t * 8), 1, 1);
    }
  }
  g.restore();
}

/** Schlüsselbilder der Rollwende (lokal, Wand rechts): Hüfte, Schulter, Kopf, Knie, Fuß, Ellbogen, Hand */
type FlipFrame = Record<'hip' | 'sh' | 'head' | 'knee' | 'foot' | 'elbow' | 'hand', [number, number]>;
const FLIP_FRAMES: readonly FlipFrame[] = [
  // Kopf taucht ab, Hüfte an der Oberfläche
  { hip: [-4, 0], sh: [6, 5], head: [11, 9], knee: [-15, -1], foot: [-25, -2], elbow: [3, 11], hand: [-3, 13] },
  // Senkrecht kopfüber, die Beine kommen hoch
  { hip: [0, -1], sh: [2, 11], head: [3, 17], knee: [-5, -10], foot: [1, -17], elbow: [-4, 13], hand: [-9, 11] },
  // Die Beine schwingen über Wasser zur Wand
  { hip: [2, 1], sh: [-7, 10], head: [-11, 14], knee: [10, -8], foot: [16, -2], elbow: [-12, 6], hand: [-18, 3] },
  // Auf dem Rücken, Füße an der Wand
  { hip: [3, 5], sh: [-10, 7], head: [-16, 8], knee: [10, 0], foot: [14, 6], elbow: [-17, 5], hand: [-24, 5] },
];

/**
 * Rollwende, u = Fortschritt 0..1 in vier Bildern: Körper taucht ab, die Füße
 * schwingen über Wasser zur Wand. (x, y) wie bei drawSwimmer.
 */
export function drawFlipTurn(g: Gfx, x: number, y: number, u: number, look: RunnerLook, dir: 1 | -1, time: number): void {
  const f = FLIP_FRAMES[Math.min(3, Math.floor(Math.max(0, u) * 4))];
  g.save();
  g.translateCanvas(Math.round(x), Math.round(y));
  if (dir < 0) g.scaleCanvas(-1, 1);
  const line = (a: [number, number], b: [number, number], w0: number, w1: number, color: number) =>
    seg(a[0], a[1], b[0], b[1], w0, w1, color);
  drawPieces(
    g,
    [
      line(f.hip, f.sh, 8, 9.5, look.jersey),
      dot(f.head[0], f.head[1], BODY.HEAD_R, look.jersey),
      line(f.sh, f.elbow, 3.2, 2.8, look.skin),
      line(f.elbow, f.hand, 2.8, 2.4, look.skin),
      line(f.hip, f.knee, 5.5, 4, look.skin),
      line(f.knee, f.foot, 4, 3, look.skin),
    ],
    WET,
  );
  // Gischt rund um die Wende
  g.fillStyle(0xffffff, 0.9);
  for (let i = 0; i < 7; i++) {
    const fx = -14 + i * 5 + Math.sin(time * 20 + i) * 1.5;
    const h = 1 + ((i * 3 + Math.floor(time * 12)) % 4);
    g.fillRect(Math.round(fx), Math.round(-h), 2, h);
  }
  g.restore();
}

// ------------------------------------------------------------- Spritzer

export interface Drop {
  /** Welt-Pixel */
  x: number;
  /** Höhe über der Wasserlinie in Pixeln (positiv = oben) */
  h: number;
  vx: number;
  vh: number;
  life: number;
}

/** Tropfen über einer Wasserlinie; `camX` = Welt→Bildschirm-Verschiebung */
export function drawDrops(g: Gfx, drops: readonly Drop[], camX: number, waterY: number): void {
  for (const d of drops) {
    g.fillStyle(d.h > 0 ? 0xeaf8ff : 0xbfe6ff, Math.min(1, d.life * 4));
    g.fillRect(Math.round(d.x - camX), Math.round(waterY - Math.max(0, d.h)), 2, 2);
  }
}

/** Kreisförmige Welle auf der Wasseroberfläche (Eintauchen, Anschlag) */
export function drawWaterRing(g: Gfx, x: number, y: number, r: number, time: number): void {
  const wob = Math.sin(time * 6) * 1;
  g.lineStyle(1, 0xeaf8ff, 0.8);
  g.strokeEllipse(Math.round(x), Math.round(y), r * 2 + wob, r * 0.5 + wob * 0.25);
}

/** Bugwelle am Kopf und Schaumspur hinter den Füßen; (x, y) wie bei drawSwimmer */
export function drawWake(g: Gfx, x: number, y: number, dir: 1 | -1, v: number, time: number): void {
  if (v < 1) return;
  const k = Math.min(1, (v - 1) / 1.4);
  const headX = x + dir * (SWIMMER_HEAD_LEAD + 1);
  // V-förmige Bugwelle
  g.fillStyle(0xffffff, 0.85);
  for (let i = 0; i < 4; i++) {
    const back = i * 3;
    const spread = 1 + i * (0.6 + 0.6 * k);
    g.fillRect(Math.round(headX - dir * back), Math.round(y - spread), 2, 1);
    g.fillRect(Math.round(headX - dir * back), Math.round(y + spread), 2, 1);
  }
  // Schaumspur hinter den Füßen
  const feetX = x - dir * 40;
  const n = Math.round(4 + 6 * k);
  for (let i = 0; i < n; i++) {
    const jitter = Math.sin(time * 23 + i * 2.1) * 1.5;
    const len = 3 + ((i * 7) % 4);
    g.fillStyle(0xffffff, 0.9 - (i / n) * 0.7);
    g.fillRect(Math.round(feetX - dir * i * 3 - (dir < 0 ? len : 0)), Math.round(y - 1 + jitter), len, 1 + (i % 2));
  }
}
