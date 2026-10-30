import Phaser from 'phaser';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import type { FlagSpec } from '../data/countries';
import { drawFlag } from './flags';

export interface BoardRow {
  flag: FlagSpec;
  label: string;
  isPlayer: boolean;
  /** Ist gerade an der Reihe */
  current: boolean;
  out: boolean;
  best: string;
  /** Versuche an der aktuellen Höhe, z. B. „XO“ */
  marks: string;
  status: string;
}

const X = { flag: 84, name: 106, best: 330, marks: 400, status: 456 };
const ROW_Y = 136;
const ROW_H = 20;

/** Anzeigetafel mit dem Zwischenstand zwischen den Sprüngen. */
export class VaultBoard {
  private readonly container: Phaser.GameObjects.Container;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly heightText: Phaser.GameObjects.Text;
  private readonly rowTexts: Phaser.GameObjects.Text[][] = [];
  private readonly footer: Phaser.GameObjects.Text;
  private readonly footer2: Phaser.GameObjects.Text;
  private rows: BoardRow[] = [];

  constructor(scene: Phaser.Scene, rowCount: number) {
    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
    this.g = scene.add.graphics();
    const title = text(GAME_WIDTH / 2, 50, 'STABHOCHSPRUNG', 8, '#9aa0b8').setOrigin(0.5, 0);
    this.heightText = text(GAME_WIDTH / 2, 66, '', 16, '#f7d038').setOrigin(0.5, 0);
    const header = '#9aa0b8';
    const headers = [
      text(X.name, 112, 'NATION', 8, header),
      text(X.best, 112, 'BEST', 8, header),
      text(X.marks, 112, 'HÖHE', 8, header),
      text(X.status, 112, 'STATUS', 8, header),
    ];
    for (let i = 0; i < rowCount; i++) {
      const y = ROW_Y + i * ROW_H;
      this.rowTexts.push([text(X.name, y, ''), text(X.best, y, ''), text(X.marks, y, ''), text(X.status, y, '')]);
    }
    this.footer = text(GAME_WIDTH / 2, 236, '', 8, '#f7d038').setOrigin(0.5, 0);
    this.footer2 = text(GAME_WIDTH / 2, 254, '', 8, '#ffffff').setOrigin(0.5, 0);
    this.container = scene.add
      .container(0, 0, [this.g, title, this.heightText, ...headers, ...this.rowTexts.flat(), this.footer, this.footer2])
      .setDepth(300);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  show(height: number, rows: BoardRow[], footer: string, footer2: string): void {
    this.rows = rows;
    this.heightText.setText(`LATTE: ${height.toFixed(2)} M`);
    this.footer.setText(footer);
    this.footer2.setText(footer2);
    rows.forEach((r, i) => {
      const [name, best, marks, status] = this.rowTexts[i];
      const color = r.out ? '#5d6278' : r.isPlayer ? '#f7d038' : '#ffffff';
      name.setText(r.label).setColor(color);
      best.setText(r.best).setColor(color);
      marks.setText(r.marks.split('').join(' ')).setColor(color);
      status.setText(r.status).setColor(r.out ? '#e8442e' : '#9aa0b8');
    });
    this.setVisible(true);
  }

  /** Muss jedes Bild aufgerufen werden – der Pfeil blinkt. */
  update(time: number): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x10101c, 0.88);
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
      // Versuche als farbige Kästchen hinter den Buchstaben
      for (let k = 0; k < r.marks.length; k++) {
        const m = r.marks[k];
        if (m === '-') continue;
        g.fillStyle(m === 'O' ? 0x2d8a4e : 0x9a2a1f, 1);
        g.fillRect(X.marks - 2 + k * 16, y - 2, 12, 12);
      }
    });
  }
}
