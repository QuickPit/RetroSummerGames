import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { FONT, GAME_WIDTH } from '../config';
import { endCompetition } from '../data/session';
import { CONFIRM_BOX, drawChoiceMarker, drawConfirmBox } from '../gfx/medalHud';
import { COMPETITION } from '../sim/competition';

export interface ConfirmSceneData {
  /** Szene darunter – sie ist pausiert, solange die Rückfrage offen ist */
  parent: string;
  question: string;
  detail: string;
  /** Szene, die bei JA startet (die pausierte wird beendet) */
  yesScene: string;
  onYes?: () => void;
  /** Wird vor dem Fortsetzen der pausierten Szene aufgerufen */
  onNo?: () => void;
}

const CHOICE_Y = 194;
const CHOICE_X = { yes: 246, no: 350 };

/** Overlay mit JA/NEIN-Rückfrage über einer pausierten Szene. */
export class ConfirmScene extends Phaser.Scene {
  private opts!: ConfirmSceneData;
  private choice: 'yes' | 'no' = COMPETITION.confirmDefault;
  private markerGfx!: Phaser.GameObjects.Graphics;
  private yesText!: Phaser.GameObjects.Text;
  private noText!: Phaser.GameObjects.Text;
  private closed = false;

  constructor() {
    super('confirm');
  }

  init(data: ConfirmSceneData): void {
    this.opts = data;
    this.choice = COMPETITION.confirmDefault;
    this.closed = false;
  }

  create(): void {
    const text = (x: number, y: number, s: string, size = 8, color = '#ffffff') =>
      this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
    drawConfirmBox(this.add.graphics());
    const top = CONFIRM_BOX.y;
    text(GAME_WIDTH / 2, top + 16, this.opts.question, 16).setOrigin(0.5, 0);
    text(GAME_WIDTH / 2, top + 42, this.opts.detail, 8, '#9aa0b8').setOrigin(0.5, 0);
    this.markerGfx = this.add.graphics();
    this.yesText = text(CHOICE_X.yes, CHOICE_Y, 'JA', 16);
    this.noText = text(CHOICE_X.no, CHOICE_Y, 'NEIN', 16);
    text(GAME_WIDTH / 2, top + 86, 'J = JA   N / ESC = NEIN', 8, '#9aa0b8').setOrigin(0.5, 0);
    this.refresh();

    const kb = this.input.keyboard!;
    const onKey = (ev: KeyboardEvent) => {
      sfx.unlock();
      if (ev.repeat || this.closed) return;
      // Nicht an die Szene darunter weiterreichen
      ev.stopPropagation();
      const code = ev.code;
      if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowRight' || code === 'KeyD') {
        this.choice = this.choice === 'yes' ? 'no' : 'yes';
        sfx.menu();
        this.refresh();
      } else if (code === 'KeyJ') {
        this.answer('yes');
      } else if (code === 'KeyN' || code === 'Escape') {
        this.answer('no');
      } else if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
        this.answer(this.choice);
      } else if (code === 'KeyM') {
        sfx.toggleMute();
      }
    };
    kb.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', onKey));
  }

  private refresh(): void {
    const yes = this.choice === 'yes';
    this.yesText.setColor(yes ? '#f7d038' : '#ffffff');
    this.noText.setColor(yes ? '#ffffff' : '#f7d038');
    const g = this.markerGfx;
    g.clear();
    drawChoiceMarker(g, (yes ? CHOICE_X.yes : CHOICE_X.no) - 14, CHOICE_Y, (yes ? this.yesText : this.noText).width);
  }

  private answer(choice: 'yes' | 'no'): void {
    this.closed = true;
    const { parent, onYes, onNo, yesScene } = this.opts;
    if (choice === 'yes') {
      sfx.confirm();
      onYes?.();
      this.scene.stop(parent);
      this.scene.start(yesScene);
      return;
    }
    sfx.menu();
    onNo?.();
    this.scene.resume(parent);
    this.scene.stop();
  }
}

/**
 * Esc im Wettkampf: Szene pausieren und nachfragen. `onResume` erhält die
 * Pausendauer in ms, damit Zeitanker verschoben werden können.
 */
export function confirmAbort(scene: Phaser.Scene, onResume?: (pausedMs: number) => void): void {
  if (scene.scene.isPaused()) return;
  const pausedAt = performance.now();
  scene.scene.pause();
  const data: ConfirmSceneData = {
    parent: scene.scene.key,
    question: 'WETTKAMPF ABBRECHEN?',
    detail: 'DER SPIELSTAND GEHT VERLOREN.',
    yesScene: 'title',
    onYes: endCompetition,
    onNo: () => onResume?.(performance.now() - pausedAt),
  };
  scene.scene.launch('confirm', data);
}
