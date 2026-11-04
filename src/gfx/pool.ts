import Phaser from 'phaser';
import { COLORS, DEPTH_SKEW, FONT, GAME_WIDTH, LANE_COUNT, LANE_DEPTH, PX_PER_M, TRACK_FAR_Y, TRACK_NEAR_Y, laneCenterY, skewAt } from '../config';
import { COUNTRIES, type FlagSpec } from '../data/countries';
import { createRng } from '../sim/cpu';
import { SWIM } from '../sim/swim';
import { drawFlag } from './flags';
import { canvasTexture, drawCrowdRows } from './textures';

// Schwimmhalle als Kulisse für 100 m Freistil – alles per Canvas bzw. Graphics gemalt.

type Ctx = CanvasRenderingContext2D;
type Gfx = Phaser.GameObjects.Graphics;

export const HALL = {
  standsY: 70,
  standsHeight: 80,
  boardsY: 150,
  boardsHeight: 14,
  /** Beckenumgang inkl. hinterem Beckenrand mit Überlaufrinne */
  deckY: 164,
  deckHeight: TRACK_FAR_Y - 164,
  waterHeight: TRACK_NEAR_Y - TRACK_FAR_Y,
  edgeHeight: 8,
  /** Startblock: Breite und Höhe in Pixeln */
  blockWidth: 14,
  blockHeight: 18,
  /** Rückenwimpel so weit vor jeder Wand */
  flagsAt: 5,
  /** Gelber Schwimmkörper auf den Leinen */
  markAt: 15,
} as const;

const WATER_FRAMES = 4;
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Wasserlinie (Schwimmer) einer Bahn */
export function waterLineY(lane: number): number {
  return laneCenterY(lane) + 3;
}

/** Bildschirm-Y der Fußfläche auf dem Startblock */
export function blockTopY(lane: number): number {
  return laneCenterY(lane) + 6 - HALL.blockHeight;
}

export function createPoolTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'hallwall', 320, HALL.standsY, drawHallWall);
  for (const frame of [0, 1]) {
    canvasTexture(scene, `hallstands${frame}`, 384, HALL.standsHeight, (ctx) => drawHallStands(ctx, frame));
  }
  canvasTexture(scene, 'hallboards', 512, HALL.boardsHeight, drawHallBoards);
  canvasTexture(scene, 'halldeck', 64, HALL.deckHeight, drawDeck);
  canvasTexture(scene, 'halledge', 64, HALL.edgeHeight, (ctx) => {
    ctx.fillStyle = css(COLORS.tile);
    ctx.fillRect(0, 0, 64, HALL.edgeHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 2);
    ctx.fillStyle = css(COLORS.tileGrout);
    ctx.fillRect(0, 2, 64, 1);
    for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 3, 1, HALL.edgeHeight - 3);
  });
  for (let f = 0; f < WATER_FRAMES; f++) canvasTexture(scene, `water${f}`, 64, HALL.waterHeight, (ctx) => drawWater(ctx, f));
  // Becken einmal vorab: Bodenstreifen je Bahn, Umgang hinter den Wänden, Leinen in mehreren Wellen-Bildern
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    canvasTexture(scene, `poolstripe${lane}`, POOL_TEX_W, STRIPE_TEX_H, (ctx) => drawLaneStripe(ctx, lane));
  }
  canvasTexture(scene, 'poolendstart', END_TEX_W, HALL.waterHeight, (ctx) => drawPoolEnd(ctx, 0));
  canvasTexture(scene, 'poolendturn', END_TEX_W, HALL.waterHeight, (ctx) => drawPoolEnd(ctx, 1));
  for (let k = 0; k <= LANE_COUNT; k++) {
    for (let f = 0; f < ROPE_FRAMES; f++) {
      canvasTexture(scene, `rope${k}_${f}`, POOL_TEX_W, ROPE_TEX_H, (ctx) => drawRopeTexture(ctx, k, f));
    }
  }
  canvasTexture(scene, 'divewall', 320, DIVE_HALL.wallHeight, drawDiveWall);
}

// ------------------------------------------------- Vorab gerenderte Becken-Teile

/** Linker Rand der Becken-Texturen in Welt-Pixeln (12 m vor der Startwand) */
const POOL_TEX_X0 = -12 * PX_PER_M;
const POOL_TEX_W = Math.ceil((SWIM.poolLength + 24) * PX_PER_M + skewAt(TRACK_FAR_Y)) + 4;
const ROPE_FRAMES = 6;
const ROPE_TEX_H = 8;
/** Bodenstreifen: Höhe der Textur und Abstand ihrer Oberkante zur Bahnmitte */
const STRIPE_TEX_H = 15;
const STRIPE_TOP = -5;
/** Umgang hinter einer Wand: 12 m plus Kante plus Schräge */
const END_M = 12;
const END_TEX_W = Math.ceil((END_M + 0.5) * PX_PER_M + skewAt(TRACK_FAR_Y)) + 2;

/** Textur-X eines Meterpunkts in der Bildschirmzeile y */
function texX(meters: number, y: number): number {
  return meters * PX_PER_M - POOL_TEX_X0 + skewAt(y);
}

/** Bildschirm-Y der Leine k (0 = hinten) */
function ropeY(k: number): number {
  return TRACK_FAR_Y + k * LANE_DEPTH + (k === 0 ? 2 : k === LANE_COUNT ? -3 : 0);
}

/** Füllt zeilenweise ein schräges Band; `ox`/`oy` = Ursprung der Textur auf dem Bildschirm (x in Welt-Pixeln) */
function bandAt(ctx: Ctx, ox: number, oy: number, m0: number, m1: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    const a = Math.round(m0 * PX_PER_M - ox + skewAt(y));
    const b = Math.round(m1 * PX_PER_M - ox + skewAt(y));
    ctx.fillRect(Math.min(a, b), y - oy, Math.max(1, Math.abs(b - a)), 1);
  }
}

/** Bodenstreifen einer Bahn mit „T“ zwei Meter vor jeder Wand und Markierung an der Wand */
function drawLaneStripe(ctx: Ctx, lane: number): void {
  const L = SWIM.poolLength;
  const y = laneCenterY(lane) + 2;
  const oy = laneCenterY(lane) + STRIPE_TOP;
  const band = (m0: number, m1: number, y0: number, y1: number) => bandAt(ctx, POOL_TEX_X0, oy, m0, m1, y0, y1);
  ctx.fillStyle = 'rgba(14, 52, 110, 0.5)';
  band(2, L - 2, y - 1, y + 2);
  for (const m of [2, L - 2]) band(m - 0.14, m + 0.14, y - 6, y + 7);
  for (const m of [0.15, L - 0.15]) band(m - 0.15, m + 0.15, y - 1, y + 2);
  // Heller Saum oben: der Streifen liegt unter dem Wasser
  ctx.fillStyle = 'rgba(160, 225, 255, 0.18)';
  band(2.15, L - 2.15, y - 2, y - 1);
}

/** Umgang hinter der Start- (0) oder Wendewand (1) mit Beckenkante */
function drawPoolEnd(ctx: Ctx, which: 0 | 1): void {
  const L = SWIM.poolLength;
  const top = TRACK_FAR_Y;
  const bottom = TRACK_NEAR_Y;
  const ox = endOriginPx(which);
  const band = (m0: number, m1: number, y0: number, y1: number) => bandAt(ctx, ox, top, m0, m1, y0, y1);
  const [m0, m1] = which === 0 ? [-END_M, 0] : [L, L + END_M];
  ctx.fillStyle = css(COLORS.tile);
  band(m0, m1, top, bottom);
  ctx.fillStyle = css(COLORS.tileGrout);
  for (let y = top + 6; y < bottom; y += 7) band(m0, m1, y, y + 1);
  for (let m = m0 + 0.6; m < m1; m += 0.6) band(m, m + 0.04, top, bottom);
  // Licht von links oben: leichter Glanz auf den Fliesen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let y = top + 1; y < bottom; y += 7) band(m0, m1, y, y + 1);
  // Beckenkante: weißer Rand, Schattenkante im Wasser
  const m = which === 0 ? 0 : L;
  const dir = which === 0 ? -1 : 1;
  ctx.fillStyle = '#ffffff';
  band(m + dir * 0.16, m, top, bottom);
  ctx.fillStyle = css(COLORS.tileGrout);
  band(m + dir * 0.2, m + dir * 0.16, top, bottom);
  ctx.fillStyle = 'rgba(16, 60, 120, 0.55)';
  band(m, m - dir * 0.12, top, bottom);
}

/** Linker Rand der Umgangs-Textur in Welt-Pixeln */
function endOriginPx(which: 0 | 1): number {
  return which === 0 ? -END_M * PX_PER_M : SWIM.poolLength * PX_PER_M - 0.5 * PX_PER_M;
}

function drawRopeTexture(ctx: Ctx, k: number, frame: number): void {
  const L = SWIM.poolLength;
  const y = ropeY(k);
  const outer = k === 0 || k === LANE_COUNT;
  const base = 3;
  const phase = (frame / ROPE_FRAMES) * Math.PI * 2;
  ctx.fillStyle = '#23304a';
  const x0 = Math.round(texX(0, y));
  ctx.fillRect(x0, base, Math.round(texX(L, y)) - x0, 1);
  const step = 0.25;
  for (let i = 0; i * step <= L; i++) {
    const m = i * step;
    const x = Math.round(texX(m, y));
    const nearWall = m < 5 || m > L - 5;
    const mark = Math.abs(m - HALL.markAt) < step / 2 || Math.abs(m - (L - HALL.markAt)) < step / 2;
    const color = mark ? COLORS.yellow : nearWall ? COLORS.ropeRed : i % 2 ? COLORS.ropeWhite : COLORS.ropeBlue;
    const wobble = Math.round(Math.sin(phase + m * 1.3 + k * 0.7) * (outer ? 0.6 : 1));
    const top = base - 1 + wobble;
    ctx.fillStyle = css(color);
    ctx.fillRect(x - 2, top, 4, 3);
    // Glanzpunkt oben links, Schatten unten
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(x - 2, top, 2, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(x - 2, top + 2, 4, 1);
  }
}

function drawHallWall(ctx: Ctx): void {
  const W = 320;
  const H = HALL.standsY;
  ctx.fillStyle = '#9db3c6';
  ctx.fillRect(0, 0, W, H);
  // Fensterfront
  for (let k = 0; k < 4; k++) {
    const x0 = 8 + k * 80;
    ctx.fillStyle = '#d9e1e8';
    ctx.fillRect(x0 - 2, 16, 68, 44);
    const grd = ctx.createLinearGradient(0, 18, 0, 58);
    grd.addColorStop(0, '#4f9be0');
    grd.addColorStop(1, '#bfe6f8');
    ctx.fillStyle = grd;
    ctx.fillRect(x0, 18, 64, 40);
    // Spiegelungen
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(x0 + 6 + i * 0.6 + (i > 20 ? 18 : 0), 18 + i, 3, 1);
    }
    // Sprossen
    ctx.fillStyle = '#d9e1e8';
    for (let x = x0 + 15; x < x0 + 64; x += 16) ctx.fillRect(x, 18, 2, 40);
    ctx.fillRect(x0, 36, 64, 2);
  }
  // Dachträger als Fachwerk
  ctx.fillStyle = '#3a4258';
  ctx.fillRect(0, 0, W, 4);
  ctx.fillRect(0, 12, W, 2);
  for (let x = 0; x < W; x += 20) {
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(x + i, 4 + Math.floor(i * 0.8), 2, 1);
      ctx.fillRect(x + 10 + i, 12 - Math.floor(i * 0.8), 2, 1);
    }
  }
  ctx.fillStyle = '#556079';
  ctx.fillRect(0, 4, W, 1);
  // Wand unter den Fenstern
  ctx.fillStyle = '#c8d4dc';
  ctx.fillRect(0, 60, W, H - 60);
  ctx.fillStyle = '#aebcc7';
  ctx.fillRect(0, 60, W, 1);
}

function drawHallStands(ctx: Ctx, frame: number): void {
  const W = 384;
  const H = HALL.standsHeight;
  const rng = createRng(43);
  const top = 2;
  const rowH = 7;
  const rows = Math.floor((H - top - 8) / rowH);
  drawCrowdRows(ctx, frame, W, top, rows, rowH, rng, ['#5a7aa6', '#4e6c96', '#3c5578']);
  // Licht fällt schräg von den Fenstern (oben links) auf die Ränge
  for (let y = top; y < top + rows * rowH; y++) {
    for (let k = 0; k < W / 96; k++) {
      const x0 = k * 96 + 10 + Math.round((y - top) * 0.55);
      for (const [dx, w, a] of [
        [0, 22, 0.18],
        [34, 16, 0.11],
      ] as const) {
        ctx.fillStyle = `rgba(255, 248, 215, ${a})`;
        const x = (x0 + dx) % W;
        ctx.fillRect(x, y, w, 1);
        if (x + w > W) ctx.fillRect(x - W, y, w, 1);
      }
    }
  }
  // Treppen
  for (let x = 89; x < W; x += 96) {
    ctx.fillStyle = '#b8c6d2';
    ctx.fillRect(x, top, 7, rows * rowH);
    ctx.fillStyle = '#9aaab8';
    for (let y = top; y < top + rows * rowH; y += 3) ctx.fillRect(x, y, 7, 1);
  }
  // Brüstung
  const wallY = top + rows * rowH;
  ctx.fillStyle = '#2f6f9f';
  ctx.fillRect(0, wallY, W, H - wallY);
  ctx.fillStyle = '#245a82';
  ctx.fillRect(0, wallY, W, 2);
  ctx.fillStyle = '#4a8cbc';
  for (let x = 0; x < W; x += 12) ctx.fillRect(x, wallY + 2, 1, H - wallY - 2);
}

function drawHallBoards(ctx: Ctx): void {
  const panels: [string, string, string][] = [
    ['#2fb4e0', '#ffffff', 'AQUA'],
    ['#f7d038', '#c8321f', 'RETRO'],
    ['#ffffff', '#2456c8', 'SPLASH'],
    ['#e8442e', '#ffffff', 'SWIM 80'],
  ];
  const H = HALL.boardsHeight;
  ctx.font = '8px "Press Start 2P"';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  panels.forEach(([bg, fg, text], i) => {
    const x = i * 128;
    ctx.fillStyle = bg;
    ctx.fillRect(x, 0, 128, H);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 127, 0, 1, H);
    ctx.fillStyle = fg;
    ctx.fillText(text, x + 64, 7);
  });
  // Glasbande: Handlauf und Spiegelungen
  ctx.fillStyle = '#e8eef2';
  ctx.fillRect(0, 0, 512, 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (let x = 0; x < 512; x += 32) {
    for (let i = 0; i < 10; i++) ctx.fillRect(x + i, 2 + i, 2, 1);
  }
  ctx.fillStyle = '#5d6278';
  ctx.fillRect(0, H - 2, 512, 2);
}

function drawDeck(ctx: Ctx): void {
  const H = HALL.deckHeight;
  const edge = 6;
  ctx.fillStyle = css(COLORS.tile);
  ctx.fillRect(0, 0, 64, H - edge);
  // Fliesenfugen, schräg wie die Projektion
  ctx.fillStyle = css(COLORS.tileGrout);
  for (let y = 0; y < H - edge; y++) {
    if (y % 7 === 6) {
      ctx.fillRect(0, y, 64, 1);
      continue;
    }
    const shift = skewAt(HALL.deckY + y);
    for (let k = 0; k < 4; k++) {
      const x = (((k * 16 + shift) % 64) + 64) % 64;
      ctx.fillRect(Math.floor(x), y, 1, 1);
    }
  }
  // Hinterer Beckenrand mit Überlaufrinne
  const y0 = H - edge;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, y0, 64, 2);
  ctx.fillStyle = '#3b4a5c';
  ctx.fillRect(0, y0 + 2, 64, 2);
  for (let x = 1; x < 64; x += 4) {
    ctx.fillStyle = '#7d8c9c';
    ctx.fillRect(x, y0 + 2, 2, 1);
  }
  ctx.fillStyle = css(COLORS.tileGrout);
  ctx.fillRect(0, y0 + 4, 64, 2);
}

function drawWater(ctx: Ctx, frame: number): void {
  const W = 64;
  const H = HALL.waterHeight;
  const phase = (frame / WATER_FRAMES) * Math.PI * 2;
  const img = ctx.createImageData(W, H);
  const base = [(COLORS.water >> 16) & 0xff, (COLORS.water >> 8) & 0xff, COLORS.water & 0xff];
  const light = [(COLORS.waterLight >> 16) & 0xff, (COLORS.waterLight >> 8) & 0xff, COLORS.waterLight & 0xff];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Lichtkringel: Netz aus hellen Linien, in x nahtlos kachelbar
      const u = (x / W) * Math.PI * 2;
      const a = Math.sin(u * 2 + 1.6 * Math.sin(y / 7 + phase));
      const b = Math.sin(y / 5 + 1.4 * Math.sin(u + phase) + phase * 0.5);
      const c = Math.min(Math.abs(a), Math.abs(b));
      let k = c < 0.12 ? 0.75 : c < 0.25 ? 0.3 : 0;
      // Hinten spiegeln sich die hellen Fenster: zerfasernde Lichtstreifen
      if (y < 26) {
        const streak = Math.sin(u * 3 + Math.sin(y * 0.8 + phase) * 0.9) > 0.35 && (y < 8 || y % 2 === 0);
        if (streak) k = Math.max(k, 0.55 * (1 - y / 26) + 0.15);
      }
      const i = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[i + ch] = Math.round(base[ch] + (light[ch] - base[ch]) * k);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Schwimmhalle mit Parallax-Ebenen, Becken, Leinen, Startblöcken und Hallenuhr. */
export class SwimHall {
  private readonly wall: Phaser.GameObjects.TileSprite;
  private readonly stands: Phaser.GameObjects.TileSprite;
  private readonly boards: Phaser.GameObjects.TileSprite;
  private readonly deck: Phaser.GameObjects.TileSprite;
  private readonly water: Phaser.GameObjects.TileSprite;
  private readonly edge: Phaser.GameObjects.TileSprite;
  /** Bodenstreifen je Bahn und Umgang hinter den Wänden (vorab gerendert) */
  private readonly stripes: Phaser.GameObjects.Image[] = [];
  private readonly ends: Phaser.GameObjects.Image[] = [];
  /** Leinen 0 (hinten) … 4 (vorne), Wellen-Bilder vorab gerendert */
  private readonly ropes: Phaser.GameObjects.Image[] = [];
  /** Glitzern auf dem Wasser und Weltrekord-Linie */
  private readonly glitter: Gfx;
  private readonly recordGfx: Gfx;
  private readonly recordLabel: Phaser.GameObjects.Text;
  private recordAt: number | null = null;
  /** Startblöcke und Anschlagplatten je Bahn */
  private readonly lanes: Gfx[] = [];
  private readonly front: Gfx;
  private readonly clockGfx: Gfx;
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly laneLabels: Phaser.GameObjects.Text[] = [];
  private readonly placeLabels: Phaser.GameObjects.Text[] = [];
  /** Anschlag im Ziel je Bahn: Platz und Zeitpunkt */
  private readonly touches: ({ place: number; at: number } | null)[] = [];
  private waterTimer = 0;
  private waterFrame = 0;
  private ropeFrame = -1;
  private crowdTimer = 0;
  private crowdFrame = 0;
  private camPx = 0;
  /** Zuletzt gezeichneter Zustand – statische Teile werden nur bei Änderung neu gemalt */
  private drawnCam = NaN;
  private clockShown = '';
  private clockTimer = 0;
  private clockHalf = 0;

  constructor(scene: Phaser.Scene) {
    this.wall = scene.add.tileSprite(0, 0, GAME_WIDTH, HALL.standsY, 'hallwall').setOrigin(0).setDepth(-10);
    this.stands = scene.add
      .tileSprite(0, HALL.standsY, GAME_WIDTH, HALL.standsHeight, 'hallstands0')
      .setOrigin(0)
      .setDepth(-8);
    this.boards = scene.add.tileSprite(0, HALL.boardsY, GAME_WIDTH, HALL.boardsHeight, 'hallboards').setOrigin(0).setDepth(-7);
    this.deck = scene.add.tileSprite(0, HALL.deckY, GAME_WIDTH, HALL.deckHeight, 'halldeck').setOrigin(0).setDepth(-7);
    this.water = scene.add.tileSprite(0, TRACK_FAR_Y, GAME_WIDTH, HALL.waterHeight, 'water0').setOrigin(0).setDepth(-6);
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      this.stripes.push(scene.add.image(0, laneCenterY(lane) + STRIPE_TOP, `poolstripe${lane}`).setOrigin(0).setDepth(-5.8));
    }
    this.glitter = scene.add.graphics().setDepth(-5.5);
    this.recordGfx = scene.add.graphics().setDepth(-5.4);
    for (const key of ['poolendstart', 'poolendturn']) this.ends.push(scene.add.image(0, TRACK_FAR_Y, key).setOrigin(0).setDepth(-5.2));
    this.recordLabel = scene.add
      .text(0, 0, 'WR', { fontFamily: FONT, fontSize: '8px', color: '#f7d038', stroke: '#10101c', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(-5)
      .setVisible(false);
    this.edge = scene.add.tileSprite(0, TRACK_NEAR_Y, GAME_WIDTH, HALL.edgeHeight, 'halledge').setOrigin(0).setDepth(45);
    for (let k = 0; k <= LANE_COUNT; k++) {
      this.ropes.push(scene.add.image(0, ropeY(k) - 3, `rope${k}_0`).setOrigin(0).setDepth(k * 10));
    }
    const style = { fontFamily: FONT, fontSize: '8px', color: '#10101c' };
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      this.lanes.push(scene.add.graphics().setDepth(lane * 10 + 2));
      this.laneLabels.push(scene.add.text(0, 0, String(lane + 1), style).setOrigin(0.5).setDepth(lane * 10 + 3));
      this.placeLabels.push(
        scene.add
          .text(0, 0, '', { ...style, color: '#f7d038', stroke: '#10101c', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(lane * 10 + 3),
      );
      this.touches.push(null);
    }
    this.front = scene.add.graphics().setDepth(46);
    this.clockGfx = scene.add.graphics().setDepth(-9);
    this.clockText = scene.add
      .text(0, 0, '0.00', { fontFamily: FONT, fontSize: '16px', color: '#ff6a3c' })
      .setOrigin(0.5, 0)
      .setDepth(-9);
  }

  /**
   * Als Hintergrund einer anderen Szene: alle Ebenen behalten ihre Reihenfolge,
   * liegen aber unter allem, was die Szene selbst zeichnet.
   */
  asBackdrop(): this {
    const all: Phaser.GameObjects.Components.Depth[] = [
      this.wall, this.stands, this.boards, this.deck, this.water, this.edge, this.glitter, this.recordGfx,
      this.recordLabel, this.front, this.clockGfx, this.clockText,
      ...this.stripes, ...this.ends, ...this.ropes, ...this.lanes, ...this.laneLabels, ...this.placeLabels,
    ];
    for (const o of all) o.setDepth(-100 + (o.depth + 20) / 100);
    return this;
  }

  /** Anschlag im Ziel: Platte blitzt auf und zeigt den Platz */
  touch(lane: number, place: number, time: number): void {
    this.touches[lane] = { place, at: time };
  }

  /** Gelbe Weltrekord-Linie bei dieser Beckenposition (Meter), null = aus */
  setRecordLine(meters: number | null): void {
    this.recordAt = meters;
  }

  /**
   * @param camPx Kameraposition in Welt-Pixeln
   * @param excitement 0..1 – wie wild das Publikum jubelt
   * @param clock Zeit auf der Hallenuhr – oder ein fertiger Text (z. B. Punkte beim Turmspringen)
   */
  update(camPx: number, dt: number, time: number, excitement: number, clock: number | string): void {
    this.camPx = Math.round(camPx);
    this.wall.tilePositionX = camPx * 0.1;
    this.stands.tilePositionX = camPx * 0.55;
    this.boards.tilePositionX = camPx * 0.95;
    this.deck.tilePositionX = camPx;
    this.edge.tilePositionX = camPx;
    // Das Wasser driftet leicht gegen die Kamera
    this.water.tilePositionX = camPx + time * 4;
    const poolX = POOL_TEX_X0 - this.camPx;
    for (const stripe of this.stripes) stripe.x = poolX;
    this.ends[0].x = endOriginPx(0) - this.camPx;
    this.ends[1].x = endOriginPx(1) - this.camPx;

    this.waterTimer += dt;
    if (this.waterTimer >= 1 / 6) {
      this.waterTimer = 0;
      this.waterFrame = (this.waterFrame + 1) % WATER_FRAMES;
      this.water.setTexture(`water${this.waterFrame}`);
    }
    // Leinen schaukeln: Wellen-Bild aus der Zeit
    const ropeFrame = Math.floor(((time * 2.6) / (Math.PI * 2)) * ROPE_FRAMES) % ROPE_FRAMES;
    for (let k = 0; k <= LANE_COUNT; k++) {
      const rope = this.ropes[k];
      rope.x = poolX;
      if (ropeFrame !== this.ropeFrame) rope.setTexture(`rope${k}_${ropeFrame}`);
    }
    this.ropeFrame = ropeFrame;

    this.crowdTimer += dt;
    if (this.crowdTimer >= Phaser.Math.Linear(0.6, 0.1, excitement)) {
      this.crowdTimer = 0;
      this.crowdFrame = 1 - this.crowdFrame;
      this.stands.setTexture(`hallstands${this.crowdFrame}`);
    }

    this.drawClock(clock, dt);
    this.drawGlitter(time);
    this.drawRecordLine();
    // Startblöcke ändern sich nur mit der Kamera oder beim Aufblitzen der Anschlagplatte
    const flashing = this.touches.some((t) => t !== null && time - t.at < 1);
    if (this.camPx !== this.drawnCam || flashing) {
      for (let lane = 0; lane < LANE_COUNT; lane++) this.drawLane(lane, time);
    }
    this.drawnCam = this.camPx;
    this.drawFlags(time);
  }

  private sx(meters: number, y: number): number {
    return Math.round(meters * PX_PER_M - this.camPx + skewAt(y));
  }

  /** Viereck quer über die Bahnen zwischen zwei Positionen (Meter) und zwei Bildschirmzeilen */
  private band(g: Gfx, m0: number, m1: number, y0: number, y1: number): void {
    g.fillPoints(
      [
        new Phaser.Math.Vector2(this.sx(m0, y0), y0),
        new Phaser.Math.Vector2(this.sx(m1, y0), y0),
        new Phaser.Math.Vector2(this.sx(m1, y1), y1),
        new Phaser.Math.Vector2(this.sx(m0, y1), y1),
      ],
      true,
    );
  }

  private drawClock(clock: number | string, dt: number): void {
    const cx = Math.round(150 - this.camPx * 0.1);
    // Die Anzeige springt etwa 15-mal pro Sekunde weiter – spart das Neuzeichnen der Schrift
    this.clockTimer += dt;
    const text = typeof clock === 'number' ? clock.toFixed(2) : clock;
    if (text !== this.clockShown && (this.clockTimer >= 1 / 15 || this.clockShown === '')) {
      this.clockTimer = 0;
      this.clockShown = text;
      this.clockText.setText(text);
    }
    this.clockText.setPosition(cx + 1, 29);
    // Breite wächst mit dem Text (Punkte haben mehr Stellen als Zeiten)
    const half = Math.max(38, this.clockShown.length * 8 + 6);
    if (cx === Math.round(150 - this.drawnCam * 0.1) && half === this.clockHalf) return;
    this.clockHalf = half;
    const g = this.clockGfx;
    g.clear();
    g.fillStyle(0x5d6278, 1);
    g.fillRect(cx - half, 22, half * 2, 30);
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(cx - half + 2, 24, half * 2 - 4, 26);
    g.fillStyle(0x2a1410, 1);
    g.fillRect(cx - half + 4, 26, half * 2 - 8, 22);
    g.fillStyle(0x5d6278, 1);
    g.fillRect(cx - 1, 52, 2, 8);
  }

  /** Sonnenlicht glitzert auf dem Wasser – vor allem hinten, wo sich die Fenster spiegeln */
  private drawGlitter(time: number): void {
    const g = this.glitter;
    g.clear();
    const cell = 23;
    const first = Math.floor(this.camPx / cell) - 2;
    for (let i = first; i < first + GAME_WIDTH / cell + 4; i++) {
      for (let row = 0; row < 3; row++) {
        // Pseudozufall je Zelle, damit die Funken mit der Kamera mitwandern
        const h = Math.sin(i * 12.9898 + row * 78.233) * 43758.5453;
        const r = h - Math.floor(h);
        const y = TRACK_FAR_Y + 3 + Math.floor(r * (row === 0 ? 24 : row === 1 ? 60 : 110));
        const life = (time * (0.7 + r) + r * 7) % 2.2;
        if (life > 0.35) continue;
        const x = Math.round(i * cell + r * 17 - this.camPx + skewAt(y) * 0.2);
        if (x < this.sx(0.3, y) || x > this.sx(SWIM.poolLength - 0.3, y)) continue;
        const peak = life > 0.1 && life < 0.25;
        g.fillStyle(0xffffff, peak ? 1 : 0.7);
        g.fillRect(x, y, 1, 1);
        if (peak) {
          g.fillStyle(0xffffff, 0.75);
          g.fillRect(x - 1, y, 3, 1);
          g.fillRect(x, y - 1, 1, 3);
        }
      }
    }
  }

  private drawRecordLine(): void {
    const g = this.recordGfx;
    g.clear();
    const m = this.recordAt;
    const top = TRACK_FAR_Y;
    const bottom = TRACK_NEAR_Y;
    if (m === null || this.sx(m, bottom) < -8 || this.sx(m, top) > GAME_WIDTH + 8) {
      this.recordLabel.setVisible(false);
      return;
    }
    g.fillStyle(COLORS.yellow, 0.25);
    this.band(g, m - 0.12, m + 0.12, top, bottom);
    g.fillStyle(COLORS.yellow, 0.9);
    this.band(g, m - 0.03, m + 0.03, top, bottom);
    this.recordLabel.setVisible(true).setPosition(this.sx(m, top - 4), top - 4);
  }

  private drawLane(lane: number, time: number): void {
    const g = this.lanes[lane];
    g.clear();
    const base = laneCenterY(lane) + 6;
    const topY = blockTopY(lane);
    const front = this.sx(0, base);
    const label = this.laneLabels[lane];
    const place = this.placeLabels[lane];
    const startVisible = front > -30 && front < GAME_WIDTH + 30;
    if (!startVisible) {
      label.setVisible(false);
    } else {
      const x = front - HALL.blockWidth;
      // Startblock: Sockel, schräge Trittfläche, Nummernschild
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x - 1, topY - 1, HALL.blockWidth + 2, HALL.blockHeight + 1);
      g.fillStyle(0x8e98a8, 1);
      g.fillRect(x, topY + 3, HALL.blockWidth, HALL.blockHeight - 3);
      g.fillStyle(0xb4bcc8, 1);
      g.fillRect(x, topY + 3, 2, HALL.blockHeight - 6);
      g.fillStyle(0x6c7686, 1);
      g.fillRect(x, base - 3, HALL.blockWidth, 3);
      g.fillStyle(0x3fa0d8, 1);
      g.fillRect(x, topY, HALL.blockWidth, 3);
      g.fillStyle(0x7cc6f0, 1);
      g.fillRect(x, topY, HALL.blockWidth, 1);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x + 3, topY + 5, 8, 9);
      label.setVisible(true).setPosition(x + 7, topY + 10);
      // Haltegriff für den Rückenstart
      g.fillStyle(0xc9d1d9, 1);
      g.fillRect(x + HALL.blockWidth - 2, topY - 4, 1, 4);
    }

    // Anschlagplatten an beiden Wänden (nur wenn im Bild)
    const farY = TRACK_FAR_Y + lane * LANE_DEPTH + 5;
    const nearY = farY + LANE_DEPTH - 9;
    const touched = this.touches[lane];
    const flash = touched !== null && time - touched.at < 0.8 && Math.floor((time - touched.at) * 10) % 2 === 0;
    for (const m of [0, SWIM.poolLength]) {
      const x = this.sx(m, nearY);
      if (x < -20 || x > GAME_WIDTH + 40) continue;
      const inward = m === 0 ? 1 : -1;
      g.fillStyle(COLORS.outline, 1);
      this.band(g, m, m + inward * 0.14, farY - 1, nearY + 1);
      g.fillStyle(m === 0 && flash ? 0xffffff : COLORS.yellow, 1);
      this.band(g, m, m + inward * 0.09, farY, nearY);
    }
    if (touched !== null && startVisible) {
      place.setVisible(true).setText(String(touched.place)).setPosition(this.sx(-0.3, topY - 8), topY - 8);
    } else {
      place.setVisible(false);
    }
  }

  /** Rückenwimpel quer über das Becken, 5 m vor jeder Wand – mit Durchhang und Schatten */
  private drawFlags(time: number): void {
    const g = this.front;
    g.clear();
    const colors = [COLORS.red, 0xffffff, COLORS.ropeBlue];
    const height = 38;
    for (const m of [HALL.flagsAt, SWIM.poolLength - HALL.flagsAt]) {
      const backY = TRACK_FAR_Y - 6;
      const frontY = TRACK_NEAR_Y + 6;
      const bx = this.sx(m, backY);
      const fx = this.sx(m, frontY);
      if (Math.max(bx, fx) < -10 || Math.min(bx, fx) > GAME_WIDTH + 10) continue;
      const lineTop = backY - height;
      const lineBottom = frontY - height;
      // Schatten der Leine auf dem Wasser (direkt darunter, leicht nach rechts versetzt)
      g.fillStyle(0x0e346e, 0.22);
      for (let y = TRACK_FAR_Y + 2; y < TRACK_NEAR_Y; y += 5) g.fillRect(this.sx(m, y) + 3, y, 2, 2);
      // Pfosten mit Fuß
      for (const [px, top, foot] of [
        [bx, lineTop, backY],
        [fx, lineBottom, frontY],
      ] as const) {
        g.fillStyle(COLORS.outline, 1);
        g.fillRect(px - 1, top - 1, 3, foot - top + 1);
        g.fillRect(px - 3, foot - 1, 7, 3);
        g.fillStyle(0xd0d6de, 1);
        g.fillRect(px, top, 1, foot - top);
        g.fillStyle(0x8e98a8, 1);
        g.fillRect(px - 2, foot, 5, 1);
      }
      // Leine mit Durchhang und flatternden Wimpeln
      const n = 18;
      const sag = 5;
      const at = (t: number) => ({
        x: bx + (fx - bx) * t,
        y: lineTop + (lineBottom - lineTop) * t + sag * 4 * t * (1 - t),
      });
      g.lineStyle(1, 0x23304a, 1);
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= n; i += 3) {
        const p = at(i / n);
        pts.push(new Phaser.Math.Vector2(Math.round(p.x), Math.round(p.y)));
      }
      g.strokePoints(pts, false);
      for (let i = 1; i < n; i++) {
        const p = at(i / n);
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        const flutter = Math.round(Math.sin(time * 7 + i * 1.7 + m) * 1.2);
        g.fillStyle(colors[i % colors.length], 1);
        g.fillTriangle(px - 3, py, px + 3, py, px + flutter, py + 6);
      }
    }
  }
}

// ======================================================= Sprunghalle (Turmspringen)

/**
 * Lage der Sprunghalle bei Kamera ganz unten (camY = 0). Die Kamera scrollt nur senkrecht:
 * Wand und Dach mit halber Geschwindigkeit, alles andere (Turm, Becken, Richter) voll.
 */
export const DIVE_HALL = {
  /** Plattformkante (Bildschirm-X) */
  edgeX: 200,
  waterY: 232,
  poolNearY: TRACK_NEAR_Y,
  standsY: 150,
  deckY: 198,
  /** Linke Beckenkante an der Wasserlinie; nach vorne läuft sie schräg wie die Projektion */
  poolLeftX: 206,
  /** Oberkante der Hallenwand-Textur (Wand-Koordinaten, Parallaxe 0,5) */
  wallTop: -110,
  wallHeight: 370,
  /**
   * LED-Anzeigetafel der Halle: hängt rechts oben, weit weg von Turm und Flugbahn (Parallaxe 0,75).
   * Die längste Zeile (20 Zeichen à 16 px) passt hinein.
   */
  board: { x: 300, y: 34, w: 328, h: 52 },
  boardParallax: 0.75,
  /** Wertung nach dem Sprung: große Tafel als Overlay, deckt die Hallentafel ganz ab (nur in der Beckenansicht) */
  verdict: { x: 220, y: 34, w: 408, h: 84 },
  /** Kampfrichter: Mitte der Hochstühle und Sitzhöhe */
  judgeX: [344, 400, 456, 512, 568],
  judgeSeatY: 216,
  platforms: [3, 5, 7.5, 10],
} as const;

/** Bildschirm-Y einer Höhe über dem Wasser (Meter) bei Kamera camY */
export function diveScreenY(heightM: number, camY: number): number {
  return DIVE_HALL.waterY + camY - heightM * PX_PER_M;
}

/** Linke Beckenkante in der Bildschirmzeile y (bei camY = 0) */
export function poolLeftAt(y: number): number {
  return DIVE_HALL.poolLeftX - (y - DIVE_HALL.waterY) * DEPTH_SKEW;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** LED-Anzeigetafel: Rahmen, dunkle Fläche, Raster (Hallentafel und Wertungs-Overlay) */
export function drawLedBoard(g: Gfx, r: Rect = DIVE_HALL.board): void {
  const { x, y, w, h } = r;
  g.fillStyle(0x5d6278, 1);
  g.fillRect(x - 3, y - 3, w + 6, h + 6);
  g.fillStyle(0x7d8496, 1);
  g.fillRect(x - 3, y - 3, w + 6, 1);
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(0x1a0c0a, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x2a1410, 1);
  for (let yy = y + 2; yy < y + h - 1; yy += 3) {
    for (let xx = x + 2; xx < x + w - 1; xx += 3) g.fillRect(xx, yy, 1, 1);
  }
}

/** Kleine Raute für Muster auf Bannern (Canvas) */
function canvasDiver(ctx: Ctx, x: number, y: number, color: string): void {
  // Piktogramm: Springer kopfüber mit gestreckten Armen
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y, 2, 2);
  ctx.fillRect(x + 2, y + 3, 2, 5);
  ctx.fillRect(x + 1, y + 2, 1, 2);
  ctx.fillRect(x + 4, y + 2, 1, 2);
  ctx.fillRect(x + 2, y + 8, 1, 3);
  ctx.fillRect(x + 3, y + 8, 1, 2);
}

/** Hallenwand: Dach mit Fachwerk, Wimpelketten und Scheinwerfern, Fensterband mit Bannern, Sichtbeton */
function drawDiveWall(ctx: Ctx): void {
  const W = 320;
  const H = DIVE_HALL.wallHeight;
  const y = (wallY: number) => wallY - DIVE_HALL.wallTop;
  // Decke mit Fachwerkträgern
  ctx.fillStyle = '#2c3348';
  ctx.fillRect(0, 0, W, y(-6));
  // Deckenpaneele mit leichtem Glanz
  ctx.fillStyle = '#323a52';
  for (let x = 0; x < W; x += 40) ctx.fillRect(x + 1, 0, 38, 17);
  ctx.fillStyle = '#3a4258';
  for (let x = 0; x < W; x += 40) {
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(x + i, 20 + Math.floor(i * 1.6), 2, 1);
      ctx.fillRect(x + 20 + i, 52 - Math.floor(i * 1.6), 2, 1);
    }
  }
  ctx.fillRect(0, 18, W, 3);
  ctx.fillRect(0, 52, W, 3);
  ctx.fillStyle = '#4a5470';
  ctx.fillRect(0, 18, W, 1);
  ctx.fillRect(0, 52, W, 1);
  // Wimpelkette quer durchs Dach, mit Durchhang
  const pennants = ['#e8442e', '#f7d038', '#2fb4e0', '#4cd964', '#ffffff', '#f08a24'];
  for (let x = 0; x < W; x += 2) {
    const u = (x % 160) / 160;
    const sag = Math.round(26 + Math.sin(Math.PI * u) * 12);
    ctx.fillStyle = '#1c2132';
    ctx.fillRect(x, sag, 2, 1);
    if (x % 8 === 0) {
      ctx.fillStyle = pennants[(x / 8) % pennants.length];
      for (let i = 0; i < 5; i++) ctx.fillRect(x + Math.floor(i / 2), sag + 1 + i, 5 - i, 1);
    }
  }
  // Hängelampen mit Lichtkegel
  for (let x = 30; x < W; x += 80) {
    ctx.fillStyle = '#1c2132';
    ctx.fillRect(x + 6, 55, 1, 14);
    ctx.fillStyle = '#5d6278';
    ctx.fillRect(x, 69, 13, 4);
    ctx.fillStyle = '#7d8496';
    ctx.fillRect(x, 69, 13, 1);
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(x + 1, 73, 11, 2);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(255, 246, 200, ${0.16 * (1 - i / 14)})`;
      ctx.fillRect(x - 1 - Math.floor(i * 0.7), 75 + i, 15 + Math.floor(i * 1.4), 1);
    }
  }
  // Ringbalken mit Scheinwerfern
  ctx.fillStyle = '#556079';
  ctx.fillRect(0, y(-14), W, 8);
  ctx.fillStyle = '#6c7896';
  ctx.fillRect(0, y(-14), W, 1);
  ctx.fillStyle = '#434c64';
  ctx.fillRect(0, y(-7), W, 1);
  for (let x = 66; x < W; x += 80) {
    ctx.fillStyle = '#1c2132';
    ctx.fillRect(x, y(-18), 8, 5);
    ctx.fillStyle = '#3a4258';
    ctx.fillRect(x + 1, y(-17), 6, 3);
    ctx.fillStyle = '#fffbe0';
    ctx.fillRect(x + 2, y(-14), 4, 1);
  }
  // Fensterband (etwas tiefer im Blau, damit der Springer davor gut lesbar bleibt)
  ctx.fillStyle = '#aebccb';
  ctx.fillRect(0, y(-6), W, y(136) - y(-6));
  for (let k = 0; k < 4; k++) {
    const x0 = 6 + k * 80;
    const top = y(0);
    const h = 128;
    const grd = ctx.createLinearGradient(0, top, 0, top + h);
    grd.addColorStop(0, '#356fc0');
    grd.addColorStop(1, '#a6d6ef');
    ctx.fillStyle = grd;
    ctx.fillRect(x0, top, 68, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 60; i++) ctx.fillRect(x0 + 8 + i * 0.5 + (i > 30 ? 20 : 0), top + 20 + i * 1.5, 3, 1);
    ctx.fillStyle = '#aebccb';
    for (let x = x0 + 16; x < x0 + 68; x += 17) ctx.fillRect(x, top, 2, h);
    for (let yy = top + 31; yy < top + h; yy += 32) ctx.fillRect(x0, yy, 68, 2);
    ctx.fillStyle = '#8d9cad';
    ctx.fillRect(x0, top + h, 68, 1);
  }
  // Senkrechte Banner zwischen den Fenstern: Wellen und Springer-Piktogramm, unten Schwalbenschwanz
  const banners: [string, string][] = [
    ['#c8321f', '#f7d038'],
    ['#2456c8', '#ffffff'],
    ['#2d8a4e', '#f7d038'],
    ['#f08a24', '#ffffff'],
  ];
  const banner = (bx: number, bg: string, fg: string) => {
    const top = y(-6);
    const len = 74;
    ctx.fillStyle = '#1c2132';
    ctx.fillRect(bx - 1, top, 12, len + 1);
    ctx.fillStyle = bg;
    ctx.fillRect(bx, top, 10, len);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(bx + 8, top, 2, len);
    ctx.fillStyle = fg;
    ctx.fillRect(bx + 1, top + 2, 8, 1);
    canvasDiver(ctx, bx + 2, top + 8, fg);
    for (let i = 0; i < 3; i++) {
      for (let x = 0; x < 8; x++) ctx.fillRect(bx + 1 + x, top + 30 + i * 8 + Math.round(Math.sin(x * 0.9) * 1.2), 1, 1);
    }
    // Schwalbenschwanz
    ctx.fillStyle = '#aebccb';
    for (let i = 0; i < 4; i++) ctx.fillRect(bx + 4 - i, top + len - 4 + i, 2 + i * 2, 1);
  };
  banners.forEach(([bg, fg], k) => {
    const bx = 75 + k * 80;
    banner(bx, bg, fg);
    // Über die Kachelgrenze hinweg auch links anfangen
    if (bx + 12 > W) banner(bx - W, bg, fg);
  });
  // Sichtbeton mit Fugen
  const base = y(136);
  ctx.fillStyle = '#b9c4cc';
  ctx.fillRect(0, base, W, H - base);
  ctx.fillStyle = '#a6b1ba';
  for (let yy = base; yy < H; yy += 16) ctx.fillRect(0, yy, W, 1);
  for (let x = 0; x < W; x += 40) ctx.fillRect(x, base, 1, H - base);
  // Ankerlöcher der Schalung
  ctx.fillStyle = '#98a3ad';
  for (let yy = base + 8; yy < H; yy += 16) for (let x = 10; x < W; x += 20) ctx.fillRect(x, yy, 1, 1);
  ctx.fillStyle = '#d4dde3';
  ctx.fillRect(0, base, W, 2);
}

/** Höhenangaben am Turmschaft: kleine Schilder mit Pixelschrift */
const HEIGHT_LABEL: Record<number, string> = { 3: '3M', 5: '5M', 7.5: '7,5M', 10: '10M' };
/** Plattformspitzen: je höher, desto weiter ragen sie über das Becken */
const PLATFORM_TIP: Record<number, number> = { 3: 168, 5: 180, 7.5: 190, 10: DIVE_HALL.edgeX };
const CORE_L = 44;
const CORE_R = 112;
const TOWER_FOOT = 262;
/** Mitte der Höhenschilder am Schaft (rechts neben der Leiter) */
const LABEL_X = 92;
/** Fahnen auf dem Turm: Breite, Höhe, Zahl der Streifen fürs Flattern */
const FLAG_W = 16;
const FLAG_H = 11;
const FLAG_SLICES = 8;

/** Sprunghalle für das Turmspringen: Betonturm, Sprungbecken, Publikum und Richterstühle. */
export class DiveHall {
  private readonly scene: Phaser.Scene;
  private readonly wall: Phaser.GameObjects.TileSprite;
  private readonly stands: Phaser.GameObjects.TileSprite;
  private readonly deck: Phaser.GameObjects.TileSprite;
  private readonly water: Phaser.GameObjects.TileSprite;
  private readonly edge: Phaser.GameObjects.TileSprite;
  /** Anzeigetafel mit Lauftext in Orange */
  private readonly boardGfx: Gfx;
  private readonly boardLines: Phaser.GameObjects.Text[];
  /** Turm, Umgang links und Richterstühle – einmal gezeichnet, nur verschoben */
  private readonly tower: Gfx;
  private readonly heightLabels: Phaser.GameObjects.Text[];
  private readonly chairs: Gfx;
  /** Tiefenstaffelung im Becken (einmal gezeichnet) */
  private readonly depth: Gfx;
  /** Sprudel-Kringel auf dem Wasser */
  private readonly surface: Gfx;
  /** Blitzlichter im Publikum */
  private readonly flashGfx: Gfx;
  private flashes: { x: number; y: number; age: number }[] = [];
  /** Fahnen der Nationen auf dem Turm, in senkrechte Streifen zerlegt (flattern) */
  private flagSlices: Phaser.GameObjects.Image[][] = [];
  private waterTimer = 0;
  private waterFrame = 0;
  private crowdTimer = 0;
  private crowdFrame = 0;
  private camY = 0;
  /** Ansage auf der Tafel: Zeilen blinken kurz, wenn ein neuer Sprung angesagt wird */
  private announce: 'pending' | number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const H = DIVE_HALL;
    this.wall = scene.add.tileSprite(0, H.wallTop, GAME_WIDTH, H.wallHeight, 'divewall').setOrigin(0).setDepth(-10);
    this.boardGfx = scene.add.graphics().setDepth(-9);
    const led = { fontFamily: FONT, color: '#ff6a3c', align: 'center' };
    const cx = H.board.x + H.board.w / 2;
    this.boardLines = [
      scene.add.text(cx, 0, '', { ...led, fontSize: '8px', color: '#f7b538' }).setOrigin(0.5, 0).setDepth(-9),
      scene.add.text(cx, 0, '', { ...led, fontSize: '16px' }).setOrigin(0.5, 0).setDepth(-9),
    ];
    // Untere Hälfte der Ränge mit Brüstung
    const standsH = H.deckY - H.standsY;
    this.stands = scene.add.tileSprite(0, H.standsY, GAME_WIDTH, standsH, 'hallstands0').setOrigin(0).setDepth(-8);
    this.stands.tilePositionY = HALL.standsHeight - standsH;
    this.flashGfx = scene.add.graphics().setDepth(-7.9);
    this.deck = scene.add.tileSprite(0, H.deckY, GAME_WIDTH, H.waterY - H.deckY, 'halldeck').setOrigin(0).setDepth(-7);
    this.water = scene.add
      .tileSprite(0, H.waterY, GAME_WIDTH, H.poolNearY - H.waterY, 'water0')
      .setOrigin(0)
      .setDepth(-6)
      .setTint(0x9cb4e8);
    this.depth = scene.add.graphics().setDepth(-5.8);
    this.surface = scene.add.graphics().setDepth(-5.5);
    this.tower = scene.add.graphics().setDepth(-4);
    this.heightLabels = H.platforms.map((m) =>
      scene.add
        .text(0, 0, HEIGHT_LABEL[m], { fontFamily: FONT, fontSize: '8px', color: '#ffffff' })
        .setOrigin(0.5, 0)
        .setDepth(-3.95),
    );
    this.chairs = scene.add.graphics().setDepth(-3.5);
    this.edge = scene.add.tileSprite(0, H.poolNearY, GAME_WIDTH, HALL.edgeHeight, 'halledge').setOrigin(0).setDepth(45);
    this.drawBoard();
    this.drawTower();
    this.drawDepth();
    this.drawChairs();
    this.setFlags(COUNTRIES.slice(0, 4).map((c) => c.flag));
    this.setBoard('TURMSPRINGEN 10 M', '');
  }

  /** Lauftext der Anzeigetafel (zwei Zeilen); `announce` lässt die Ansage kurz blinken */
  setBoard(line1: string, line2: string, announce = false): void {
    if (this.boardLines[0].text !== line1) this.boardLines[0].setText(line1);
    if (this.boardLines[1].text !== line2) this.boardLines[1].setText(line2);
    this.announce = announce ? 'pending' : null;
    for (const t of this.boardLines) t.setAlpha(1);
  }

  /** Lauftext ausblenden, solange die Wertung auf der Tafel steht */
  setBoardTextVisible(visible: boolean): void {
    for (const t of this.boardLines) t.setVisible(visible);
  }

  /** Fahnen der teilnehmenden Nationen auf dem Turm (höchstens 4) */
  setFlags(flags: readonly FlagSpec[]): void {
    for (const slices of this.flagSlices) for (const img of slices) img.destroy();
    this.flagSlices = flags.slice(0, 4).map((spec, i) => {
      const key = `diveflag${i}`;
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      const tg = this.scene.make.graphics({}, false);
      drawFlag(tg, spec, 1, 1, FLAG_W, FLAG_H);
      tg.generateTexture(key, FLAG_W + 2, FLAG_H + 2);
      tg.destroy();
      const step = (FLAG_W + 2) / FLAG_SLICES;
      return Array.from({ length: FLAG_SLICES }, (_, k) =>
        this.scene.add
          .image(0, 0, key)
          .setOrigin(0)
          .setCrop(Math.round(k * step), 0, Math.round((k + 1) * step) - Math.round(k * step), FLAG_H + 2)
          .setDepth(-3.9),
      );
    });
  }

  /**
   * @param camY senkrechte Kamera: 0 = Beckenansicht, größer = weiter oben
   * @param excitement 0..1 – wie wild das Publikum jubelt
   */
  update(camY: number, dt: number, time: number, excitement: number): void {
    const H = DIVE_HALL;
    const c = Math.round(camY);
    this.camY = c;
    const half = Math.round(camY * 0.5);
    const boardY = Math.round(camY * H.boardParallax);
    this.wall.y = H.wallTop + half;
    this.boardGfx.y = boardY;
    this.boardLines[0].y = H.board.y + 8 + boardY;
    this.boardLines[1].y = H.board.y + 26 + boardY;
    if (this.announce === 'pending') this.announce = time;
    if (typeof this.announce === 'number') {
      const age = time - this.announce;
      const on = age > 1.2 || Math.floor(age / 0.15) % 2 === 0;
      for (const t of this.boardLines) t.setAlpha(on ? 1 : 0.15);
      if (age > 1.2) this.announce = null;
    }
    this.stands.y = H.standsY + c;
    this.deck.y = H.deckY + c;
    this.water.y = H.waterY + c;
    this.edge.y = H.poolNearY + c;
    this.tower.y = c;
    this.chairs.y = c;
    this.surface.y = c;
    this.depth.y = c;
    this.flashGfx.y = c;
    H.platforms.forEach((m, i) => this.heightLabels[i].setPosition(LABEL_X + 1, H.waterY - m * PX_PER_M + 12 + c));
    // Unterhalb des Bildes muss nichts gezeichnet werden
    const low = H.standsY + c < 360;
    for (const o of [this.stands, this.deck, this.water, this.edge, this.surface, this.chairs, this.depth, this.flashGfx]) {
      o.setVisible(low);
    }

    this.waterTimer += dt;
    if (this.waterTimer >= 1 / 6) {
      this.waterTimer = 0;
      this.waterFrame = (this.waterFrame + 1) % WATER_FRAMES;
      this.water.setTexture(`water${this.waterFrame}`);
    }
    this.water.tilePositionX = time * 3;
    this.crowdTimer += dt;
    if (this.crowdTimer >= Phaser.Math.Linear(0.6, 0.1, excitement)) {
      this.crowdTimer = 0;
      this.crowdFrame = 1 - this.crowdFrame;
      this.stands.setTexture(`hallstands${this.crowdFrame}`);
    }
    this.updateFlags(time);
    if (low) {
      this.drawSurface(time);
      this.drawFlashes(dt, excitement);
    }
  }

  /** Fahnen flattern: jeder Streifen hebt und senkt sich, am Mast ruhig */
  private updateFlags(time: number): void {
    const top = DIVE_HALL.waterY - 10 * PX_PER_M - 73 + this.camY;
    this.flagSlices.forEach((slices, i) => {
      const px = CORE_L + 8 + i * 20;
      slices.forEach((img, k) => {
        const amp = (k / FLAG_SLICES) * 1.6;
        const dy = Math.round(Math.sin(time * 5.5 - k * 0.9 + i * 1.3) * amp);
        img.setPosition(px, top + dy);
      });
    });
  }

  /** Blitzlichter im Publikum, je aufgeregter, desto mehr */
  private drawFlashes(dt: number, excitement: number): void {
    const H = DIVE_HALL;
    const g = this.flashGfx;
    g.clear();
    if (excitement >= 0.5 && Math.random() < dt * excitement * 9) {
      this.flashes.push({ x: Math.floor(Math.random() * GAME_WIDTH), y: H.standsY + 3 + Math.floor(Math.random() * 30), age: 0 });
    }
    for (const f of this.flashes) {
      f.age += dt;
      const a = 1 - f.age / 0.12;
      if (a <= 0) continue;
      g.fillStyle(0xffffff, a);
      g.fillRect(f.x - 1, f.y, 3, 1);
      g.fillRect(f.x, f.y - 1, 1, 3);
      g.fillStyle(0xfff6c8, a * 0.35);
      g.fillRect(f.x - 3, f.y - 2, 7, 5);
    }
    this.flashes = this.flashes.filter((f) => f.age < 0.12);
  }

  private drawBoard(): void {
    const { x, y, w } = DIVE_HALL.board;
    const g = this.boardGfx;
    // Aufhängung an Stahlseilen
    g.fillStyle(0x3a4258, 1);
    g.fillRect(x + 30, y - 40, 1, 37);
    g.fillRect(x + w - 31, y - 40, 1, 37);
    g.fillStyle(0x5d6278, 1);
    g.fillRect(x + 28, y - 5, 5, 2);
    g.fillRect(x + w - 33, y - 5, 5, 2);
    drawLedBoard(g);
  }

  /** Betonturm mit Plattformen 3/5/7,5/10 m, Leiter, Geländer und Fahnenmasten; links davon Fliesenboden */
  private drawTower(): void {
    const g = this.tower;
    const H = DIVE_HALL;
    const yOf = (m: number) => H.waterY - m * PX_PER_M;
    // Fliesenboden links vom Becken (bis zur schrägen Beckenkante)
    const near = H.poolNearY;
    g.fillStyle(COLORS.tile, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(0, H.waterY),
        new Phaser.Math.Vector2(poolLeftAt(H.waterY), H.waterY),
        new Phaser.Math.Vector2(poolLeftAt(near), near),
        new Phaser.Math.Vector2(0, near),
      ],
      true,
    );
    g.fillStyle(COLORS.tileGrout, 1);
    for (let y = H.waterY + 6; y < near; y += 7) g.fillRect(0, y, Math.round(poolLeftAt(y)) - 3, 1);
    for (let y = H.waterY; y < near; y++) {
      if (y % 7 === 6) continue;
      const shift = Math.round(skewAt(y)) % 16;
      for (let x = shift; x < poolLeftAt(y) - 3; x += 16) g.fillRect(x, y, 1, 1);
    }
    // Beckenkante: weißer Rand, dunkle Fuge zum Wasser
    for (let y = H.waterY; y < near; y++) {
      const x = Math.round(poolLeftAt(y));
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - 3, y, 3, 1);
      g.fillStyle(0x16406e, 0.6);
      g.fillRect(x, y, 2, 1);
    }

    // Vorderer Umgang unter dem HUD
    g.fillStyle(COLORS.tile, 1);
    g.fillRect(0, near + HALL.edgeHeight, GAME_WIDTH, 60);
    g.fillStyle(COLORS.tileGrout, 1);
    for (let y = near + HALL.edgeHeight + 6; y < near + 68; y += 7) g.fillRect(0, y, GAME_WIDTH, 1);
    for (let x = 4; x < GAME_WIDTH; x += 16) g.fillRect(x, near + HALL.edgeHeight, 1, 60);

    // Turmschaft aus Sichtbeton, steht hinten auf dem Umgang
    const top = yOf(10);
    const foot = TOWER_FOOT;
    const w = CORE_R - CORE_L;
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(CORE_L - 1, top - 1, w + 2, foot - top + 2);
    g.fillStyle(0xb4b9c2, 1);
    g.fillRect(CORE_L, top, w, foot - top);
    // Licht von links: helle Kante, rechts eine Schattenseite
    g.fillStyle(0xc9cdd4, 1);
    g.fillRect(CORE_L, top, 6, foot - top);
    g.fillStyle(0xdde0e6, 1);
    g.fillRect(CORE_L, top, 1, foot - top);
    g.fillStyle(0x969ba6, 1);
    g.fillRect(CORE_R - 8, top, 8, foot - top);
    g.fillStyle(0x858a96, 1);
    g.fillRect(CORE_R - 8, top, 1, foot - top);
    // Schalungsfugen und Ankerlöcher
    for (let y = top + 12; y < foot; y += 13) {
      g.fillStyle(0xa4a9b3, 1);
      g.fillRect(CORE_L + 6, y, w - 14, 1);
      g.fillStyle(0x7f8490, 1);
      g.fillRect(CORE_R - 8, y, 8, 1);
      g.fillStyle(0x8e939e, 1);
      for (let x = CORE_L + 10; x < CORE_R - 10; x += 16) g.fillRect(x, y + 6, 1, 1);
    }
    // Beton: Körnung und Flecken (fester Zufall)
    const rng = createRng(77);
    for (let i = 0; i < 160; i++) {
      const x = CORE_L + 1 + Math.floor(rng() * (w - 2));
      const y = top + Math.floor(rng() * (foot - top));
      g.fillStyle(rng() < 0.5 ? 0xa7acb6 : 0xc2c6ce, 1);
      g.fillRect(x, y, 1, 1);
    }
    // Leiter an der Turmvorderseite mit Schatten
    g.fillStyle(0x8e939e, 1);
    g.fillRect(CORE_L + 15, top + 7, 2, foot - top - 10);
    g.fillRect(CORE_L + 27, top + 7, 2, foot - top - 10);
    g.fillStyle(0x6d7482, 1);
    g.fillRect(CORE_L + 14, top + 6, 2, foot - top - 10);
    g.fillRect(CORE_L + 26, top + 6, 2, foot - top - 10);
    for (let y = top + 10; y < foot - 4; y += 6) {
      g.fillStyle(0x6d7482, 1);
      g.fillRect(CORE_L + 14, y, 14, 1);
      g.fillStyle(0x9aa0aa, 1);
      g.fillRect(CORE_L + 16, y + 1, 12, 1);
    }
    // Sockel
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(CORE_L - 5, foot - 7, w + 10, 8);
    g.fillStyle(0x8e939e, 1);
    g.fillRect(CORE_L - 4, foot - 6, w + 8, 6);
    g.fillStyle(0xa9aeb8, 1);
    g.fillRect(CORE_L - 4, foot - 6, w + 8, 1);

    for (const m of H.platforms) {
      const y = yOf(m);
      const tip = PLATFORM_TIP[m];
      // Wasserfahnen unter dem Schild am Schaft
      g.fillStyle(0xa2a7b1, 1);
      for (let k = 0; k < 4; k++) g.fillRect(84 + k * 5, y + 24, 1, 5 + ((k * 5) % 7));
      // Geländer hinten
      g.fillStyle(0x6d7482, 1);
      g.fillRect(CORE_R, y - 23, tip - CORE_R - 14, 1);
      g.fillStyle(0x9aa0aa, 1);
      g.fillRect(CORE_R, y - 24, tip - CORE_R - 14, 1);
      g.fillStyle(0x7d8492, 1);
      g.fillRect(CORE_R, y - 13, tip - CORE_R - 14, 1);
      for (let x = CORE_R + 10; x < tip - 12; x += 18) {
        g.fillStyle(0x7d8492, 1);
        g.fillRect(x, y - 24, 2, 24);
        g.fillStyle(0x9aa0aa, 1);
        g.fillRect(x, y - 24, 1, 24);
      }
      // Konsole unter der Platte mit Schattenseite
      g.fillStyle(COLORS.outline, 1);
      g.fillTriangle(CORE_R - 1, y + 8, CORE_R + 26, y + 8, CORE_R - 1, y + 28);
      g.fillStyle(0x969ba6, 1);
      g.fillTriangle(CORE_R, y + 8, CORE_R + 24, y + 8, CORE_R, y + 26);
      g.fillStyle(0x858a96, 1);
      g.fillTriangle(CORE_R, y + 8, CORE_R + 10, y + 8, CORE_R, y + 18);
      // Platte: Betonkante mit Licht von oben, rutschfester Belag, weiße Stirnkante
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(CORE_R - 2, y - 1, tip - CORE_R + 3, 10);
      g.fillStyle(0xa9aeb8, 1);
      g.fillRect(CORE_R - 1, y, tip - CORE_R + 1, 8);
      g.fillStyle(0x3a6fa8, 1);
      g.fillRect(CORE_R - 1, y, tip - CORE_R + 1, 2);
      g.fillStyle(0x5a8fc8, 1);
      for (let x = CORE_R + 1; x < tip - 3; x += 4) g.fillRect(x, y, 2, 1);
      g.fillStyle(0xc4c8d0, 1);
      g.fillRect(CORE_R - 1, y + 2, tip - CORE_R - 2, 1);
      g.fillStyle(0x7d8290, 1);
      g.fillRect(CORE_R - 1, y + 6, tip - CORE_R - 2, 2);
      g.fillStyle(0xffffff, 1);
      g.fillRect(tip - 3, y, 3, 8);
      g.fillStyle(0xd0d4dc, 1);
      g.fillRect(tip - 3, y + 6, 3, 2);
      // Schild mit der Höhe am Schaft
      const label = HEIGHT_LABEL[m];
      const lw = label.length * 8 + 4;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(LABEL_X - lw / 2 - 1, y + 10, lw + 2, 12);
      g.fillStyle(0x24346b, 1);
      g.fillRect(LABEL_X - lw / 2, y + 11, lw, 10);
      g.fillStyle(0x3a5296, 1);
      g.fillRect(LABEL_X - lw / 2, y + 11, lw, 1);
    }
    // Ganz oben: Geländer und Fahnenmasten (die Fahnen selbst flattern, siehe updateFlags)
    const y10 = yOf(10);
    g.fillStyle(0x7d8492, 1);
    g.fillRect(CORE_L, y10 - 24, 2, 24);
    g.fillRect(CORE_L, y10 - 24, CORE_R - CORE_L, 2);
    g.fillStyle(0x9aa0aa, 1);
    g.fillRect(CORE_L, y10 - 24, CORE_R - CORE_L, 1);
    for (let i = 0; i < 4; i++) {
      const px = CORE_L + 7 + i * 20;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(px - 1, y10 - 77, 3, 53);
      g.fillStyle(0xd0d6de, 1);
      g.fillRect(px, y10 - 76, 1, 52);
      g.fillStyle(0xf7d038, 1);
      g.fillRect(px - 1, y10 - 78, 3, 2);
    }
  }

  /**
   * Tiefenstaffelung im Sprungbecken: nach vorne wird das Wasser tiefer und dunkler,
   * links sieht man die Beckenwand abtauchen, am Grund schimmert die Bodenmarkierung.
   */
  private drawDepth(): void {
    const g = this.depth;
    const H = DIVE_HALL;
    const h = H.poolNearY - H.waterY;
    for (let i = 0; i < h; i++) {
      const y = H.waterY + i;
      const k = i / h;
      g.fillStyle(0x0b2f5c, 0.05 + 0.3 * k * k);
      const x = Math.round(poolLeftAt(y));
      g.fillRect(x, y, GAME_WIDTH - x, 1);
    }
    // Beckenwand links unter Wasser: Fliesenstreifen, der in die Tiefe verblasst
    for (let i = 2; i < h; i++) {
      const y = H.waterY + i;
      const x = Math.round(poolLeftAt(y));
      const fade = 1 - i / h;
      g.fillStyle(0x7fc4ec, 0.35 * fade);
      g.fillRect(x + 2, y, 6, 1);
      g.fillStyle(0x0b2f5c, 0.25);
      g.fillRect(x + 8, y, 2, 1);
      if (i % 6 === 0) {
        g.fillStyle(0x0b2f5c, 0.3 * fade);
        g.fillRect(x + 2, y, 6, 1);
      }
    }
    // Bodenmarkierung (Kreuz) unter der Eintauchstelle
    g.fillStyle(0x0b2f5c, 0.2);
    const cy = H.waterY + 46;
    g.fillRect(232, cy, 120, 3);
    g.fillRect(286, cy - 14, 6, 34);
  }

  /** Hochstühle der Kampfrichter am hinteren Beckenrand */
  private drawChairs(): void {
    const g = this.chairs;
    const H = DIVE_HALL;
    for (const x of H.judgeX) {
      const seat = H.judgeSeatY;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x - 9, seat - 1, 18, 4);
      g.fillRect(x - 8, seat + 2, 2, H.waterY - 4 - seat);
      g.fillRect(x + 6, seat + 2, 2, H.waterY - 4 - seat);
      g.fillRect(x - 11, seat - 16, 3, 16);
      g.fillStyle(0xe8e8f0, 1);
      g.fillRect(x - 8, seat, 16, 2);
      g.fillRect(x - 10, seat - 15, 1, 14);
      // Fußstütze
      g.fillStyle(0x7d8492, 1);
      g.fillRect(x - 7, seat + 9, 14, 1);
    }
  }

  /** Sprudelanlage: Düsen am Beckenboden rauen die Oberfläche auf, unter dem Turm brodelt es */
  private drawSurface(time: number): void {
    const g = this.surface;
    g.clear();
    const H = DIVE_HALL;
    for (let i = 0; i < 26; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const r = h - Math.floor(h);
      const life = (time * (0.6 + r * 0.5) + r * 5) % 1.6;
      if (life > 0.9) continue;
      const y = H.waterY + 3 + Math.floor(r * 70);
      const left = poolLeftAt(y) + 10;
      const x = left + ((i * 53 + Math.floor(r * 400)) % (GAME_WIDTH - left - 6));
      const k = life / 0.9;
      g.lineStyle(1, 0xeaf8ff, 0.75 * (1 - k));
      g.strokeEllipse(Math.round(x), y, 3 + k * 8, 1 + k * 2);
    }
    // Sprudelfeld unter den Plattformen: Bläschen ploppen auf, kleine Schaumkringel
    for (let i = 0; i < 48; i++) {
      const h = Math.sin(i * 78.233 + 1.7) * 43758.5453;
      const r = h - Math.floor(h);
      const life = (time * (1.3 + r) + r * 9) % 1;
      const y = H.waterY + 1 + Math.floor(((i * 37) % 23) * 0.9);
      const x = Math.round(poolLeftAt(y) + 14 + ((i * 29 + Math.floor(r * 97)) % 96));
      if (life < 0.55) {
        g.fillStyle(0xffffff, 0.85 * (1 - life));
        g.fillRect(x, y, life < 0.25 ? 1 : 2, 1);
      } else if (life < 0.7) {
        g.fillStyle(0xeaf8ff, 0.6);
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
      }
    }
    // Glanz an der Wasserlinie
    g.fillStyle(0xbfeaff, 0.5);
    for (let x = Math.round(poolLeftAt(H.waterY)); x < GAME_WIDTH; x += 6) {
      if (Math.sin(x * 0.7 + time * 3) > 0.2) g.fillRect(x, H.waterY, 3, 1);
    }
  }
}
