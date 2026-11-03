import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import type { Side } from '../sim/hurdles';
import { LJ, type LjState } from '../sim/longjump';
import { BOTTOM_Y, drawActionKey, drawKeyCaps, drawSpeedBar } from './hud';

const TAP_WINDOW = 1;

/** Anzeige beim Weitsprung: Durchgang, Tempo, Tasten und Winkelmesser. */
export class LongJumpHud {
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly roundText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;
  private readonly rateText: Phaser.GameObjects.Text;
  private readonly angleText: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly subMessage: Phaser.GameObjects.Text;
  private readonly tapTimes: number[] = [];
  private flashSide: Side | null = null;
  private flashUntil = 0;

  constructor(scene: Phaser.Scene) {
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };
    this.g = scene.add.graphics();
    this.roundText = scene.add.text(GAME_WIDTH / 2, 8, '', style).setOrigin(0.5, 0);
    this.bestText = scene.add.text(GAME_WIDTH - 8, 8, '', style).setOrigin(1, 0);
    this.actionText = scene.add.text(268, BOTTOM_Y + 6, '', { ...style, color: '#9aa0b8' }).setOrigin(0.5, 0);
    this.rateText = scene.add.text(330, BOTTOM_Y + 18, '0.0', { ...style, fontSize: '16px' });
    this.angleText = scene.add.text(540, BOTTOM_Y + 18, '', { ...style, fontSize: '16px' });
    this.message = scene.add
      .text(GAME_WIDTH / 2, 70, '', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#f7d038',
        stroke: '#10101c',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5);
    this.subMessage = scene.add
      .text(GAME_WIDTH / 2, 98, '', {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#ffffff',
        stroke: '#10101c',
        strokeThickness: 4,
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    this.container = scene.add
      .container(0, 0, [
        this.g,
        scene.add.text(8, 8, 'WEITSPRUNG', style),
        this.roundText,
        this.bestText,
        scene.add.text(8, BOTTOM_Y + 6, 'TEMPO', style),
        scene.add.text(330, BOTTOM_Y + 6, 'TIPPS/S', style),
        scene.add.text(452, BOTTOM_Y + 6, 'WINKEL', style),
        this.actionText,
        this.rateText,
        this.angleText,
        this.message,
        this.subMessage,
      ])
      .setDepth(200);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  setAttempt(round: number, best: string): void {
    this.roundText.setText(`${round}. DURCHGANG`);
    this.bestText.setText(best);
    this.tapTimes.length = 0;
  }

  setMessage(text: string, sub = '', color = '#f7d038'): void {
    this.message.setText(text).setColor(color);
    this.subMessage.setText(sub);
  }

  registerTap(side: Side, valid: boolean, now: number): void {
    if (valid) this.tapTimes.push(now);
    this.flashSide = side;
    this.flashUntil = now + (valid ? 0.07 : 0.15);
  }

  update(now: number, s: LjState): void {
    while (this.tapTimes.length && this.tapTimes[0] < now - TAP_WINDOW) this.tapTimes.shift();
    this.rateText.setText((this.tapTimes.length / TAP_WINDOW).toFixed(1));
    const running = s.phase === 'ready' || s.phase === 'runup';
    this.actionText.setText(
      running ? 'ABSPRUNG' : s.phase === 'takeoff' ? 'WINKEL' : s.phase === 'flight' ? 'LANDUNG' : '',
    );
    const showAngle = s.phase !== 'ready' && s.phase !== 'runup' && s.phase !== 'runthrough';
    this.angleText.setText(showAngle ? `${Math.round(s.angle)}°` : '');

    const g = this.g;
    g.clear();
    g.fillStyle(COLORS.hudBg, 0.75);
    g.fillRect(0, 0, GAME_WIDTH, 24);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 360 - BOTTOM_Y);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 1);

    drawSpeedBar(g, s.phase === 'flight' || s.phase === 'landed' ? s.vAvg : s.v, LJ.maxSpeed);
    drawKeyCaps(g, running ? (s.lastSide === 'L' ? 'R' : 'L') : null, now < this.flashUntil ? this.flashSide : null);
    drawActionKey(g, s.phase === 'takeoff' || (s.phase === 'flight' && s.extendAt !== null), COLORS.yellow);

    // Winkelmesser: Viertelkreis mit Zeiger
    const cx = 456;
    const cy = BOTTOM_Y + 32;
    const r = 16;
    g.fillStyle(0x2a2e40, 1);
    g.slice(cx, cy, r, -Math.PI / 2, 0, false);
    g.fillPath();
    g.lineStyle(1, 0x5d6278, 1);
    for (let deg = 0; deg <= 90; deg += 15) {
      const a = (-deg * Math.PI) / 180;
      g.lineBetween(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    if (showAngle) {
      const a = (-s.angle * Math.PI) / 180;
      g.lineStyle(2, COLORS.yellow, 1);
      g.lineBetween(cx, cy, cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    }
    g.fillStyle(COLORS.outline, 1);
    g.fillCircle(cx, cy, 2);
  }
}
