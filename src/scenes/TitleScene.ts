import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import { COUNTRIES } from '../data/countries';
import { EVENTS } from '../data/events';
import { endCompetition, setCompetition } from '../data/session';
import {
  loadBest,
  loadCountryIndex,
  loadEventIndex,
  loadLookSeed,
  loadMode,
  saveCountryIndex,
  saveEventIndex,
  saveLookSeed,
  saveMode,
  type GameMode,
} from '../data/storage';
import { drawFlag } from '../gfx/flags';
import { drawBmx } from '../gfx/bike';
import { diverSwingPose, drawDiver } from '../gfx/diver';
import { carryPole, createLook, drawRunner, drawShadow, handOffset, idlePose, type RunnerLook } from '../gfx/runner';
import { Stadium } from '../gfx/stadium';
import { blockIdlePose, drawSwimmerUpright } from '../gfx/swimmer';
import { COMPETITION_ORDER, createCompetition } from '../sim/competition';

const STRIPES = [0xf7d038, 0xf08a24, 0xe8442e, 0xc42f6e, 0x7a3fc4];
const ROWS = ['MODUS', 'DISZIPLIN', 'NATION', 'ATHLET'] as const;
const ROW_Y = [118, 144, 170, 196];
const PANEL = { x: 100, y: 106, w: GAME_WIDTH - 200, h: 112 };
const VALUE_X = 370;
const HELP_Y = 232;
const ROW = { mode: 0, event: 1, nation: 2, look: 3 };
const COMPETITION_HELP: [string, string][] = [
  ['REIHENFOLGE', 'HÜR-WEIT-STAB-SCHW-TURM-BMX'],
  ['WERTUNG', 'MEDAILLENSPIEGEL DER NATIONEN'],
  ['STEUERUNG', 'VOR JEDER DISZIPLIN ERKLÄRT'],
  ['PFEIL HOCH/RUNTER', 'MENÜ: ZEILE WÄHLEN'],
];

export class TitleScene extends Phaser.Scene {
  private stadium!: Stadium;
  private mode: GameMode = 'single';
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
    // Kein Publikumsrauschen aus Siegerehrung oder Feier im Menü (Töne wie der Bestätigungston laufen aus)
    sfx.crowd(0);
    this.mode = loadMode();
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

    // Menü: Modus, Disziplin, Nation, Aussehen
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

    this.bestText = text(GAME_WIDTH / 2, 298, '', 8, '#4cd964').setOrigin(0.5, 0);
    const prompt = text(GAME_WIDTH / 2, 318, 'ENTER = START', 16).setOrigin(0.5, 0).setStroke('#10101c', 4);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 550, yoyo: true, repeat: -1 });
    text(GAME_WIDTH - 6, 350, 'v0.9 SOLO', 8, '#5d6278').setOrigin(1, 0);

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
    // Im Wettkampf gibt es keine Disziplin-Wahl
    if (this.mode === 'competition' && this.selected === ROW.event) {
      this.selected = (this.selected + delta + ROWS.length) % ROWS.length;
    }
    sfx.menu();
    this.refresh();
  }

  private change(delta: number): void {
    const wrap = (v: number, n: number) => (v + delta + n) % n;
    if (this.selected === ROW.mode) {
      this.mode = this.mode === 'single' ? 'competition' : 'single';
      saveMode(this.mode);
    } else if (this.selected === ROW.event) this.eventIndex = wrap(this.eventIndex, EVENTS.length);
    else if (this.selected === ROW.nation) this.countryIndex = wrap(this.countryIndex, COUNTRIES.length);
    else this.lookSeed = Math.max(1, this.lookSeed + delta);
    sfx.menu();
    this.refresh();
  }

  private start(): void {
    sfx.confirm();
    saveEventIndex(this.eventIndex);
    saveCountryIndex(this.countryIndex);
    saveLookSeed(this.lookSeed);
    saveMode(this.mode);
    if (this.mode === 'competition') {
      const codes = COUNTRIES.map((c) => c.code);
      setCompetition(createCompetition(COUNTRIES[this.countryIndex].code, codes, Math.random, this.lookSeed));
      this.scene.start('medals', { mode: 'intro' });
      return;
    }
    endCompetition();
    this.scene.start(EVENTS[this.eventIndex].scene, { countryIndex: this.countryIndex });
  }

  private refresh(): void {
    const event = EVENTS[this.eventIndex];
    const country = COUNTRIES[this.countryIndex];
    const competition = this.mode === 'competition';
    this.look = createLook(country, this.lookSeed, 1);

    this.values[ROW.mode].setText(competition ? 'WETTKAMPF' : 'EINZELDISZIPLIN');
    this.values[ROW.event].setText(competition ? `ALLE ${COMPETITION_ORDER.length}` : event.name);
    this.values[ROW.nation].setText(country.name);
    this.values[ROW.look].setText(`TYP ${this.lookSeed}`);
    // Bei der Nation sitzt die Flagge links neben dem Namen
    const flagW = 24;
    this.values[ROW.nation].setX(VALUE_X + (flagW + 10) / 2);
    ROWS.forEach((_, i) => {
      const active = i === this.selected;
      const disabled = competition && i === ROW.event;
      this.labels[i].setColor(disabled ? '#5d6278' : active ? '#f7d038' : '#9aa0b8');
      this.values[i].setColor(disabled ? '#5d6278' : active ? '#f7d038' : '#ffffff');
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
    const nation = this.values[ROW.nation];
    drawFlag(g, country.flag, Math.round(nation.x - nation.width / 2 - flagW - 10), ROW_Y[ROW.nation], flagW, 16);

    const lines: [string, string][] = competition ? [...COMPETITION_HELP] : [...event.controls];
    if (!competition) {
      lines.push(['PFEIL HOCH/RUNTER', 'MENÜ: ZEILE WÄHLEN']);
      if (lines.length < 4) lines.push(['M / ESC', 'TON AN/AUS / ZURÜCK ZUM MENÜ']);
    }
    this.helpKeys.forEach((t, i) => t.setText(lines[i]?.[0] ?? ''));
    this.helpTexts.forEach((t, i) => t.setText(lines[i]?.[1] ?? ''));

    const best = competition ? null : loadBest(event.key);
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
    const key = this.mode === 'competition' ? '110h' : EVENTS[this.eventIndex].key;
    if (key === 'dive') {
      // An der Plattformkante mit Armschwung im Takt, darunter das Becken
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(24, y - 1, 45, 8);
      g.fillStyle(0xa9aeb8, 1);
      g.fillRect(25, y, 43, 6);
      g.fillStyle(0x3a6fa8, 1);
      g.fillRect(25, y, 43, 2);
      g.fillStyle(0xffffff, 1);
      g.fillRect(65, y, 3, 6);
      g.fillStyle(COLORS.waterDark, 1);
      g.fillRect(24, y + 16, 80, 8);
      g.fillStyle(COLORS.water, 1);
      g.fillRect(24, y + 16, 80, 2);
      g.fillStyle(0xffffff, 0.8);
      for (let i = 0; i < 4; i++) g.fillRect(30 + ((i * 23 + Math.floor(this.elapsed * 12)) % 70), y + 17, 4, 1);
      const lift = Math.abs(1 - 2 * ((this.elapsed + 0.25) % 1));
      const pose = diverSwingPose(lift, 0.8);
      drawDiver(g, x, y - pose.hip, pose, this.look, { time: this.elapsed, scale: 1 });
      return;
    }
    if (key === 'swim') {
      // Badekleidung auf dem Fliesenboden, Warteroutine wie auf dem Startblock
      g.fillStyle(COLORS.tileGrout, 1);
      g.fillRect(x - 25, y - 2, 52, 7);
      g.fillStyle(COLORS.tile, 1);
      for (let i = 0; i < 4; i++) g.fillRect(x - 24 + i * 13, y - 1, 12, 5);
      drawShadow(g, x, y, 0);
      drawSwimmerUpright(g, x, y, blockIdlePose(this.elapsed, this.look.seed), this.look, { dir: 1, time: this.elapsed });
      return;
    }
    drawShadow(g, x, y, 0);
    if (key === 'bmx') {
      // Im Stand pedalierend auf dem Rad
      drawBmx(g, x, y, 0, this.look, {
        crank: this.elapsed * 0.4,
        stance: 'pedal',
        mood: 'neutral',
        time: this.elapsed,
        frameColor: this.look.shoe,
        helmetColor: COUNTRIES[this.countryIndex].jersey,
        speed: 0,
      });
      return;
    }
    const vaulting = key === 'pole';
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
