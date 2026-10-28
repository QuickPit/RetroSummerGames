import type Phaser from 'phaser';
import { GAME_WIDTH, LANE_COUNT, LANE_DEPTH } from '../config';
import { createRng } from '../sim/cpu';

// Alle Grafiken werden beim Start per Canvas erzeugt – es gibt keine
// externen Bilddateien. Jede Funktion legt eine Phaser-Textur an.

type Ctx = CanvasRenderingContext2D;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Textur ${key} konnte nicht erzeugt werden`);
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
}

export const TRACK_TEX_HEIGHT = LANE_COUNT * LANE_DEPTH + 6;
export const STANDS_HEIGHT = 150;

export function createTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'sky', GAME_WIDTH, 120, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, 120);
    grd.addColorStop(0, '#2f6fd0');
    grd.addColorStop(0.7, '#7fc0f0');
    grd.addColorStop(1, '#c4e6f7');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, GAME_WIDTH, 120);
    // Sonne
    ctx.fillStyle = 'rgba(255, 244, 190, 0.35)';
    ctx.beginPath();
    ctx.arc(540, 28, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c8';
    ctx.beginPath();
    ctx.arc(540, 28, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'clouds', 400, 50, (ctx) => {
    const cloud = (x: number, y: number, s: number) => {
      ctx.fillStyle = '#ffffff';
      for (const [dx, dy, r] of [
        [0, 6, 6],
        [8, 2, 8],
        [18, 5, 7],
        [26, 8, 5],
      ]) {
        ctx.fillRect(x + dx * s - r * s, y + dy * s - r * s * 0.6, r * 2 * s, r * 1.2 * s);
      }
      ctx.fillStyle = '#dceefa';
      ctx.fillRect(x - 6 * s, y + 9 * s, 38 * s, 2 * s);
    };
    cloud(30, 14, 1);
    cloud(190, 26, 0.7);
    cloud(300, 8, 1.2);
  });

  for (const frame of [0, 1]) {
    canvasTexture(scene, `stands${frame}`, 384, STANDS_HEIGHT, (ctx) => drawStands(ctx, frame));
  }

  canvasTexture(scene, 'boards', 512, 14, (ctx) => {
    const panels: [string, string, string][] = [
      ['#f7d038', '#c8321f', 'RETRO'],
      ['#2456c8', '#ffffff', 'SUMMER'],
      ['#e8442e', '#f7d038', 'GAMES'],
      ['#2d8a4e', '#ffffff', '110M H'],
    ];
    ctx.font = '8px "Press Start 2P"';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    panels.forEach(([bg, fg, text], i) => {
      const x = i * 128;
      ctx.fillStyle = bg;
      ctx.fillRect(x, 0, 128, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, 12, 128, 2);
      ctx.fillRect(x + 127, 0, 1, 14);
      ctx.fillStyle = fg;
      ctx.fillText(text, x + 64, 7);
    });
  });

  canvasTexture(scene, 'grass', 64, 64, (ctx) => {
    for (let x = 0; x < 64; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? '#4c9a3c' : '#55a644';
      ctx.fillRect(x, 0, 16, 64);
    }
    const rng = createRng(7);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#3d7f30' : '#62b350';
      ctx.fillRect(Math.floor(rng() * 64), Math.floor(rng() * 64), 1, 1);
    }
  });

  canvasTexture(scene, 'track', 64, TRACK_TEX_HEIGHT, (ctx) => {
    ctx.fillStyle = '#c4553a';
    ctx.fillRect(0, 0, 64, TRACK_TEX_HEIGHT);
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#b04a32' : '#cf6447';
      ctx.fillRect(Math.floor(rng() * 64), Math.floor(rng() * TRACK_TEX_HEIGHT), 1, 1);
    }
    // Bordstein oben
    ctx.fillStyle = '#d9d9d9';
    ctx.fillRect(0, 0, 64, 3);
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(0, 2, 64, 1);
    // Bahnlinien
    ctx.fillStyle = '#f4efe6';
    for (let i = 0; i <= LANE_COUNT; i++) {
      ctx.fillRect(0, 3 + i * LANE_DEPTH, 64, 1);
    }
    ctx.fillStyle = '#9a3f2a';
    ctx.fillRect(0, TRACK_TEX_HEIGHT - 2, 64, 2);
  });
}

function drawStands(ctx: Ctx, frame: number): void {
  const W = 384;
  const H = STANDS_HEIGHT;
  const rng = createRng(42);

  // Dach mit Flutlicht
  ctx.fillStyle = '#3a3f55';
  ctx.fillRect(0, 0, W, 12);
  ctx.fillStyle = '#545a78';
  ctx.fillRect(0, 10, W, 2);
  for (let x = 20; x < W; x += 96) {
    ctx.fillStyle = '#2a2e40';
    ctx.fillRect(x, 12, 3, 10);
    ctx.fillStyle = '#fff8d0';
    ctx.fillRect(x - 6, 3, 15, 5);
    ctx.fillStyle = '#e8d890';
    ctx.fillRect(x - 6, 7, 15, 1);
  }

  // Ränge
  const top = 14;
  const rowH = 7;
  const rows = Math.floor((H - top - 10) / rowH);
  const shirts = ['#e8442e', '#f7d038', '#2456c8', '#ffffff', '#2d8a4e', '#f08a24', '#8a3fc4', '#1a1a1a', '#e85d9a', '#47c1d9'];
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  for (let r = 0; r < rows; r++) {
    const y = top + r * rowH;
    ctx.fillStyle = r % 2 === 0 ? '#6b7088' : '#5d6278';
    ctx.fillRect(0, y, W, rowH);
    ctx.fillStyle = '#4a4e63';
    ctx.fillRect(0, y + rowH - 1, W, 1);
    for (let x = 1 + (r % 2) * 2; x < W - 3; x += 4) {
      const aisle = x % 96 > 88;
      const roll = rng();
      const jumps = rng() < 0.35;
      const armsUp = rng() < 0.2;
      const shirt = shirts[Math.floor(rng() * shirts.length)];
      const skin = skins[Math.floor(rng() * skins.length)];
      if (aisle || roll < 0.12) continue;
      const dy = frame === 1 && jumps ? -1 : 0;
      ctx.fillStyle = shirt;
      ctx.fillRect(x, y + 3 + dy, 3, 3);
      ctx.fillStyle = skin;
      ctx.fillRect(x + 0.5, y + 1 + dy, 2, 2);
      if (frame === 1 && armsUp) {
        ctx.fillRect(x - 1, y + dy, 1, 2);
        ctx.fillRect(x + 3, y + dy, 1, 2);
      }
    }
  }
  // Treppen
  for (let x = 89; x < W; x += 96) {
    ctx.fillStyle = '#8e93a8';
    ctx.fillRect(x, top, 7, rows * rowH);
    for (let y = top; y < top + rows * rowH; y += 3) {
      ctx.fillStyle = '#767b90';
      ctx.fillRect(x, y, 7, 1);
    }
  }
  // Mauer vor den Rängen
  const wallY = top + rows * rowH;
  ctx.fillStyle = '#2a4a7a';
  ctx.fillRect(0, wallY, W, H - wallY);
  ctx.fillStyle = '#1e365a';
  ctx.fillRect(0, wallY, W, 2);
}
