import type Phaser from 'phaser';
import { COLORS } from '../config';

// Prozedural animierter Läufer. Winkel sind im Bogenmaß und von der
// Senkrechten aus gemessen; positiv heißt „nach vorne“ (Laufrichtung).

const THIGH = 9;
const SHIN = 9;
const FOOT = 3;
const TORSO = 11;
const UPPER_ARM = 6;
const FOREARM = 6;
const HEAD_R = 3;
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

export interface RunnerLook {
  jersey: number;
  shorts: number;
  skin: number;
  hair: number;
}

function legAt(phase: number, amp: number): Limb {
  const upper = 0.12 + 0.8 * amp * Math.sin(phase);
  const knee = 0.15 + 1.5 * amp * Math.max(0, Math.cos(phase + Math.PI / 4));
  return { upper, lower: upper - knee };
}

function armAt(phase: number, amp: number): Limb {
  const upper = 0.15 - 0.95 * amp * Math.sin(phase);
  return { upper, lower: upper + 1.2 + 0.3 * amp };
}

/** Laufen bzw. Stehen. `cycle` zählt Doppelschritte, `intensity` 0..1. */
export function runPose(cycle: number, intensity: number): Pose {
  const phase = cycle * Math.PI * 2;
  const amp = 0.25 + 0.75 * intensity;
  return {
    hip: STANDING_HIP - 1 - amp * 1.2 + amp * 1.2 * Math.cos(phase * 2),
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

/** Startblock-Hocke. `set` 0 = „Auf die Plätze“, 1 = „Fertig“ (Hüfte hoch). */
export function crouchPose(set: number): Pose {
  return {
    hip: 10 + set * 3,
    lean: 1.25 + set * 0.1,
    nearLeg: { upper: 1.05 - set * 0.25, lower: -0.55 - set * 0.2 },
    farLeg: { upper: -0.15 - set * 0.15, lower: -1.0 - set * 0.2 },
    nearArm: { upper: -0.1, lower: -0.1 },
    farArm: { upper: 0.0, lower: 0.0 },
  };
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
  p.nearArm = { upper: Math.PI - 0.45 + wave, lower: Math.PI - 0.2 + wave };
  p.farArm = { upper: Math.PI - 0.25 - wave, lower: Math.PI - 0.1 - wave };
  return p;
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function dir(angle: number, len: number): [number, number] {
  return [Math.sin(angle) * len, Math.cos(angle) * len];
}

function segment(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: number,
): void {
  g.lineStyle(width + 2, COLORS.outline, 1);
  g.lineBetween(x0, y0, x1, y1);
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(x1, y1, (width + 2) / 2);
  g.lineStyle(width, color, 1);
  g.lineBetween(x0, y0, x1, y1);
  g.fillStyle(color, 1);
  g.fillCircle(x0, y0, width / 2);
  g.fillCircle(x1, y1, width / 2);
}

function drawLeg(
  g: Phaser.GameObjects.Graphics,
  hx: number,
  hy: number,
  leg: Limb,
  skin: number,
  shorts: number,
  shoe: number,
): void {
  const [tx, ty] = dir(leg.upper, THIGH);
  const kx = hx + tx;
  const ky = hy + ty;
  const [sx, sy] = dir(leg.lower, SHIN);
  const ax = kx + sx;
  const ay = ky + sy;
  segment(g, hx, hy, kx, ky, 3, skin);
  segment(g, ax, ay, ax + Math.cos(leg.lower) * FOOT, ay - Math.sin(leg.lower) * FOOT, 2, shoe);
  segment(g, kx, ky, ax, ay, 3, skin);
  // Shorts über dem Oberschenkelansatz
  g.lineStyle(4, shorts, 1);
  g.lineBetween(hx, hy, hx + tx * 0.45, hy + ty * 0.45);
}

function drawArm(g: Phaser.GameObjects.Graphics, sx: number, sy: number, arm: Limb, skin: number, jersey: number): void {
  const [ux, uy] = dir(arm.upper, UPPER_ARM);
  const ex = sx + ux;
  const ey = sy + uy;
  const [fx, fy] = dir(arm.lower, FOREARM);
  segment(g, sx, sy, ex, ey, 2, skin);
  segment(g, ex, ey, ex + fx, ey + fy, 2, skin);
  // Trikot-Ärmel
  g.lineStyle(3, jersey, 1);
  g.lineBetween(sx, sy, sx + ux * 0.35, sy + uy * 0.35);
}

/**
 * Zeichnet den Läufer. (x, y) ist der Bodenpunkt unter der Hüfte,
 * `lift` hebt den ganzen Körper an (Sprung).
 */
export function drawRunner(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  pose: Pose,
  look: RunnerLook,
  lift = 0,
): void {
  const hx = x;
  const hy = y - pose.hip - lift;
  const sx = hx + Math.sin(pose.lean) * TORSO;
  const sy = hy - Math.cos(pose.lean) * TORSO;
  const farSkin = shade(look.skin, 0.75);
  const farJersey = shade(look.jersey, 0.75);
  const farShorts = shade(look.shorts, 0.75);

  drawArm(g, sx, sy, pose.farArm, farSkin, farJersey);
  drawLeg(g, hx, hy, pose.farLeg, farSkin, farShorts, 0xb8b8c8);

  // Oberkörper mit Trikot
  segment(g, hx, hy, sx, sy, 5, look.jersey);
  g.lineStyle(5, look.shorts, 1);
  g.lineBetween(hx, hy, hx + (sx - hx) * 0.18, hy + (sy - hy) * 0.18);

  // Kopf
  const headX = sx + Math.sin(pose.lean) * (HEAD_R + 1);
  const headY = sy - Math.cos(pose.lean) * (HEAD_R + 1);
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(headX, headY, HEAD_R + 1);
  g.fillStyle(look.skin, 1);
  g.fillCircle(headX, headY, HEAD_R);
  g.fillStyle(look.hair, 1);
  g.fillCircle(headX - 1, headY - 1, HEAD_R - 1);
  g.fillRect(headX - HEAD_R, headY - HEAD_R + 1, 2, 3);
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(Math.round(headX + 1), Math.round(headY - 1), 1, 1);

  drawLeg(g, hx, hy, pose.nearLeg, look.skin, look.shorts, 0xffffff);
  drawArm(g, sx, sy, pose.nearArm, look.skin, look.jersey);
}

/** Schatten auf der Bahn – wird im Sprung kleiner und heller. */
export function drawShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, lift: number): void {
  const k = Math.max(0.4, 1 - lift / 40);
  g.fillStyle(0x000000, 0.28 * k);
  g.fillEllipse(x + 2, y, 18 * k, 4 * k);
}
