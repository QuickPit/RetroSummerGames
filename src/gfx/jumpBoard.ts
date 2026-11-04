import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import type { FlagSpec } from '../data/countries';
import { drawFlag } from './flags';

export interface JumpBoardRow {
  flag: FlagSpec;
  label: string;
  isPlayer: boolean;
  /** Ist gerade an der Reihe */
  current: boolean;
  /** Je Durchgang: Weite bzw. Punkte, 'X' für ungültig, '' für noch offen */
  attempts: string[];
  best: string;
}

const X = { flag: 84, name: 106, attempts: [300, 360, 420], best: 490 };
const ROW_Y = 136;
const ROW_H = 20;

/** Anzeigetafel für Disziplinen mit mehreren Durchgängen (z. B. Weitsprung). */
export class JumpBoard {
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly roundText: Phaser.GameObjects.Text;
  private readonly rowTexts: Phaser.GameObjects.Text[][] = [];
  private readonly footer: Phaser.GameObjects.Text;
  private readonly footer2: Phaser.GameObjects.Text;
  private rows: JumpBoardRow[] = [];
  /** Deckkraft des Hintergrunds (Turmspringen: deckend, damit die Hallentafel nicht durchscheint) */
  bgAlpha = 0.88;

  /** `bestHeader`: Kopf der letzten Spalte, z. B. 'GESAMT' beim Turmspringen */
  constructor(scene: Phaser.Scene, title: string, rowCount: number, rounds: number, bestHeader = 'BEST') {
    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
    this.g = scene.add.graphics();
    const titleText = text(GAME_WIDTH / 2, 50, title, 8, '#9aa0b8').setOrigin(0.5, 0);
    this.roundText = text(GAME_WIDTH / 2, 66, '', 16, '#f7d038').setOrigin(0.5, 0);
    const header = '#9aa0b8';
    const headers = [
      text(X.name, 112, 'NATION', 8, header),
      ...Array.from({ length: rounds }, (_, i) => text(X.attempts[i], 112, `${i + 1}.`, 8, header)),
      text(X.best, 112, bestHeader, 8, header),
    ];
    for (let i = 0; i < rowCount; i++) {
      const y = ROW_Y + i * ROW_H;
      this.rowTexts.push([
        text(X.name, y, ''),
        ...Array.from({ length: rounds }, (_, k) => text(X.attempts[k], y, '')),
        text(X.best, y, ''),
      ]);
    }
    this.footer = text(GAME_WIDTH / 2, 236, '', 8, '#f7d038').setOrigin(0.5, 0);
    this.footer2 = text(GAME_WIDTH / 2, 254, '', 8, '#ffffff').setOrigin(0.5, 0);
    this.container = scene.add
      .container(0, 0, [this.g, titleText, this.roundText, ...headers, ...this.rowTexts.flat(), this.footer, this.footer2])
      .setDepth(300);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  show(heading: string, rows: JumpBoardRow[], footer: string, footer2: string): void {
    this.rows = rows;
    this.roundText.setText(heading);
    this.footer.setText(footer);
    this.footer2.setText(footer2);
    rows.forEach((r, i) => {
      const texts = this.rowTexts[i];
      const color = r.isPlayer ? '#f7d038' : '#ffffff';
      texts[0].setText(r.label).setColor(color);
      r.attempts.forEach((a, k) => texts[k + 1].setText(a).setColor(a === 'X' ? '#e8442e' : color));
      texts[texts.length - 1].setText(r.best).setColor(color);
    });
    this.setVisible(true);
  }

  update(time: number): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x10101c, this.bgAlpha);
    g.fillRect(60, 42, GAME_WIDTH - 120, 232);
    g.lineStyle(1, COLORS.yellow, 1);
    g.strokeRect(60.5, 42.5, GAME_WIDTH - 121, 231);
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(72, 124, GAME_WIDTH - 144, 1);
    g.fillRect(72, 228, GAME_WIDTH - 144, 1);
    this.rows.forEach((r, i) => {
      const y = ROW_Y + i * ROW_H;
      if (r.current) {
        g.fillStyle(COLORS.yellow, 0.15);
        g.fillRect(72, y - 5, GAME_WIDTH - 144, 18);
        if (Math.floor(time * 3) % 2 === 0) {
          g.fillStyle(COLORS.yellow, 1);
          g.fillTriangle(74, y - 1, 74, y + 7, 79, y + 3);
        }
      }
      drawFlag(g, r.flag, X.flag, y - 1, 14, 10);
    });
  }
}
