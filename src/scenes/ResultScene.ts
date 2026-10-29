import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_WIDTH, WORLD_RECORD } from '../config';
import type { Country } from '../data/countries';
import { loadBest, saveBest } from '../data/storage';
import { drawFlag } from '../gfx/flags';
import { cheerPose, drawRunner, wavePose, type RunnerLook } from '../gfx/runner';
import { Stadium } from '../gfx/stadium';

export interface RaceResult {
  country: Country;
  look: RunnerLook;
  /** null = nicht im Ziel angekommen */
  time: number | null;
  x: number;
  hits: number;
  reaction: number | null;
  isPlayer: boolean;
}

interface ResultSceneData {
  results: RaceResult[];
  countryIndex: number;
  falseStarts: number;
}

const EVENT_KEY = '110h';
const MEDALS = [COLORS.gold, COLORS.silver, COLORS.bronze];
const PODIUM_BASE_Y = 166;
/** [Platzierung, Mitte X, Höhe] – Silber links, Gold Mitte, Bronze rechts */
const PODIUM: [number, number, number][] = [
  [1, GAME_WIDTH / 2 - 70, 30],
  [0, GAME_WIDTH / 2, 42],
  [2, GAME_WIDTH / 2 + 70, 22],
];

export class ResultScene extends Phaser.Scene {
  private data_!: ResultSceneData;
  private ranked: RaceResult[] = [];
  private podiumGfx!: Phaser.GameObjects.Graphics;
  private elapsed = 0;

  constructor() {
    super('result');
  }

  init(data: ResultSceneData): void {
    this.data_ = data;
    this.elapsed = 0;
    this.ranked = [...data.results].sort((a, b) => {
      if (a.time !== null && b.time !== null) return a.time - b.time;
      if (a.time !== null) return -1;
      if (b.time !== null) return 1;
      return b.x - a.x;
    });
  }

  create(): void {
    const stadium = new Stadium(this);
    stadium.update(1200, 0, 0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, 360, 0x10101c, 0.78).setOrigin(0);
    this.cameras.main.fadeIn(300, 16, 16, 28);

    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });

    text(GAME_WIDTH / 2, 12, 'ERGEBNIS', 16, '#f7d038').setOrigin(0.5, 0);
    text(GAME_WIDTH / 2, 34, '110 M HÜRDEN', 8, '#9aa0b8').setOrigin(0.5, 0);

    // Podest
    this.podiumGfx = this.add.graphics();
    const g = this.add.graphics();
    for (const [rank, cx, h] of PODIUM) {
      const r = this.ranked[rank];
      if (!r || r.time === null) continue;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(cx - 31, PODIUM_BASE_Y - h - 1, 62, h + 1);
      g.fillStyle(0xe8e8f0, 1);
      g.fillRect(cx - 30, PODIUM_BASE_Y - h, 60, h);
      g.fillStyle(0xb8bcd0, 1);
      g.fillRect(cx - 30, PODIUM_BASE_Y - 3, 60, 3);
      text(cx, PODIUM_BASE_Y - h + 6, String(rank + 1), 16, '#10101c').setOrigin(0.5, 0);
      drawFlag(g, r.country.flag, cx + 14, PODIUM_BASE_Y - h - 24, 16, 11);
    }

    // Tabelle
    const tableY = 178;
    const cols = { place: 70, flag: 104, nation: 130, time: 320, hits: 400, reaction: 480 };
    const header = '#9aa0b8';
    text(cols.place, tableY, 'PL', 8, header);
    text(cols.nation, tableY, 'NATION', 8, header);
    text(cols.time, tableY, 'ZEIT', 8, header);
    text(cols.hits, tableY, 'HÜRDEN', 8, header);
    text(cols.reaction, tableY, 'REAKTION', 8, header);
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(60, tableY + 12, GAME_WIDTH - 120, 1);

    this.ranked.forEach((r, i) => {
      const y = tableY + 20 + i * 18;
      const color = r.isPlayer ? '#f7d038' : '#ffffff';
      if (r.isPlayer) {
        g.fillStyle(0xf7d038, 0.15);
        g.fillRect(60, y - 4, GAME_WIDTH - 120, 16);
      }
      if (i < 3 && r.time !== null) {
        g.fillStyle(COLORS.outline, 1);
        g.fillCircle(cols.place + 4, y + 4, 6);
        g.fillStyle(MEDALS[i], 1);
        g.fillCircle(cols.place + 4, y + 4, 5);
        text(cols.place + 4, y + 1, String(i + 1), 8, '#10101c').setOrigin(0.5, 0);
      } else {
        text(cols.place, y, `${i + 1}.`, 8, color);
      }
      drawFlag(g, r.country.flag, cols.flag, y - 1, 14, 10);
      text(cols.nation, y, `${r.country.code} ${r.country.name}${r.isPlayer ? ' (DU)' : ''}`, 8, color);
      text(cols.time, y, r.time !== null ? r.time.toFixed(2) : 'DNF', 8, color);
      text(cols.hits, y, r.hits === 0 ? 'SAUBER' : `${r.hits}x`, 8, r.hits === 0 ? '#4cd964' : '#e8442e');
      text(cols.reaction, y, r.reaction !== null ? r.reaction.toFixed(3) : '-', 8, color);
    });

    // Persönliche Bestzeit
    const player = this.ranked.find((r) => r.isPlayer)!;
    const place = this.ranked.indexOf(player) + 1;
    const previous = loadBest(EVENT_KEY);
    const footerY = 274;
    let line = '';
    let lineColor = '#ffffff';
    if (player.time !== null) {
      if (!previous || player.time < previous.time) {
        saveBest(EVENT_KEY, { time: player.time, country: player.country.code });
        line = previous ? `NEUE BESTZEIT! (BISHER ${previous.time.toFixed(2)})` : 'ERSTE BESTZEIT AUFGESTELLT!';
        lineColor = '#4cd964';
      } else {
        line = `DEINE BESTZEIT: ${previous.time.toFixed(2)} (${previous.country})`;
      }
      if (player.time < WORLD_RECORD) {
        line = `WELTREKORD! ${player.time.toFixed(2)} < ${WORLD_RECORD.toFixed(2)}`;
        lineColor = '#f7c843';
      }
    }
    const best = text(GAME_WIDTH / 2, footerY, line, 8, lineColor).setOrigin(0.5, 0);
    if (lineColor !== '#ffffff') {
      this.tweens.add({ targets: best, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    }
    if (this.data_.falseStarts > 0) {
      text(GAME_WIDTH / 2, footerY + 14, `FEHLSTARTS: ${this.data_.falseStarts}`, 8, '#9aa0b8').setOrigin(0.5, 0);
    }

    const prompt = text(GAME_WIDTH / 2, 330, 'ENTER: NOCHMAL   ESC: MENÜ', 8, '#f7d038').setOrigin(0.5, 0);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });

    if (place === 1) sfx.fanfare();
    sfx.crowd(place <= 3 ? 0.7 : 0.25);

    const kb = this.input.keyboard!;
    const onKey = (ev: KeyboardEvent) => {
      sfx.unlock();
      if (ev.repeat) return;
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') {
        sfx.confirm();
        this.scene.start('race', { countryIndex: this.data_.countryIndex });
      } else if (ev.code === 'Escape') {
        this.scene.start('title');
      } else if (ev.code === 'KeyM') {
        sfx.toggleMute();
      }
    };
    kb.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
  }

  update(_time: number, deltaMs: number): void {
    this.elapsed += deltaMs / 1000;
    const g = this.podiumGfx;
    g.clear();
    for (const [rank, cx, h] of PODIUM) {
      const r = this.ranked[rank];
      if (!r || r.time === null) continue;
      const t = this.elapsed + rank * 0.7;
      const pose = rank === 0 ? cheerPose(t) : wavePose(t);
      const bounce = rank === 0 ? Math.abs(Math.sin(t * 6)) * 4 : 0;
      drawRunner(g, cx - 6, PODIUM_BASE_Y - h, pose, r.look, {
        lift: bounce,
        mood: 'joy',
        time: t,
        medal: MEDALS[rank],
      });
    }
  }
}
