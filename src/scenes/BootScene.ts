import Phaser from 'phaser';
import { createBeachTextures } from '../gfx/beach';
import { createDiveHallTextures } from '../gfx/diveHall';
import { createPoolTextures } from '../gfx/pool';
import { createTextures } from '../gfx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createTextures(this);
    createBeachTextures(this);
    createPoolTextures(this);
    createDiveHallTextures(this);
    this.scene.start('title');
  }
}
