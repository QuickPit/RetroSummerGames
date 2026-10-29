import type Phaser from 'phaser';
import { COLORS, HAIR_COLORS, SKIN_TONES } from '../config';
import type { Country } from '../data/countries';
import { createRng } from '../sim/cpu';

// Prozedural animierte Athleten. Winkel sind im Bogenmaß und von der
// Senkrechten nach unten gemessen; positiv heißt „nach vorne“ (Laufrichtung).
// Alle Maße in Pixeln – die Figur ist gut 50 px groß.

const THIGH = 12;
const SHIN = 12;
const FOOT = 5;
const TORSO = 14;
const NECK = 2;
const HEAD_R = 5;
const UPPER_ARM = 8;
const FOREARM = 7;
const STANDING_HIP = THIGH + SHIN + 1;

interface Limb {
  upper: number;
  lower: number;
}

export interface Pose {
  /** Hüfthöhe über dem Boden in Pixeln */
  hip: number;
  /** Vorlage des Oberkörpers */
  lean: number;
  nearLeg: Limb;
  farLeg: Limb;
  nearArm: Limb;
  farArm: Limb;
}

export type HairStyle = 'short' | 'buzz' | 'afro' | 'ponytail' | 'bun' | 'bald';

export interface RunnerLook {
  jersey: number;
  shorts: number;
  /** Akzentfarbe für Streifen, Schweißbänder und Stirnband */
  accent: number;
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  shoe: number;
  headband: boolean;
  mustache: boolean;
  /** Startnummer auf der Hüfte */
  number: number;
  /** Individueller Versatz für Blinzeln und Wippen */
  seed: number;
}

export type Mood = 'neutral' | 'effort' | 'ouch' | 'joy' | 'tired';

export interface DrawOptions {
  /** Hebt den ganzen Körper an (Sprung) */
  lift?: number;
  mood?: Mood;
  /** Laufende Zeit in Sekunden für kleine Animationen */
  time?: number;
  /** Geschwindigkeit in m/s – lässt Haare wehen */
  speed?: number;
  /** Farbe einer umgehängten Medaille */
  medal?: number | null;
}

const HAIR_STYLES: HairStyle[] = ['short', 'short', 'buzz', 'afro', 'ponytail', 'ponytail', 'bun', 'bald'];
const SHOE_COLORS = [0xff3d7f, 0x2fe0ff, 0xffe14d, 0x7dff4d, 0xffffff, 0xff8a1f, 0xb06cff];

/** Erzeugt ein zufälliges, aber reproduzierbares Aussehen. */
export function createLook(country: Country, seed: number, number: number): RunnerLook {
  const rng = createRng(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)];
  const hairStyle = pick(HAIR_STYLES);
  const longHair = hairStyle === 'ponytail' || hairStyle === 'bun';
  return {
    jersey: country.jersey,
    shorts: country.shorts,
    accent: country.accent,
    skin: pick(SKIN_TONES),
    hair: pick(HAIR_COLORS),
    hairStyle,
    shoe: pick(SHOE_COLORS),
    headband: hairStyle === 'bald' || rng() < 0.3,
    mustache: !longHair && rng() < 0.25,
    number,
    seed: Math.floor(rng() * 1000),
  };
}

// ------------------------------------------------------------------ Posen

function legAt(phase: number, amp: number): Limb {
  const upper = 0.12 + 0.8 * amp * Math.sin(phase);
  const knee = 0.15 + 1.5 * amp * Math.max(0, Math.cos(phase + Math.PI / 4));
  return { upper, lower: upper - knee };
}

function armAt(phase: number, amp: number): Limb {
  const upper = 0.15 - 0.95 * amp * Math.sin(phase);
  return { upper, lower: upper + 1.2 + 0.3 * amp };
}

/** Laufen. `cycle` zählt Doppelschritte, `intensity` 0..1. */
export function runPose(cycle: number, intensity: number): Pose {
  const phase = cycle * Math.PI * 2;
  const amp = 0.25 + 0.75 * intensity;
  return {
    hip: STANDING_HIP - 1 - amp * 1.5 + amp * 1.5 * Math.cos(phase * 2),
    lean: 0.08 + 0.22 * intensity,
    nearLeg: legAt(phase, amp),
    farLeg: legAt(phase + Math.PI, amp),
    nearArm: armAt(phase + Math.PI, amp),
    farArm: armAt(phase, amp),
  };
}

export function standPose(): Pose {
  return {
    hip: STANDING_HIP,
    lean: 0.02,
    nearLeg: { upper: 0.06, lower: 0.04 },
    farLeg: { upper: -0.06, lower: -0.08 },
    nearArm: { upper: 0.05, lower: 0.15 },
    farArm: { upper: -0.05, lower: 0.1 },
  };
}

/** Lockeres Wippen auf den Fußballen vor dem Start. */
export function idlePose(time: number, seed: number): Pose {
  const t = time * 5 + seed;
  const bounce = Math.abs(Math.sin(t));
  const p = standPose();
  p.hip += bounce * 1.5;
  p.nearLeg = { upper: 0.06 - bounce * 0.12, lower: 0.04 - bounce * 0.05 };
  p.farLeg = { upper: -0.06 + bounce * 0.1, lower: -0.3 * bounce };
  p.nearArm = { upper: 0.15 * Math.sin(t * 2), lower: 0.3 + 0.2 * Math.sin(t * 2) };
  p.farArm = { upper: -0.15 * Math.sin(t * 2), lower: 0.2 - 0.2 * Math.sin(t * 2) };
  return p;
}

const MARKS: Pose = {
  hip: 12,
  lean: 1.2,
  nearLeg: { upper: 1.0, lower: -1.09 },
  farLeg: { upper: 0.0, lower: -1.5 },
  nearArm: { upper: 0, lower: 0 },
  farArm: { upper: 0.05, lower: 0.05 },
};

const SET: Pose = {
  hip: 19,
  lean: 1.7,
  nearLeg: { upper: 0.7, lower: -0.6 },
  farLeg: { upper: -0.3, lower: -0.9 },
  nearArm: { upper: 0, lower: 0 },
  farArm: { upper: 0.05, lower: 0.05 },
};

/** Startblock. `set` 0 = „Auf die Plätze“ (Knie unten), 1 = „Fertig“ (Hüfte hoch). */
export function crouchPose(set: number): Pose {
  return lerpPose(MARKS, SET, set);
}

/** Hürdensprung, `u` = Fortschritt 0..1. */
export function jumpPose(u: number): Pose {
  const s = Math.sin(Math.PI * u);
  const trail = -0.7 + 1.5 * u;
  return {
    hip: STANDING_HIP - 1,
    lean: 0.2 + 0.55 * s,
    nearLeg: { upper: 1.0 + 0.5 * s, lower: 0.9 + 0.6 * s },
    farLeg: { upper: trail, lower: trail - 1.9 },
    nearArm: { upper: -0.5 - 0.3 * s, lower: 0.4 },
    farArm: { upper: 1.0 + 0.4 * s, lower: 1.4 + 0.3 * s },
  };
}

/** Stolpern nach gerissener Hürde: Oberkörper kippt, Arme rudern. */
export function stumblePose(cycle: number, amount: number, time: number): Pose {
  const p = runPose(cycle, 0.8);
  p.lean += 0.6 * amount;
  p.hip -= 2 * amount;
  p.nearArm = { upper: 1.6 * Math.sin(time * 30), lower: 2.2 };
  p.farArm = { upper: -1.4 * Math.sin(time * 30 + 1), lower: -0.6 };
  return p;
}

/** Jubel mit hochgerissenen Armen. */
export function cheerPose(time: number): Pose {
  const p = standPose();
  const wave = 0.15 * Math.sin(time * 10);
  p.nearArm = { upper: Math.PI + 0.95 + wave, lower: Math.PI + 0.3 + wave };
  p.farArm = { upper: Math.PI - 0.95 - wave, lower: Math.PI - 0.3 - wave };
  return p;
}

/** Winken mit einem Arm (Podest). */
export function wavePose(time: number): Pose {
  const p = standPose();
  const wave = 0.35 * Math.sin(time * 8);
  p.nearArm = { upper: Math.PI + 1.0, lower: Math.PI + 0.25 + wave };
  return p;
}

/** Erschöpft: Hände auf den Oberschenkeln, schweres Atmen. */
export function tiredPose(time: number): Pose {
  const breath = Math.sin(time * 5);
  return {
    hip: 22,
    lean: 1.15 + 0.05 * breath,
    nearLeg: { upper: 0.45, lower: -0.15 },
    farLeg: { upper: 0.1, lower: -0.3 },
    nearArm: { upper: -0.75, lower: -0.65 },
    farArm: { upper: -0.65, lower: -0.55 },
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const limb = (x: Limb, y: Limb) => ({ upper: l(x.upper, y.upper), lower: l(x.lower, y.lower) });
  return {
    hip: l(a.hip, b.hip),
    lean: l(a.lean, b.lean),
    nearLeg: limb(a.nearLeg, b.nearLeg),
    farLeg: limb(a.farLeg, b.farLeg),
    nearArm: limb(a.nearArm, b.nearArm),
    farArm: limb(a.farArm, b.farArm),
  };
}

// ------------------------------------------------------------- Zeichnen

type Gfx = Phaser.GameObjects.Graphics;

/** Ein Körperteil: sich verjüngendes Segment oder Kreis. */
type Piece =
  | { kind: 'seg'; x0: number; y0: number; x1: number; y1: number; w0: number; w1: number; color: number; outline: boolean; caps: boolean }
  | { kind: 'dot'; x: number; y: number; r: number; color: number; outline: boolean };

function seg(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  color: number,
  outline = true,
  caps = true,
): Piece {
  return { kind: 'seg', x0, y0, x1, y1, w0, w1, color, outline, caps };
}

function dot(x: number, y: number, r: number, color: number, outline = true): Piece {
  return { kind: 'dot', x, y, r, color, outline };
}

function quad(g: Gfx, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  g.fillPoints(
    [
      { x: x0 + (nx * w0) / 2, y: y0 + (ny * w0) / 2 },
      { x: x1 + (nx * w1) / 2, y: y1 + (ny * w1) / 2 },
      { x: x1 - (nx * w1) / 2, y: y1 - (ny * w1) / 2 },
      { x: x0 - (nx * w0) / 2, y: y0 - (ny * w0) / 2 },
    ],
    true,
  );
}

/** Erst alle Konturen, dann alle Füllungen – so entstehen saubere Gelenke. */
function drawPieces(g: Gfx, pieces: Piece[]): void {
  g.fillStyle(COLORS.outline, 1);
  for (const p of pieces) {
    if (!p.outline) continue;
    if (p.kind === 'dot') {
      g.fillCircle(p.x, p.y, p.r + 1);
    } else {
      quad(g, p.x0, p.y0, p.x1, p.y1, p.w0 + 2, p.w1 + 2);
      if (p.caps) {
        g.fillCircle(p.x0, p.y0, p.w0 / 2 + 1);
        g.fillCircle(p.x1, p.y1, p.w1 / 2 + 1);
      }
    }
  }
  for (const p of pieces) {
    g.fillStyle(p.color, 1);
    if (p.kind === 'dot') {
      g.fillCircle(p.x, p.y, p.r);
    } else {
      quad(g, p.x0, p.y0, p.x1, p.y1, p.w0, p.w1);
      if (p.caps) {
        g.fillCircle(p.x0, p.y0, p.w0 / 2);
        g.fillCircle(p.x1, p.y1, p.w1 / 2);
      }
    }
  }
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function along(x: number, y: number, angle: number, len: number): [number, number] {
  return [x + Math.sin(angle) * len, y + Math.cos(angle) * len];
}

function lerp2(x0: number, y0: number, x1: number, y1: number, t: number): [number, number] {
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

interface Palette {
  skin: number;
  jersey: number;
  shorts: number;
  accent: number;
  shoe: number;
  sock: number;
}

function legPieces(hx: number, hy: number, leg: Limb, c: Palette): Piece[] {
  const [kx, ky] = along(hx, hy, leg.upper, THIGH);
  const [ax, ay] = along(kx, ky, leg.lower, SHIN);
  // Fuß zeigt nach vorne und kippt mit dem Unterschenkel
  const fdx = Math.cos(leg.lower);
  const fdy = -Math.sin(leg.lower);
  const [sx, sy] = lerp2(kx, ky, ax, ay, 0.72);
  const [shx, shy] = lerp2(hx, hy, kx, ky, 0.55);
  return [
    seg(hx, hy, kx, ky, 5.5, 4, c.skin),
    seg(kx, ky, ax, ay, 4, 3, c.skin),
    seg(ax - fdx * 1.5, ay - fdy * 1.5, ax + fdx * FOOT, ay + fdy * FOOT, 3.4, 2.6, c.shoe),
    // Socke, Shorts und Schuh-Streifen liegen innerhalb der Kontur
    seg(sx, sy, ax, ay, 3.4, 3.2, c.sock, false, false),
    seg(hx, hy, shx, shy, 6.6, 5.6, c.shorts, false, false),
    seg(ax + fdx * 0.5, ay + fdy * 0.5 - 0.4, ax + fdx * 3, ay + fdy * 3 - 0.4, 1, 1, c.accent, false, false),
  ];
}

function armPieces(sx: number, sy: number, arm: Limb, c: Palette): Piece[] {
  const [ex, ey] = along(sx, sy, arm.upper, UPPER_ARM);
  const [hx, hy] = along(ex, ey, arm.lower, FOREARM);
  const [b0x, b0y] = lerp2(ex, ey, hx, hy, 0.62);
  const [b1x, b1y] = lerp2(ex, ey, hx, hy, 0.85);
  return [
    seg(sx, sy, ex, ey, 3.4, 2.8, c.skin),
    seg(ex, ey, hx, hy, 2.8, 2.4, c.skin),
    dot(hx, hy, 1.8, c.skin),
    seg(b0x, b0y, b1x, b1y, 3.2, 3.2, c.accent, false, false),
    // Träger des Trikots über der Schulter
    seg(sx, sy, ...lerp2(sx, sy, ex, ey, 0.25), 3.8, 3.4, c.jersey, false, false),
  ];
}

// 3×5-Ziffern für die Hüftnummer
const DIGITS: Record<string, string> = {
  '1': '010110010010111',
  '2': '111001111100111',
  '3': '111001111001111',
  '4': '101101111001001',
  '5': '111100111001111',
  '6': '111100111101111',
  '7': '111001010010010',
  '8': '111101111101111',
};

function drawHipNumber(g: Gfx, x: number, y: number, n: number): void {
  const bits = DIGITS[String(n)];
  if (!bits) return;
  const x0 = Math.round(x) - 2;
  const y0 = Math.round(y) - 3;
  g.fillStyle(0xffffff, 1);
  g.fillRect(x0, y0, 4, 6);
  g.fillStyle(COLORS.outline, 1);
  for (let i = 0; i < 15; i++) {
    if (bits[i] === '1') g.fillRect(x0 + (i % 3), y0 + Math.floor(i / 3) + 0.5, 1, 1);
  }
}

function drawHead(g: Gfx, hx: number, hy: number, look: RunnerLook, mood: Mood, time: number, speed: number): void {
  const r = HEAD_R;
  const hair = look.hair;
  const wind = Math.min(1, speed / 8);

  // Pferdeschwanz weht hinterher
  if (look.hairStyle === 'ponytail') {
    const sway = Math.sin(time * 14 + look.seed) * (0.15 + 0.2 * wind);
    const a = -0.35 - 1.05 * wind + sway;
    const [bx, by] = [hx - r + 0.5, hy - 2];
    const [p1x, p1y] = along(bx, by, a, 4.5);
    const [p2x, p2y] = along(p1x, p1y, a + sway * 1.5 - 0.15, 4);
    drawPieces(g, [seg(bx, by, p1x, p1y, 3.2, 2.6, hair), seg(p1x, p1y, p2x, p2y, 2.6, 1.4, hair), dot(bx, by, 1.4, look.accent, false)]);
  }
  if (look.hairStyle === 'bun') drawPieces(g, [dot(hx - r + 0.5, hy - r + 1.5, 2.6, hair)]);

  // Kopf mit Kontur; die Haare bleiben als Sichel oben und hinten stehen
  if (look.hairStyle === 'afro') {
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(hx - 1.2, hy - 1.8, r + 2.8);
    g.fillStyle(hair, 1);
    g.fillCircle(hx - 1.2, hy - 1.8, r + 1.8);
  }
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(hx, hy, r + 1);
  const hasHair = look.hairStyle !== 'bald';
  g.fillStyle(hasHair ? hair : look.skin, 1);
  g.fillCircle(hx, hy, r);
  if (hasHair) {
    const thin = look.hairStyle === 'buzz';
    g.fillStyle(look.skin, 1);
    g.fillCircle(hx + (thin ? 0.7 : 1.3), hy + (thin ? 0.6 : 1.1), r - (thin ? 0.7 : 1.3));
  }
  // Ohr und Nase
  g.fillStyle(shade(look.skin, 0.82), 1);
  g.fillRect(hx - 0.5, hy + 0.5, 1, 2);
  g.fillStyle(look.skin, 1);
  g.fillRect(hx + r, hy, 1, 2);

  // Stirnband im 80er-Stil, die Enden flattern
  if (look.headband) {
    g.fillStyle(look.accent, 1);
    g.fillRect(hx - r, hy - 3, r * 2, 2);
    const flap = Math.sin(time * 16 + look.seed) * (0.5 + wind);
    g.fillRect(hx - r - 2, hy - 2 + flap * 0.5, 2, 1);
    g.fillRect(hx - r - 3.5 - wind, hy - 1 + flap, 2, 1);
  }

  // Gesicht: Augen, Brauen, Mund
  const ex = hx + 2;
  const ey = hy - 1;
  const blink = (time + look.seed * 0.37) % 3.4 < 0.13;
  g.fillStyle(COLORS.outline, 1);
  if (mood === 'joy' || ((mood === 'neutral' || mood === 'tired') && blink)) {
    // Geschlossene, lachende Augen
    g.fillRect(ex, ey, 2, 1);
    if (mood === 'joy') g.fillRect(ex + 0.5, ey - 1, 1, 1);
  } else {
    g.fillStyle(0xffffff, 1);
    g.fillRect(ex, ey - (mood === 'ouch' ? 1 : 0), 2, mood === 'ouch' ? 3 : 2);
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(ex + 1, ey, 1, 1);
  }
  // Augenbraue: angestrengt schräg, erschrocken hochgezogen
  if (mood === 'effort') {
    g.fillRect(ex - 0.5, ey - 2.5, 1, 1);
    g.fillRect(ex + 0.5, ey - 2, 2, 1);
  } else {
    g.fillRect(ex - 0.5, ey - (mood === 'ouch' ? 3.5 : 2.5), 3, 1);
  }

  const mx = hx + 2.5;
  const my = hy + 2.5;
  if (look.mustache) {
    g.fillStyle(hair, 1);
    g.fillRect(mx, my - 1, 3, 1);
  }
  if (mood === 'joy') {
    g.fillStyle(0x7a1f1f, 1);
    g.fillRect(mx, my, 3, 2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(mx, my, 3, 1);
  } else if (mood === 'effort' || mood === 'ouch' || mood === 'tired') {
    g.fillStyle(0x7a1f1f, 1);
    g.fillRect(mx + 0.5, my, 2, 2);
  } else {
    g.fillStyle(shade(look.skin, 0.55), 1);
    g.fillRect(mx + 0.5, my + 0.5, 2, 1);
  }

  // Schweißtropfen bei Erschöpfung, Sternchen nach dem Stolpern
  if (mood === 'tired') {
    const t = (time * 1.5 + look.seed * 0.1) % 1;
    g.fillStyle(0x9fe6ff, 1 - t);
    g.fillRect(hx - 3 - t * 3, hy - r - 1 + t * 6, 1, 2);
  }
  if (mood === 'ouch') {
    for (let i = 0; i < 3; i++) {
      const a = time * 9 + (i * Math.PI * 2) / 3;
      const sx = hx + Math.cos(a) * 7;
      const sy = hy - r - 4 + Math.sin(a) * 2;
      g.fillStyle(COLORS.yellow, 1);
      g.fillRect(sx - 1, sy, 3, 1);
      g.fillRect(sx, sy - 1, 1, 3);
    }
  }
}

function drawMedal(g: Gfx, x: number, y: number, nx: number, ny: number, color: number): void {
  g.lineStyle(1, 0x2456c8, 1);
  g.lineBetween(x - 1, y - 6, x + nx * 1.5, y + ny * 1.5);
  g.lineBetween(x + 1, y - 6, x + nx * 1.5, y + ny * 1.5);
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(x + nx * 1.5, y + ny * 1.5 + 1, 3);
  g.fillStyle(color, 1);
  g.fillCircle(x + nx * 1.5, y + ny * 1.5 + 1, 2.2);
  g.fillStyle(0xffffff, 1);
  g.fillRect(x + nx * 1.5 - 1, y + ny * 1.5, 1, 1);
}

/**
 * Zeichnet einen Athleten. (x, y) ist der Bodenpunkt unter der Hüfte.
 */
export function drawRunner(g: Gfx, x: number, y: number, pose: Pose, look: RunnerLook, opts: DrawOptions = {}): void {
  const { lift = 0, mood = 'neutral', time = 0, speed = 0, medal = null } = opts;
  const hx = x;
  const hy = y - pose.hip - lift;
  const ux = Math.sin(pose.lean);
  const uy = -Math.cos(pose.lean);
  const sx = hx + ux * TORSO;
  const sy = hy + uy * TORSO;
  // Nach vorne zeigende Normale des Oberkörpers
  const nx = -uy;
  const ny = ux;

  const near: Palette = {
    skin: look.skin,
    jersey: look.jersey,
    shorts: look.shorts,
    accent: look.accent,
    shoe: look.shoe,
    sock: 0xffffff,
  };
  const far: Palette = {
    skin: shade(look.skin, 0.72),
    jersey: shade(look.jersey, 0.72),
    shorts: shade(look.shorts, 0.72),
    accent: shade(look.accent, 0.72),
    shoe: shade(look.shoe, 0.72),
    sock: 0xb8b8c8,
  };

  drawPieces(g, armPieces(sx, sy, pose.farArm, far));
  drawPieces(g, legPieces(hx, hy, pose.farLeg, far));

  // Oberkörper: Trikot, Shorts-Bund, Seitenstreifen, Glanzlicht
  const [bx, by] = lerp2(hx, hy, sx, sy, 0.24);
  const [nkx, nky] = [sx + ux * (NECK + 1), sy + uy * (NECK + 1)];
  const [cx, cy] = lerp2(hx, hy, sx, sy, 0.68);
  drawPieces(g, [
    seg(sx, sy, nkx, nky, 3.4, 3, look.skin),
    seg(hx, hy, sx, sy, 8.5, 10, look.jersey),
    // Brustkorb und Gesäß geben der Silhouette Form
    dot(cx + nx * 1.2, cy + ny * 1.2, 4.6, look.jersey),
    dot(hx - nx * 1.2, hy - ny * 1.2, 4.2, look.shorts),
    seg(hx, hy, bx, by, 9, 9.2, look.shorts, false, true),
    seg(hx - nx * 3, hy - ny * 3, sx - nx * 3.6, sy - ny * 3.6, 1.2, 1.2, look.accent, false, false),
    seg(bx + nx * 2.6, by + ny * 2.6, sx + nx * 3.4, sy + ny * 3.4, 1, 1, shade(look.jersey, 1.25), false, false),
  ]);
  if (medal !== null) drawMedal(g, sx - ux * 2.5, sy - uy * 2.5, nx, ny, medal);

  const headX = sx + ux * (NECK + HEAD_R);
  const headY = sy + uy * (NECK + HEAD_R);
  drawHead(g, headX, headY, look, mood, time, speed);

  drawHipNumber(g, hx - 3, hy, look.number);
  drawPieces(g, legPieces(hx, hy, pose.nearLeg, near));
  drawPieces(g, armPieces(sx, sy, pose.nearArm, near));
}

/** Schatten auf der Bahn – wird im Sprung kleiner und heller. */
export function drawShadow(g: Gfx, x: number, y: number, lift: number): void {
  const k = Math.max(0.4, 1 - lift / 50);
  g.fillStyle(0x000000, 0.28 * k);
  g.fillEllipse(x + 2, y, 24 * k, 5 * k);
}
