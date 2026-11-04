import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';
import type { FlagSpec } from '../data/countries';
import { createRng } from '../sim/cpu';
import { drawFlag } from './flags';
import { canvasTexture } from './textures';

// Grafik der Abschlussfeier: Nachthimmel, Flutlichtmasten, Podest, Fahnenmasten,
// Pokal, Feuerwerk, Konfetti und Blitzlichter im Publikum. Alle Effekte arbeiten
// mit festen Pools und werden je Bild in wenige Graphics-Objekte gezeichnet.

type Gfx = Phaser.GameObjects.Graphics;

export const NIGHT = {
  skyH: 140,
  standsY: 126,
  standsH: 74,
  boardsY: 200,
  grassY: 214,
  /** Tönung der Tagestexturen für die Nacht */
  standsTint: 0x6c68a0,
  boardsTint: 0x9a96c4,
  grassTint: 0x5c6c8c,
} as const;

/** Nachthimmel mit Verlauf, Sternen und Mondsichel */
export function createNightTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'nightSky', GAME_WIDTH, NIGHT.skyH, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, NIGHT.skyH);
    grd.addColorStop(0, '#06061a');
    grd.addColorStop(0.55, '#141238');
    grd.addColorStop(0.85, '#2a2052');
    grd.addColorStop(1, '#4a2f62');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, GAME_WIDTH, NIGHT.skyH);
    const rng = createRng(1984);
    for (let i = 0; i < 110; i++) {
      const x = Math.floor(rng() * GAME_WIDTH);
      const y = Math.floor(rng() * (NIGHT.skyH - 20));
      const b = 120 + Math.floor(rng() * 135) - y;
      ctx.fillStyle = `rgb(${b},${b},${Math.min(255, b + 30)})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Ein paar helle Kreuzsterne
    for (let i = 0; i < 7; i++) {
      const x = 20 + Math.floor(rng() * (GAME_WIDTH - 40));
      const y = 6 + Math.floor(rng() * 60);
      ctx.fillStyle = '#8890c8';
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
    }
    // Mondsichel oben rechts
    ctx.fillStyle = '#f4ecc8';
    ctx.beginPath();
    ctx.arc(588, 20, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a20';
    ctx.beginPath();
    ctx.arc(592, 17, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Flagge als eigene Textur (28×18 inkl. Rahmen) – Grundlage für die wehenden Streifen */
export function createFlagTexture(scene: Phaser.Scene, key: string, spec: FlagSpec): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({}, false);
  drawFlag(g, spec, 1, 1, FLAG_W - 2, FLAG_H - 2);
  // Licht von oben links: obere Kante etwas heller
  g.fillStyle(0xffffff, 0.25);
  g.fillRect(1, 1, FLAG_W - 2, 1);
  g.generateTexture(key, FLAG_W, FLAG_H);
  g.destroy();
}

export const FLAG_W = 28;
export const FLAG_H = 18;

// ------------------------------------------------------------ Kulisse

/** Flutlichtmast mit Gitterstruktur und Lampenfeld; (x, top) = Mitte des Lampenfelds */
export function drawFloodlightTower(g: Gfx, x: number, top: number, bottom: number): void {
  const half = 3;
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - half - 1, top + 6, half * 2 + 3, bottom - top - 6);
  g.fillStyle(0x4a5070, 1);
  g.fillRect(x - half, top + 6, 1, bottom - top - 6);
  g.fillRect(x + half, top + 6, 1, bottom - top - 6);
  // Diagonale Streben
  for (let y = top + 8; y < bottom - 4; y += 8) {
    for (let k = 0; k < 7; k++) {
      g.fillRect(x - half + k, y + k, 1, 1);
      g.fillRect(x + half - k, y + k, 1, 1);
    }
  }
  // Lampenfeld 22×12 mit 3×2 Lampen
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 12, top - 6, 24, 13);
  g.fillStyle(0x3a3f55, 1);
  g.fillRect(x - 11, top - 5, 22, 11);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const lx = x - 10 + c * 7;
      const ly = top - 4 + r * 5;
      g.fillStyle(0xfff8d0, 1);
      g.fillRect(lx, ly, 6, 4);
      g.fillStyle(0xffffff, 1);
      g.fillRect(lx + 1, ly + 1, 2, 1);
    }
  }
}

/** Leuchtender Hof um die Lampen (additiv zeichnen) */
export function drawLampGlow(g: Gfx, x: number, top: number, pulse: number): void {
  g.fillStyle(0xfff0b0, 0.07 + 0.02 * pulse);
  g.fillCircle(x, top, 26);
  g.fillStyle(0xfff0b0, 0.1);
  g.fillCircle(x, top, 16);
}

/** Lichtkegel von (x0, y0) auf einen Punkt mit halber Breite `half` (additiv zeichnen) */
export function drawLightCone(g: Gfx, x0: number, y0: number, x1: number, y1: number, half: number, color: number, alpha: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  g.fillStyle(color, alpha);
  g.fillTriangle(x0, y0, x1 + nx * half, y1 + ny * half, x1 - nx * half, y1 - ny * half);
  // Hellerer Kern
  g.fillStyle(color, alpha * 0.8);
  g.fillTriangle(x0, y0, x1 + nx * half * 0.45, y1 + ny * half * 0.45, x1 - nx * half * 0.45, y1 - ny * half * 0.45);
}

// ------------------------------------------------------------ Podest

export const PODIUM_MEDALS = [COLORS.gold, COLORS.silver, COLORS.bronze];

/**
 * Siegertreppchen-Stufe mit Draufsicht (4 px), Vorderseite, Medaillenstreifen
 * und dunklerer rechter Kante. (cx, base) = Mitte unten.
 */
export function drawPodiumStep(g: Gfx, cx: number, base: number, w: number, h: number, rank: number): void {
  const x = Math.round(cx - w / 2);
  const top = base - h;
  const medal = PODIUM_MEDALS[rank - 1] ?? COLORS.bronze;
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 1, top - 5, w + 2, h + 6);
  // Draufsicht
  g.fillStyle(0xf6f6fb, 1);
  g.fillRect(x, top - 4, w, 4);
  g.fillStyle(0xffffff, 1);
  g.fillRect(x, top - 4, w, 1);
  // Vorderseite
  g.fillStyle(0xd8dae6, 1);
  g.fillRect(x, top, w, h);
  g.fillStyle(0xb4b8cc, 1);
  g.fillRect(x + w - 3, top, 3, h);
  g.fillRect(x, base - 3, w, 3);
  // Medaillenstreifen unter der Kante
  g.fillStyle(medal, 1);
  g.fillRect(x, top, w, 3);
  g.fillStyle(0xffffff, 0.45);
  g.fillRect(x, top, w, 1);
  // Plakette für die Ziffer
  g.fillStyle(0xbcc0d2, 1);
  g.fillRect(Math.round(cx) - 11, top + 7, 22, 20);
  g.fillStyle(0xeeeff6, 1);
  g.fillRect(Math.round(cx) - 10, top + 8, 20, 18);
}

/** Fahnenmast mit goldener Kugel und Leine; (x, top) = Mastspitze */
export function drawFlagpole(g: Gfx, x: number, top: number, bottom: number, flagTop: number): void {
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 2, top, 4, bottom - top);
  g.fillStyle(0xd8dce8, 1);
  g.fillRect(x - 1, top, 1, bottom - top);
  g.fillStyle(0x8a90a8, 1);
  g.fillRect(x, top, 1, bottom - top);
  // Kugel
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(x, top - 2, 3);
  g.fillStyle(COLORS.gold, 1);
  g.fillCircle(x, top - 2, 2);
  g.fillStyle(0xffffff, 1);
  g.fillRect(x - 1, top - 3, 1, 1);
  // Leine: von der Spitze zur Flagge und vom Flaggenende hinunter
  g.fillStyle(0xe8e8f0, 0.8);
  g.fillRect(x + 2, top, 1, Math.max(0, flagTop - top));
  g.fillRect(x + 2, flagTop + FLAG_H, 1, Math.max(0, bottom - 8 - flagTop - FLAG_H));
  // Sockel
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 4, bottom - 3, 8, 3);
  g.fillStyle(0x6b7088, 1);
  g.fillRect(x - 3, bottom - 2, 6, 1);
}

/** Konfettikanone (schräges Rohr auf Sockel), (x, y) = Mitte unten, dir = Neigung ±1 */
export function drawConfettiCannon(g: Gfx, x: number, y: number, dir: number): void {
  const rows = 11;
  for (const [pass, w, color] of [
    [0, 6, COLORS.outline],
    [1, 4, 0xe8442e],
  ] as const) {
    for (let k = 0; k < rows; k++) {
      const cx = Math.round(x + dir * k * 0.45);
      g.fillStyle(k >= rows - 2 && pass === 1 ? COLORS.gold : color, 1);
      g.fillRect(cx - w / 2, y - 5 - k - pass, w, 1 + (pass === 0 ? 2 : 0));
    }
  }
  // Glanzlinie links
  g.fillStyle(0xff9a8a, 1);
  for (let k = 1; k < rows - 2; k++) g.fillRect(Math.round(x + dir * k * 0.45) - 1, y - 6 - k, 1, 1);
  // Sockel
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 5, y - 6, 10, 6);
  g.fillStyle(0x4a5070, 1);
  g.fillRect(x - 4, y - 5, 8, 4);
  g.fillStyle(0x6b7090, 1);
  g.fillRect(x - 4, y - 5, 8, 1);
}

// Pokal 15×15: o Kontur, Y Gold, L hell, W Glanz, D dunkel, B/b Sockel
const TROPHY = [
  '...ooooooooo...',
  '..oLLLLLLLLLo..',
  'oooWYYYYYYYDooo',
  'oYoWYYYYYYYDoYo',
  'oYooWYYYYYDooYo',
  '.oYooWYYYDooYo.',
  '..oooWYYYDooo..',
  '.....oWYDo.....',
  '......oYo......',
  '......oDo......',
  '.....oWYDo.....',
  '....oLLLLLo....',
  '...oBBBBBBBo...',
  '...oBbbbbbBo...',
  '...ooooooooo...',
];
const TROPHY_COLORS: Record<string, number> = {
  o: COLORS.outline,
  Y: COLORS.gold,
  L: 0xffe27a,
  W: 0xfff6c8,
  D: 0xb8862a,
  B: 0x6a4428,
  b: 0x472c18,
};

/** Pokal; (x, bottom) = Mitte der Unterkante. `time` lässt einen Glanzpunkt funkeln. */
export function drawTrophy(g: Gfx, x: number, bottom: number, time: number): void {
  const x0 = Math.round(x) - 7;
  const y0 = Math.round(bottom) - TROPHY.length;
  TROPHY.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = TROPHY_COLORS[row[i]];
      if (c === undefined) continue;
      g.fillStyle(c, 1);
      g.fillRect(x0 + i, y0 + j, 1, 1);
    }
  });
  // Funkeln
  const t = time % 1.6;
  if (t < 0.4) {
    const a = 1 - Math.abs(t - 0.2) / 0.2;
    g.fillStyle(0xffffff, a);
    g.fillRect(x0 + 4, y0 + 1, 1, 5);
    g.fillRect(x0 + 2, y0 + 3, 5, 1);
  }
}

// ------------------------------------------------------------ Feuerwerk

const SPARKS = 960;
const ROCKETS = 8;
const GRAVITY = 34;

export type BurstShape = 'peony' | 'ring' | 'willow' | 'double';

export const FIREWORK_COLORS = [0xff4a4a, 0xffd23f, 0x4dff7a, 0x4aa8ff, 0xff6ad5, 0xffffff, 0xb070ff, 0xff9a2e] as const;

interface Rocket {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  vx: number;
  shape: BurstShape;
  colors: [number, number];
}

/**
 * Feuerwerk mit festem Funken-Ringpuffer: neue Funken überschreiben die ältesten,
 * es entstehen also nie neue Objekte.
 */
export class Fireworks {
  private readonly x = new Float32Array(SPARKS);
  private readonly y = new Float32Array(SPARKS);
  private readonly vx = new Float32Array(SPARKS);
  private readonly vy = new Float32Array(SPARKS);
  private readonly life = new Float32Array(SPARKS);
  private readonly maxLife = new Float32Array(SPARKS);
  private readonly color = new Uint32Array(SPARKS);
  /** 0 = Schweif, 1 = Stern, 2 = Trauerweide (schwer, mit Glitzern) */
  private readonly kind = new Uint8Array(SPARKS);
  private cursor = 0;
  private readonly rockets: Rocket[] = Array.from({ length: ROCKETS }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    shape: 'peony' as BurstShape,
    colors: [0xffffff, 0xffffff] as [number, number],
  }));
  /** Aufhellung des Himmels nach einer Explosion */
  flash = 0;
  flashColor = 0xffffff;
  private readonly rng: () => number;

  constructor(seed = 7) {
    this.rng = createRng(seed);
  }

  /** Startet eine Rakete vom Boden (startY) zur Höhe targetY. false = alle Raketen unterwegs. */
  launch(x: number, startY: number, targetY: number, shape: BurstShape, colors: [number, number]): boolean {
    const r = this.rockets.find((k) => !k.active);
    if (!r) return false;
    r.active = true;
    r.x = x;
    r.y = startY;
    r.vx = (this.rng() - 0.5) * 12;
    r.vy = -Math.sqrt(2 * GRAVITY * 1.6 * (startY - targetY));
    r.shape = shape;
    r.colors = colors;
    return true;
  }

  /** Zufällige Rakete; liefert false, wenn keine frei war */
  launchRandom(startY: number, minX = 50, maxX = GAME_WIDTH - 50): boolean {
    const rng = this.rng;
    const pick = () => FIREWORK_COLORS[Math.floor(rng() * FIREWORK_COLORS.length)];
    const shapes: BurstShape[] = ['peony', 'peony', 'ring', 'willow', 'double'];
    const shape = shapes[Math.floor(rng() * shapes.length)];
    const c1 = shape === 'willow' ? 0xffd23f : pick();
    const c2 = rng() < 0.5 ? c1 : pick();
    return this.launch(minX + rng() * (maxX - minX), startY, 30 + rng() * 60, shape, [c1, c2]);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, color: number, kind: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % SPARKS;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.color[i] = color;
    this.kind[i] = kind;
  }

  private explode(r: Rocket): void {
    const rng = this.rng;
    const [c1, c2] = r.colors;
    const n = r.shape === 'willow' ? 56 : r.shape === 'double' ? 72 : 64;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng() * 0.12;
      let speed: number;
      let color = k % 2 === 0 ? c1 : c2;
      let kind = 1;
      let life = 1.3 + rng() * 0.5;
      switch (r.shape) {
        case 'ring':
          speed = 78 + rng() * 5;
          break;
        case 'double':
          speed = k % 2 === 0 ? 84 : 44;
          color = k % 2 === 0 ? c1 : c2;
          break;
        case 'willow':
          speed = 40 + rng() * 34;
          kind = 2;
          life = 2.2 + rng() * 0.6;
          break;
        default:
          speed = 24 + Math.sqrt(rng()) * 64;
      }
      this.spawn(r.x, r.y, Math.cos(a) * speed, Math.sin(a) * speed * 0.9, life, color, kind);
    }
    this.flash = 1;
    this.flashColor = c1;
  }

  /** Simuliert dt Sekunden; liefert die Zahl der Explosionen (für den Klang) */
  update(dt: number): number {
    let bangs = 0;
    for (const r of this.rockets) {
      if (!r.active) continue;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy += GRAVITY * 1.6 * dt;
      // Schweif aus kleinen Funken
      this.spawn(r.x, r.y + 2, (this.rng() - 0.5) * 6, 8 + this.rng() * 6, 0.35 + this.rng() * 0.2, 0xffb050, 0);
      if (r.vy >= -10) {
        r.active = false;
        this.explode(r);
        bangs++;
      }
    }
    const drag = Math.max(0, 1 - 1.3 * dt);
    for (let i = 0; i < SPARKS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const heavy = this.kind[i] === 2;
      this.vx[i] *= heavy ? Math.max(0, 1 - 2.2 * dt) : drag;
      this.vy[i] = this.vy[i] * (heavy ? Math.max(0, 1 - 2.2 * dt) : drag) + GRAVITY * (heavy ? 0.9 : 0.6) * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    return bangs;
  }

  /** Zeichnet Himmelsaufhellung, Raketen und Funken */
  draw(g: Gfx, skyHeight: number): void {
    if (this.flash > 0) {
      g.fillStyle(this.flashColor, 0.08 * this.flash);
      g.fillRect(0, 0, GAME_WIDTH, skyHeight);
    }
    for (const r of this.rockets) {
      if (!r.active) continue;
      g.fillStyle(0xfff4d0, 1);
      g.fillRect(Math.round(r.x), Math.round(r.y), 1, 2);
    }
    for (let i = 0; i < SPARKS; i++) {
      const life = this.life[i];
      if (life <= 0) continue;
      const f = life / this.maxLife[i];
      const kind = this.kind[i];
      // Gegen Ende knistern die Sterne (flackern)
      if (kind !== 0 && f < 0.3 && this.rng() < 0.45) continue;
      const x = Math.round(this.x[i]);
      const y = Math.round(this.y[i]);
      if (kind === 0) {
        g.fillStyle(this.color[i], f * 0.8);
        g.fillRect(x, y, 1, 1);
      } else if (f > 0.5) {
        // Frisch explodiert: 2×2 mit hellem Kern
        g.fillStyle(this.color[i], 1);
        g.fillRect(x, y, 2, 2);
        g.fillStyle(0xffffff, 0.8);
        g.fillRect(x, y, 1, 1);
      } else {
        g.fillStyle(this.color[i], Math.min(1, 0.35 + f * 1.4));
        g.fillRect(x, y, 1, kind === 2 ? 2 : 1);
      }
    }
  }

  /** Anzahl lebender Funken (für Tests der Pool-Größe) */
  liveSparks(): number {
    let n = 0;
    for (let i = 0; i < SPARKS; i++) if (this.life[i] > 0) n++;
    return n;
  }
}

// ------------------------------------------------------------ Konfetti

const CONFETTI = 96;
const CONFETTI_COLORS = [0xff4a4a, 0xffd23f, 0x4dff7a, 0x4aa8ff, 0xff6ad5, 0xffffff, 0xff9a2e];

/**
 * Konfetti aus festem Pool: zuerst aus zwei Kanonen neben dem Podest geschossen,
 * danach als Regen – Schnipsel, die unten ankommen, starten oben neu.
 */
export class Confetti {
  private readonly x = new Float32Array(CONFETTI);
  private readonly y = new Float32Array(CONFETTI);
  private readonly vx = new Float32Array(CONFETTI);
  private readonly vy = new Float32Array(CONFETTI);
  private readonly phase = new Float32Array(CONFETTI);
  private readonly fall = new Float32Array(CONFETTI);
  private readonly color = new Uint32Array(CONFETTI);
  private readonly rng = createRng(31);
  private active = false;
  private time = 0;

  constructor(
    private readonly minX: number,
    private readonly maxX: number,
    private readonly floor: number,
  ) {}

  /** Kanonen bei (x, y) für jede Hälfte des Pools, schräg nach oben zur Mitte */
  shoot(cannons: { x: number; y: number; dir: number }[]): void {
    this.active = true;
    for (let i = 0; i < CONFETTI; i++) {
      const c = cannons[i % cannons.length];
      const a = -Math.PI / 2 + c.dir * (0.15 + this.rng() * 0.45);
      const speed = 110 + this.rng() * 90;
      this.setPiece(i, c.x, c.y, Math.cos(a) * speed, Math.sin(a) * speed);
    }
  }

  private setPiece(i: number, x: number, y: number, vx: number, vy: number): void {
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.phase[i] = this.rng() * Math.PI * 2;
    this.fall[i] = 14 + this.rng() * 16;
    this.color[i] = CONFETTI_COLORS[Math.floor(this.rng() * CONFETTI_COLORS.length)];
  }

  update(dt: number): void {
    if (!this.active) return;
    this.time += dt;
    const drag = Math.max(0, 1 - 2.4 * dt);
    for (let i = 0; i < CONFETTI; i++) {
      this.vx[i] *= drag;
      // Schwerkraft bis zur Sinkgeschwindigkeit eines Papierschnipsels
      this.vy[i] = Math.min(this.fall[i], this.vy[i] * drag + 140 * dt);
      this.x[i] += (this.vx[i] + Math.sin(this.time * 2.2 + this.phase[i]) * 14) * dt;
      this.y[i] += this.vy[i] * dt;
      if (this.y[i] > this.floor) {
        const x = this.minX + this.rng() * (this.maxX - this.minX);
        this.setPiece(i, x, -4 - this.rng() * 40, 0, this.fall[i]);
      }
    }
  }

  draw(g: Gfx): void {
    if (!this.active) return;
    for (let i = 0; i < CONFETTI; i++) {
      if (this.y[i] < -4) continue;
      // Schnipsel drehen sich: abwechselnd breit, schmal und Kante (dunkler)
      const spin = Math.sin(this.time * 7 + this.phase[i] * 3);
      const wide = Math.abs(spin) > 0.4;
      g.fillStyle(this.color[i], spin > 0 ? 1 : 0.7);
      g.fillRect(Math.round(this.x[i]), Math.round(this.y[i]), wide ? 2 : 1, wide ? 1 : 2);
    }
  }
}

// ------------------------------------------------------------ Publikum

const FLASHES = 14;

/** Blitzlichter und Wunderkerzen im Publikum (fester Pool, gezeichnet in ein Graphics) */
export class CrowdLights {
  private readonly fx = new Float32Array(FLASHES);
  private readonly fy = new Float32Array(FLASHES);
  private readonly life = new Float32Array(FLASHES);
  private readonly sparklers: { x: number; y: number; phase: number }[] = [];
  private readonly rng = createRng(77);
  private time = 0;
  /** Blitze pro Sekunde */
  rate = 4;

  constructor(
    private readonly top: number,
    private readonly bottom: number,
  ) {
    for (let i = 0; i < 11; i++) {
      this.sparklers.push({
        x: 30 + ((i * 577) % 580) + this.rng() * 10,
        y: top + 14 + this.rng() * (bottom - top - 34),
        phase: this.rng() * Math.PI * 2,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < FLASHES; i++) this.life[i] = Math.max(0, this.life[i] - dt);
    if (this.rng() < this.rate * dt) {
      const i = this.life.findIndex((l) => l <= 0);
      if (i >= 0) {
        this.fx[i] = 8 + this.rng() * (GAME_WIDTH - 16);
        this.fy[i] = this.top + 8 + this.rng() * (this.bottom - this.top - 22);
        this.life[i] = 0.14;
      }
    }
  }

  draw(g: Gfx): void {
    for (let i = 0; i < FLASHES; i++) {
      const l = this.life[i];
      if (l <= 0) continue;
      const a = l / 0.14;
      const x = Math.round(this.fx[i]);
      const y = Math.round(this.fy[i]);
      g.fillStyle(0xffffff, 0.35 * a);
      g.fillRect(x - 2, y - 2, 5, 5);
      g.fillStyle(0xffffff, a);
      g.fillRect(x - 3, y, 7, 1);
      g.fillRect(x, y - 3, 1, 7);
    }
    for (const s of this.sparklers) {
      // Wunderkerze wird hin und her geschwenkt
      const x = Math.round(s.x + Math.sin(this.time * 2.5 + s.phase) * 3);
      const y = Math.round(s.y + Math.cos(this.time * 2.5 + s.phase) * 1.5);
      g.fillStyle(0x6b6b78, 1);
      g.fillRect(x, y + 1, 1, 3);
      g.fillStyle(0xfff4c0, 1);
      g.fillRect(x, y, 1, 1);
      for (let k = 0; k < 5; k++) {
        const a = this.rng() * Math.PI * 2;
        const d = 1 + this.rng() * 4;
        g.fillStyle(this.rng() < 0.5 ? 0xffd23f : 0xffffff, 0.6 + this.rng() * 0.4);
        g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 1, 1);
      }
    }
  }
}
