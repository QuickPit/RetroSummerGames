import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import { COUNTRIES } from '../data/countries';
import { loadBest, loadCountryIndex, saveCountryIndex } from '../data/storage';
import { drawFlag } from '../gfx/flags';
import { Stadium } from '../gfx/stadium';

const STRIPES = [0xf7d038, 0xf08a24, 0xe8442e, 0xc42f6e, 0x7a3fc4];

export class TitleScene extends Phaser.Scene {
  private stadium!: Stadium;
  private countryIndex = 0;
  private nationGfx!: Phaser.GameObjects.Graphics;
  private nationText!: Phaser.GameObjects.Text;
  private camPx = 0;
  private elapsed = 0;

  constructor() {
    super('title');
  }

  create(): void {
    this.countryIndex = loadCountryIndex() % COUNTRIES.length;
    this.stadium = new Stadium(this);
    this.add.rectangle(0, 0, GAME_WIDTH, 360, 0x10101c, 0.6).setOrigin(0);

    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color }).setOrigin(0.5, 0);

    // Logo mit Streifen im Stil der 80er
    const g = this.add.graphics();
    STRIPES.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, 58 + i * 7, GAME_WIDTH, 4);
    });
    text(GAME_WIDTH / 2, 30, 'RETRO', 16, '#ffffff').setStroke('#10101c', 6);
    const logo = text(GAME_WIDTH / 2, 62, 'SUMMER GAMES', 32).setStroke('#10101c', 8).setShadow(3, 3, '#10101c', 0, true, true);
    const grd = logo.context.createLinearGradient(0, 0, 0, logo.height);
    grd.addColorStop(0.2, '#fff6c8');
    grd.addColorStop(0.5, '#f7d038');
    grd.addColorStop(0.8, '#f08a24');
    logo.setFill(grd);

    // Auswahl
    text(GAME_WIDTH / 2, 124, 'DISZIPLIN', 8, '#9aa0b8');
    text(GAME_WIDTH / 2, 138, '110 M HÜRDEN', 16, '#ffffff');
    text(GAME_WIDTH / 2, 170, 'NATION', 8, '#9aa0b8');
    this.nationGfx = this.add.graphics();
    this.nationText = this.add.text(0, 186, '', { fontFamily: FONT, fontSize: '16px', color: '#f7d038' });

    // Steuerung
    const help = this.add.graphics();
    help.fillStyle(0x10101c, 0.8);
    help.fillRect(110, 220, GAME_WIDTH - 220, 64);
    help.lineStyle(1, COLORS.yellow, 1);
    help.strokeRect(110.5, 220.5, GAME_WIDTH - 221, 63);
    const left = 126;
    const helpText = (y: number, key: string, what: string) => {
      this.add.text(left, y, key, { fontFamily: FONT, fontSize: '8px', color: '#f7d038' });
      this.add.text(left + 150, y, what, { fontFamily: FONT, fontSize: '8px', color: '#ffffff' });
    };
    helpText(230, 'PFEIL LINKS/RECHTS', 'ABWECHSELND TIPPEN = LAUFEN');
    helpText(244, '(ODER A / D)', 'JE SCHNELLER, DESTO BESSER');
    helpText(258, 'LEERTASTE', 'ÜBER DIE HÜRDE SPRINGEN');
    helpText(272, 'M / ESC', 'TON AN/AUS / ZURÜCK ZUM MENÜ');

    const best = loadBest('110h');
    if (best) text(GAME_WIDTH / 2, 296, `BESTZEIT: ${best.time.toFixed(2)} (${best.country})`, 8, '#4cd964');

    const prompt = text(GAME_WIDTH / 2, 318, 'ENTER = START', 16, '#ffffff').setStroke('#10101c', 4);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 550, yoyo: true, repeat: -1 });
    this.add
      .text(GAME_WIDTH - 6, 350, 'v0.1 SOLO', { fontFamily: FONT, fontSize: '8px', color: '#5d6278' })
      .setOrigin(1, 0);

    this.drawNation();

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    const onKey = (ev: KeyboardEvent) => {
      sfx.unlock();
      if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') this.changeCountry(-1);
      else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') this.changeCountry(1);
      else if (ev.code === 'KeyM') sfx.toggleMute();
      else if (!ev.repeat && (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space')) {
        sfx.confirm();
        saveCountryIndex(this.countryIndex);
        this.scene.start('race', { countryIndex: this.countryIndex });
      }
    };
    kb.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
  }

  private changeCountry(delta: number): void {
    this.countryIndex = (this.countryIndex + delta + COUNTRIES.length) % COUNTRIES.length;
    sfx.menu();
    this.drawNation();
  }

  private drawNation(): void {
    const country = COUNTRIES[this.countryIndex];
    this.nationText.setText(country.name);
    const flagW = 24;
    const total = flagW + 10 + this.nationText.width;
    const x0 = Math.round(GAME_WIDTH / 2 - total / 2);
    this.nationText.setX(x0 + flagW + 10);

    const g = this.nationGfx;
    g.clear();
    drawFlag(g, country.flag, x0, 186, flagW, 16);
    // Pfeile links und rechts
    const y = 194;
    g.fillStyle(COLORS.yellow, 1);
    g.fillTriangle(180, y, 190, y - 7, 190, y + 7);
    g.fillTriangle(GAME_WIDTH - 180, y, GAME_WIDTH - 190, y - 7, GAME_WIDTH - 190, y + 7);
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.elapsed += dt;
    this.camPx += dt * 40;
    this.stadium.update(this.camPx, dt, this.elapsed, 0.2);
  }
}
