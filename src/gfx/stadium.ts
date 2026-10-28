import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TRACK_FAR_Y } from '../config';
import { STANDS_HEIGHT, TRACK_TEX_HEIGHT } from './textures';

const BOARDS_Y = TRACK_FAR_Y - 3 - 12 - 14;
const STANDS_Y = BOARDS_Y - STANDS_HEIGHT;

/** Stadion-Hintergrund mit Parallax-Ebenen und jubelndem Publikum. */
export class Stadium {
  private readonly clouds: Phaser.GameObjects.TileSprite;
  private readonly stands: Phaser.GameObjects.TileSprite;
  private readonly boards: Phaser.GameObjects.TileSprite;
  private readonly grassFar: Phaser.GameObjects.TileSprite;
  private readonly track: Phaser.GameObjects.TileSprite;
  private readonly grassNear: Phaser.GameObjects.TileSprite;
  private crowdTimer = 0;
  private crowdFrame = 0;

  constructor(scene: Phaser.Scene) {
    scene.add.image(0, 0, 'sky').setOrigin(0).setDepth(-10);
    this.clouds = scene.add.tileSprite(0, 6, GAME_WIDTH, 50, 'clouds').setOrigin(0).setDepth(-9);
    this.stands = scene.add.tileSprite(0, STANDS_Y, GAME_WIDTH, STANDS_HEIGHT, 'stands0').setOrigin(0).setDepth(-8);
    this.boards = scene.add.tileSprite(0, BOARDS_Y, GAME_WIDTH, 14, 'boards').setOrigin(0).setDepth(-7);
    this.grassFar = scene.add.tileSprite(0, BOARDS_Y + 14, GAME_WIDTH, 12, 'grass').setOrigin(0).setDepth(-7);
    this.track = scene.add.tileSprite(0, TRACK_FAR_Y - 3, GAME_WIDTH, TRACK_TEX_HEIGHT, 'track').setOrigin(0).setDepth(-6);
    const nearY = TRACK_FAR_Y - 3 + TRACK_TEX_HEIGHT;
    this.grassNear = scene.add.tileSprite(0, nearY, GAME_WIDTH, GAME_HEIGHT - nearY, 'grass').setOrigin(0).setDepth(-6);
  }

  /**
   * @param camPx Kameraposition in Welt-Pixeln
   * @param excitement 0..1 – wie wild das Publikum jubelt
   */
  update(camPx: number, dt: number, time: number, excitement: number): void {
    this.clouds.tilePositionX = camPx * 0.05 + time * 3;
    this.stands.tilePositionX = camPx * 0.55;
    this.boards.tilePositionX = camPx * 0.95;
    this.grassFar.tilePositionX = camPx;
    this.track.tilePositionX = camPx;
    this.grassNear.tilePositionX = camPx * 1.05;

    this.crowdTimer += dt;
    const interval = Phaser.Math.Linear(0.6, 0.1, excitement);
    if (this.crowdTimer >= interval) {
      this.crowdTimer = 0;
      this.crowdFrame = 1 - this.crowdFrame;
      this.stands.setTexture(`stands${this.crowdFrame}`);
    }
  }
}
