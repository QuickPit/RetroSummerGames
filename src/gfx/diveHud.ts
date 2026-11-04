import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import type { Side } from '../sim/hurdles';
import { DIVE, DIVES, armLift, targetRot, twistProgress, type DiveDef, type DiveState } from '../sim/dive';
import { BOTTOM_Y, drawActionKey, drawKeyCaps, drawSpeedBar, drawUpKey } from './hud';
import { DIVE_HALL, drawLedBoard } from './pool';

// Anzeigen beim Turmspringen: HUD unten und oben, Takt-Skala am Turm, Kampfrichter-Tafeln,
// Wertung auf der Anzeigetafel und das Panel zur Sprungwahl.

type Gfx = Phaser.GameObjects.Graphics;

/** Halbe Salti als Text: 0, ½, 1, 1½ … */
export function halvesLabel(halves: number): string {
  const whole = Math.floor(halves / 2);
  if (halves % 2 === 0) return String(whole);
  return whole === 0 ? '½' : `${whole}½`;
}

const UP_X = 312;
const ROT_X0 = 420;
const ROT_X1 = 632;
const SWING_W = 144;

/** HUD beim Turmspringen: oben Sprung und Gesamtpunkte, unten Schwung, Tasten, Schraube und Drehung. */
export class DiveHud {
  private readonly g: Gfx;
  private readonly roundText: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly ddText: Phaser.GameObjects.Text;
  private readonly totalText: Phaser.GameObjects.Text;
  private readonly minText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;
  private readonly twistLabel: Phaser.GameObjects.Text;
  private readonly twistCount: Phaser.GameObjects.Text;
  private readonly rotText: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly subMessage: Phaser.GameObjects.Text;
  private readonly all: Phaser.GameObjects.GameObject[];
  private flashSide: Side | null = null;
  private flashUntil = 0;
  private missUntil = 0;
  private upMissUntil = 0;

  constructor(scene: Phaser.Scene) {
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };
    const text = (x: number, y: number, s: string, color = '#ffffff') =>
      scene.add.text(x, y, s, { ...style, color }).setDepth(201);
    this.g = scene.add.graphics().setDepth(200);
    const title = text(8, 8, 'TURMSPRINGEN');
    this.roundText = text(120, 8, '', '#f7d038');
    this.nameText = text(208, 8, '');
    this.ddText = text(384, 8, '', '#9aa0b8');
    const totalLabel = text(470, 8, 'GESAMT', '#9aa0b8');
    this.totalText = scene.add
      .text(GAME_WIDTH - 8, 4, '0.00', { ...style, fontSize: '16px' })
      .setOrigin(1, 0)
      .setDepth(201);
    const swingLabel = text(8, BOTTOM_Y + 6, 'SCHWUNG');
    this.minText = text(0, BOTTOM_Y + 6, 'MIN').setOrigin(0.5, 0);
    this.actionText = text(269, BOTTOM_Y + 6, 'SPRUNG', '#9aa0b8').setOrigin(0.5, 0);
    this.twistLabel = text(UP_X, BOTTOM_Y + 6, 'SCHRAUBE');
    this.twistCount = text(UP_X + 26, BOTTOM_Y + 22, '');
    const rotLabel = text(ROT_X0, BOTTOM_Y + 6, 'DREHUNG');
    this.rotText = text(ROT_X1, BOTTOM_Y + 6, '').setOrigin(1, 0);
    this.message = scene.add
      .text(GAME_WIDTH / 2, 110, '', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#f7d038',
        stroke: '#10101c',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(210);
    this.subMessage = scene.add
      .text(GAME_WIDTH / 2, 142, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#10101c',
        strokeThickness: 4,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0)
      .setDepth(210);
    this.all = [
      this.g, title, this.roundText, this.nameText, this.ddText, totalLabel, this.totalText, swingLabel, this.minText,
      this.actionText, this.twistLabel, this.twistCount, rotLabel, this.rotText,
    ];
  }

  setVisible(visible: boolean): void {
    for (const o of this.all) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
  }

  /** Kopfzeile: Durchgang, Sprung, SG und eigene Gesamtpunkte */
  setInfo(round: number, def: DiveDef | null, total: number): void {
    this.roundText.setText(`${round}. SPRUNG`);
    this.nameText.setText(def?.name ?? '');
    this.ddText.setText(def ? `SG ${def.dd.toFixed(1)}` : '');
    this.totalText.setText(total.toFixed(2));
  }

  /**
   * Meldung in der Bildmitte; `size` 24 für Bewertungen, 16 für Ansagen.
   * (x, y) ist die Mitte der großen Zeile.
   */
  setMessage(text: string, sub = '', color = '#f7d038', size = 24, x = GAME_WIDTH / 2, y = 110): void {
    if (this.message.text !== text) this.message.setText(text);
    if (this.message.style.color !== color) this.message.setColor(color);
    if (this.message.style.fontSize !== `${size}px`) {
      this.message.setFontSize(size).setStroke('#10101c', size >= 24 ? 6 : 4);
    }
    this.message.setPosition(x, y);
    if (this.subMessage.text !== sub) this.subMessage.setText(sub);
    this.subMessage.setPosition(x, y + (text ? size / 2 + 10 : -4));
  }

  registerTap(side: Side, valid: boolean, now: number): void {
    this.flashSide = side;
    this.flashUntil = now + (valid ? 0.07 : 0.15);
  }

  /** Leertaste ohne Wirkung: Taste blinkt rot */
  registerMiss(now: number): void {
    this.missUntil = now + 0.3;
  }

  /** PFEIL HOCH ohne Wirkung: Taste blinkt rot */
  registerUpMiss(now: number): void {
    this.upMissUntil = now + 0.3;
  }

  update(now: number, s: DiveState | null, minPower: number): void {
    const g = this.g;
    g.clear();
    g.fillStyle(COLORS.hudBg, 0.75);
    g.fillRect(0, 0, GAME_WIDTH, 24);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 360 - BOTTOM_Y);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 1);

    const phase = s?.phase ?? 'walk';
    const onTower = phase === 'walk' || phase === 'ready' || phase === 'swing';
    // Nach dem Absprung friert der Balken ein und zeigt die Kraft
    drawSpeedBar(g, s ? (onTower ? s.swing : s.power) : 0, 1);
    this.drawMinMark(g, minPower);

    const tapping = phase === 'ready' || phase === 'swing';
    const next: Side | null = tapping ? (s!.lastSide === 'L' ? 'R' : 'L') : null;
    drawKeyCaps(g, next, now < this.flashUntil ? this.flashSide : null);

    let label = 'SPRUNG';
    let lit = false;
    if (phase === 'swing') lit = armLift(s!) > 0.85;
    else if (phase === 'air') {
      label = s!.held ? 'HALTEN' : 'OFFEN';
      lit = s!.held;
    }
    if (now < this.missUntil) drawActionKey(g, true, COLORS.red);
    else drawActionKey(g, lit);
    if (this.actionText.text !== label) this.actionText.setText(label);
    this.actionText.setColor(lit ? '#ffffff' : '#9aa0b8');

    this.drawTwist(g, s, now);
    this.drawRotation(g, s);
  }

  private drawMinMark(g: Gfx, minPower: number): void {
    const x = Math.round(8 + Math.min(1, minPower) * SWING_W);
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(x - 1, BOTTOM_Y + 15, 3, 19);
    g.fillStyle(0xffffff, 1);
    g.fillRect(x, BOTTOM_Y + 16, 1, 17);
    g.fillTriangle(x - 2, BOTTOM_Y + 14, x + 2, BOTTOM_Y + 14, x, BOTTOM_Y + 17);
    // Beschriftung nur, wenn sie nicht in „SCHWUNG“ hineinläuft
    this.minText.setX(x).setVisible(x - 12 > 66 && minPower <= 1);
  }

  private drawTwist(g: Gfx, s: DiveState | null, now: number): void {
    const twists = s?.def.twists ?? 0;
    const active = twists > 0;
    const red = now < this.upMissUntil;
    drawUpKey(g, UP_X, red || (s?.twistStart != null), red ? COLORS.red : COLORS.yellow);
    this.twistLabel.setColor(active ? '#ffffff' : '#5d6278');
    const done = s ? Math.floor(twistProgress(s)) : 0;
    this.twistCount.setText(active ? `${done}/${twists}` : '-').setColor(active ? '#f7d038' : '#5d6278');
  }

  private drawRotation(g: Gfx, s: DiveState | null): void {
    const y = BOTTOM_Y + 18;
    const w = ROT_X1 - ROT_X0;
    g.fillStyle(0x2a2e40, 1);
    g.fillRect(ROT_X0, y, w, 12);
    if (!s) {
      this.rotText.setText('');
      return;
    }
    const target = targetRot(s.def);
    const px = (deg: number) => ROT_X0 + Math.round((Math.max(0, Math.min(target, deg)) / target) * w);
    // Grüne Zone: Ziel −40° bis Ziel
    g.fillStyle(0x2d6a3e, 1);
    g.fillRect(px(target - 40), y, ROT_X1 - px(target - 40), 12);
    const rot = s.rot;
    const color = rot > target + DIVE.cleanAngle ? COLORS.red : rot >= target - 40 ? 0x4cd964 : COLORS.yellow;
    g.fillStyle(color, 1);
    g.fillRect(ROT_X0, y + 2, px(rot) - ROT_X0, 8);
    // Teilstriche je halbem Salto
    g.fillStyle(0xffffff, 0.8);
    for (let d = 180; d < target; d += 180) g.fillRect(px(d), y - 2, 1, 16);
    g.fillStyle(0xffffff, 1);
    g.fillRect(ROT_X1 - 1, y - 3, 2, 18);
    const halves = Math.max(0, Math.floor((rot + 1) / 180));
    this.rotText.setText(`${halvesLabel(halves)}/${halvesLabel(Math.round(target / 180))}`);
  }
}

/**
 * Takt-Skala neben dem Springer (6×44 px): Der Strich läuft als Dreieckswelle,
 * unten = Arme hinten, oben = Hochpunkt (grün). (x, y) = linke obere Ecke.
 */
export function drawTaktScale(g: Gfx, x: number, y: number, lift: number): void {
  const h = 44;
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 1, y - 1, 8, h + 2);
  g.fillStyle(0x3a3f55, 1);
  g.fillRect(x, y, 6, h);
  g.fillStyle(0x4cd964, 1);
  g.fillRect(x, y, 6, 4);
  const my = Math.round(y + (1 - lift) * (h - 2));
  const top = lift > 0.9;
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 3, my - 1, 12, 4);
  g.fillStyle(top ? 0xffffff : COLORS.yellow, 1);
  g.fillRect(x - 2, my, 10, 2);
}

// ----------------------------------------------------- Kampfrichter-Tafeln

const CARD_W = 52;
const CARD_H = 26;
const CARD_Y = 170;
/** Abstand zwischen zwei Tafeln und Zeit bis zur Streich-Markierung */
export const CARD_STEP = 0.15;
export const CARD_STRIKE = 0.5;

function noteLabel(n: number): string {
  return n >= 10 ? '10' : n.toFixed(1);
}

/** Die fünf Wertungstafeln; gestrichene werden grau mit roter Diagonale. */
export class JudgeCards {
  private readonly g: Gfx;
  /** Rote Diagonalen liegen über den Ziffern */
  private readonly strikeG: Gfx;
  private readonly texts: Phaser.GameObjects.Text[];
  private notes: number[] = [];
  private dropped: number[] = [];
  private shownAt: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(-2);
    this.strikeG = scene.add.graphics().setDepth(-1.8);
    this.texts = DIVE_HALL.judgeX.map((x) =>
      scene.add
        .text(x, CARD_Y, '', { fontFamily: FONT, fontSize: '16px', color: '#10101c' })
        .setOrigin(0.5)
        .setDepth(-1.9)
        .setVisible(false),
    );
  }

  show(notes: number[], dropped: readonly number[], now: number): void {
    this.notes = notes;
    this.dropped = [...dropped];
    this.shownAt = now;
  }

  hide(): void {
    this.shownAt = null;
    this.g.clear();
    this.strikeG.clear();
    for (const t of this.texts) t.setVisible(false);
  }

  /** 0..1: wie weit Richter i seine Tafel gehoben hat */
  raise(i: number, now: number): number {
    if (this.shownAt === null) return 0;
    return Math.max(0, Math.min(1, (now - this.shownAt - i * CARD_STEP) / CARD_STEP));
  }

  /** Alle Tafeln oben und gestrichen */
  done(now: number): boolean {
    return this.shownAt !== null && now - this.shownAt >= 4 * CARD_STEP + CARD_STRIKE;
  }

  update(now: number, camY: number): void {
    const g = this.g;
    g.clear();
    this.strikeG.clear();
    if (this.shownAt === null) return;
    const struck = this.done(now);
    DIVE_HALL.judgeX.forEach((cx, i) => {
      const k = this.raise(i, now);
      const t = this.texts[i];
      if (k <= 0) {
        t.setVisible(false);
        return;
      }
      const y = Math.round(CARD_Y + (1 - k) * 16 + camY);
      const grey = struck && this.dropped.includes(i);
      drawJudgeCard(g, cx, y, grey);
      t.setVisible(true).setPosition(cx + 1, y + 1).setText(noteLabel(this.notes[i])).setColor(grey ? '#5d6278' : '#10101c');
      if (grey) {
        this.strikeG.lineStyle(2, COLORS.red, 1);
        this.strikeG.lineBetween(cx - CARD_W / 2 + 3, y + CARD_H / 2 - 3, cx + CARD_W / 2 - 3, y - CARD_H / 2 + 3);
      }
    });
  }
}

/** Eine Wertungstafel (Mitte cx, cy) */
export function drawJudgeCard(g: Gfx, cx: number, cy: number, grey: boolean): void {
  const x = cx - CARD_W / 2;
  const y = cy - CARD_H / 2;
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(x - 1, y - 1, CARD_W + 2, CARD_H + 2);
  g.fillStyle(grey ? 0x9aa0b0 : 0xffffff, 1);
  g.fillRect(x, y, CARD_W, CARD_H);
  g.fillStyle(grey ? 0x7d8290 : 0xd8dce6, 1);
  g.fillRect(x, y + CARD_H - 3, CARD_W, 3);
  // Griff
  g.fillStyle(0x8a6035, 1);
  g.fillRect(cx - 1, y + CARD_H + 1, 2, 5);
}

// ------------------------------------------------------- Wertung auf der Tafel

export interface VerdictInfo {
  rating: string;
  ratingColor: string;
  sum: number;
  dd: number;
  points: number;
  tip: string;
  measures: string;
}

const COUNT_TIME = 0.6;

/** Wertung auf der großen LED-Tafel (DIVE_HALL.verdict) als Overlay; die Punkte zählen hoch. */
export class VerdictBoard {
  private readonly g: Gfx;
  private readonly texts: Phaser.GameObjects.Text[];
  private info: VerdictInfo | null = null;
  private shownAt = 0;

  constructor(scene: Phaser.Scene) {
    const { x, y, w } = DIVE_HALL.verdict;
    const cx = x + w / 2;
    // Die Tafel liegt vor dem Turm, damit nichts in die Schrift ragt
    this.g = scene.add.graphics().setDepth(149).setVisible(false);
    drawLedBoard(this.g, DIVE_HALL.verdict);
    const t = (dy: number, size: number, color: string) =>
      scene.add
        .text(cx, y + dy, '', { fontFamily: FONT, fontSize: `${size}px`, color })
        .setOrigin(0.5, 0)
        .setDepth(150)
        .setVisible(false);
    this.texts = [t(5, 16, '#f7d038'), t(25, 16, '#ff6a3c'), t(47, 8, '#ffffff'), t(59, 8, '#9aa0b8'), t(72, 8, '#f7d038')];
  }

  get visible(): boolean {
    return this.info !== null;
  }

  show(info: VerdictInfo, now: number): void {
    this.info = info;
    this.shownAt = now;
    const [rating, , tip, measures, enter] = this.texts;
    rating.setText(info.rating).setColor(info.ratingColor);
    tip.setText(info.tip);
    measures.setText(info.measures);
    enter.setText('ENTER: WEITER');
    for (const t of this.texts) t.setVisible(true);
    this.g.setVisible(true);
  }

  hide(): void {
    this.info = null;
    for (const t of this.texts) t.setVisible(false);
    this.g.setVisible(false);
  }

  update(now: number): void {
    const info = this.info;
    if (!info) return;
    const k = Math.min(1, (now - this.shownAt) / COUNT_TIME);
    this.texts[1].setText(`${info.sum.toFixed(1)} × ${info.dd.toFixed(1)} = ${(info.points * k).toFixed(2)}`);
    this.texts[4].setAlpha(Math.floor(now * 2.5) % 2 === 0 ? 1 : 0.35);
  }
}

// -------------------------------------------------------------- Sprungwahl

export interface DiveSelectRow {
  def: DiveDef;
  /** Kleinster nötiger Schwung 0..1 */
  need: number;
  /** Punkte, wenn schon gesprungen */
  points: number | null;
}

const SEL = { x: 60, y: 40, w: 520, h: 260, rowY: 92, rowH: 18, name: 84, dd: 330, bar: 380, barW: 90, pct: 480 };

/** Panel „DEIN n. SPRUNG“: 8 Sprünge mit SG und nötigem Schwung, gesprungene sind gesperrt. */
export class DiveSelect {
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Gfx;
  private readonly title: Phaser.GameObjects.Text;
  private readonly rowTexts: Phaser.GameObjects.Text[][] = [];
  private readonly lastText: Phaser.GameObjects.Text;
  private readonly footer2: Phaser.GameObjects.Text;
  private rows: DiveSelectRow[] = [];
  private selected = 0;
  private lastSwing: number | null = null;

  constructor(scene: Phaser.Scene) {
    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
    this.g = scene.add.graphics();
    this.title = text(GAME_WIDTH / 2, SEL.y + 10, '', 16, '#f7d038').setOrigin(0.5, 0);
    const header = '#9aa0b8';
    const headers = [
      text(SEL.name, SEL.y + 36, 'SPRUNG', 8, header),
      text(SEL.dd, SEL.y + 36, 'SG', 8, header),
      text(SEL.bar, SEL.y + 36, 'NÖTIGER SCHWUNG', 8, header),
    ];
    for (let i = 0; i < DIVES.length; i++) {
      const y = SEL.rowY + i * SEL.rowH;
      this.rowTexts.push([text(SEL.name, y, ''), text(SEL.dd, y, ''), text(SEL.pct, y, ''), text(SEL.bar, y, '')]);
    }
    this.lastText = text(GAME_WIDTH / 2, SEL.rowY + DIVES.length * SEL.rowH + 6, '', 8, '#47c1d9').setOrigin(0.5, 0);
    const footer = text(GAME_WIDTH / 2, SEL.y + SEL.h - 32, 'PFEIL HOCH/RUNTER: WÄHLEN   ENTER: SPRINGEN', 8, '#f7d038').setOrigin(0.5, 0);
    this.footer2 = text(GAME_WIDTH / 2, SEL.y + SEL.h - 18, '', 8, '#9aa0b8').setOrigin(0.5, 0);
    this.container = scene.add
      .container(0, 0, [this.g, this.title, ...headers, ...this.rowTexts.flat(), this.lastText, footer, this.footer2])
      .setDepth(300)
      .setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  show(round: number, rows: DiveSelectRow[], selected: number, lastSwing: number | null, exitHint: string): void {
    this.rows = rows;
    this.lastSwing = lastSwing;
    this.title.setText(`DEIN ${round}. SPRUNG`);
    this.lastText.setText(lastSwing !== null ? `DEIN SCHWUNG ZULETZT: ${Math.round(lastSwing * 100)}%` : '');
    this.footer2.setText(exitHint);
    this.select(selected);
    this.setVisible(true);
  }

  select(index: number): void {
    this.selected = index;
    this.rows.forEach((r, i) => {
      const [name, dd, pct, pts] = this.rowTexts[i];
      const used = r.points !== null;
      const color = used ? '#5d6278' : i === index ? '#f7d038' : '#ffffff';
      name.setText(r.def.name).setColor(color);
      dd.setText(r.def.dd.toFixed(1)).setColor(color);
      pct.setText(used ? '' : `${Math.round(r.need * 100)}%`).setColor(color);
      pts.setText(used ? `${r.points!.toFixed(2)} P` : '').setColor('#9aa0b8');
    });
  }

  update(time: number): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x10101c, 0.9);
    g.fillRect(SEL.x, SEL.y, SEL.w, SEL.h);
    g.lineStyle(1, COLORS.yellow, 1);
    g.strokeRect(SEL.x + 0.5, SEL.y + 0.5, SEL.w - 1, SEL.h - 1);
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(SEL.x + 12, SEL.y + 48, SEL.w - 24, 1);
    this.rows.forEach((r, i) => {
      const y = SEL.rowY + i * SEL.rowH;
      if (i === this.selected) {
        g.fillStyle(COLORS.yellow, 0.15);
        g.fillRect(SEL.x + 12, y - 5, SEL.w - 24, 17);
        if (Math.floor(time * 3) % 2 === 0) {
          g.fillStyle(COLORS.yellow, 1);
          g.fillTriangle(SEL.x + 14, y - 1, SEL.x + 14, y + 7, SEL.x + 19, y + 3);
        }
      }
      if (r.points !== null) return;
      // Balken: nötiger Schwung, Farbe nach Schwierigkeit; weißer Strich = eigener Schwung zuletzt
      const w = Math.round(Math.min(1, r.need) * SEL.barW);
      g.fillStyle(0x2a2e40, 1);
      g.fillRect(SEL.bar, y, SEL.barW, 7);
      g.fillStyle(r.need < 0.55 ? 0x4cd964 : r.need < 0.85 ? COLORS.yellow : COLORS.red, 1);
      g.fillRect(SEL.bar, y, w, 7);
      if (this.lastSwing !== null) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(SEL.bar + Math.round(Math.min(1, this.lastSwing) * SEL.barW), y - 2, 1, 11);
      }
    });
  }
}
