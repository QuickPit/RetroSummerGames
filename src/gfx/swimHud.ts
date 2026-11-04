import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import type { Side } from '../sim/hurdles';
import { SWIM, type StrokeQuality, type SwimmerState } from '../sim/swim';
import { BOTTOM_Y, drawActionKey, drawKeyCaps, drawSpeedBar, drawUpKey } from './hud';

export interface SwimHudSwimmer {
  state: SwimmerState;
  color: number;
  isPlayer: boolean;
}

export interface SwimHudInput {
  /** Beschriftung über der Leertaste */
  actionLabel: 'START' | 'WENDE';
  actionLit: boolean;
}

const TAKT_X = 316;
const TAKT_BOXES = 8;
const AIR_X = 420;
const AIR_SEGMENTS = 16;

/** Anzeige beim Schwimmen: Zeit, Mini-Karte, Tempo, Tasten, Takt der letzten Züge und Luft. */
export class SwimHud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly subMessage: Phaser.GameObjects.Text;
  /** Letzte Züge: grün = im Takt, gelb = hektisch, rot = verschluckt */
  private readonly takt: ('takt' | 'hasty' | 'choke')[] = [];
  private flashSide: Side | null = null;
  private flashUntil = 0;
  private missUntil = 0;

  constructor(scene: Phaser.Scene) {
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };
    this.g = scene.add.graphics().setDepth(200);
    scene.add.text(8, 8, '100 M FREISTIL', style).setDepth(201);
    this.timeText = scene.add
      .text(GAME_WIDTH - 8, 4, '0.00', { ...style, fontSize: '16px' })
      .setOrigin(1, 0)
      .setDepth(201);
    scene.add.text(8, BOTTOM_Y + 6, 'TEMPO', style).setDepth(201);
    this.actionText = scene.add
      .text(269, BOTTOM_Y + 6, 'START', { ...style, color: '#9aa0b8' })
      .setOrigin(0.5, 0)
      .setDepth(201);
    scene.add.text(TAKT_X, BOTTOM_Y + 6, 'TAKT', style).setDepth(201);
    scene.add.text(AIR_X, BOTTOM_Y + 6, 'LUFT ↑', style).setDepth(201);

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
  }

  setMessage(text: string, sub = '', color = '#f7d038'): void {
    // Wird jedes Bild aufgerufen – nur bei Änderung neu zeichnen
    if (this.message.text !== text) this.message.setText(text);
    if (this.message.style.color !== color) this.message.setColor(color);
    if (this.subMessage.text !== sub) this.subMessage.setText(sub);
  }

  registerTap(side: Side, valid: boolean, now: number): void {
    this.flashSide = side;
    this.flashUntil = now + (valid ? 0.07 : 0.15);
  }

  /** Ein gewerteter Zug für die TAKT-Kästchen */
  registerStroke(quality: StrokeQuality, inTakt: boolean): void {
    this.takt.push(quality === 'choke' ? 'choke' : inTakt ? 'takt' : 'hasty');
    while (this.takt.length > TAKT_BOXES) this.takt.shift();
  }

  /** Leertaste ohne Wirkung: Taste blinkt kurz rot */
  registerMiss(now: number): void {
    this.missUntil = now + 0.25;
  }

  update(now: number, raceTime: number, swimmers: SwimHudSwimmer[], input: SwimHudInput): void {
    const p = swimmers.find((s) => s.isPlayer)!.state;
    // Texte nur bei Änderung neu setzen – jedes setText/setColor zeichnet die Textur neu
    const time = (p.finishTime ?? Math.max(0, raceTime)).toFixed(2);
    if (this.timeText.text !== time) this.timeText.setText(time);
    if (this.actionText.text !== input.actionLabel) this.actionText.setText(input.actionLabel);
    const actionColor = input.actionLit ? '#ffffff' : '#9aa0b8';
    if (this.actionText.style.color !== actionColor) this.actionText.setColor(actionColor);

    const g = this.g;
    g.clear();
    g.fillStyle(COLORS.hudBg, 0.75);
    g.fillRect(0, 0, GAME_WIDTH, 24);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 360 - BOTTOM_Y);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 1);

    this.drawMiniMap(g, swimmers);
    drawSpeedBar(g, p.v, SWIM.maxSpeed);
    const swimming = p.phase === 'swim';
    drawKeyCaps(g, swimming ? (p.lastSide === 'L' ? 'R' : 'L') : null, now < this.flashUntil ? this.flashSide : null);
    if (now < this.missUntil) drawActionKey(g, true, COLORS.red);
    else drawActionKey(g, input.actionLit && Math.floor(now * 6) % 2 === 0);
    this.drawTakt(g);
    this.drawAir(g, p, now);
  }

  private drawMiniMap(g: Phaser.GameObjects.Graphics, swimmers: SwimHudSwimmer[]): void {
    const x0 = 180;
    const x1 = 440;
    const y = 12;
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(x0, y - 1, x1 - x0, 3);
    // Wende bei 50 m
    g.fillStyle(0xffffff, 1);
    g.fillRect(Math.round((x0 + x1) / 2), y - 4, 1, 4);
    // Zielflagge
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0x10101c : 0xffffff, 1);
      g.fillRect(x1 + (i % 2) * 2, y - 6 + Math.floor(i / 2) * 2, 2, 2);
      g.fillStyle(i % 2 ? 0xffffff : 0x10101c, 1);
      g.fillRect(x1 + ((i + 1) % 2) * 2, y - 6 + Math.floor(i / 2) * 2, 2, 2);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(x1, y - 6, 1, 9);
    for (const r of [...swimmers].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))) {
      const px = Math.round(x0 + Math.min(1, Math.max(0, r.state.d / SWIM.distance)) * (x1 - x0));
      const s = r.isPlayer ? 3 : 2;
      g.fillStyle(r.isPlayer ? 0xffffff : COLORS.outline, 1);
      g.fillRect(px - s - 1, y - s, s * 2 + 2, s * 2 + 1);
      g.fillStyle(r.color, 1);
      g.fillRect(px - s, y - s + 1, s * 2, s * 2 - 1);
    }
  }

  private drawTakt(g: Phaser.GameObjects.Graphics): void {
    const offset = TAKT_BOXES - this.takt.length;
    for (let i = 0; i < TAKT_BOXES; i++) {
      const x = TAKT_X + i * 11;
      const entry = this.takt[i - offset];
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x - 1, BOTTOM_Y + 16, 11, 15);
      g.fillStyle(entry === 'takt' ? 0x4cd964 : entry === 'hasty' ? COLORS.yellow : entry === 'choke' ? COLORS.red : 0x2a2e40, 1);
      g.fillRect(x, BOTTOM_Y + 17, 9, 13);
    }
  }

  private drawAir(g: Phaser.GameObjects.Graphics, p: SwimmerState, now: number): void {
    // Beim Atmen füllt sich der Balken sichtbar auf
    const breath = p.breathing > 0 ? 1 - p.breathing / SWIM.breathTime : 0;
    const air = p.air + (1 - p.air) * breath;
    const filled = Math.ceil(air * AIR_SEGMENTS - 0.001);
    const low = air < SWIM.lowAir;
    const color = low ? COLORS.red : air < 0.5 ? COLORS.yellow : 0x7fd0f4;
    const blinkOff = low && Math.floor(now * 6) % 2 === 1;
    for (let i = 0; i < AIR_SEGMENTS; i++) {
      g.fillStyle(i < filled && !blinkOff ? color : 0x2a2e40, 1);
      g.fillRect(AIR_X + i * 11, BOTTOM_Y + 18, 10, 12);
    }
    drawUpKey(g, AIR_X + AIR_SEGMENTS * 11 + 4, p.breathing > 0);
  }
}
