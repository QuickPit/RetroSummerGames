import type Phaser from 'phaser';
import { COLORS } from '../config';
import { BODY, drawRunner, lyingPose, type Mood, type Pose, type RunnerLook } from './runner';

// BMX-Rad mit Fahrer. Koordinaten in Pixeln relativ zum Bodenpunkt
// zwischen den Rädern; x zeigt nach vorne, y nach unten.

type Gfx = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

const WHEEL_R = 7;
const REAR: Pt = { x: -13, y: -WHEEL_R };
const FRONT: Pt = { x: 13, y: -WHEEL_R };
const BB: Pt = { x: 0, y: -8 };
const SEAT: Pt = { x: -6, y: -16 };
const HEAD_TOP: Pt = { x: 9, y: -18 };
const HEAD_BOTTOM: Pt = { x: 10, y: -13 };
const GRIP: Pt = { x: 7, y: -23 };
const CRANK = 4;

export type RiderStance = 'pedal' | 'air' | 'trick';

/** Zwei-Gelenk-Kinematik: Winkel (von unten, positiv nach vorne) für Ober- und Unterteil */
function ik(a: Pt, b: Pt, l1: number, l2: number, bend: 1 | -1): { upper: number; lower: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.max(0.1, Math.min(l1 + l2 - 0.05, Math.hypot(dx, dy)));
  const base = Math.atan2(dx, dy);
  const inner = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const upper = base + bend * inner;
  const kx = a.x + Math.sin(upper) * l1;
  const ky = a.y + Math.cos(upper) * l1;
  return { upper, lower: Math.atan2(b.x - kx, b.y - ky) };
}

function pedalPoint(crank: number): Pt {
  return { x: BB.x + Math.cos(crank) * CRANK, y: BB.y + Math.sin(crank) * CRANK };
}

/** Haltung des Fahrers: Hüfte (lokal) und Pose für drawRunner. */
function riderPose(stance: RiderStance, crank: number, time: number): { hip: Pt; pose: Pose } {
  const pump = stance === 'pedal' ? Math.sin(crank * 2) * 0.8 : 0;
  const hip: Pt =
    stance === 'trick' ? { x: -13, y: -27 } : stance === 'air' ? { x: -5, y: -26 } : { x: -4, y: -28 + pump };
  const lean = stance === 'trick' ? 1.45 : stance === 'air' ? 0.85 : 0.95;
  const shoulder: Pt = { x: hip.x + Math.sin(lean) * BODY.TORSO, y: hip.y - Math.cos(lean) * BODY.TORSO };
  const arm = ik(shoulder, GRIP, BODY.UPPER_ARM, BODY.FOREARM, -1);

  let nearLeg;
  let farLeg;
  if (stance === 'trick') {
    // „Superman“: Beine weit nach hinten gestreckt, flattern leicht
    const flutter = Math.sin(time * 18) * 0.08;
    nearLeg = { upper: -1.3 + flutter, lower: -1.4 + flutter };
    farLeg = { upper: -1.15 - flutter, lower: -1.3 - flutter };
  } else {
    const c = stance === 'air' ? 0 : crank;
    const near = pedalPoint(c);
    const far = pedalPoint(c + Math.PI);
    // Knöchel sitzt etwas hinter und über dem Pedal
    nearLeg = ik(hip, { x: near.x - 2, y: near.y - 1.5 }, BODY.THIGH, BODY.SHIN, 1);
    farLeg = ik(hip, { x: far.x - 2, y: far.y - 1.5 }, BODY.THIGH, BODY.SHIN, 1);
  }
  return {
    hip,
    pose: {
      hip: 0,
      lean,
      nearLeg,
      farLeg,
      nearArm: arm,
      farArm: { upper: arm.upper + 0.08, lower: arm.lower + 0.05 },
    },
  };
}

function tube(g: Gfx, a: Pt, b: Pt, color: number, width = 2): void {
  g.lineStyle(width + 2, COLORS.outline, 1);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.lineStyle(width, color, 1);
  g.lineBetween(a.x, a.y, b.x, b.y);
}

function wheel(g: Gfx, c: Pt, spin: number): void {
  g.lineStyle(4, COLORS.outline, 1);
  g.strokeCircle(c.x, c.y, WHEEL_R - 1);
  g.lineStyle(2, 0x2a2a30, 1);
  g.strokeCircle(c.x, c.y, WHEEL_R - 1);
  g.lineStyle(1, 0xd0d4e0, 1);
  g.strokeCircle(c.x, c.y, WHEEL_R - 2.5);
  // Speichen drehen sich mit
  g.lineStyle(1, 0x9aa0b8, 1);
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI) / 3;
    const dx = Math.cos(a) * (WHEEL_R - 2.5);
    const dy = Math.sin(a) * (WHEEL_R - 2.5);
    g.lineBetween(c.x - dx, c.y - dy, c.x + dx, c.y + dy);
  }
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(c.x, c.y, 1.5);
}

function drawFrame(g: Gfx, color: number, crank: number, wheelSpin: number, number: number): void {
  wheel(g, REAR, wheelSpin);
  wheel(g, FRONT, wheelSpin);
  // Hintere Kurbel
  const far = pedalPoint(crank + Math.PI);
  tube(g, BB, far, 0x5d6278, 1);
  tube(g, REAR, BB, color);
  tube(g, REAR, SEAT, color);
  tube(g, BB, SEAT, color);
  tube(g, SEAT, HEAD_TOP, color);
  tube(g, BB, HEAD_BOTTOM, color);
  tube(g, HEAD_BOTTOM, HEAD_TOP, color);
  tube(g, HEAD_BOTTOM, FRONT, 0xd0d4e0);
  tube(g, HEAD_TOP, GRIP, 0xd0d4e0);
  tube(g, { x: GRIP.x - 2, y: GRIP.y }, { x: GRIP.x + 2, y: GRIP.y - 0.5 }, 0x2a2a30);
  // Sattel und Startnummerntafel
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(SEAT.x - 4, SEAT.y - 2.5, 8, 3);
  g.fillStyle(0x2a2a30, 1);
  g.fillRect(SEAT.x - 3, SEAT.y - 2, 6, 1.5);
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(HEAD_TOP.x + 1, HEAD_TOP.y - 7, 7, 7);
  g.fillStyle(COLORS.yellow, 1);
  g.fillRect(HEAD_TOP.x + 2, HEAD_TOP.y - 6, 5, 5);
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(HEAD_TOP.x + 4, HEAD_TOP.y - 5, 1, 3);
  if (number > 1) g.fillRect(HEAD_TOP.x + 3, HEAD_TOP.y - 5, 3, 1);
  // Vordere Kurbel mit Pedal
  const near = pedalPoint(crank);
  tube(g, BB, near, 0xb8bcd0, 1);
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(near.x - 2, near.y - 1, 4, 2);
}

export interface BikeDrawOptions {
  /** Kurbelstellung in Umdrehungen */
  crank: number;
  stance: RiderStance;
  mood: Mood;
  time: number;
  frameColor: number;
  helmetColor: number;
  speed: number;
}

/** Rad mit Fahrer; (x, y) ist der Bodenpunkt, `angle` die Neigung (positiv = Nase runter). */
export function drawBmx(g: Gfx, x: number, y: number, angle: number, look: RunnerLook, o: BikeDrawOptions): void {
  const crankAngle = o.crank * Math.PI * 2;
  const wheelSpin = o.crank * Math.PI * 2 * 1.8;
  const { hip, pose } = riderPose(o.stance, crankAngle, o.time);
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  drawFrame(g, o.frameColor, crankAngle, wheelSpin, look.number);
  drawRunner(g, hip.x, hip.y, pose, look, { mood: o.mood, time: o.time, speed: o.speed, helmet: o.helmetColor });
  g.restore();
}

/** Sturz: Rad liegt, Fahrer purzelt daneben und bleibt kurz liegen. */
export function drawCrash(g: Gfx, x: number, y: number, look: RunnerLook, o: BikeDrawOptions, since: number): void {
  g.save();
  g.translateCanvas(x - 10, y);
  g.rotateCanvas(-0.25);
  drawFrame(g, o.frameColor, 0, since * 8, look.number);
  g.restore();
  // Der Fahrer überschlägt sich nach vorne und landet auf dem Rücken
  const tumble = Math.min(1, since / 0.6);
  const rot = -Math.PI / 2 - (1 - tumble) * Math.PI * 2;
  const hop = Math.sin(tumble * Math.PI) * 14;
  const pose: Pose = { ...lyingPose(false, o.time), hip: 0 };
  drawRunner(g, x + 12 * tumble, y - 4 - hop, pose, look, {
    rotation: rot,
    mood: 'ouch',
    time: o.time,
    helmet: o.helmetColor,
  });
}
