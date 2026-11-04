import '@fontsource/press-start-2p/latin-400.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { BmxScene } from './scenes/BmxScene';
import { BootScene } from './scenes/BootScene';
import { CeremonyScene } from './scenes/CeremonyScene';
import { ConfirmScene } from './scenes/ConfirmScene';
import { DiveScene } from './scenes/DiveScene';
import { LongJumpScene } from './scenes/LongJumpScene';
import { MedalsScene } from './scenes/MedalsScene';
import { PoleVaultScene } from './scenes/PoleVaultScene';
import { RaceScene } from './scenes/RaceScene';
import { ResultScene } from './scenes/ResultScene';
import { SwimScene } from './scenes/SwimScene';
import { TitleScene } from './scenes/TitleScene';

async function start(): Promise<void> {
  // Die Pixel-Schrift muss geladen sein, bevor Texte und Texturen entstehen.
  try {
    await document.fonts.load('8px "Press Start 2P"', 'AÄÖÜ');
  } catch {
    // Notfalls mit Ersatzschrift weitermachen.
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#10101c',
    pixelArt: true,
    roundPixels: true,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Die Rückfrage liegt als Overlay über allen anderen Szenen
    scene: [
      BootScene,
      TitleScene,
      RaceScene,
      PoleVaultScene,
      LongJumpScene,
      BmxScene,
      SwimScene,
      DiveScene,
      ResultScene,
      MedalsScene,
      CeremonyScene,
      ConfirmScene,
    ],
  });

  // Für automatisierte Tests im Entwicklungsmodus erreichbar machen.
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
}

void start();
