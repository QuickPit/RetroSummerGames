// TEMPORÄR: Galerie für Grafik-Detailprüfungen – wird wieder gelöscht.
import '@fontsource/press-start-2p/latin-400.css';
import Phaser from 'phaser';
import { COUNTRIES } from './data/countries';
import { createPoolTextures, SwimHall } from './gfx/pool';
import { createTextures } from './gfx/textures';
import { createLook } from './gfx/runner';
import {
  drawFlipTurn,
  drawSplashCrown,
  drawSwimmer,
  drawSwimmerUpright,
  drawWake,
  ropeRestPose,
  waterCheerPose,
  type SwimKind,
} from './gfx/swimmer';

const view = new URLSearchParams(location.search).get('view') ?? 'swimmers';

class Gallery extends Phaser.Scene {
  constructor() {
    super('gallery');
  }
  create(): void {
    createTextures(this);
    createPoolTextures(this);
    if (view === 'hall') {
      const hall = new SwimHall(this);
      const cam = Number(new URLSearchParams(location.search).get('cam') ?? 0);
      hall.update(cam, 0.016, 1.3, 0.5, 23.45);
      (window as unknown as { __hall: SwimHall }).__hall = hall;
      return;
    }
    this.add.tileSprite(0, 0, 640, 360, 'water0').setOrigin(0);
    const g = this.add.graphics();
    const looks = [0, 1, 2, 3].map((i) => createLook(COUNTRIES[i], 1234 + i * 77, i + 1));
    const t = 0.37;
    // Reihe 1: Kraulzyklus
    for (let i = 0; i < 8; i++) {
      drawSwimmer(g, 50 + i * 74, 30, 'crawl', looks[0], { dir: 1, cycle: i / 8, kick: i * 0.9, time: t + i * 0.1 });
    }
    // Reihe 2: Sonderposen
    const kinds: SwimKind[] = ['breath', 'choke', 'gasp', 'glide', 'touch', 'crawl'];
    kinds.forEach((k, i) => {
      drawSwimmer(g, 50 + i * 90, 80, k, looks[1], { dir: 1, cycle: 0.3, kick: 1, time: t });
    });
    drawWake(g, 50 + 5 * 90, 80, 1, 2.3, t);
    // Reihe 3: Rollwende
    for (let i = 0; i < 8; i++) {
      drawFlipTurn(g, 50 + i * 74, 135, i / 8 + 0.01, looks[2], 1, t + i * 0.05);
    }
    // Reihe 4: aufrecht im Wasser, Platscher, Rückbahn
    for (let i = 0; i < 2; i++) {
      const wy = 200;
      const pose = i === 0 ? waterCheerPose(t) : ropeRestPose(t);
      drawSwimmerUpright(g, 40 + i * 60, wy + pose.hip + 4, pose, looks[3], { dir: -1, mood: i ? 'tired' : 'joy', time: t, waterY: wy });
    }
    for (let i = 0; i < 5; i++) drawSplashCrown(g, 180 + i * 40, 200, i / 5);
    drawSwimmer(g, 480, 200, 'crawl', looks[3], { dir: -1, cycle: 0.6, kick: 2, time: t });
    drawWake(g, 480, 200, -1, 2.4, t);
    drawSwimmer(g, 580, 200, 'breath', looks[0], { dir: -1, cycle: 0.6, kick: 2, time: t });
    // Reihe 5: verschiedene Nationen
    for (let i = 0; i < 8; i++) {
      const look = createLook(COUNTRIES[i + 4] ?? COUNTRIES[i], 99 + i, 1);
      drawSwimmer(g, 50 + i * 74, 260, i % 2 ? 'breath' : 'crawl', look, { dir: 1, cycle: 0.7 + i * 0.1, kick: i, time: t });
    }
  }
}

void document.fonts.load('8px "Press Start 2P"', 'AÄÖÜ').then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 640,
    height: 360,
    backgroundColor: '#10101c',
    pixelArt: true,
    roundPixels: true,
    audio: { noAudio: true },
    scene: [Gallery],
  });
  (window as unknown as { __game: Phaser.Game }).__game = game;
});
