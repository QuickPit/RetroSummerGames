import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { createRng } from '../sim/cpu';
import { canvasTexture } from './textures';

// Kalifornischer Strand als Kulisse für das BMX-Rennen – alles per Canvas gemalt.

type Ctx = CanvasRenderingContext2D;

export const BEACH = {
  oceanY: 130,
  palmsBottom: 196,
  crowdY: 182,
  boardsY: 214,
  sandY: 166,
} as const;

export function createBeachTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, 'beachsky', GAME_WIDTH, 140, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, 140);
    grd.addColorStop(0, '#3f8fe6');
    grd.addColorStop(0.6, '#8fd0f2');
    grd.addColorStop(1, '#ffe0ad');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, GAME_WIDTH, 140);
    // Tief stehende kalifornische Sonne
    for (const [r, c] of [
      [34, 'rgba(255, 214, 140, 0.25)'],
      [24, 'rgba(255, 220, 150, 0.45)'],
      [16, '#fff1c4'],
    ] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(120, 96, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  canvasTexture(scene, 'ocean', 320, 36, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, 36);
    grd.addColorStop(0, '#1f5fae');
    grd.addColorStop(1, '#3fa3df');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 320, 36);
    const rng = createRng(11);
    for (let i = 0; i < 70; i++) {
      const y = Math.floor(rng() * 28) + 2;
      ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(160,220,255,0.6)';
      ctx.fillRect(Math.floor(rng() * 320), y, 3 + Math.floor(rng() * 6), 1);
    }
    // Glitzer der Sonne
    ctx.fillStyle = 'rgba(255, 240, 190, 0.8)';
    for (let i = 0; i < 12; i++) ctx.fillRect(100 + Math.floor(rng() * 40), 2 + Math.floor(rng() * 10), 4, 1);
    // Segelboot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(232, 4);
    ctx.lineTo(232, 14);
    ctx.lineTo(240, 14);
    ctx.fill();
    ctx.fillStyle = '#e8442e';
    ctx.fillRect(227, 14, 16, 2);
    // Gischt am Ufer
    ctx.fillStyle = '#ffffff';
    for (let x = 0; x < 320; x += 2) ctx.fillRect(x, 33 + Math.round(Math.sin(x / 9) * 1.5), 2, 3);
  });

  canvasTexture(scene, 'sand', 64, 64, (ctx) => {
    ctx.fillStyle = '#e9c98b';
    ctx.fillRect(0, 0, 64, 64);
    const rng = createRng(5);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#d8b474' : '#f4dca6';
      ctx.fillRect(Math.floor(rng() * 64), Math.floor(rng() * 64), 1, 1);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 40, 2, 1);
    ctx.fillRect(44, 18, 1, 2);
  });

  canvasTexture(scene, 'palms', 480, 110, drawPalms);
  for (const frame of [0, 1]) canvasTexture(scene, `beachcrowd${frame}`, 384, 34, (ctx) => drawCrowd(ctx, frame));

  canvasTexture(scene, 'bmxboards', 512, 12, (ctx) => {
    const panels: [string, string, string][] = [
      ['#ff5fa2', '#ffffff', 'BMX'],
      ['#2fc4d9', '#10101c', 'SURF'],
      ['#f7d038', '#c8321f', 'RETRO'],
      ['#7dd94c', '#10101c', 'SUN'],
    ];
    ctx.font = '8px "Press Start 2P"';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    panels.forEach(([bg, fg, text], i) => {
      const x = i * 128;
      ctx.fillStyle = bg;
      ctx.fillRect(x, 0, 128, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(x, 10, 128, 2);
      ctx.fillRect(x + 127, 0, 1, 12);
      ctx.fillStyle = fg;
      ctx.fillText(text, x + 64, 6);
    });
  });
}

function drawPalm(ctx: Ctx, x: number, height: number, lean: number): void {
  const base = 110;
  let px = x;
  let py = base;
  // Leicht gebogener Stamm mit Ringen
  for (let i = 0; i < height; i += 3) {
    const t = i / height;
    px = x + lean * t * t * 20;
    py = base - i;
    ctx.fillStyle = i % 6 === 0 ? '#7a4d2a' : '#93623a';
    ctx.fillRect(Math.round(px) - 2, py - 3, 5, 3);
  }
  const tx = Math.round(px);
  const ty = py - 2;
  // Palmwedel
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.55;
    for (let s = 0; s < 18; s++) {
      const fx = tx + Math.cos(a) * s * 1.2;
      const fy = ty + Math.sin(a) * s * 0.9 + (s * s) / 28;
      ctx.fillStyle = s < 6 ? '#2d7a34' : '#3d9a3c';
      ctx.fillRect(Math.round(fx) - 1, Math.round(fy), 3, 2);
    }
  }
  ctx.fillStyle = '#6b4a22';
  ctx.fillRect(tx - 2, ty + 1, 2, 2);
  ctx.fillRect(tx + 1, ty + 2, 2, 2);
}

function drawPalms(ctx: Ctx): void {
  // Sonnenschirme und Handtücher im Sand
  const umbrellas: [number, string][] = [
    [96, '#e8442e'],
    [218, '#2fc4d9'],
    [350, '#f7d038'],
  ];
  for (const [x, c] of umbrellas) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, 92, 1, 18);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, 92, 11, 5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, 88, 2, 4);
    ctx.fillStyle = c;
    ctx.fillRect(x + 4, 106, 12, 4);
  }
  // Rettungsschwimmer-Turm
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(282, 84, 2, 26);
  ctx.fillRect(300, 84, 2, 26);
  ctx.fillStyle = '#e8442e';
  ctx.fillRect(278, 70, 28, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(278, 75, 28, 3);
  ctx.fillStyle = '#2a5fcf';
  ctx.fillRect(284, 72, 8, 3);
  ctx.fillStyle = '#e8442e';
  ctx.fillRect(276, 66, 32, 4);
  drawPalm(ctx, 30, 84, 1);
  drawPalm(ctx, 150, 96, -1);
  drawPalm(ctx, 176, 70, 0.6);
  drawPalm(ctx, 410, 90, 0.8);
}

function drawCrowd(ctx: Ctx, frame: number): void {
  const rng = createRng(77);
  const shirts = ['#ff5fa2', '#2fc4d9', '#f7d038', '#ffffff', '#7dd94c', '#f08a24', '#8a3fc4', '#e8442e'];
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const hats = ['#f4dca6', '#e8442e', '#2fc4d9', '#ffffff'];
  for (let x = 2; x < 380; x += 6) {
    const skip = rng() < 0.15;
    const shirt = shirts[Math.floor(rng() * shirts.length)];
    const skin = skins[Math.floor(rng() * skins.length)];
    const hat = rng() < 0.35 ? hats[Math.floor(rng() * hats.length)] : null;
    const shades = rng() < 0.3;
    const jumps = rng() < 0.4;
    const tall = Math.floor(rng() * 4);
    if (skip) continue;
    const dy = frame === 1 && jumps ? -2 : 0;
    const y = 8 - tall + dy;
    ctx.fillStyle = shirt;
    ctx.fillRect(x, y + 6, 5, 14);
    ctx.fillStyle = skin;
    ctx.fillRect(x + 1, y + 1, 3, 5);
    if (frame === 1 && jumps) {
      ctx.fillRect(x - 1, y - 1, 1, 5);
      ctx.fillRect(x + 5, y - 1, 1, 5);
    }
    if (shades) {
      ctx.fillStyle = '#10101c';
      ctx.fillRect(x + 2, y + 2, 3, 1);
    }
    if (hat) {
      ctx.fillStyle = hat;
      ctx.fillRect(x - 1, y, 7, 1);
      ctx.fillRect(x + 1, y - 1, 3, 1);
    }
  }
  // Holzzaun vor den Zuschauern
  ctx.fillStyle = '#b98a55';
  ctx.fillRect(0, 24, 384, 3);
  ctx.fillRect(0, 30, 384, 3);
  ctx.fillStyle = '#8a6035';
  for (let x = 0; x < 384; x += 16) ctx.fillRect(x, 22, 3, 12);
}

/** Parallax-Ebenen der Strandkulisse */
export class Beach {
  private readonly clouds: Phaser.GameObjects.TileSprite;
  private readonly ocean: Phaser.GameObjects.TileSprite;
  private readonly palms: Phaser.GameObjects.TileSprite;
  private readonly sand: Phaser.GameObjects.TileSprite;
  private readonly crowd: Phaser.GameObjects.TileSprite;
  private readonly boards: Phaser.GameObjects.TileSprite;
  private crowdTimer = 0;
  private crowdFrame = 0;

  constructor(scene: Phaser.Scene) {
    scene.add.image(0, 0, 'beachsky').setOrigin(0).setDepth(-10);
    this.clouds = scene.add.tileSprite(0, 8, GAME_WIDTH, 50, 'clouds').setOrigin(0).setDepth(-9);
    this.ocean = scene.add.tileSprite(0, BEACH.oceanY, GAME_WIDTH, 36, 'ocean').setOrigin(0).setDepth(-9);
    this.sand = scene.add
      .tileSprite(0, BEACH.sandY, GAME_WIDTH, GAME_HEIGHT - BEACH.sandY, 'sand')
      .setOrigin(0)
      .setDepth(-8);
    this.palms = scene.add
      .tileSprite(0, BEACH.palmsBottom - 110, GAME_WIDTH, 110, 'palms')
      .setOrigin(0)
      .setDepth(-7);
    this.crowd = scene.add.tileSprite(0, BEACH.crowdY, GAME_WIDTH, 34, 'beachcrowd0').setOrigin(0).setDepth(-6);
    this.boards = scene.add.tileSprite(0, BEACH.boardsY, GAME_WIDTH, 12, 'bmxboards').setOrigin(0).setDepth(-6);
  }

  update(camPx: number, dt: number, time: number, excitement: number): void {
    this.clouds.tilePositionX = camPx * 0.04 + time * 4;
    this.ocean.tilePositionX = camPx * 0.1 + time * 2;
    this.ocean.tilePositionY = Math.round(Math.sin(time * 1.5));
    this.palms.tilePositionX = camPx * 0.35;
    this.sand.tilePositionX = camPx;
    this.crowd.tilePositionX = camPx * 0.85;
    this.boards.tilePositionX = camPx * 0.9;

    this.crowdTimer += dt;
    if (this.crowdTimer >= Phaser.Math.Linear(0.6, 0.12, excitement)) {
      this.crowdTimer = 0;
      this.crowdFrame = 1 - this.crowdFrame;
      this.crowd.setTexture(`beachcrowd${this.crowdFrame}`);
    }
  }
}
