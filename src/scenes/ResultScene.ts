import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_WIDTH } from '../config';
import type { Country } from '../data/countries';
import { eventByKey, type EventKey } from '../data/events';
import { getCompetition, setCompetition } from '../data/session';
import { loadBest, saveBest } from '../data/storage';
import { drawFlag } from '../gfx/flags';
import { SwimHall } from '../gfx/pool';
import { cheerPose, drawRunner, wavePose, type RunnerLook } from '../gfx/runner';
import { Stadium } from '../gfx/stadium';
import { COMPETITION_ORDER, currentEvent, recordEvent } from '../sim/competition';
import { confirmAbort, confirmPending } from './ConfirmScene';

export interface ResultCell {
  text: string;
  color?: string;
}

export interface ResultRow {
  country: Country;
  look: RunnerLook;
  isPlayer: boolean;
  /** Hat eine gültige Leistung – nur dann gibt es Medaillen */
  valid: boolean;
  cells: ResultCell[];
}

export interface ResultSceneData {
  event: EventKey;
  /** Bis zu drei Spaltenüberschriften für `cells` */
  headers: string[];
  /** Bereits nach Platzierung sortiert */
  rows: ResultRow[];
  /** Eigene Leistung für die Bestenliste, null = keine gültige */
  playerScore: number | null;
  worldRecord?: number;
  notes?: string[];
  /** Szene und Daten für „Nochmal“ */
  replay: { scene: string; data: object };
}

const MEDALS = [COLORS.gold, COLORS.silver, COLORS.bronze];
const PODIUM_BASE_Y = 166;
/** [Platzierung, Mitte X, Höhe] – Silber links, Gold Mitte, Bronze rechts */
const PODIUM: [number, number, number][] = [
  [1, GAME_WIDTH / 2 - 70, 30],
  [0, GAME_WIDTH / 2, 42],
  [2, GAME_WIDTH / 2 + 70, 22],
];
const CELL_X = [320, 400, 480];
/** Kamera der Schwimmhalle hinter dem Podest: Beckenmitte ohne Wimpel */
const HALL_CAM_PX = 520;

export class ResultScene extends Phaser.Scene {
  private result!: ResultSceneData;
  private podiumGfx!: Phaser.GameObjects.Graphics;
  /** Schwimmhalle als Kulisse (nur bei Hallen-Disziplinen) */
  private hall: SwimHall | null = null;
  private clock: number | string = 0;
  private elapsed = 0;
  /** Szenenwechsel ist angestoßen – keine weiteren Tasten */
  private leaving = false;

  constructor() {
    super('result');
  }

  init(data: ResultSceneData): void {
    this.result = data;
    this.elapsed = 0;
    this.leaving = false;
  }

  create(): void {
    const { rows, headers } = this.result;
    const event = eventByKey(this.result.event);
    // Im Wettkampf: Medaillen genau einmal eintragen
    const competition = getCompetition();
    if (competition) {
      setCompetition(recordEvent(competition, event.key, rows.map((r) => ({ code: r.country.code, valid: r.valid }))));
    }
    const eventNo = (COMPETITION_ORDER as readonly EventKey[]).indexOf(event.key) + 1;
    // Kulisse je Disziplin: Schwimmen in der Halle (mit Hallenklang), sonst im Stadion
    this.hall = null;
    // Die Hallenuhr zeigt Zeiten; bei Punkte-Disziplinen (Turmspringen) die eigenen Punkte
    const score = this.result.playerScore ?? 0;
    this.clock = event.lowerIsBetter ? score : score.toFixed(2);
    if (event.venue === 'hall') {
      this.hall = new SwimHall(this).asBackdrop();
      this.hall.update(HALL_CAM_PX, 0, 0, 0.5, this.clock);
      sfx.setRoom('hall');
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sfx.setRoom('open'));
    } else {
      new Stadium(this).update(1200, 0, 0, 0);
    }
    this.add.rectangle(0, 0, GAME_WIDTH, 360, 0x10101c, 0.78).setOrigin(0);
    this.cameras.main.fadeIn(300, 16, 16, 28);

    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });

    text(GAME_WIDTH / 2, 12, 'ERGEBNIS', 16, '#f7d038').setOrigin(0.5, 0);
    const subtitle = competition ? `${event.name} – DISZIPLIN ${eventNo} VON ${COMPETITION_ORDER.length}` : event.name;
    text(GAME_WIDTH / 2, 34, subtitle, 8, '#9aa0b8').setOrigin(0.5, 0);

    // Podest
    this.podiumGfx = this.add.graphics();
    const g = this.add.graphics();
    for (const [rank, cx, h] of PODIUM) {
      const r = rows[rank];
      if (!r?.valid) continue;
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
    const cols = { place: 70, flag: 104, nation: 130 };
    const header = '#9aa0b8';
    text(cols.place, tableY, 'PL', 8, header);
    text(cols.nation, tableY, 'NATION', 8, header);
    headers.forEach((h, i) => text(CELL_X[i], tableY, h, 8, header));
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(60, tableY + 12, GAME_WIDTH - 120, 1);

    rows.forEach((r, i) => {
      const y = tableY + 20 + i * 18;
      const color = r.isPlayer ? '#f7d038' : '#ffffff';
      if (r.isPlayer) {
        g.fillStyle(0xf7d038, 0.15);
        g.fillRect(60, y - 4, GAME_WIDTH - 120, 16);
      }
      if (i < 3 && r.valid) {
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
      r.cells.forEach((c, j) => text(CELL_X[j], y, c.text, 8, c.color ?? color));
    });

    this.showPersonalBest(rows, event.key);

    const promptText = competition ? 'ENTER: WEITER   ESC: ABBRECHEN' : 'ENTER: NOCHMAL   ESC: MENÜ';
    const prompt = text(GAME_WIDTH / 2, 330, promptText, 8, '#f7d038').setOrigin(0.5, 0);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });

    const place = rows.findIndex((r) => r.isPlayer) + 1;
    const medal = place <= 3 && rows[place - 1].valid;
    if (place === 1 && medal) sfx.fanfare();
    sfx.crowd(medal ? 0.7 : 0.25);

    const kb = this.input.keyboard!;
    const createdAt = performance.now();
    const onKey = (ev: KeyboardEvent) => {
      sfx.unlock();
      if (ev.repeat || this.leaving || confirmPending()) return;
      const state = getCompetition();
      // Im Wettkampf zählen nur Tasten, die erst in der Siegerehrung gedrückt wurden
      if (state && ev.timeStamp > 0 && ev.timeStamp < createdAt) return;
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') {
        sfx.confirm();
        this.leaving = true;
        // Im Wettkampf gibt es kein Nochmal – weiter zum Medaillenspiegel
        if (state) this.scene.start('medals', { mode: currentEvent(state) === null ? 'final' : 'between' });
        else this.scene.start(this.result.replay.scene, this.result.replay.data);
      } else if (ev.code === 'Escape') {
        if (state) confirmAbort(this);
        else {
          this.leaving = true;
          this.scene.start('title');
        }
      } else if (ev.code === 'KeyM') {
        sfx.toggleMute();
      }
    };
    kb.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
  }

  private showPersonalBest(rows: ResultRow[], key: EventKey): void {
    const event = eventByKey(key);
    const { playerScore, worldRecord, notes = [] } = this.result;
    const player = rows.find((r) => r.isPlayer)!;
    const previous = loadBest(key);
    const better = (a: number, b: number) => (event.lowerIsBetter ? a < b : a > b);
    const label = event.bestLabel;

    let line = '';
    let color = '#ffffff';
    if (playerScore !== null) {
      if (!previous || better(playerScore, previous.value)) {
        saveBest(key, { value: playerScore, country: player.country.code });
        line = previous ? `NEUE ${label}! (BISHER ${event.format(previous.value)})` : `ERSTE ${label} AUFGESTELLT!`;
        color = '#4cd964';
      } else {
        line = `DEINE ${label}: ${event.format(previous.value)} (${previous.country})`;
      }
      if (worldRecord !== undefined && better(playerScore, worldRecord)) {
        line = `WELTREKORD! ${event.format(playerScore)}`;
        color = '#f7c843';
      }
    }
    const footerY = 274;
    const best = this.add
      .text(GAME_WIDTH / 2, footerY, line, { fontFamily: FONT, fontSize: '8px', color })
      .setOrigin(0.5, 0);
    if (color !== '#ffffff') this.tweens.add({ targets: best, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    notes.forEach((n, i) =>
      this.add
        .text(GAME_WIDTH / 2, footerY + 14 * (i + 1), n, { fontFamily: FONT, fontSize: '8px', color: '#9aa0b8' })
        .setOrigin(0.5, 0),
    );
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.elapsed += dt;
    this.hall?.update(HALL_CAM_PX, dt, this.elapsed, 0.5, this.clock);
    const g = this.podiumGfx;
    g.clear();
    for (const [rank, cx, h] of PODIUM) {
      const r = this.result.rows[rank];
      if (!r?.valid) continue;
      const t = this.elapsed + rank * 0.7;
      const pose = rank === 0 ? cheerPose(t) : wavePose(t);
      const bounce = rank === 0 ? Math.abs(Math.sin(t * 6)) * 4 : 0;
      drawRunner(g, cx - 6, PODIUM_BASE_Y - h, pose, r.look, {
        lift: bounce,
        mood: 'joy',
        time: t,
        medal: MEDALS[rank],
        // In der Schwimmhalle stehen die Sieger mit Badekappe auf dem Podest
        cap: this.hall ? r.look.jersey : undefined,
      });
    }
  }
}
