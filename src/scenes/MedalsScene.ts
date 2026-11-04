import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { FONT, GAME_WIDTH } from '../config';
import { COUNTRIES, countryByCode } from '../data/countries';
import { eventByKey, type EventKey } from '../data/events';
import { endCompetition, getCompetition } from '../data/session';
import { drawFlag } from '../gfx/flags';
import { PLACE_MEDALS, drawInfoBox, drawMedalHeader, drawPlaceBadge, drawPlayerRow } from '../gfx/medalHud';
import { Stadium } from '../gfx/stadium';
import {
  COMPETITION,
  COMPETITION_ORDER,
  currentEvent,
  medalTable,
  medalsOf,
  overallWinners,
  placingOf,
  type CompetitionState,
  type MedalRow,
} from '../sim/competition';
import { confirmAbort } from './ConfirmScene';

export type MedalsMode = 'intro' | 'between' | 'final';

export interface MedalsSceneData {
  mode: MedalsMode;
}

const COL = { place: 70, flag: 100, nation: 122, gold: 290, silver: 320, bronze: 350 };
const EVENT_COLS: { key: EventKey; label: string; x: number }[] = [
  { key: '110h', label: 'HÜR', x: 392 },
  { key: 'long', label: 'WEIT', x: 436 },
  { key: 'pole', label: 'STAB', x: 480 },
  { key: 'bmx', label: 'BMX', x: 524 },
];
const HEAD_Y = 56;
const ROW_Y = 76;
const ROW_H = 20;
const BOX = { x: 110, y: 196, w: 420, h: 104 };
const GREY = '#9aa0b8';

/** Medaillenspiegel im Wettkampf: vor der ersten, zwischen und nach den Disziplinen. */
export class MedalsScene extends Phaser.Scene {
  /** Öffentlich lesbar für den Spieltest */
  mode: MedalsMode = 'intro';
  table: MedalRow[] = [];
  winners: string[] = [];
  private state!: CompetitionState;
  private lastEvent: EventKey | null = null;
  private blinkObjects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private elapsedMs = 0;

  constructor() {
    super('medals');
  }

  init(data: MedalsSceneData): void {
    this.mode = data.mode ?? 'intro';
    this.blinkObjects = [];
    this.elapsedMs = 0;
  }

  create(): void {
    const state = getCompetition();
    if (!state) {
      this.scene.start('title');
      return;
    }
    this.state = state;
    this.table = medalTable(state);
    this.winners = overallWinners(state);
    this.lastEvent = state.index > 0 ? COMPETITION_ORDER[state.index - 1] : null;

    const stadium = new Stadium(this);
    stadium.update(1200, 0, 0, 0);
    this.add.rectangle(0, 0, GAME_WIDTH, 360, 0x10101c, 0.78).setOrigin(0);
    this.cameras.main.fadeIn(300, 16, 16, 28);

    const title = this.mode === 'intro' ? 'DIE NATIONEN' : this.mode === 'final' ? 'ENDSTAND' : 'MEDAILLENSPIEGEL';
    const sub = this.mode === 'intro' ? 'WETTKAMPF ÜBER 4 DISZIPLINEN' : `NACH ${state.index} VON 4 DISZIPLINEN`;
    this.text(GAME_WIDTH / 2, 10, title, 16, '#f7d038').setOrigin(0.5, 0);
    this.text(GAME_WIDTH / 2, 32, sub, 8, GREY).setOrigin(0.5, 0);

    this.drawTable();
    this.drawFeedback();
    if (this.mode === 'final') this.drawWinner();
    else this.drawNext();

    const prompt = this.text(
      GAME_WIDTH / 2,
      330,
      this.mode === 'final' ? 'ENTER: ZURÜCK ZUM MENÜ' : 'ENTER: WEITER   ESC: ABBRECHEN',
      8,
      '#f7d038',
    ).setOrigin(0.5, 0);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });

    if (this.mode === 'final') {
      if (this.winners.includes(this.playerCode())) sfx.fanfare();
      sfx.crowd(0.9);
    } else if (this.mode === 'between') {
      const medal = this.lastEvent && medalsOf(state.results[this.lastEvent] ?? []).has(this.playerCode());
      sfx.crowd(medal ? 0.6 : 0.3);
    } else {
      sfx.crowd(0.3);
    }

    const kb = this.input.keyboard!;
    const createdAt = performance.now();
    const onKey = (ev: KeyboardEvent) => {
      sfx.unlock();
      // Tasten aus der vorigen Szene nicht übernehmen
      if (ev.repeat || this.scene.isPaused() || (ev.timeStamp > 0 && ev.timeStamp < createdAt)) return;
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') {
        sfx.confirm();
        this.proceed();
      } else if (ev.code === 'Escape') {
        if (this.mode === 'final') this.proceed();
        else confirmAbort(this);
      } else if (ev.code === 'KeyM') {
        sfx.toggleMute();
      }
    };
    kb.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
  }

  private text(x: number, y: number, s: string, size = 8, color = '#ffffff'): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
  }

  private playerCode(): string {
    return this.state.field.find((f) => f.isPlayer)!.code;
  }

  private proceed(): void {
    if (this.mode === 'final') {
      endCompetition();
      this.scene.start('title');
      return;
    }
    const next = currentEvent(this.state);
    if (!next) {
      this.scene.start('medals', { mode: 'final' });
      return;
    }
    const countryIndex = Math.max(0, COUNTRIES.findIndex((c) => c.code === this.playerCode()));
    this.scene.start(eventByKey(next).scene, { countryIndex });
  }

  private drawTable(): void {
    const g = this.add.graphics();
    const blink = this.add.graphics();
    this.blinkObjects.push(blink);

    this.text(COL.place, HEAD_Y, 'PL', 8, GREY);
    this.text(COL.nation, HEAD_Y, 'NATION', 8, GREY);
    const heads: [number, number][] = [
      [COL.gold, 0],
      [COL.silver, 1],
      [COL.bronze, 2],
    ];
    for (const [x, i] of heads) {
      drawMedalHeader(g, x + 6, HEAD_Y + 4, PLACE_MEDALS[i]);
      this.text(x + 6, HEAD_Y + 1, 'GSB'[i], 8, '#10101c').setOrigin(0.5, 0);
    }
    for (const c of EVENT_COLS) this.text(c.x, HEAD_Y, c.label, 8, c.key === this.lastEvent ? '#ffffff' : GREY);
    g.fillStyle(0x4a4e63, 1);
    g.fillRect(60, HEAD_Y + 12, GAME_WIDTH - 120, 1);

    const anyResult = this.state.index > 0;
    this.table.forEach((row, i) => {
      const y = ROW_Y + i * ROW_H;
      const entry = this.state.field.find((f) => f.code === row.code)!;
      const country = countryByCode(row.code);
      const color = entry.isPlayer ? '#f7d038' : '#ffffff';
      if (entry.isPlayer) drawPlayerRow(g, 60, y - 4, GAME_WIDTH - 120, 16);
      this.text(COL.place, y, anyResult ? `${row.rank}.` : '-', 8, color);
      drawFlag(g, country.flag, COL.flag, y - 1, 14, 10);
      this.text(COL.nation, y, `${country.code} ${country.name}${entry.isPlayer ? ' (DU)' : ''}`, 8, color);
      [row.gold, row.silver, row.bronze].forEach((n, k) => {
        this.text([COL.gold, COL.silver, COL.bronze][k] + 6, y, String(n), 8, n > 0 ? color : '#5d6278').setOrigin(0.5, 0);
      });

      for (const c of EVENT_COLS) {
        const cx = c.x + (c.label.length * 8) / 2;
        const p = placingOf(this.state, c.key, row.code);
        const isNew = this.mode === 'between' && c.key === this.lastEvent;
        if (!p) {
          this.text(cx, y, '-', 8, '#5d6278').setOrigin(0.5, 0);
        } else if (!p.valid) {
          this.text(cx, y, 'X', 8, '#e8442e').setOrigin(0.5, 0);
        } else if (p.place <= 3) {
          drawPlaceBadge(isNew ? blink : g, cx, y + 4, p.place as 1 | 2 | 3);
          const digit = this.text(cx, y + 1, String(p.place), 8, '#10101c').setOrigin(0.5, 0);
          if (isNew) this.blinkObjects.push(digit);
        } else {
          this.text(cx, y, String(p.place), 8, '#ffffff').setOrigin(0.5, 0);
        }
      }
    });
  }

  private drawFeedback(): void {
    const s = this.state;
    const me = this.playerCode();
    let line1 = '';
    let line2 = '';
    if (this.mode === 'intro') {
      const favorite = s.field.find((f) => f.profile === 2);
      line1 = favorite ? `FAVORIT: ${countryByCode(favorite.code).name}` : '';
      line2 = 'JEDE DISZIPLIN NUR EIN DURCHGANG!';
    } else {
      const myRow = this.table.find((r) => r.code === me)!;
      const leaders = this.table.filter((r) => r.rank === 1);
      if (this.mode === 'between' && this.lastEvent) {
        const name = eventByKey(this.lastEvent).name;
        const medal = medalsOf(s.results[this.lastEvent] ?? []).get(me);
        const label = { gold: 'GOLD', silver: 'SILBER', bronze: 'BRONZE' };
        line1 = medal ? `${name}: ${label[medal]} FÜR DICH!` : `${name}: KEINE MEDAILLE FÜR DICH`;
        if (myRow.rank === 1 && leaders.length === 1) line2 = 'ZWISCHENSTAND: DU FÜHRST!';
        else if (myRow.rank === 1) line2 = 'ZWISCHENSTAND: GLEICHAUF AN DER SPITZE';
        else line2 = `ZWISCHENSTAND: DU BIST ${myRow.rank}. VON 4`;
      } else {
        if (this.winners.includes(me) && this.winners.length === 1) line1 = 'GLÜCKWUNSCH! DU HAST DIE SPIELE GEWONNEN!';
        else if (this.winners.includes(me)) line1 = 'GEMEINSAM AN DER SPITZE – STARK!';
        else line1 = `DU WIRST ${myRow.rank}. – AUF EIN NEUES!`;
      }
    }
    // Dunkles Band, damit die Bandenwerbung dahinter nicht stört
    this.add.rectangle(0, 158, GAME_WIDTH, 32, 0x10101c, 0.6).setOrigin(0);
    this.text(GAME_WIDTH / 2, 164, line1, 8, '#ffffff').setOrigin(0.5, 0);
    this.text(GAME_WIDTH / 2, 178, line2, 8, GREY).setOrigin(0.5, 0);
  }

  /** Kasten mit der nächsten Disziplin und ihrer Steuerung */
  private drawNext(): void {
    const next = currentEvent(this.state);
    if (!next) return;
    const event = eventByKey(next);
    drawInfoBox(this.add.graphics(), BOX.x, BOX.y, BOX.w, BOX.h);
    this.text(GAME_WIDTH / 2, BOX.y + 10, `NÄCHSTE: ${event.name}`, 16, '#f7d038').setOrigin(0.5, 0);
    const lines = event.controls.slice(0, 4);
    lines.forEach(([key, what], i) => {
      const y = BOX.y + 38 + (4 - lines.length) * 7 + i * 14;
      this.text(126, y, key, 8, '#f7d038');
      this.text(276, y, what);
    });
  }

  /** Endstand: Gesamtsieger mit Flagge */
  private drawWinner(): void {
    const g = this.add.graphics();
    drawInfoBox(g, BOX.x, BOX.y, BOX.w, BOX.h);
    const winners = this.winners;
    if (winners.length === 0) {
      this.text(GAME_WIDTH / 2, BOX.y + 44, 'KEIN GESAMTSIEGER', 16, '#ffffff').setOrigin(0.5, 0);
      return;
    }
    this.text(GAME_WIDTH / 2, BOX.y + 12, 'GESAMTSIEGER', 8, GREY).setOrigin(0.5, 0);
    const flagW = 32;
    const gap = 10;
    const total = winners.length * flagW + (winners.length - 1) * gap;
    winners.forEach((code, i) => {
      drawFlag(g, countryByCode(code).flag, GAME_WIDTH / 2 - total / 2 + i * (flagW + gap), BOX.y + 30, flagW, 22);
    });
    const name =
      winners.length === 1
        ? countryByCode(winners[0]).name
        : `${winners.slice(0, -1).join(', ')} UND ${winners[winners.length - 1]}`;
    this.text(GAME_WIDTH / 2, BOX.y + 64, name, 16, '#f7c843').setOrigin(0.5, 0);
  }

  update(_time: number, deltaMs: number): void {
    if (this.mode !== 'between') return;
    this.elapsedMs += deltaMs;
    const on = Math.floor(this.elapsedMs / COMPETITION.medalBlinkMs) % 2 === 0;
    for (const o of this.blinkObjects) o.setVisible(on);
  }
}
