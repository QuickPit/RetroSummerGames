import Phaser from 'phaser';
import { createTextures } from '../gfx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createTextures(this);
    this.scene.start('title');
  }
}
