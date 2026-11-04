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
  const kick = Math.sin(time * 7) * 0.25;
  // Wassertreten: Knie vorne, Unterschenkel nach hinten angewinkelt
  p.nearLeg = { upper: 0.7 + kick, lower: -0.6 + kick };
  p.farLeg = { upper: 0.3 - kick, lower: -0.9 - kick };
  return p;
}

/** Erschöpft an der Leine: Arme vorne aufgelegt, Kopf hängt */
export function ropeRestPose(time: number): Pose {
  const breath = Math.sin(time * 4) * 0.04;
  return {
    hip: 25,
    lean: 0.35 + breath,
    nearLeg: { upper: 0.5 + breath, lower: -0.5 },
    farLeg: { upper: 0.25, lower: -0.7 },
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

/** Unter der Oberfläche: leicht bläulich und durch die Brechung flacher */
const WET: WaterTint = { y: 0.5, color: WATER_TINT, amount: 0.24, squash: 0.65 };
const DEEP: WaterTint = { y: -100, color: WATER_TINT, amount: 0.45 };
const FOAM = 0xffffff;
const SPRAY = 0xd8f4ff;

interface ArmShape {
  upper: number;
  lower: number;
}

/** Armwinkel im Kraulzyklus (φ 0..1: Zug unter Wasser, dann Rückholen mit hohem Ellbogen) */
function crawlArm(phi: number): ArmShape {
  const f = ((phi % 1) + 1) % 1;
  if (f < 0.5) {
    const u = f / 0.5;
    const upper = 0.12 + (Math.PI - 0.4) * u;
    return { upper, lower: upper + 0.55 * Math.sin(Math.PI * u) };
  }
  const u = (f - 0.5) / 0.5;
  const upper = Math.PI - 0.28 + (Math.PI + 0.4) * u;
  return { upper, lower: upper + 2.2 * Math.sin(Math.PI * u) };
}

function armPieces(sx: number, sy: number, arm: ArmShape, skin: number): Piece[] {
  const ex = sx + Math.cos(arm.upper) * BODY.UPPER_ARM;
  const ey = sy + Math.sin(arm.upper) * BODY.UPPER_ARM;
  const hx = ex + Math.cos(arm.lower) * BODY.FOREARM;
  const hy = ey + Math.sin(arm.lower) * BODY.FOREARM;
  return [seg(sx, sy, ex, ey, 3.4, 2.8, skin), seg(ex, ey, hx, hy, 2.8, 2.4, skin), dot(hx, hy, 1.8, skin)];
}

/** Lage der Hand für Spritzer */
function handOf(sx: number, sy: number, arm: ArmShape): [number, number] {
  const ex = sx + Math.cos(arm.upper) * BODY.UPPER_ARM;
  const ey = sy + Math.sin(arm.upper) * BODY.UPPER_ARM;
  return [ex + Math.cos(arm.lower) * BODY.FOREARM, ey + Math.sin(arm.lower) * BODY.FOREARM];
}

/** Bein mit gestreckter Fußspitze; liefert auch die Fußspitze für den Schaum */
function legPieces(
  hx: number,
  hy: number,
  a: number,
  bend: number,
  skin: number,
  suit: number,
): { pieces: Piece[]; toe: [number, number] } {
  const kx = hx + Math.cos(a) * BODY.THIGH;
  const ky = hy + Math.sin(a) * BODY.THIGH;
  const a2 = a + bend;
  const ax = kx + Math.cos(a2) * BODY.SHIN;
  const ay = ky + Math.sin(a2) * BODY.SHIN;
  const fx = ax + Math.cos(a2 + 0.35) * BODY.FOOT;
  const fy = ay + Math.sin(a2 + 0.35) * BODY.FOOT;
  const bx = hx + Math.cos(a) * 3.5;
  const by = hy + Math.sin(a) * 3.5;
  return {
    pieces: [
      seg(hx, hy, kx, ky, 5.5, 4, skin),
      seg(kx, ky, ax, ay, 4, 3, skin),
      seg(ax, ay, fx, fy, 3, 2, skin),
      // Beinabschluss des Badeanzugs
      seg(hx, hy, bx, by, 6.4, 6, suit, false, false),
    ],
    toe: [fx, fy],
  };
}

/** Wasserfarbe über den Teil des Kopfes unter der Oberfläche */
function submergeHead(g: Gfx, hx: number, hy: number, r: number): void {
  const level = 1;
  if (hy + r <= level) return;
  const a0 = Math.asin(Math.max(-1, Math.min(1, (level - hy) / r)));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((Math.PI - 2 * a0) * i) / 12;
    pts.push({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r });
  }
  g.fillStyle(WATER_TINT, 0.4);
  g.fillPoints(pts, true);
}

/** Kappe als Kreisausschnitt von a0 bis a1 (Bogenmaß) */
function capArc(g: Gfx, hx: number, hy: number, r: number, a0: number, a1: number): void {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((a1 - a0) * i) / 12;
    pts.push({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r });
  }
  g.fillPoints(pts, true);
}

/**
 * Kopf beim Atmen: zur Kamera gedreht und seitlich auf dem Wasser liegend –
 * der Scheitel zeigt in Schwimmrichtung, der Mund schnappt knapp über der Welle.
 */
function drawBreathHead(g: Gfx, hx: number, hy: number, look: RunnerLook, time: number): void {
  const r = BODY.HEAD_R;
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(hx, hy, r + 1);
  g.fillStyle(look.skin, 1);
  g.fillCircle(hx, hy, r);
  // Kappe über Scheitel und Hinterkopf
  g.fillStyle(look.jersey, 1);
  capArc(g, hx + 0.3, hy, r + 0.4, -Math.PI / 2 - 0.5, Math.PI / 2 + 0.5);
  g.fillStyle(shade(look.jersey, 1.35), 1);
  g.fillRect(hx + 2, hy - r + 1, 2, 1);
  g.fillRect(hx + 4, hy - r + 2, 1, 2);
  // Brille: zwei Gläser übereinander, Band nach oben und unten
  g.fillStyle(look.accent, 1);
  g.fillRect(hx - 1, hy - r, 1, 2);
  g.fillRect(hx - 1, hy + r - 2, 1, 2);
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(hx - 3, hy - 4, 3, 3);
  g.fillRect(hx - 3, hy + 1, 3, 3);
  g.fillRect(hx - 2, hy - 1, 1, 2);
  g.fillStyle(0x6fd3ff, 1);
  g.fillRect(hx - 2, hy - 3, 1, 1);
  g.fillRect(hx - 2, hy + 2, 1, 1);
  // Mund „O“ zum Kinn hin
  const open = 1.3 + 0.3 * Math.sin(time * 20);
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(hx - 4, hy - 0.5, open + 0.9);
  g.fillStyle(0xc0393a, 1);
  g.fillCircle(hx - 4, hy - 0.5, open);
  g.fillStyle(0x5a1414, 1);
  g.fillRect(Math.round(hx - 4.5), Math.round(hy - 0.5), 1, 1);
  submergeHead(g, hx, hy, r + 1);
  // Wellental am Mund: der Kopf liegt in seiner eigenen Bugwelle
  g.fillStyle(0xffffff, 0.95);
  g.fillRect(Math.round(hx - 8), Math.round(hy + 2), 3, 1);
  g.fillRect(Math.round(hx - 9), Math.round(hy + 1), 1, 1);
  g.fillRect(Math.round(hx + r), Math.round(hy + 1), 2, 1);
  g.fillRect(Math.round(hx + r + 1), Math.round(hy), 1, 1);
}

/** Kopf im Profil (Blick nach vorne/unten); bei Verschlucken und Luftnot hochgereckt */
function drawHead(g: Gfx, hx: number, hy: number, look: RunnerLook, kind: SwimKind, time: number, deep: boolean): void {
  if (kind === 'breath') {
    drawBreathHead(g, hx, hy, look, time);
    return;
  }
  const r = BODY.HEAD_R;
  const skin = deep ? mixColor(look.skin, WATER_TINT, DEEP.amount) : look.skin;
  const cap = deep ? mixColor(look.jersey, WATER_TINT, DEEP.amount) : look.jersey;
  g.fillStyle(deep ? mixColor(COLORS.outline, WATER_TINT, 0.5) : COLORS.outline, 1);
  g.fillCircle(hx, hy, r + 1);
  g.fillStyle(skin, 1);
  g.fillCircle(hx, hy, r);
  // Ohr
  g.fillStyle(shade(skin, 0.8), 1);
  g.fillRect(hx - 1, hy + 0.5, 1, 2);
  drawSwimCap(g, hx, hy, cap, deep ? mixColor(look.accent, WATER_TINT, DEEP.amount) : look.accent);

  if (kind === 'choke') {
    // Augen zu (Brille beschlagen), Mund auf, Wasserstrahl
    g.fillStyle(0xd8e4ea, 1);
    g.fillRect(hx + 2.5, hy - 1.5, 2, 1);
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(hx + 3, hy + 2, 2.5, 2);
    const t = (time * 3) % 1;
    g.fillStyle(SPRAY, 1);
    for (let i = 0; i < 5; i++) {
      const s = i * 2.4 + t * 2.4;
      g.fillRect(Math.round(hx + 6 + s), Math.round(hy + 2 - s * 0.9 + s * s * 0.08), i % 2 ? 1 : 2, 1);
    }
  } else if (kind === 'gasp') {
    // Weit aufgerissener Mund
    const open = 1.6 + 0.5 * Math.abs(Math.sin(time * 14));
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(hx + 3.8, hy + 2.6, open + 0.8);
    g.fillStyle(0x7a1f1f, 1);
    g.fillCircle(hx + 3.8, hy + 2.6, open);
  } else if (kind === 'touch') {
    g.fillStyle(shade(look.skin, 0.55), 1);
    g.fillRect(hx + 3, hy + 2.5, 2, 1);
  }
  if (!deep) submergeHead(g, hx, hy, r + 1);
}

/** Glitzernde Wasserlinie quer über den Körper – so liegt der Schwimmer im Wasser */
function drawSurfaceLine(g: Gfx, x0: number, x1: number, time: number): void {
  for (let x = Math.floor(x0); x < x1; x += 2) {
    const k = Math.sin(x * 0.9 + time * 9);
    if (k < -0.2) continue;
    g.fillStyle(k > 0.6 ? FOAM : 0xbfeaff, k > 0.6 ? 0.95 : 0.7);
    g.fillRect(x, k > 0.6 ? 0 : 1, 2, 1);
  }
}

/** Schaum, wo eine Fußspitze die Oberfläche durchbricht */
function drawKickFoam(g: Gfx, toe: [number, number], kick: number, time: number): void {
  if (toe[1] > 3) return;
  const k = Math.min(1, (3 - toe[1]) / 4);
  g.fillStyle(FOAM, 0.9);
  const n = 2 + Math.round(3 * k);
  for (let i = 0; i < n; i++) {
    const jx = Math.sin(time * 31 + i * 2.3 + kick) * 2.5;
    const h = 1 + ((i * 5 + Math.floor(time * 14)) % 3) * k;
    g.fillRect(Math.round(toe[0] + jx - 1), Math.round(-h), 2, Math.max(1, Math.round(h)));
  }
  g.fillStyle(0xbfeaff, 0.8);
  g.fillRect(Math.round(toe[0] - 4), 0, 8, 1);
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
  const headUp = kind === 'choke' ? -4.5 : kind === 'gasp' ? -6.5 : kind === 'breath' ? -2 : kind === 'touch' ? -3 : -0.5;
  const sx = 0;
  const sy = kind === 'gasp' ? 0.5 : 1.5;
  const hipX = -15;
  const hipY = kind === 'touch' || kind === 'gasp' ? 5 : 3;
  const headX = kind === 'gasp' ? 5 : kind === 'breath' ? 6 : 7;

  let near: ArmShape;
  let far: ArmShape;
  if (kind === 'glide') {
    near = { upper: -0.05, lower: -0.05 };
    far = { upper: 0.02, lower: 0.02 };
  } else if (kind === 'touch') {
    near = { upper: -0.2, lower: -0.25 };
    far = { upper: Math.PI / 2 + 0.4, lower: Math.PI / 2 + 0.6 };
  } else if (kind === 'gasp') {
    // Hilflos rudernde Arme
    const flail = Math.sin(opts.time * 18) * 0.6;
    near = { upper: -1.0 + flail, lower: -0.3 + flail };
    far = { upper: -2.0 - flail, lower: -2.6 - flail };
  } else {
    near = crawlArm(opts.cycle);
    far = crawlArm(opts.cycle + 0.5);
    // Beim Atmen ist der vordere Arm vorne gestreckt, der Körper rollt zur Kamera
    if (kind === 'breath') near = { upper: 0.1, lower: 0.05 };
  }

  const amp = deep ? 0.08 : kind === 'touch' ? 0.1 : 0.2;
  const kick = Math.sin(opts.kick);
  const legDrop = kind === 'touch' ? 0.35 : kind === 'gasp' ? 0.5 : deep ? 0 : 0.05;
  const farSkin = shade(look.skin, 0.72);
  const suit = look.jersey;
  const trunks = look.shorts;

  // Hinterer Arm und hinteres Bein
  drawPieces(g, armPieces(sx, sy - 1, far, farSkin), water);
  const farLeg = legPieces(
    hipX,
    hipY - 1,
    Math.PI - legDrop - amp * kick,
    0.3 * Math.max(0, Math.sin(opts.kick + 2)),
    farSkin,
    shade(trunks, 0.72),
  );
  drawPieces(g, farLeg.pieces, water);

  // Rumpf: Badeanzug mit Schultern in Hautfarbe; der Rücken schaut aus dem Wasser
  const body = deep ? water : undefined;
  drawPieces(
    g,
    [
      seg(sx, sy, headX - 2, headUp + 1, 3.4, 3, look.skin),
      seg(hipX, hipY, sx, sy, 8, 9.5, look.skin),
      seg(hipX, hipY, sx - 3, sy + 0.3, 8, 9.3, suit, false),
      seg(hipX - 1, hipY, hipX + 5, hipY - 0.3, 8.6, 8.4, trunks, false),
      // Seitenstreifen und Glanz auf dem Rücken
      seg(hipX + 4, hipY + 0.6, sx - 4, sy + 0.4, 1.2, 1.2, look.accent, false, false),
      seg(hipX + 3, hipY - 3.4, sx - 4, sy - 4, 1, 1, shade(suit, 1.35), false, false),
    ],
    body,
  );
  if (!deep) {
    // Bauchseite unter Wasser leicht bläulich
    drawPieces(g, [
      seg(hipX, hipY + 2.6, sx - 3, sy + 2.8, 3, 3.6, mixColor(suit, WATER_TINT, WET.amount), false, false),
      seg(hipX - 1, hipY + 2.6, hipX + 5, hipY + 2.6, 3, 3, mixColor(trunks, WATER_TINT, WET.amount), false, false),
    ]);
    drawSurfaceLine(g, hipX - 4, sx + 1, opts.time);
  }

  drawHead(g, headX, headUp, look, kind, opts.time, deep);

  // Vorderes Bein und vorderer Arm
  const nearLeg = legPieces(hipX, hipY, Math.PI - legDrop + amp * kick, 0.3 * Math.max(0, Math.sin(opts.kick - 1)), look.skin, trunks);
  drawPieces(g, nearLeg.pieces, water);
  drawPieces(g, armPieces(sx, sy, near, look.skin), water);

  if (deep) {
    // Bläschen steigen auf
    for (let i = 0; i < 4; i++) {
      const t = (opts.time * 1.5 + i / 4) % 1;
      g.fillStyle(0xd8f4ff, 1 - t);
      g.fillRect(Math.round(headX + 3 + i * 2 - t * 3), Math.round(-2 - t * 8), i % 2 ? 1 : 2, i % 2 ? 1 : 2);
    }
  } else if (kind === 'crawl' || kind === 'breath') {
    drawKickFoam(g, nearLeg.toe, opts.kick, opts.time);
    drawKickFoam(g, farLeg.toe, opts.kick + 2, opts.time + 0.3);
    // Wasser perlt von der Hand, solange sie über Wasser nach vorne schwingt
    for (const arm of [near, far]) {
      const [hx, hy] = handOf(sx, sy, arm);
      if (hy > -1) continue;
      const t = (opts.time * 4) % 1;
      g.fillStyle(SPRAY, 1 - t);
      g.fillRect(Math.round(hx - 1), Math.round(hy + 2 + t * Math.max(0, -hy - 1)), 1, 1);
    }
  } else if (kind === 'gasp' || kind === 'choke') {
    // Aufgewühltes Wasser
    g.fillStyle(FOAM, 0.9);
    for (let i = 0; i < 6; i++) {
      const fx = -16 + i * 6 + Math.sin(opts.time * 25 + i) * 2;
      const h = 1 + ((i * 3 + Math.floor(opts.time * 16)) % 3);
      g.fillRect(Math.round(fx), -h, 2, h);
    }
  }
  g.restore();
}

/** Kopf mit Kappe in beliebiger Lage; `axis` zeigt zum Scheitel */
function drawTuckHead(g: Gfx, hx: number, hy: number, axis: number, look: RunnerLook): void {
  const r = BODY.HEAD_R - 0.5;
  const under = hy > 1;
  const skin = under ? mixColor(look.skin, WATER_TINT, 0.24) : look.skin;
  const cap = under ? mixColor(look.jersey, WATER_TINT, 0.24) : look.jersey;
  g.fillStyle(under ? mixColor(COLORS.outline, WATER_TINT, 0.2) : COLORS.outline, 1);
  g.fillCircle(hx, hy, r + 1);
  g.fillStyle(skin, 1);
  g.fillCircle(hx, hy, r);
  g.fillStyle(cap, 1);
  capArc(g, hx, hy, r + 0.3, axis - 1.9, axis + 1.9);
  g.fillStyle(shade(cap, 1.35), 1);
  g.fillRect(Math.round(hx + Math.cos(axis) * 2.5), Math.round(hy + Math.sin(axis) * 2.5), 1, 1);
}

/** Glättung 0..1 */
const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};

/**
 * Rollwende, u = Fortschritt 0..1: Kinn zur Brust, eng gehockter Salto vorwärts,
 * die Füße schwingen über Wasser zur Wand, dann liegt der Schwimmer auf dem Rücken
 * und setzt die Füße an. (x, y) wie bei drawSwimmer, die Wand liegt rechts.
 * In 8 Schritten gezeichnet, damit es nach Pixel-Animation aussieht.
 */
export function drawFlipTurn(g: Gfx, x: number, y: number, u: number, look: RunnerLook, dir: 1 | -1, time: number): void {
  const q = Math.min(7, Math.floor(Math.max(0, u) * 8)) / 7;
  g.save();
  g.translateCanvas(Math.round(x), Math.round(y));
  if (dir < 0) g.scaleCanvas(-1, 1);

  // Körper im eigenen System (Bauchlage, Kopf nach +x, Bauch nach +y)
  const tuck = q < 0.55 ? smooth(q / 0.55) : 1 - 0.55 * smooth((q - 0.55) / 0.45);
  const theta = Math.PI * smooth(q * 1.08);
  const thigh = Math.PI - 0.75 * Math.PI * tuck;
  const shin = thigh + tuck * (0.75 * Math.PI + 0.2);
  const arm = Math.PI * (1 - smooth((q - 0.3) / 0.7)) + 0.15;
  const pike = 0.35 * tuck;
  const local: Record<string, [number, number]> = {};
  const P = (x0: number, y0: number, a: number, len: number): [number, number] => [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len];
  local.hip = [0, 0];
  local.sh = P(0, 0, pike, BODY.TORSO);
  local.head = P(local.sh[0], local.sh[1], pike + 0.15 * tuck, BODY.NECK + BODY.HEAD_R);
  local.knee = P(0, 0, thigh, BODY.THIGH);
  local.foot = P(local.knee[0], local.knee[1], shin, BODY.SHIN);
  local.toe = P(local.foot[0], local.foot[1], shin + 0.3, BODY.FOOT);
  local.elbow = P(local.sh[0], local.sh[1], arm, BODY.UPPER_ARM);
  local.hand = P(local.elbow[0], local.elbow[1], arm - 0.2, BODY.FOREARM);

  // Drehen und ins Wasser setzen: Hüfte kommt hoch, am Ende liegt der Körper tiefer
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const hipX = -12 + 6 * smooth(q);
  const hipY = 3 - 4 * Math.sin(Math.PI * Math.min(1, q * 1.3)) + 6 * smooth((q - 0.6) / 0.4);
  const pt = (k: string, off = 0): [number, number] => {
    const [lx, ly] = local[k];
    const wx = hipX + lx * c - (ly + off) * s;
    const wy = hipY + lx * s + (ly + off) * c;
    // Unter Wasser wirkt alles flacher
    return [wx, wy > 0 ? wy * 0.8 : wy];
  };
  const farSkin = shade(look.skin, 0.72);
  const line = (a: [number, number], b: [number, number], w0: number, w1: number, color: number) =>
    seg(a[0], a[1], b[0], b[1], w0, w1, color);
  const water: WaterTint = { y: 0.5, color: WATER_TINT, amount: 0.24 };
  const hip = pt('hip');
  const sh = pt('sh');
  const head = pt('head');
  const knee = pt('knee');
  const mid = (a: [number, number], b: [number, number], t: number): [number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  drawPieces(
    g,
    [
      line(pt('knee', -1.5), pt('foot', -1.5), 3.6, 2.8, farSkin),
      line(pt('foot', -1.5), pt('toe', -1.5), 2.6, 2, farSkin),
      line(hip, pt('knee', -1.5), 5, 3.8, farSkin),
      line(pt('sh', -1), pt('elbow', -1), 3, 2.6, farSkin),
      line(pt('elbow', -1), pt('hand', -1), 2.6, 2.2, farSkin),
    ],
    water,
  );
  drawPieces(
    g,
    [
      line(hip, sh, 7, 8, look.skin),
      line(hip, mid(hip, sh, 0.8), 7, 8, look.jersey),
      line(hip, mid(hip, sh, 0.3), 7.6, 7.8, look.shorts),
      line(hip, mid(hip, knee, 0.3), 6, 5.4, look.shorts),
    ],
    water,
  );
  drawTuckHead(g, head[0], head[1], Math.atan2(head[1] - sh[1], head[0] - sh[0]), look);
  drawPieces(
    g,
    [
      line(hip, knee, 5, 3.8, look.skin),
      line(knee, pt('foot'), 3.6, 2.8, look.skin),
      line(pt('foot'), pt('toe'), 2.6, 2, look.skin),
      line(hip, mid(hip, knee, 0.3), 5.6, 5, look.shorts),
      line(sh, pt('elbow'), 3, 2.6, look.skin),
      line(pt('elbow'), pt('hand'), 2.6, 2.2, look.skin),
    ],
    water,
  );
  // Gischt rund um die Wende, am stärksten wenn die Beine überschlagen
  const power = Math.sin(Math.PI * Math.min(1, q * 1.2));
  g.fillStyle(FOAM, 0.9);
  for (let i = 0; i < 9; i++) {
    const fx = -20 + i * 4 + Math.sin(time * 20 + i) * 1.5;
    const h = 1 + Math.round((((i * 3 + Math.floor(time * 12)) % 4) + 1) * power);
    g.fillRect(Math.round(fx), -h, 2, h);
  }
  g.fillStyle(SPRAY, 0.9);
  for (let i = 0; i < 4; i++) {
    const t = (time * 2.5 + i / 4) % 1;
    g.fillRect(Math.round(-10 + i * 6 + t * 4 * (i % 2 ? 1 : -1)), Math.round(-3 - 10 * power * t + 12 * t * t), 1, 1);
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
  /** Kantenlänge in Pixeln (Standard 2) */
  size?: number;
}

/** Tropfen über einer Wasserlinie; `camX` = Welt→Bildschirm-Verschiebung */
export function drawDrops(g: Gfx, drops: readonly Drop[], camX: number, waterY: number): void {
  for (const d of drops) {
    const a = Math.min(1, d.life * 4);
    const size = d.size ?? 2;
    const x = Math.round(d.x - camX);
    const y = Math.round(waterY - Math.max(0, d.h));
    if (d.h > 1 && size > 1) {
      // Dunkler Rand unten, damit der Tropfen auch vor hellem Wasser lesbar bleibt
      g.fillStyle(0x2f78b8, a * 0.8);
      g.fillRect(x, y + size, size, 1);
    }
    g.fillStyle(d.h > 0 ? 0xffffff : 0xbfe6ff, a);
    g.fillRect(x, y, size, size);
  }
}

/** Kreisförmige Welle auf der Wasseroberfläche (Eintauchen, Anschlag) */
export function drawWaterRing(g: Gfx, x: number, y: number, r: number, time: number): void {
  const wob = Math.sin(time * 6) * 1;
  g.lineStyle(1, 0xeaf8ff, 0.8);
  g.strokeEllipse(Math.round(x), Math.round(y), r * 2 + wob, r * 0.5 + wob * 0.25);
}

/**
 * Platscher beim Eintauchen: eine Krone aus Wasser steigt auf und fällt zurück,
 * dazu ein Schaumteppich. u = Alter 0..1.
 */
export function drawSplashCrown(g: Gfx, x: number, y: number, u: number): void {
  if (u >= 1) return;
  const rise = Math.sin(Math.PI * Math.min(1, u * 1.4));
  const fade = 1 - u * u;
  const cx = Math.round(x);
  // Schaumteppich
  g.fillStyle(0xffffff, 0.85 * fade);
  g.fillEllipse(cx, y + 1, 26 + 14 * u, 5 + 2 * u);
  g.fillStyle(0xbfeaff, 0.9 * fade);
  g.fillEllipse(cx, y + 1, 16 + 10 * u, 3);
  // Krone: Zacken links und rechts, in der Mitte eine Säule
  const spikes = [-11, -7, -3, 1, 5, 9];
  spikes.forEach((dx, i) => {
    const h = Math.round(rise * (5 + ((i * 7) % 5) + (Math.abs(dx) < 4 ? 6 : 0)));
    if (h <= 0) return;
    const lean = Math.round((dx / 11) * 3 * u);
    g.fillStyle(0x2f78b8, 0.6 * fade);
    g.fillRect(cx + dx + lean - 1, y - h, 1, h);
    g.fillStyle(0xffffff, 0.95 * fade);
    g.fillRect(cx + dx + lean, y - h, 2, h);
  });
}

/** Bugwelle am Kopf und Schaumspur hinter den Füßen; (x, y) wie bei drawSwimmer */
export function drawWake(g: Gfx, x: number, y: number, dir: 1 | -1, v: number, time: number): void {
  if (v < 0.6) return;
  const k = Math.min(1, (v - 0.6) / 1.8);
  const headX = x + dir * (SWIMMER_HEAD_LEAD + 1);
  // Wasser türmt sich vor dem Kopf
  g.fillStyle(0xffffff, 0.95);
  g.fillRect(Math.round(headX - (dir < 0 ? 3 : 0)), y - 1, 3, 2);
  if (k > 0.3) g.fillRect(Math.round(headX + dir * 2 - (dir < 0 ? 1 : 0)), y, 1, 1);
  // V-förmige Bugwelle: ein Arm läuft nach hinten-oben, einer nach hinten-unten
  const arms = 4 + Math.round(5 * k);
  for (let i = 1; i <= arms; i++) {
    const back = i * 3;
    const spread = 1 + i * (0.5 + 0.35 * k);
    const a = (0.95 - (i / arms) * 0.7) * (0.6 + 0.4 * k);
    const shimmer = Math.sin(time * 14 + i) > -0.6 ? 2 : 1;
    g.fillStyle(0xffffff, a);
    const bx = Math.round(headX - dir * back - (dir < 0 ? shimmer : 0));
    g.fillRect(bx, Math.round(y - spread), shimmer, 1);
    g.fillRect(bx, Math.round(y + spread * 0.8), shimmer, 1);
  }
  // Schaumspur hinter den Füßen: aufgewühltes Wasser in zwei Reihen
  const feetX = x - dir * 40;
  const n = Math.round(5 + 9 * k);
  for (let i = 0; i < n; i++) {
    const jitter = Math.sin(time * 23 + i * 2.1) * 1.5;
    const len = 2 + ((i * 7) % 4);
    const fade = 1 - i / n;
    g.fillStyle(0xffffff, 0.9 * fade);
    g.fillRect(Math.round(feetX - dir * i * 3 - (dir < 0 ? len : 0)), Math.round(y - 1 + jitter), len, 1 + (i % 2));
    if (i % 2 === 0) {
      g.fillStyle(0xbfeaff, 0.7 * fade);
      g.fillRect(Math.round(feetX - dir * (i * 3 + 1)), Math.round(y + 2 - jitter * 0.5), 2, 1);
    }
  }
}
