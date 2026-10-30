import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import type { Side } from '../sim/hurdles';
import { VAULT, type VaultState } from '../sim/polevault';
import { BOTTOM_Y, drawActionKey, drawKeyCaps, drawSpeedBar } from './hud';

const TAP_WINDOW = 1;

/** Anzeige während eines Sprungs: Latte, Versuch, Tempo, Tasten. */
export class VaultHud {
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly barText: Phaser.GameObjects.Text;
  private readonly attemptText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;
  private readonly rateText: Phaser.GameObjects.Text;
  private readonly bestText: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly subMessage: Phaser.GameObjects.Text;
  private readonly tapTimes: number[] = [];
  private flashSide: Side | null = null;
  private flashUntil = 0;
  private actionUntil = 0;
  private marks = '';

  constructor(scene: Phaser.Scene) {
    const style = { fontFamily: FONT, fontSize: '8px', color: '#ffffff' };
    this.g = scene.add.graphics();
    this.barText = scene.add.text(GAME_WIDTH / 2, 8, '', style).setOrigin(0.5, 0);
    this.attemptText = scene.add.text(GAME_WIDTH - 8, 8, '', style).setOrigin(1, 0);
    this.actionText = scene.add.text(268, BOTTOM_Y + 6, '', { ...style, color: '#9aa0b8' }).setOrigin(0.5, 0);
    this.rateText = scene.add.text(330, BOTTOM_Y + 18, '0.0', { ...style, fontSize: '16px' });
    this.bestText = scene.add.text(GAME_WIDTH - 8, BOTTOM_Y + 22, '', style).setOrigin(1, 0);
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
        scene.add.text(8, 8, 'STABHOCHSPRUNG', style),
        this.barText,
        this.attemptText,
        scene.add.text(8, BOTTOM_Y + 6, 'TEMPO', style),
        scene.add.text(330, BOTTOM_Y + 6, 'TIPPS/S', style),
        scene.add.text(452, BOTTOM_Y + 6, 'VERSUCHE', style),
        this.actionText,
        this.rateText,
        this.bestText,
        this.message,
        this.subMessage,
      ])
      .setDepth(200);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /** Infos für den anstehenden Sprung */
  setAttempt(bar: number, attempt: number, marks: string, best: string): void {
    this.barText.setText(`LATTE ${bar.toFixed(2)} M`);
    this.attemptText.setText(`${attempt}. VERSUCH`);
    this.bestText.setText(best);
    this.marks = marks;
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

  registerAction(now: number): void {
    this.actionUntil = now + 0.25;
  }

  update(now: number, s: VaultState): void {
    while (this.tapTimes.length && this.tapTimes[0] < now - TAP_WINDOW) this.tapTimes.shift();
    this.rateText.setText((this.tapTimes.length / TAP_WINDOW).toFixed(1));
    const running = s.phase === 'ready' || s.phase === 'runup';
    this.actionText.setText(running ? 'EINSTICH' : s.phase === 'vault' ? 'LOSLASSEN' : '');

    const g = this.g;
    g.clear();
    g.fillStyle(COLORS.hudBg, 0.75);
    g.fillRect(0, 0, GAME_WIDTH, 24);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 360 - BOTTOM_Y);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(0, BOTTOM_Y, GAME_WIDTH, 1);

    drawSpeedBar(g, s.v, VAULT.maxSpeed);
    drawKeyCaps(g, running ? (s.lastSide === 'L' ? 'R' : 'L') : null, now < this.flashUntil ? this.flashSide : null);
    drawActionKey(g, now < this.actionUntil || s.phase === 'vault', s.phase === 'vault' ? COLORS.yellow : 0x47c1d9);

    // Bisherige Versuche an dieser Höhe
    for (let i = 0; i < 3; i++) {
      const x = 452 + i * 18;
      const m = this.marks[i];
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x - 1, BOTTOM_Y + 17, 15, 15);
      g.fillStyle(m === 'O' ? 0x4cd964 : m === 'X' ? COLORS.red : 0x3a3f55, 1);
      g.fillRect(x, BOTTOM_Y + 18, 13, 13);
      if (i === this.marks.length) {
        g.fillStyle(0xffffff, 1);
        g.fillRect(x, BOTTOM_Y + 31, 13, 2);
      }
    }
  }
}
