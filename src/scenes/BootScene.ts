import Phaser from 'phaser';
import { createBeachTextures } from '../gfx/beach';
import { createTextures } from '../gfx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createTextures(this);
    createBeachTextures(this);
    this.scene.start('title');
  }
}
