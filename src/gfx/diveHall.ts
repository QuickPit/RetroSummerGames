import Phaser from 'phaser';
import { COLORS, DEPTH_SKEW, FONT, GAME_WIDTH, PX_PER_M, TRACK_NEAR_Y, skewAt } from '../config';
import type { FlagSpec } from '../data/countries';
import { createRng } from '../sim/cpu';
import { drawFlag } from './flags';
import { HALL, WATER_FRAMES } from './pool';
import { canvasTexture } from './textures';

// Sprunghalle für das Turmspringen: Wand und Dach (Parallaxe 0,5), LED-Tafel, Betonturm,
// Sprungbecken, Ränge und Richterstühle. Statische Teile werden einmal als Textur gerendert.

type Ctx = CanvasRenderingContext2D;
type Gfx = Phaser.GameObjects.Graphics;

/** Texturen der Sprunghalle anlegen (nach createPoolTextures, die Halle nutzt Wasser und Ränge mit) */
export function createDiveHallTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'divewall', 320, DIVE_HALL.wallHeight, drawDiveWall);
}

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

/** Rand oberhalb von y = 0 in den gebackenen Texturen (Fahnenmasten, Aufhängung der Tafel) */
const TOWER_TOP = 110;
const TOWER_TEX_H = 500;
const BOARD_TOP = 10;

/**
 * Zeichnet statische Teile einmal in eine Textur und liefert ein Bild davon.
 * `oy` verschiebt die Zeichnung nach unten, damit nichts über y = 0 abgeschnitten wird.
 */
function bakeImage(scene: Phaser.Scene, key: string, h: number, oy: number, draw: (g: Gfx) => void): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    g.translateCanvas(0, oy);
    draw(g);
    g.generateTexture(key, GAME_WIDTH, h);
    g.destroy();
  }
  return scene.add.image(0, -oy, key).setOrigin(0);
}

/** Sprunghalle für das Turmspringen: Betonturm, Sprungbecken, Publikum und Richterstühle. */
export class DiveHall {
  private readonly scene: Phaser.Scene;
  private readonly wall: Phaser.GameObjects.TileSprite;
  private readonly stands: Phaser.GameObjects.TileSprite;
  private readonly deck: Phaser.GameObjects.TileSprite;
  private readonly water: Phaser.GameObjects.TileSprite;
  private readonly edge: Phaser.GameObjects.TileSprite;
  /** Anzeigetafel mit Lauftext in Orange */
  private readonly board: Phaser.GameObjects.Image;
  private readonly boardLines: Phaser.GameObjects.Text[];
  /** Turm mit Umgang, Tiefenstaffelung und Richterstühle: gebackene Texturen, nur verschoben */
  private readonly tower: Phaser.GameObjects.Image;
  private readonly depth: Phaser.GameObjects.Image;
  private readonly chairs: Phaser.GameObjects.Image;
  private readonly heightLabels: Phaser.GameObjects.Text[];
  /** Sprudel-Kringel auf dem Wasser */
  private readonly surface: Gfx;
  /** Blitzlichter im Publikum */
  private readonly flashGfx: Gfx;
  /** Alles, was unter dem Bildrand verschwindet, wenn die Kamera oben ist */
  private readonly lowParts: Phaser.GameObjects.Components.Visible[];
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
    const boardH = H.board.y + H.board.h + 4 + BOARD_TOP;
    this.board = bakeImage(scene, 'diveboard', boardH, BOARD_TOP, (g) => this.drawBoard(g)).setDepth(-9);
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
    this.depth = bakeImage(scene, 'divedepth', H.poolNearY + 2, 0, (g) => this.drawDepth(g)).setDepth(-5.8);
    this.surface = scene.add.graphics().setDepth(-5.5);
    this.tower = bakeImage(scene, 'divetower', TOWER_TEX_H, TOWER_TOP, (g) => this.drawTower(g)).setDepth(-4);
    this.heightLabels = H.platforms.map((m) =>
      scene.add
        .text(0, 0, HEIGHT_LABEL[m], { fontFamily: FONT, fontSize: '8px', color: '#ffffff' })
        .setOrigin(0.5, 0)
        .setDepth(-3.95),
    );
    this.chairs = bakeImage(scene, 'divechairs', H.waterY + 2, 0, (g) => this.drawChairs(g)).setDepth(-3.5);
    this.edge = scene.add.tileSprite(0, H.poolNearY, GAME_WIDTH, HALL.edgeHeight, 'halledge').setOrigin(0).setDepth(45);
    this.lowParts = [this.stands, this.deck, this.water, this.edge, this.surface, this.chairs, this.depth, this.flashGfx];
    // Die Fahnen setzt die Szene mit setFlags (Nationen des Feldes)
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
    this.board.y = boardY - BOARD_TOP;
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
    this.tower.y = c - TOWER_TOP;
    this.chairs.y = c;
    this.surface.y = c;
    this.depth.y = c;
    this.flashGfx.y = c;
    for (let i = 0; i < H.platforms.length; i++) {
      this.heightLabels[i].setPosition(LABEL_X + 1, H.waterY - H.platforms[i] * PX_PER_M + 12 + c);
    }
    // Unterhalb des Bildes muss nichts gezeichnet werden
    const low = H.standsY + c < 360;
    for (const o of this.lowParts) o.setVisible(low);

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
    for (let i = 0; i < this.flagSlices.length; i++) {
      const slices = this.flagSlices[i];
      const px = CORE_L + 8 + i * 20;
      for (let k = 0; k < slices.length; k++) {
        const amp = (k / FLAG_SLICES) * 1.6;
        const dy = Math.round(Math.sin(time * 5.5 - k * 0.9 + i * 1.3) * amp);
        slices[k].setPosition(px, top + dy);
      }
    }
  }

  /** Blitzlichter im Publikum, je aufgeregter, desto mehr */
  private drawFlashes(dt: number, excitement: number): void {
    const H = DIVE_HALL;
    const g = this.flashGfx;
    g.clear();
    if (excitement >= 0.5 && Math.random() < dt * excitement * 9) {
      this.flashes.push({ x: Math.floor(Math.random() * GAME_WIDTH), y: H.standsY + 3 + Math.floor(Math.random() * 30), age: 0 });
    }
    // Abgelaufene Blitze an Ort und Stelle entfernen (kein neues Array je Bild)
    let n = 0;
    for (const f of this.flashes) {
      f.age += dt;
      const a = 1 - f.age / 0.12;
      if (a <= 0) continue;
      this.flashes[n++] = f;
      g.fillStyle(0xffffff, a);
      g.fillRect(f.x - 1, f.y, 3, 1);
      g.fillRect(f.x, f.y - 1, 1, 3);
      g.fillStyle(0xfff6c8, a * 0.35);
      g.fillRect(f.x - 3, f.y - 2, 7, 5);
    }
    this.flashes.length = n;
  }

  private drawBoard(g: Gfx): void {
    const { x, y, w } = DIVE_HALL.board;
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
  private drawTower(g: Gfx): void {
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
  private drawDepth(g: Gfx): void {
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
  private drawChairs(g: Gfx): void {
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
