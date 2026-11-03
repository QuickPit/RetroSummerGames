import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import { BMX, COURSE, type RiderState } from '../sim/bmx';
import type { Side } from '../sim/hurdles';
import { BOTTOM_Y, drawActionKey, drawKeyCaps, drawSpeedBar } from './hud';

export interface BmxHudRider {
  state: RiderState;
  color: number;
  isPlayer: boolean;
}

/** Anzeige beim BMX: Zeit, Punkte, Strecke, Tempo, Stürze. */
export class BmxHud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly pointsText: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly subMessage: Phaser.GameObjects.Text;
  private flashSide: Side | null = null;
  private flashUntil = 0;

  constructor(scene: Phaser.Scene) {
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };
    this.g = scene.add.graphics().setDepth(200);
    scene.add.text(8, 8, 'BMX', style).setDepth(201);
    this.timeText = scene.add
      .text(GAME_WIDTH - 8, 4, '0.00', { ...style, fontSize: '16px' })
      .setOrigin(1, 0)
      .setDepth(201);
    scene.add.text(8, BOTTOM_Y + 6, 'TEMPO', style).setDepth(201);
    scene.add.text(268, BOTTOM_Y + 6, 'TRICK', { ...style, color: '#9aa0b8' }).setOrigin(0.5, 0).setDepth(201);
    scene.add.text(330, BOTTOM_Y + 6, 'PUNKTE', style).setDepth(201);
    this.pointsText = scene.add.text(330, BOTTOM_Y + 18, '0', { ...style, fontSize: '16px' }).setDepth(201);
    scene.add.text(490, BOTTOM_Y + 6, 'STÜRZE', style).setDepth(201);
    this.message = scene.add
      .text(GAME_WIDTH / 2, 80, '', {
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
      .text(GAME_WIDTH / 2, 108, '', {
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

  registerTap(side: Side, valid: boolean, now: number): void {
    this.flashSide = side;
    this.flashUntil = now + (valid ? 0.07 : 0.15);
  }

  update(now: number, raceTime: number, riders: BmxHudRider[], trickHeld: boolean): void {
    const p = riders.find((r) => r.isPlayer)!.state;
    this.timeText.setText((p.finishTime ?? Math.max(0, raceTime)).toFixed(2));
    this.pointsText.setText(String(p.points));

    const g = this.g;
    g.clear();
    g.fillStyle(COLORS.hudBg, 0.75);
    g.fillRect(0, 0, GAME_WIDTH, 24);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 360 - BOTTOM_Y);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 1);

    // Mini-Karte mit Rampen
    const x0 = 120;
    const x1 = 440;
    const y = 12;
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(x0, y - 1, x1 - x0, 3);
    g.fillStyle(0xb9733f, 1);
    for (const f of COURSE.features) {
      if (f.kind === 'roller') continue;
      g.fillRect(Math.round(x0 + (f.x / COURSE.length) * (x1 - x0)), y - 4, 2, 3);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(x1, y - 6, 1, 9);
    for (const r of [...riders].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))) {
      const px = Math.round(x0 + Math.min(1.03, Math.max(0, r.state.x / COURSE.length)) * (x1 - x0));
      const s = r.isPlayer ? 3 : 2;
      g.fillStyle(r.isPlayer ? 0xffffff : COLORS.outline, 1);
      g.fillRect(px - s - 1, y - s, s * 2 + 2, s * 2 + 1);
      g.fillStyle(r.color, 1);
      g.fillRect(px - s, y - s + 1, s * 2, s * 2 - 1);
    }

    drawSpeedBar(g, p.vx, BMX.maxSpeed);
    const pedaling = p.phase === 'ground';
    drawKeyCaps(g, pedaling ? (p.lastSide === 'L' ? 'R' : 'L') : null, now < this.flashUntil ? this.flashSide : null);
    drawActionKey(g, trickHeld && p.phase === 'air', COLORS.yellow);

    // Stürze als Helme
    for (let i = 0; i < BMX.maxCrashes; i++) {
      const cx = 498 + i * 20;
      const cy = BOTTOM_Y + 26;
      g.fillStyle(COLORS.outline, 1);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(i < p.crashes ? COLORS.red : 0x4cd964, 1);
      g.fillCircle(cx, cy, 6);
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(cx - 6, cy + 1, 13, 6);
      g.fillRect(cx + 1, cy - 2, 6, 2);
    }
  }
}
