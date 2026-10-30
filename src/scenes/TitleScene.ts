import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import { COUNTRIES } from '../data/countries';
import { EVENTS } from '../data/events';
import {
  loadBest,
  loadCountryIndex,
  loadEventIndex,
  loadLookSeed,
  saveCountryIndex,
  saveEventIndex,
  saveLookSeed,
} from '../data/storage';
import { drawFlag } from '../gfx/flags';
import { carryPole, createLook, drawRunner, drawShadow, handOffset, idlePose, type RunnerLook } from '../gfx/runner';
import { Stadium } from '../gfx/stadium';

const STRIPES = [0xf7d038, 0xf08a24, 0xe8442e, 0xc42f6e, 0x7a3fc4];
const ROWS = ['DISZIPLIN', 'NATION', 'ATHLET'] as const;
const ROW_Y = [124, 154, 184];
const PANEL = { x: 100, y: 112, w: GAME_WIDTH - 200, h: 100 };
const VALUE_X = 370;
const HELP_Y = 228;

export class TitleScene extends Phaser.Scene {
  private stadium!: Stadium;
  private eventIndex = 0;
  private countryIndex = 0;
  private lookSeed = 1;
  private look!: RunnerLook;
  private selected = 0;
  private menuGfx!: Phaser.GameObjects.Graphics;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private values: Phaser.GameObjects.Text[] = [];
  private helpKeys: Phaser.GameObjects.Text[] = [];
  private helpTexts: Phaser.GameObjects.Text[] = [];
  private bestText!: Phaser.GameObjects.Text;
  private camPx = 0;
  private elapsed = 0;

  constructor() {
    super('title');
  }

  create(): void {
    this.eventIndex = loadEventIndex() % EVENTS.length;
    this.countryIndex = loadCountryIndex() % COUNTRIES.length;
    this.lookSeed = loadLookSeed();
    this.selected = 0;
    this.labels = [];
    this.values = [];
    this.helpKeys = [];
    this.helpTexts = [];
    this.stadium = new Stadium(this);
    this.add.rectangle(0, 0, GAME_WIDTH, 360, 0x10101c, 0.6).setOrigin(0);

    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });

    // Logo mit Streifen im Stil der 80er
    const g = this.add.graphics();
    STRIPES.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, 58 + i * 7, GAME_WIDTH, 4);
    });
    text(GAME_WIDTH / 2, 30, 'RETRO', 16).setOrigin(0.5, 0).setStroke('#10101c', 6);
    const logo = text(GAME_WIDTH / 2, 62, 'SUMMER GAMES', 32)
      .setOrigin(0.5, 0)
      .setStroke('#10101c', 8)
      .setShadow(3, 3, '#10101c', 0, true, true);
    const grd = logo.context.createLinearGradient(0, 0, 0, logo.height);
    grd.addColorStop(0.2, '#fff6c8');
    grd.addColorStop(0.5, '#f7d038');
    grd.addColorStop(0.8, '#f08a24');
    logo.setFill(grd);

    // Menü: Disziplin, Nation, Aussehen
    this.menuGfx = this.add.graphics();
    ROWS.forEach((label, i) => {
      this.labels.push(text(PANEL.x + 12, ROW_Y[i] + 4, label));
      this.values.push(text(VALUE_X, ROW_Y[i], '', 16).setOrigin(0.5, 0));
    });

    // Steuerungshilfe passend zur Disziplin
    const help = this.add.graphics();
    help.fillStyle(0x10101c, 0.8);
    help.fillRect(110, HELP_Y - 8, GAME_WIDTH - 220, 64);
    help.lineStyle(1, COLORS.yellow, 1);
    help.strokeRect(110.5, HELP_Y - 7.5, GAME_WIDTH - 221, 63);
    for (let i = 0; i < 4; i++) {
      this.helpKeys.push(text(126, HELP_Y + i * 14, '', 8, '#f7d038'));
      this.helpTexts.push(text(276, HELP_Y + i * 14, ''));
    }

    this.bestText = text(GAME_WIDTH / 2, 296, '', 8, '#4cd964').setOrigin(0.5, 0);
    const prompt = text(GAME_WIDTH / 2, 318, 'ENTER = START', 16).setOrigin(0.5, 0).setStroke('#10101c', 4);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 550, yoyo: true, repeat: -1 });
    text(GAME_WIDTH - 6, 350, 'v0.3 SOLO', 8, '#5d6278').setOrigin(1, 0);

    // Der eigene Athlet wippt neben der Steuerungshilfe
    this.previewGfx = this.add.graphics();
    this.refresh();

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    const onKey = (ev: KeyboardEvent) => {
      sfx.unlock();
      if (ev.code === 'ArrowUp' || ev.code === 'KeyW') this.select(-1);
      else if (ev.code === 'ArrowDown' || ev.code === 'KeyS') this.select(1);
      else if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') this.change(-1);
      else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') this.change(1);
      else if (ev.code === 'KeyM') sfx.toggleMute();
      else if (!ev.repeat && (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space')) this.start();
    };
    kb.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
  }

  private select(delta: number): void {
    this.selected = (this.selected + delta + ROWS.length) % ROWS.length;
    sfx.menu();
    this.refresh();
  }

  private change(delta: number): void {
    const wrap = (v: number, n: number) => (v + delta + n) % n;
    if (this.selected === 0) this.eventIndex = wrap(this.eventIndex, EVENTS.length);
    else if (this.selected === 1) this.countryIndex = wrap(this.countryIndex, COUNTRIES.length);
    else this.lookSeed = Math.max(1, this.lookSeed + delta);
    sfx.menu();
    this.refresh();
  }

  private start(): void {
    sfx.confirm();
    saveEventIndex(this.eventIndex);
    saveCountryIndex(this.countryIndex);
    saveLookSeed(this.lookSeed);
    this.scene.start(EVENTS[this.eventIndex].scene, { countryIndex: this.countryIndex });
  }

  private refresh(): void {
    const event = EVENTS[this.eventIndex];
    const country = COUNTRIES[this.countryIndex];
    this.look = createLook(country, this.lookSeed, 1);

    this.values[0].setText(event.name);
    this.values[1].setText(country.name);
    this.values[2].setText(`TYP ${this.lookSeed}`);
    // Bei der Nation sitzt die Flagge links neben dem Namen
    const flagW = 24;
    this.values[1].setX(VALUE_X + (flagW + 10) / 2);
    ROWS.forEach((_, i) => {
      const active = i === this.selected;
      this.labels[i].setColor(active ? '#f7d038' : '#9aa0b8');
      this.values[i].setColor(active ? '#f7d038' : '#ffffff');
    });

    const g = this.menuGfx;
    g.clear();
    g.fillStyle(0x10101c, 0.8);
    g.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    g.lineStyle(1, COLORS.yellow, 1);
    g.strokeRect(PANEL.x + 0.5, PANEL.y + 0.5, PANEL.w - 1, PANEL.h - 1);
    const rowY = ROW_Y[this.selected];
    g.fillStyle(COLORS.yellow, 0.12);
    g.fillRect(PANEL.x + 4, rowY - 5, PANEL.w - 8, 26);
    g.fillStyle(COLORS.yellow, 1);
    g.fillTriangle(214, rowY + 8, 222, rowY + 2, 222, rowY + 14);
    g.fillTriangle(PANEL.x + PANEL.w - 14, rowY + 8, PANEL.x + PANEL.w - 22, rowY + 2, PANEL.x + PANEL.w - 22, rowY + 14);
    const nation = this.values[1];
    drawFlag(g, country.flag, Math.round(nation.x - nation.width / 2 - flagW - 10), ROW_Y[1], flagW, 16);

    const lines: [string, string][] = [...event.controls];
    lines.push(['PFEIL HOCH/RUNTER', 'MENÜ: ZEILE WÄHLEN']);
    if (lines.length < 4) lines.push(['M / ESC', 'TON AN/AUS / ZURÜCK ZUM MENÜ']);
    this.helpKeys.forEach((t, i) => t.setText(lines[i]?.[0] ?? ''));
    this.helpTexts.forEach((t, i) => t.setText(lines[i]?.[1] ?? ''));

    const best = loadBest(event.key);
    this.bestText.setText(best ? `${event.bestLabel}: ${event.format(best.value)} (${best.country})` : '');
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.elapsed += dt;
    this.camPx += dt * 40;
    this.stadium.update(this.camPx, dt, this.elapsed, 0.2);

    const g = this.previewGfx;
    g.clear();
    const x = 58;
    const y = 282;
    drawShadow(g, x, y, 0);
    const vaulting = EVENTS[this.eventIndex].key === 'pole';
    const pose = vaulting ? carryPole(idlePose(this.elapsed, this.look.seed)) : idlePose(this.elapsed, this.look.seed);
    drawRunner(g, x, y, pose, this.look, { time: this.elapsed });
    if (vaulting) {
      // Stab aufrecht in der Hand
      const hand = handOffset(pose);
      const hx = x + hand.x;
      const hy = y - pose.hip + hand.y;
      g.lineStyle(4, COLORS.outline, 1);
      g.lineBetween(hx - 6, hy + 18, hx + 22, hy - 92);
      g.lineStyle(2, 0xf7d038, 1);
      g.lineBetween(hx - 6, hy + 18, hx + 22, hy - 92);
    }
  }
}
