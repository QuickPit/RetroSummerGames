import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH, LANE_COUNT, LANE_DEPTH, PX_PER_M, TRACK_FAR_Y, TRACK_NEAR_Y, laneCenterY, skewAt } from '../config';
import { createRng } from '../sim/cpu';
import { SWIM } from '../sim/swim';
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
      const k = c < 0.12 ? 0.75 : c < 0.25 ? 0.3 : 0;
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
  /** Beckenboden, Wände und Umgang jenseits der Wände */
  private readonly floor: Gfx;
  /** Leinen 0 (hinten) … 4 (vorne) */
  private readonly ropes: Gfx[] = [];
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
  private crowdTimer = 0;
  private crowdFrame = 0;
  private camPx = 0;

  constructor(scene: Phaser.Scene) {
    this.wall = scene.add.tileSprite(0, 0, GAME_WIDTH, HALL.standsY, 'hallwall').setOrigin(0).setDepth(-10);
    this.stands = scene.add
      .tileSprite(0, HALL.standsY, GAME_WIDTH, HALL.standsHeight, 'hallstands0')
      .setOrigin(0)
      .setDepth(-8);
    this.boards = scene.add.tileSprite(0, HALL.boardsY, GAME_WIDTH, HALL.boardsHeight, 'hallboards').setOrigin(0).setDepth(-7);
    this.deck = scene.add.tileSprite(0, HALL.deckY, GAME_WIDTH, HALL.deckHeight, 'halldeck').setOrigin(0).setDepth(-7);
    this.water = scene.add.tileSprite(0, TRACK_FAR_Y, GAME_WIDTH, HALL.waterHeight, 'water0').setOrigin(0).setDepth(-6);
    this.edge = scene.add.tileSprite(0, TRACK_NEAR_Y, GAME_WIDTH, HALL.edgeHeight, 'halledge').setOrigin(0).setDepth(45);
    this.floor = scene.add.graphics().setDepth(-5);
    for (let k = 0; k <= LANE_COUNT; k++) this.ropes.push(scene.add.graphics().setDepth(k * 10));
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

  /** Anschlag im Ziel: Platte blitzt auf und zeigt den Platz */
  touch(lane: number, place: number, time: number): void {
    this.touches[lane] = { place, at: time };
  }

  /**
   * @param camPx Kameraposition in Welt-Pixeln
   * @param excitement 0..1 – wie wild das Publikum jubelt
   * @param clock Zeit auf der Hallenuhr
   */
  update(camPx: number, dt: number, time: number, excitement: number, clock: number): void {
    this.camPx = camPx;
    this.wall.tilePositionX = camPx * 0.1;
    this.stands.tilePositionX = camPx * 0.55;
    this.boards.tilePositionX = camPx * 0.95;
    this.deck.tilePositionX = camPx;
    this.edge.tilePositionX = camPx;
    // Das Wasser driftet leicht gegen die Kamera
    this.water.tilePositionX = camPx + time * 4;

    this.waterTimer += dt;
    if (this.waterTimer >= 1 / 6) {
      this.waterTimer = 0;
      this.waterFrame = (this.waterFrame + 1) % WATER_FRAMES;
      this.water.setTexture(`water${this.waterFrame}`);
    }
    this.crowdTimer += dt;
    if (this.crowdTimer >= Phaser.Math.Linear(0.6, 0.1, excitement)) {
      this.crowdTimer = 0;
      this.crowdFrame = 1 - this.crowdFrame;
      this.stands.setTexture(`hallstands${this.crowdFrame}`);
    }

    this.drawClock(clock);
    this.drawFloor();
    for (let k = 0; k <= LANE_COUNT; k++) this.drawRope(k, time);
    for (let lane = 0; lane < LANE_COUNT; lane++) this.drawLane(lane, time);
    this.drawFlags();
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

  private drawClock(clock: number): void {
    const g = this.clockGfx;
    g.clear();
    const cx = Math.round(150 - this.camPx * 0.1);
    g.fillStyle(0x5d6278, 1);
    g.fillRect(cx - 38, 22, 76, 30);
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(cx - 36, 24, 72, 26);
    g.fillStyle(0x5d6278, 1);
    g.fillRect(cx - 1, 52, 2, 8);
    this.clockText.setText(clock.toFixed(2)).setPosition(cx + 1, 29);
  }

  private drawFloor(): void {
    const g = this.floor;
    g.clear();
    const top = TRACK_FAR_Y;
    const bottom = TRACK_NEAR_Y;
    const L = SWIM.poolLength;

    // Bodenstreifen in Bahnmitte mit „T“ zwei Meter vor jeder Wand
    g.fillStyle(COLORS.waterDark, 0.55);
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const y = laneCenterY(lane) + 2;
      this.band(g, 2, L - 2, y - 1, y + 2);
      for (const m of [2, L - 2]) this.band(g, m - 0.12, m + 0.12, y - 5, y + 6);
    }

    // Umgang hinter den Wänden
    for (const [m0, m1] of [
      [-12, 0],
      [L, L + 12],
    ] as const) {
      g.fillStyle(COLORS.tile, 1);
      this.band(g, m0, m1, top, bottom);
      g.fillStyle(COLORS.tileGrout, 1);
      for (let y = top + 6; y < bottom; y += 7) this.band(g, m0, m1, y, y + 1);
      for (let m = m0 + 0.6; m < m1; m += 0.6) this.band(g, m, m + 0.04, top, bottom);
    }
    // Beckenkante an beiden Wänden
    for (const [m, dir] of [
      [0, -1],
      [L, 1],
    ] as const) {
      g.fillStyle(0xffffff, 1);
      this.band(g, m + dir * 0.16, m, top, bottom);
      g.fillStyle(COLORS.waterDark, 0.7);
      this.band(g, m, m - dir * 0.1, top, bottom);
    }
  }

  private drawRope(k: number, time: number): void {
    const g = this.ropes[k];
    g.clear();
    const outer = k === 0 || k === LANE_COUNT;
    const y = TRACK_FAR_Y + k * LANE_DEPTH + (k === 0 ? 2 : k === LANE_COUNT ? -3 : 0);
    const L = SWIM.poolLength;
    // Seil
    g.fillStyle(0x23304a, 1);
    const x0 = Math.max(-4, this.sx(0, y));
    const x1 = Math.min(GAME_WIDTH + 4, this.sx(L, y));
    if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
    const step = 0.25;
    for (let i = 0; i * step <= L; i++) {
      const m = i * step;
      const x = this.sx(m, y);
      if (x < -6 || x > GAME_WIDTH + 6) continue;
      const nearWall = m < 5 || m > L - 5;
      const mark = Math.abs(m - HALL.markAt) < step / 2 || Math.abs(m - (L - HALL.markAt)) < step / 2;
      const color = mark ? COLORS.yellow : nearWall ? COLORS.ropeRed : i % 2 ? COLORS.ropeWhite : COLORS.ropeBlue;
      const wobble = Math.round(Math.sin(time * 2.6 + m * 1.3 + k * 0.7) * (outer ? 0.6 : 1));
      g.fillStyle(color, 1);
      g.fillRect(x - 2, y - 1 + wobble, 4, 3);
      g.fillStyle(0x000000, 0.25);
      g.fillRect(x - 2, y + 1 + wobble, 4, 1);
    }
  }

  private drawLane(lane: number, time: number): void {
    const g = this.lanes[lane];
    g.clear();
    const base = laneCenterY(lane) + 6;
    const topY = blockTopY(lane);
    const front = this.sx(0, base);
    const x = front - HALL.blockWidth;
    const label = this.laneLabels[lane];
    const place = this.placeLabels[lane];
    if (front < -30 || front > GAME_WIDTH + 30) {
      label.setVisible(false);
      place.setVisible(false);
    } else {
      // Startblock: Sockel, schräge Trittfläche, Nummernschild
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x - 1, topY - 1, HALL.blockWidth + 2, HALL.blockHeight + 1);
      g.fillStyle(0x8e98a8, 1);
      g.fillRect(x, topY + 3, HALL.blockWidth, HALL.blockHeight - 3);
      g.fillStyle(0x6c7686, 1);
      g.fillRect(x, base - 3, HALL.blockWidth, 3);
      g.fillStyle(0x3fa0d8, 1);
      g.fillRect(x, topY, HALL.blockWidth, 3);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x + 3, topY + 5, 8, 9);
      label.setVisible(true).setPosition(x + 7, topY + 10);
      // Haltegriff für den Rückenstart
      g.fillStyle(0xc9d1d9, 1);
      g.fillRect(x + HALL.blockWidth - 2, topY - 4, 1, 4);
    }

    // Anschlagplatten an beiden Wänden
    const farY = TRACK_FAR_Y + lane * LANE_DEPTH + 5;
    const nearY = farY + LANE_DEPTH - 9;
    const touched = this.touches[lane];
    const flash = touched !== null && time - touched.at < 0.8 && Math.floor((time - touched.at) * 10) % 2 === 0;
    for (const m of [0, SWIM.poolLength]) {
      const inward = m === 0 ? 1 : -1;
      g.fillStyle(COLORS.outline, 1);
      this.band(g, m, m + inward * 0.14, farY - 1, nearY + 1);
      g.fillStyle(m === 0 && flash ? 0xffffff : COLORS.yellow, 1);
      this.band(g, m, m + inward * 0.09, farY, nearY);
    }
    if (touched !== null && front > -30 && front < GAME_WIDTH + 30) {
      place.setVisible(true).setText(String(touched.place)).setPosition(this.sx(-0.3, topY - 8), topY - 8);
    } else {
      place.setVisible(false);
    }
  }

  /** Rückenwimpel quer über das Becken, 5 m vor jeder Wand */
  private drawFlags(): void {
    const g = this.front;
    g.clear();
    const colors = [COLORS.red, 0xffffff, COLORS.ropeBlue];
    for (const m of [HALL.flagsAt, SWIM.poolLength - HALL.flagsAt]) {
      const backY = TRACK_FAR_Y - 6;
      const frontY = TRACK_NEAR_Y + 6;
      const bx = this.sx(m, backY);
      const fx = this.sx(m, frontY);
      if (Math.max(bx, fx) < -10 || Math.min(bx, fx) > GAME_WIDTH + 10) continue;
      const lineTop = backY - 40;
      const lineBottom = frontY - 34;
      // Pfosten
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(bx - 1, lineTop, 3, backY - lineTop);
      g.fillRect(fx - 1, lineBottom, 3, frontY - lineBottom);
      g.fillStyle(0xd0d6de, 1);
      g.fillRect(bx, lineTop, 1, backY - lineTop);
      g.fillRect(fx, lineBottom, 1, frontY - lineBottom);
      // Leine mit Wimpeln
      g.lineStyle(1, 0x23304a, 1);
      g.lineBetween(bx, lineTop, fx, lineBottom);
      const n = 16;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const px = Math.round(bx + (fx - bx) * t);
        const py = Math.round(lineTop + (lineBottom - lineTop) * t);
        g.fillStyle(colors[i % colors.length], 1);
        g.fillTriangle(px - 3, py, px + 3, py, px, py + 5);
      }
    }
  }
}
