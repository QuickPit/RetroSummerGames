import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { FONT, GAME_WIDTH } from '../config';
import { COUNTRIES, countryByCode, winnersLabel } from '../data/countries';
import { eventByKey, type EventKey } from '../data/events';
import { endCompetition, getCompetition } from '../data/session';
import { drawFlag } from '../gfx/flags';
import {
  PLACE_MEDALS,
  drawColumnDivider,
  drawInfoBox,
  drawMedalHeader,
  drawPlaceBadge,
  drawPlayerRow,
  drawTablePanel,
  drawYouTag,
} from '../gfx/medalHud';
import { Stadium } from '../gfx/stadium';
import {
  COMPETITION,
  COMPETITION_ORDER,
  currentEvent,
  medalTable,
  medalsOf,
  overallWinners,
  placingOf,
  playerStanding,
  type CompetitionState,
  type MedalRow,
} from '../sim/competition';
import { confirmAbort, confirmPending } from './ConfirmScene';

export type MedalsMode = 'intro' | 'between' | 'final';

export interface MedalsSceneData {
  mode: MedalsMode;
}

// Spalten: Pfeil-Schild „DU“, Platz, Flagge, Code, Name, Medaillen (Mitte der Scheibe), Disziplinen
const COL = { tag: 46, place: 76, flag: 100, code: 122, name: 154, gold: 292, silver: 324, bronze: 356 };
const EVENT_COLS: { key: EventKey; label: string; x: number }[] = [
  { key: '110h', label: 'HÜR', x: 404 },
  { key: 'long', label: 'WEIT', x: 454 },
  { key: 'pole', label: 'STAB', x: 506 },
  { key: 'bmx', label: 'BMX', x: 558 },
];
const PANEL = { x: 38, y: 44, w: GAME_WIDTH - 76 };
const HEAD_Y = 56;
const ROW_Y = 76;
const ROW_H = 20;
const BOX = { x: 80, y: 196, w: 480, h: 104 };
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
  private newMedals = 0;
  private shines = 0;
  /** Szenenwechsel ist angestoßen – keine weiteren Tasten */
  private leaving = false;

  constructor() {
    super('medals');
  }

  init(data: MedalsSceneData): void {
    this.mode = data.mode ?? 'intro';
    this.blinkObjects = [];
    this.elapsedMs = 0;
    this.newMedals = 0;
    this.shines = 0;
    this.leaving = false;
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
    const total = COMPETITION_ORDER.length;
    const sub = this.mode === 'intro' ? `WETTKAMPF ÜBER ${total} DISZIPLINEN` : `NACH ${state.index} VON ${total} DISZIPLINEN`;
    this.text(GAME_WIDTH / 2, 10, title, 16, '#f7d038').setOrigin(0.5, 0);
    this.text(GAME_WIDTH / 2, 32, sub, 8, GREY).setOrigin(0.5, 0);

    this.drawTable();
    this.drawFeedback();
    if (this.mode === 'final') this.drawWinner();
    else this.drawNext();

    const prompt = this.text(
      GAME_WIDTH / 2,
      330,
      this.mode === 'final' ? 'ENTER: ABSCHLUSSFEIER' : 'ENTER: WEITER   ESC: ABBRECHEN',
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
      if (ev.repeat || this.leaving || confirmPending() || (ev.timeStamp > 0 && ev.timeStamp < createdAt)) return;
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space') {
        // Vor der Feier die Fanfare des Endstands stoppen, damit sie sich nicht mit der Siegermelodie überlagert
        if (this.mode === 'final') sfx.stopAll();
        sfx.confirm();
        this.proceed();
      } else if (ev.code === 'Escape') {
        // Im Endstand überspringt ESC die Feier und führt direkt ins Menü
        if (this.mode === 'final') this.toMenu();
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
    this.leaving = true;
    if (this.mode === 'final') {
      this.scene.start('ceremony');
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

  private toMenu(): void {
    this.leaving = true;
    sfx.stopAll();
    endCompetition();
    this.scene.start('title');
  }

  private drawTable(): void {
    const rowYs = this.table.map((_, i) => ROW_Y + i * ROW_H - 5);
    const g = this.add.graphics();
    drawTablePanel(g, PANEL.x, PANEL.y, PANEL.w, HEAD_Y + 12 - PANEL.y, rowYs, ROW_H - 2);
    drawColumnDivider(g, 382, PANEL.y + 4, rowYs[rowYs.length - 1] + ROW_H - 2);
    const blink = this.add.graphics();
    this.blinkObjects.push(blink);

    this.text(COL.place, HEAD_Y, 'PL', 8, GREY);
    this.text(COL.code, HEAD_Y, 'NATION', 8, GREY);
    const medalX = [COL.gold, COL.silver, COL.bronze];
    medalX.forEach((px, i) => {
      drawMedalHeader(g, px, HEAD_Y + 3, PLACE_MEDALS[i]);
      this.text(px - 3, HEAD_Y, 'GSB'[i], 8, '#10101c');
    });
    for (const c of EVENT_COLS) this.text(c.x, HEAD_Y, c.label, 8, c.key === this.lastEvent ? '#ffffff' : GREY);

    const anyResult = this.state.index > 0;
    this.table.forEach((row, i) => {
      const y = ROW_Y + i * ROW_H;
      const entry = this.state.field.find((f) => f.code === row.code)!;
      const country = countryByCode(row.code);
      const color = entry.isPlayer ? '#f7d038' : '#ffffff';
      if (entry.isPlayer) {
        drawPlayerRow(g, PANEL.x + 1, y - 5, PANEL.w - 2, ROW_H - 2);
        drawYouTag(g, COL.tag, y);
        this.text(COL.tag + 3, y, 'DU', 8, '#10101c');
      }
      this.text(COL.place, y, anyResult ? `${row.rank}.` : '-', 8, color);
      drawFlag(g, country.flag, COL.flag, y - 1, 14, 10);
      // Code grau, Name in Zeilenfarbe – ist beides gleich (USA), nur der Name
      if (country.name !== country.code) this.text(COL.code, y, country.code, 8, entry.isPlayer ? '#c9a92c' : GREY);
      this.text(country.name !== country.code ? COL.name : COL.code, y, country.name, 8, color);
      [row.gold, row.silver, row.bronze].forEach((n, k) => {
        this.text(medalX[k] + 1, y, String(n), 8, n > 0 ? color : '#5d6278').setOrigin(0.5, 0);
      });

      for (const c of EVENT_COLS) {
        // Sichtbare Mitte der Überschrift (Glyphen sind 7 px breit)
        const px = c.x + c.label.length * 4 - 1;
        const p = placingOf(this.state, c.key, row.code);
        const isNew = this.mode === 'between' && c.key === this.lastEvent;
        if (!p) {
          this.text(px + 1, y, '-', 8, '#5d6278').setOrigin(0.5, 0);
        } else if (!p.valid) {
          this.text(px + 1, y, 'X', 8, '#e8442e').setOrigin(0.5, 0);
        } else if (p.place <= 3) {
          drawPlaceBadge(isNew ? blink : g, px, y + 3, p.place as 1 | 2 | 3);
          const digit = this.text(px - 3, y, String(p.place), 8, '#10101c');
          if (isNew) {
            this.blinkObjects.push(digit);
            this.newMedals++;
          }
        } else {
          this.text(px + 1, y, String(p.place), 8, '#ffffff').setOrigin(0.5, 0);
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
      const standing = playerStanding(s);
      if (this.mode === 'between' && this.lastEvent) {
        const name = eventByKey(this.lastEvent).name;
        const medal = medalsOf(s.results[this.lastEvent] ?? []).get(me);
        const label = { gold: 'GOLD', silver: 'SILBER', bronze: 'BRONZE' };
        line1 = medal ? `${name}: ${label[medal]} FÜR DICH!` : `${name}: KEINE MEDAILLE FÜR DICH`;
        line2 = {
          noMedals: 'ZWISCHENSTAND: NOCH KEINE MEDAILLEN',
          leader: 'ZWISCHENSTAND: DU FÜHRST!',
          tied: 'ZWISCHENSTAND: GLEICHAUF AN DER SPITZE',
          behind: `ZWISCHENSTAND: DU BIST ${standing.rank}. VON ${s.field.length}`,
        }[standing.kind];
      } else {
        line1 = {
          noMedals: 'NIEMAND HOLT EINE MEDAILLE – AUF EIN NEUES!',
          leader: 'GLÜCKWUNSCH! DU HAST DIE SPIELE GEWONNEN!',
          tied: 'GEMEINSAM AN DER SPITZE – STARK!',
          behind: `DU WIRST ${standing.rank}. – AUF EIN NEUES!`,
        }[standing.kind];
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
    // Tasten- und Textspalte als Block mittig, mit 16 px Luft dazwischen
    const keyW = Math.max(...lines.map(([key]) => key.length)) * 8;
    const textW = Math.max(...lines.map(([, what]) => what.length)) * 8;
    const x0 = Math.round((GAME_WIDTH - (keyW + 16 + textW)) / 2);
    lines.forEach(([key, what], i) => {
      const y = BOX.y + 38 + (4 - lines.length) * 7 + i * 14;
      this.text(x0, y, key, 8, '#f7d038');
      this.text(x0 + keyW + 16, y, what);
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
    this.text(GAME_WIDTH / 2, BOX.y + 64, winnersLabel(winners), 16, '#f7c843').setOrigin(0.5, 0);
  }

  update(_time: number, deltaMs: number): void {
    if (this.mode !== 'between') return;
    this.elapsedMs += deltaMs;
    const phase = Math.floor(this.elapsedMs / COMPETITION.medalBlinkMs);
    const on = phase % 2 === 0;
    // Die ersten drei Male klingt das Aufblinken der neuen Medaillen
    if (on && this.newMedals > 0 && this.shines < 3 && phase / 2 >= this.shines) {
      sfx.medalShine(this.shines);
      this.shines++;
    }
    for (const o of this.blinkObjects) o.setVisible(on);
  }
}
