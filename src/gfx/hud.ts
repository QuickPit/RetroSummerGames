import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import { PHYSICS, TRACK, type RunnerState, type Side } from '../sim/hurdles';

export interface HudRunner {
  state: RunnerState;
  color: number;
  isPlayer: boolean;
}

const BOTTOM_Y = 326;
const TAP_WINDOW = 1;

/** Anzeige: Zeit, Mini-Karte, Tempo, Tasten-Feedback, Hürden-Bilanz. */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly rateText: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly subMessage: Phaser.GameObjects.Text;
  private readonly tapTimes: number[] = [];
  private flashSide: Side | null = null;
  private flashUntil = 0;
  private now = 0;

  constructor(scene: Phaser.Scene, eventName: string) {
    this.g = scene.add.graphics().setDepth(200);
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };
    scene.add.text(8, 8, eventName, style).setDepth(201);
    this.timeText = scene.add
      .text(GAME_WIDTH - 8, 4, '0.00', { ...style, fontSize: '16px' })
      .setOrigin(1, 0)
      .setDepth(201);
    scene.add.text(8, BOTTOM_Y + 6, 'TEMPO', style).setDepth(201);
    scene.add.text(330, BOTTOM_Y + 6, 'TIPPS/S', style).setDepth(201);
    this.rateText = scene.add.text(330, BOTTOM_Y + 18, '0.0', { ...style, fontSize: '16px' }).setDepth(201);
    scene.add.text(452, BOTTOM_Y + 6, 'HÜRDEN', style).setDepth(201);
    scene.add.text(268, BOTTOM_Y + 6, 'SPRUNG', { ...style, color: '#9aa0b8' }).setOrigin(0.5, 0).setDepth(201);

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
    this.message.setText(text).setColor(color);
    this.subMessage.setText(sub);
  }

  registerTap(side: Side, valid: boolean, time: number): void {
    if (valid) this.tapTimes.push(time);
    this.flashSide = side;
    this.flashUntil = time + (valid ? 0.07 : 0.15);
  }

  update(time: number, raceTime: number, runners: HudRunner[]): void {
    this.now = time;
    const player = runners.find((r) => r.isPlayer)!;
    const p = player.state;
    while (this.tapTimes.length && this.tapTimes[0] < time - TAP_WINDOW) this.tapTimes.shift();

    const shown = p.finishTime ?? Math.max(0, raceTime);
    this.timeText.setText(shown.toFixed(2));
    this.rateText.setText((this.tapTimes.length / TAP_WINDOW).toFixed(1));

    const g = this.g;
    g.clear();

    // Obere und untere Leiste
    g.fillStyle(COLORS.hudBg, 0.75);
    g.fillRect(0, 0, GAME_WIDTH, 24);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 360 - BOTTOM_Y);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 1);

    this.drawMiniMap(g, runners);
    this.drawSpeed(g, p.v);
    this.drawKeys(g, p);
    this.drawHurdles(g, p);
  }

  private drawMiniMap(g: Phaser.GameObjects.Graphics, runners: HudRunner[]): void {
    const x0 = 180;
    const x1 = 440;
    const y = 12;
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(x0, y - 1, x1 - x0, 3);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < TRACK.hurdleCount; i++) {
      const hx = x0 + ((TRACK.firstHurdle + i * TRACK.hurdleSpacing) / TRACK.distance) * (x1 - x0);
      g.fillRect(Math.round(hx), y - 3, 1, 3);
    }
    // Zielflagge
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0x10101c : 0xffffff, 1);
      g.fillRect(x1 + (i % 2) * 2, y - 6 + Math.floor(i / 2) * 2, 2, 2);
      g.fillStyle(i % 2 ? 0xffffff : 0x10101c, 1);
      g.fillRect(x1 + ((i + 1) % 2) * 2, y - 6 + Math.floor(i / 2) * 2, 2, 2);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(x1, y - 6, 1, 9);

    const sorted = [...runners].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
    for (const r of sorted) {
      const px = x0 + Math.min(1.04, Math.max(0, r.state.x / TRACK.distance)) * (x1 - x0);
      const s = r.isPlayer ? 3 : 2;
      g.fillStyle(r.isPlayer ? 0xffffff : COLORS.outline, 1);
      g.fillRect(Math.round(px) - s - 1, y - s, s * 2 + 2, s * 2 + 1);
      g.fillStyle(r.color, 1);
      g.fillRect(Math.round(px) - s, y - s + 1, s * 2, s * 2 - 1);
    }
  }

  private drawSpeed(g: Phaser.GameObjects.Graphics, v: number): void {
    const segments = 24;
    const filled = Math.round((v / PHYSICS.maxSpeed) * segments);
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const color = t < 0.55 ? 0x4cd964 : t < 0.85 ? COLORS.yellow : COLORS.red;
      g.fillStyle(i < filled ? color : 0x2a2e40, 1);
      g.fillRect(8 + i * 6, BOTTOM_Y + 18, 5, 12);
    }
  }

  private drawKeys(g: Phaser.GameObjects.Graphics, p: RunnerState): void {
    const next: Side = p.lastSide === 'L' ? 'R' : 'L';
    const flashing = this.now < this.flashUntil;
    const keyCap = (x: number, side: Side) => {
      const lit = flashing && this.flashSide === side;
      const expected = next === side && p.finishTime === null;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x - 1, BOTTOM_Y + 15, 26, 20);
      g.fillStyle(lit ? 0xffffff : expected ? COLORS.yellow : 0x5d6278, 1);
      g.fillRect(x, BOTTOM_Y + 16, 24, 17);
      g.fillStyle(lit ? 0xd0d0d0 : expected ? COLORS.orange : 0x3a3f55, 1);
      g.fillRect(x, BOTTOM_Y + 30, 24, 3);
      g.fillStyle(COLORS.outline, 1);
      const cx = x + 12;
      const cy = BOTTOM_Y + 23;
      if (side === 'L') g.fillTriangle(cx - 6, cy, cx + 4, cy - 5, cx + 4, cy + 5);
      else g.fillTriangle(cx + 6, cy, cx - 4, cy - 5, cx - 4, cy + 5);
    };
    keyCap(186, 'L');
    keyCap(214, 'R');

    const airborne = p.air >= 0;
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(243, BOTTOM_Y + 15, 52, 20);
    g.fillStyle(airborne ? 0x47c1d9 : 0x5d6278, 1);
    g.fillRect(244, BOTTOM_Y + 16, 50, 17);
    g.fillStyle(airborne ? 0x2a8aa0 : 0x3a3f55, 1);
    g.fillRect(244, BOTTOM_Y + 30, 50, 3);
  }

  private drawHurdles(g: Phaser.GameObjects.Graphics, p: RunnerState): void {
    p.hurdles.forEach((h, i) => {
      const x = 452 + i * 18;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x - 1, BOTTOM_Y + 17, 15, 15);
      g.fillStyle(h === 'clear' ? 0x4cd964 : h === 'hit' ? COLORS.red : 0x3a3f55, 1);
      g.fillRect(x, BOTTOM_Y + 18, 13, 13);
      if (i === p.nextHurdle && p.finishTime === null) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x, BOTTOM_Y + 31, 13, 2);
      }
    });
  }
}
