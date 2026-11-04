// TEMPORÄR: Galerie für die Abschlussfeier – wird nach der Prüfung gelöscht.
import '@fontsource/press-start-2p/latin-400.css';
import Phaser from 'phaser';
import { setCompetition } from './data/session';
import { createTextures } from './gfx/textures';
import { CeremonyScene } from './scenes/CeremonyScene';
import { COMPETITION_ORDER, recordEvent, type CompetitionState } from './sim/competition';

const params = new URLSearchParams(location.search);
const kase = params.get('case') ?? 'tie1';
const ok = (...codes: string[]) => codes.map((code) => ({ code, valid: true }));
const bad = (...codes: string[]) => codes.map((code) => ({ code, valid: false }));
const CASES: Record<string, { field: string[]; events: { code: string; valid: boolean }[][] }> = {
  win: { field: ['GER', 'AUT', 'FRA', 'ITA'], events: [ok('GER', 'AUT', 'FRA', 'ITA'), ok('GER', 'FRA', 'AUT', 'ITA'), ok('AUT', 'GER', 'ITA', 'FRA'), ok('GER', 'ITA', 'FRA', 'AUT')] },
  tie1: { field: ['GER', 'JAM', 'USA', 'FRA'], events: [ok('GER', 'JAM', 'USA', 'FRA'), ok('JAM', 'GER', 'USA', 'FRA'), bad('GER', 'JAM', 'USA', 'FRA'), bad('GER', 'JAM', 'USA', 'FRA')] },
  tie2: { field: ['GER', 'AUT', 'FRA', 'ITA'], events: [ok('GER', 'AUT', 'FRA', 'ITA'), ok('GER', 'FRA', 'AUT', 'ITA'), ok('AUT', 'GER', 'ITA', 'FRA'), ok('FRA', 'ITA', 'GER', 'AUT')] },
  second: { field: ['GER', 'USA', 'JAM', 'FRA'], events: [ok('USA', 'GER', 'JAM', 'FRA'), ok('USA', 'JAM', 'GER', 'FRA'), ok('GER', 'USA', 'FRA', 'JAM'), ok('USA', 'FRA', 'JAM', 'GER')] },
  four: { field: ['NED', 'JAM', 'USA', 'FRA'], events: [ok('NED', 'JAM', 'USA', 'FRA'), ok('JAM', 'USA', 'FRA', 'NED'), ok('USA', 'FRA', 'NED', 'JAM'), ok('FRA', 'NED', 'JAM', 'USA')] },
  fourth: { field: ['SWE', 'USA', 'JAM', 'FRA'], events: [ok('USA', 'JAM', 'FRA', 'SWE'), ok('USA', 'FRA', 'JAM', 'SWE'), ok('JAM', 'USA', 'FRA', 'SWE'), ok('FRA', 'USA', 'JAM', 'SWE')] },
  none: { field: ['GER', 'AUT', 'FRA', 'ITA'], events: [bad('GER', 'AUT', 'FRA', 'ITA'), bad('GER', 'AUT', 'FRA', 'ITA'), bad('GER', 'AUT', 'FRA', 'ITA'), bad('GER', 'AUT', 'FRA', 'ITA')] },
};
const c = CASES[kase];
let state: CompetitionState = {
  field: c.field.map((code, i) => ({ code, isPlayer: i === 0, profile: i === 0 ? null : ((i - 1) as 0 | 1 | 2), lookSeed: 1000 + i * 77 })),
  index: 0,
  results: {},
};
c.events.forEach((rows, i) => (state = recordEvent(state, COMPETITION_ORDER[i], rows)));
setCompetition(state);

class GalleryBoot extends Phaser.Scene {
  constructor() {
    super('galleryBoot');
  }
  create(): void {
    createTextures(this);
    this.scene.start('ceremony');
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
    scene: [GalleryBoot, CeremonyScene],
  });
  (window as unknown as { __game: Phaser.Game }).__game = game;
});
