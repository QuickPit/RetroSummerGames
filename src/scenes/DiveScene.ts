import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, GAME_WIDTH, PX_PER_M } from '../config';
import { COUNTRIES, countryByCode, type Country } from '../data/countries';
import { getCompetition } from '../data/session';
import { loadLookSeed } from '../data/storage';
import {
  DIVER_SCALE,
  blendPose,
  bombPose,
  diverStandPose,
  diverSwingPose,
  diverTakeoffPose,
  diverWalkPose,
  drawBubbles,
  drawDiver,
  drawEntrySplash,
  drawJudge,
  flatPose,
  glidePose,
  judgeLook,
  linePose,
  positionPose,
  splashDrops,
  treadPose,
  twistPose,
  type JudgeReaction,
} from '../gfx/diver';
import { CARD_STEP, CARD_STRIKE, DiveHud, DiveSelect, JudgeCards, VerdictBoard, drawTaktScale, type DiveSelectRow } from '../gfx/diveHud';
import { JumpBoard, type JumpBoardRow } from '../gfx/jumpBoard';
import { DIVE_HALL, DiveHall, diveScreenY, poolLeftAt } from '../gfx/pool';
import { createLook, type Mood, type Pose, type RunnerLook } from '../gfx/runner';
import { drawDrops, drawWaterRing, type Drop } from '../gfx/swimmer';
import type { Side } from '../sim/hurdles';
import {
  DIVE,
  DIVES,
  DIVE_CPU_PROFILES,
  DIVE_TIPS,
  armLift,
  cpuDiveRate,
  createDive,
  createDiver,
  diveById,
  diverTotal,
  judge,
  minPower,
  nextDive,
  rankDivers,
  setHold,
  simulateCpuDive,
  stepDive,
  swingTap,
  takeoff,
  targetRot,
  twist,
  usedDives,
  type DiveCpuProfile,
  type DiveDef,
  type DiveEvent,
  type DiveState,
  type DiveTip,
  type Diver,
  type EntryRating,
  type Judgement,
} from '../sim/dive';
import { confirmAbort, confirmPending } from './ConfirmScene';
import type { ResultRow, ResultSceneData } from './ResultScene';

const SIM_DT = 1 / 120;
/** Hüfte an der Kante: so weit hinter der Plattformkante (Pixel) */
const HIP_BACK = 7;
/** So weit geht der Springer zur Kante (Pixel) */
const WALK_PX = 46;
/** Die Kamera folgt der Hüfte auf dieser Bildschirmhöhe */
const FOLLOW_Y = 150;
const CAM_MAX = 230;
/** Übergang zwischen Sprungposition und Linie */
const POSE_BLEND = 0.08;
/** Nach dem Auftauchen: Tafeln, dann die Wertung auf der Anzeigetafel */
const VERDICT_DELAY = 4 * CARD_STEP + CARD_STRIKE + 0.3;
/** Anzeige der Computer-Sprünge auf der Tafel (ms) */
const CPU_ANNOUNCE_MS = 700;
const CPU_SCORE_MS = 800;
/** Ansagen am Turm stehen rechts vom Springer */
const TOWER_MSG = { x: 430, y: 44 };
const POOL_MSG = { x: GAME_WIDTH / 2, y: 136 };
/** Hüfte bis Kopfmitte in Pixeln (ungedreht, ohne Vergrößerung) */
const BODY_TO_HEAD = 21;

type Phase = 'board' | 'select' | 'attempt';

interface Entrant {
  country: Country;
  look: RunnerLook;
  competitor: Diver;
  profile: DiveCpuProfile | null;
  /** Tipprate dieses Wettkampfs (Computer) */
  rate: number;
}

export interface DiveSceneData {
  countryIndex: number;
}

const RATING_TEXT: Record<Exclude<EntryRating, 'bomb' | 'wrong'>, { text: string; color: string }> = {
  perfect: { text: 'PERFEKT!', color: '#f7c843' },
  clean: { text: 'SAUBER!', color: '#4cd964' },
  early: { text: 'ZU FRÜH GEÖFFNET', color: '#f08a24' },
  late: { text: 'ZU SPÄT GEÖFFNET', color: '#f08a24' },
  belly: { text: 'BAUCHKLATSCHER!', color: '#e8442e' },
  back: { text: 'RÜCKENKLATSCHER!', color: '#e8442e' },
};

/** Bewertung beim Eintauchen als Text (24 px) */
function ratingText(j: Judgement, def: DiveDef): { text: string; color: string } {
  if (j.rating === 'bomb') {
    const text = def.position === 'tuck' ? 'ARSCHBOMBE!' : def.position === 'pike' ? 'KLAPPMESSER!' : 'NICHT GEÖFFNET!';
    return { text, color: '#e8442e' };
  }
  if (j.rating === 'wrong') return { text: j.delta < 0 ? 'SALTO FEHLT!' : 'SALTO ZU VIEL!', color: '#e8442e' };
  return RATING_TEXT[j.rating];
}

/**
 * Kopfzeile der Wertung: das Urteil über die Ausführung (die Tippzeile darunter gibt den Rat).
 * Fehlsprünge heißen nach ihrer Art, sonst entscheidet die Basisnote.
 */
function verdictTitle(j: Judgement, def: DiveDef): { text: string; color: string } {
  const red = '#e8442e';
  if (j.rating === 'bomb') {
    return { text: def.position === 'tuck' ? 'ARSCHBOMBE!' : def.position === 'pike' ? 'KLAPPMESSER!' : 'FEHLSPRUNG', color: red };
  }
  if (j.rating === 'belly' || j.rating === 'back') return { text: 'KLATSCHER!', color: red };
  if (j.rating === 'wrong') return { text: 'FEHLSPRUNG', color: red };
  if (j.base >= 9) return { text: 'WELTKLASSE!', color: '#f7c843' };
  if (j.base >= 8) return { text: 'SEHR GUTER SPRUNG', color: '#4cd964' };
  if (j.base >= 7) return { text: 'GUTER SPRUNG', color: '#4cd964' };
  if (j.base >= 5.5) return { text: 'ORDENTLICH', color: '#f7d038' };
  if (j.base >= 4) return { text: 'WACKELIG', color: '#f08a24' };
  return { text: 'MISSGLÜCKT', color: '#f08a24' };
}

function tipText(tip: DiveTip, j: Judgement | null): string {
  switch (tip) {
    case 'notOpened':
      return 'NICHT GEÖFFNET – LEERTASTE VOR DEM WASSER LOS';
    case 'lowPower':
      return 'ZU WENIG SCHWUNG – LEICHTEREN SPRUNG WÄHLEN';
    case 'wrongShort':
      return 'SALTO FEHLT – LEERTASTE LÄNGER HALTEN';
    case 'wrongLong':
      return 'SALTO ZU VIEL – FRÜHER LOSLASSEN';
    case 'openEarly':
      return 'ZU FRÜH GEÖFFNET – LEERTASTE LÄNGER HALTEN';
    case 'openLate':
      return 'ZU SPÄT GEÖFFNET – FRÜHER LOSLASSEN';
    case 'twistOpen':
      return 'SCHRAUBE NICHT FERTIG – FRÜHER PFEIL HOCH';
    case 'twistMissing':
      return `SCHRAUBE FEHLT – ${j ? `${j.missingTwists}X ` : ''}PFEIL HOCH DRÜCKEN`;
    case 'takeoffEarly':
      return 'ABSPRUNG ZU FRÜH – ARME GANZ OBEN ABWARTEN';
    case 'takeoffLate':
      return 'ABSPRUNG ZU SPÄT – LEERTASTE, WENN ARME OBEN';
    case 'moreHeight':
      return 'MEHR HÖHE – SCHNELLER TIPPEN (IDEAL 11/S)';
    case 'dream':
      return 'BESSER GEHT ES KAUM – GENAU SO WEITER!';
    case 'clean':
      // Nichts Grobes falsch: Rat zum Feinschliff an der schwächsten Stelle
      if (j && j.quality < 0.9) return 'FEINSCHLIFF: GENAU IM HOCHPUNKT ABSPRINGEN';
      if (j && Math.abs(j.delta) > DIVE.perfectAngle) return 'FEINSCHLIFF: GANZ SENKRECHT EINTAUCHEN';
      return 'FEINSCHLIFF: NOCH ETWAS MEHR SCHWUNG';
  }
}

function formatPoints(p: number): string {
  return p.toFixed(2);
}

export class DiveScene extends Phaser.Scene {
  private hall!: DiveHall;
  private hud!: DiveHud;
  private board!: JumpBoard;
  private selectPanel!: DiveSelect;
  private cards!: JudgeCards;
  private verdict!: VerdictBoard;
  private judgeGfx!: Phaser.GameObjects.Graphics;
  private diverGfx!: Phaser.GameObjects.Graphics;
  private waterGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private countryIndex = 0;
  private entrants: Entrant[] = [];
  private player!: Entrant;
  private officials: RunnerLook[] = [];

  /** Öffentlich lesbar für den Spieltest */
  phase: Phase = 'board';
  turn: { diver: Diver; round: number } | null = null;
  waitingForPlayer = false;
  /** Gewählter Sprung (Index in DIVES) */
  selection = 0;
  diver: DiveState | null = null;
  judgement: Judgement | null = null;
  /** ENTER führt nach der Wertung weiter */
  verdictReady = false;
  finished = false;

  /** performance.now() beim Beginn des Versuchs – Bezug der Sim-Zeit */
  private anchor = 0;
  private elapsed = 0;
  private camY = 0;
  private tuckAt = 0;
  private entryX = 0;
  private entryAt = 0;
  private surfacedAt: number | null = null;
  private drops: Drop[] = [];
  private messageUntil = 0;
  private lastSwing: number | null = null;
  /** Reaktion der Kampfrichter beim Eintauchen (Nicken/Kopfschütteln) */
  private judgeReact: { kind: JudgeReaction['kind']; at: number } | null = null;
  /** Kopfschütteln nach dem Auftauchen: zuletzt gezeichnete Blickrichtung (für die Tropfen) */
  private shakeDir: 1 | -1 = 1;
  private dripAt = 0;
  /** Tipps der eigenen Sprünge für die Notiz im Ergebnis */
  private tips: DiveTip[] = [];

  constructor() {
    super('dive');
  }

  init(data: DiveSceneData): void {
    this.countryIndex = data.countryIndex ?? 0;
    this.entrants = [];
    this.phase = 'board';
    this.turn = null;
    this.waitingForPlayer = false;
    this.selection = 0;
    this.diver = null;
    this.judgement = null;
    this.verdictReady = false;
    this.finished = false;
    this.elapsed = 0;
    this.camY = 0;
    this.surfacedAt = null;
    this.drops = [];
    this.messageUntil = 0;
    this.lastSwing = null;
    this.judgeReact = null;
    this.tips = [];
  }

  /** Aktuelle Sim-Zeit des Versuchs in Sekunden */
  get simTime(): number {
    return (performance.now() - this.anchor) / 1000;
  }

  /** Durchgang (0-basiert) */
  get round(): number {
    return this.turn?.round ?? DIVE.rounds - 1;
  }

  create(): void {
    this.hall = new DiveHall(this);
    this.judgeGfx = this.add.graphics().setDepth(-3);
    this.cards = new JudgeCards(this);
    this.diverGfx = this.add.graphics().setDepth(25);
    this.waterGfx = this.add.graphics().setDepth(26);
    this.fxGfx = this.add.graphics().setDepth(27);
    this.hud = new DiveHud(this);
    this.verdict = new VerdictBoard(this);
    this.board = new JumpBoard(this, 'TURMSPRINGEN 10 M', 4, DIVE.rounds, 'GESAMT');
    this.selectPanel = new DiveSelect(this);
    this.setupEntrants();

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    kb.on('keydown', this.onKeyDown, this);
    kb.on('keyup', this.onKeyUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', this.onKeyDown, this);
      kb.off('keyup', this.onKeyUp, this);
    });
    // Sprunghalle: alles hallt nach
    sfx.setRoom('hall');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sfx.setRoom('open'));
    sfx.crowd(0.3);
    this.cameras.main.fadeIn(300, 16, 16, 28);
    this.nextTurn();
  }

  private setupEntrants(): void {
    const others = Phaser.Utils.Array.Shuffle(COUNTRIES.filter((_, i) => i !== this.countryIndex));
    const profiles = Phaser.Utils.Array.Shuffle([...DIVE_CPU_PROFILES]);
    const country = COUNTRIES[this.countryIndex];
    // Im Wettkampf tritt immer dasselbe Feld an
    const field = getCompetition()?.field;
    const seed = field?.find((f) => f.isPlayer)?.lookSeed ?? loadLookSeed();
    this.player = { country, look: createLook(country, seed, 1), competitor: createDiver(0, true), profile: null, rate: 0 };
    const opponents = field
      ? field
          .filter((f) => !f.isPlayer)
          .map((f) => ({ country: countryByCode(f.code), seed: f.lookSeed, profile: DIVE_CPU_PROFILES[f.profile ?? 0] }))
      : profiles.map((profile, i) => ({ country: others[i], seed: Math.floor(Math.random() * 1e9), profile }));
    const cpus: Entrant[] = opponents.map(({ country: c, seed: s, profile }, i) => ({
      country: c,
      look: createLook(c, s, i + 2),
      competitor: createDiver(i + 1, false),
      profile,
      rate: cpuDiveRate(profile, Math.random),
    }));
    this.entrants = Phaser.Utils.Array.Shuffle([this.player, ...cpus]);
    // Am Turm wehen die Fahnen der Nationen, die heute springen
    this.hall.setFlags(this.entrants.map((e) => e.country.flag));
    this.officials = DIVE_HALL.judgeX.map((_, i) => judgeLook(createLook(country, 4242 + i * 17, 0)));
  }

  private entrantOf(d: Diver): Entrant {
    return this.entrants.find((e) => e.competitor === d)!;
  }

  private competitors(): Diver[] {
    return this.entrants.map((e) => e.competitor);
  }

  // ------------------------------------------------------- Wettkampfablauf

  private nextTurn(): void {
    this.turn = nextDive(this.competitors());
    this.waitingForPlayer = false;
    if (!this.turn) {
      this.finish();
      return;
    }
    const { diver: competitor, round } = this.turn;
    if (competitor.isPlayer) {
      this.waitingForPlayer = true;
      const exit = getCompetition() ? 'ESC: ABBRECHEN' : 'ESC: MENÜ';
      this.showBoard(`DU BIST DRAN – ${round + 1}. SPRUNG`, `ENTER: SPRUNG WÄHLEN   ${exit}`);
      return;
    }
    const e = this.entrantOf(competitor);
    const def = diveById(e.profile!.dives[round]);
    this.showBoard(`${e.country.name} – ${def.name}`, '');
    this.time.delayedCall(CPU_ANNOUNCE_MS, () => {
      const j = this.cpuDive(e, round);
      sfx.cardFlip();
      sfx.board(!j.fail);
      this.showBoard(
        `${e.country.name}: ${j.sum.toFixed(1)} × ${j.dd.toFixed(1)} = ${formatPoints(j.points)}`,
        `NOTEN ${j.notes.map((n) => n.toFixed(1)).join(' ')}`,
      );
      this.time.delayedCall(CPU_SCORE_MS, () => this.nextTurn());
    });
  }

  /** Computer-Sprung mit derselben Sim wie der Spieler – erscheint nur auf der Tafel */
  private cpuDive(e: Entrant, round: number): Judgement {
    const def = diveById(e.profile!.dives[round]);
    const j = simulateCpuDive(e.profile!, def, Math.random, e.rate);
    e.competitor.attempts[round] = { dive: def.id, points: j.points };
    return j;
  }

  private showBoard(footer: string, footer2: string): void {
    this.phase = 'board';
    this.hud.setVisible(false);
    this.hud.setMessage('');
    this.selectPanel.setVisible(false);
    this.hall.setBoard('TURMSPRINGEN 10 M', `${this.round + 1}. DURCHGANG`);
    const rows: JumpBoardRow[] = this.entrants.map((e) => ({
      flag: e.country.flag,
      label: `${e.country.code} ${e.country.name}${e.competitor.isPlayer ? ' (DU)' : ''}`,
      isPlayer: e.competitor.isPlayer,
      current: this.turn?.diver === e.competitor,
      attempts: e.competitor.attempts.map((a) => (a ? formatPoints(a.points) : '')),
      best: formatPoints(diverTotal(e.competitor)),
    }));
    this.board.show(`${this.round + 1}. DURCHGANG`, rows, footer, footer2);
  }

  private openSelect(): void {
    this.phase = 'select';
    this.board.setVisible(false);
    const used = this.player.competitor.attempts.filter((a) => a !== undefined);
    const rows: DiveSelectRow[] = DIVES.map((def) => ({
      def,
      need: minPower(def),
      points: used.find((a) => a!.dive === def.id)?.points ?? null,
    }));
    // Vorauswahl: erster freier Sprung
    if (rows[this.selection]?.points !== null) this.selection = rows.findIndex((r) => r.points === null);
    const exit = getCompetition() ? 'ESC: ABBRECHEN' : 'ESC: MENÜ';
    this.selectPanel.show(this.round + 1, rows, this.selection, this.lastSwing, exit);
  }

  private moveSelection(delta: number): void {
    const used = usedDives(this.player.competitor);
    let i = this.selection;
    for (let k = 0; k < DIVES.length; k++) {
      i = (i + delta + DIVES.length) % DIVES.length;
      if (!used.includes(DIVES[i].id)) break;
    }
    if (i === this.selection) return;
    this.selection = i;
    this.selectPanel.select(i);
    sfx.menu();
  }

  private startAttempt(): void {
    const def = DIVES[this.selection];
    this.phase = 'attempt';
    this.selectPanel.setVisible(false);
    this.hud.setVisible(true);
    this.hud.setInfo(this.round + 1, def, diverTotal(this.player.competitor));
    // Sprungansage: blinkt kurz auf der Hallentafel, die rechts oben weit weg von der Flugbahn hängt
    this.hall.setBoard(this.player.country.name, def.name, true);
    this.diver = createDive(def);
    this.judgement = null;
    this.verdictReady = false;
    this.surfacedAt = null;
    this.judgeReact = null;
    this.drops = [];
    this.anchor = performance.now();
    this.hud.setMessage('', '');
    // Psst – das Publikum wird leise
    sfx.crowd(0.1);
  }

  private endAttempt(): void {
    const s = this.diver;
    const j = this.judgement;
    if (!s || !j || this.phase !== 'attempt') return;
    sfx.confirm();
    this.player.competitor.attempts[this.turn!.round] = { dive: s.def.id, points: j.points };
    this.tips.push(j.tip);
    this.lastSwing = s.swing;
    this.diver = null;
    this.judgement = null;
    this.verdictReady = false;
    this.cards.hide();
    this.verdict.hide();
    this.hall.setBoardTextVisible(true);
    sfx.crowd(0.3);
    this.nextTurn();
  }

  /** Wer noch nicht gesprungen ist, springt im Schnelldurchlauf (nur auf der Tafel) */
  private finishRemaining(): void {
    for (const e of this.entrants) {
      if (!e.profile) continue;
      for (let round = 0; round < DIVE.rounds; round++) {
        if (e.competitor.attempts[round] === undefined) this.cpuDive(e, round);
      }
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.finishRemaining();
    const rows: ResultRow[] = rankDivers(this.competitors()).map((d) => {
      const e = this.entrantOf(d);
      return {
        country: e.country,
        look: e.look,
        isPlayer: d.isPlayer,
        // Kein Sprung ist ungültig: Fehlsprünge sind nur schlecht benotet
        valid: true,
        cells: [{ text: formatPoints(diverTotal(d)) }, { text: d.attempts.map((a) => (a ? formatPoints(a.points) : '-')).join(' ') }],
      };
    });
    const data: ResultSceneData = {
      event: 'dive',
      headers: ['PUNKTE', 'SERIE'],
      rows,
      playerScore: diverTotal(this.player.competitor),
      worldRecord: DIVE.worldRecord,
      notes: this.notes(),
      replay: { scene: 'dive', data: { countryIndex: this.countryIndex } },
    };
    this.cameras.main.fadeOut(300, 16, 16, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('result', data));
  }

  /** Bester Sprung und der häufigste Tipp der Serie (bei Gleichstand der wichtigere) */
  private notes(): string[] {
    const attempts = this.player.competitor.attempts.filter((a) => a !== undefined);
    const notes: string[] = [];
    const best = attempts.reduce<(typeof attempts)[number] | undefined>((b, a) => (!b || a!.points > b.points ? a : b), undefined);
    if (best) notes.push(`BESTER SPRUNG: ${diveById(best.dive).name} ${formatPoints(best.points)}`);
    if (this.tips.length) {
      const count = (t: DiveTip) => this.tips.filter((x) => x === t).length;
      const tip = [...DIVE_TIPS].filter((t) => count(t) > 0).sort((a, b) => count(b) - count(a))[0];
      notes.push(tipText(tip, null));
    }
    return notes;
  }

  // ---------------------------------------------------------------- Eingabe

  /** Zeitstempel eines Tastendrucks als Sim-Zeit – zählt, wann die Taste gedrückt wurde */
  private simTimeAt(ev: KeyboardEvent, s: DiveState): number {
    const stamp = ev.timeStamp > 0 ? ev.timeStamp : performance.now();
    return Math.max(s.time, (stamp - this.anchor) / 1000);
  }

  private onKeyDown(ev: KeyboardEvent): void {
    sfx.unlock();
    if (ev.repeat || confirmPending()) return;
    const competition = getCompetition() !== null;
    if (ev.code === 'Escape') {
      if (competition) {
        if (!this.finished) confirmAbort(this, (ms) => this.resumeAfterConfirm(ms));
      } else this.scene.start('title');
      return;
    }
    if (ev.code === 'KeyM') {
      sfx.toggleMute();
      return;
    }
    if (ev.code === 'KeyR') {
      if (!competition && !this.finished) this.scene.restart({ countryIndex: this.countryIndex });
      return;
    }
    const confirm = ev.code === 'Enter' || ev.code === 'NumpadEnter';
    const up = ev.code === 'ArrowUp' || ev.code === 'KeyW';
    const down = ev.code === 'ArrowDown' || ev.code === 'KeyS';

    if (this.phase === 'board') {
      // Die Leertaste bestätigt hier nicht, damit sie nicht in den Absprung hineinwirkt
      if (this.waitingForPlayer && confirm) {
        sfx.confirm();
        this.openSelect();
      }
      return;
    }
    if (this.phase === 'select') {
      if (up) this.moveSelection(-1);
      else if (down) this.moveSelection(1);
      else if (confirm) {
        sfx.confirm();
        this.startAttempt();
      }
      return;
    }

    const s = this.diver;
    if (!s) return;
    if (confirm) {
      if (this.verdictReady) this.endAttempt();
      return;
    }
    const side: Side | null =
      ev.code === 'ArrowLeft' || ev.code === 'KeyA' ? 'L' : ev.code === 'ArrowRight' || ev.code === 'KeyD' ? 'R' : null;
    const t = this.simTimeAt(ev, s);
    if (side) {
      const valid = swingTap(s, side, t);
      this.hud.registerTap(side, valid, this.elapsed);
      if (valid) sfx.swingWhoosh(s.swing);
    } else if (ev.code === 'Space') {
      if (s.phase === 'air') setHold(s, true, t);
      else if (s.phase === 'walk' || s.phase === 'ready') {
        this.flash('ERST SCHWUNG HOLEN!', '', '#e8442e', 1, 16, TOWER_MSG);
        this.hud.registerMiss(this.elapsed);
      } else if (s.phase === 'swing') takeoff(s, t);
    } else if (up) {
      if (s.phase === 'air' && !twist(s, t)) this.hud.registerUpMiss(this.elapsed);
    }
  }

  private onKeyUp(ev: KeyboardEvent): void {
    const s = this.diver;
    if (ev.code !== 'Space' || !s || this.phase !== 'attempt' || confirmPending()) return;
    setHold(s, false, this.simTimeAt(ev, s));
  }

  /** Nach NEIN: kein Zeitsprung, der Takt läuft vom selben Punkt weiter; gehaltene Leertaste gilt als losgelassen */
  private resumeAfterConfirm(pausedMs: number): void {
    this.anchor += pausedMs;
    const s = this.diver;
    if (s && s.phase === 'air' && s.held) setHold(s, false, s.time);
  }

  // ------------------------------------------------------------------ Ablauf

  /** Meldung für eine Weile stehen lassen */
  private flash(text: string, sub: string, color: string, seconds: number, size = 24, at = POOL_MSG): void {
    this.hud.setMessage(text, sub, color, size, at.x, at.y);
    this.messageUntil = this.elapsed + seconds;
  }

  /** Hinweise am Turm, solange keine Meldung steht */
  private updateHint(s: DiveState): void {
    if (this.elapsed < this.messageUntil) return;
    if (s.phase === 'ready') {
      const def = s.def;
      this.hud.setMessage(
        def.name,
        `SG ${def.dd.toFixed(1)}   NÖTIGER SCHWUNG ${Math.round(minPower(def) * 100)}%\n\nPFEIL LINKS/RECHTS: SCHWUNG HOLEN\nLEERTASTE, WENN DIE ARME OBEN SIND`,
        '#ffffff',
        16,
        TOWER_MSG.x,
        TOWER_MSG.y,
      );
    } else if (s.phase === 'swing') {
      this.hud.setMessage('', 'LEERTASTE, WENN DIE ARME OBEN SIND', '#ffffff', 16, TOWER_MSG.x, TOWER_MSG.y + 8);
    } else if (s.phase === 'air') {
      this.hud.setMessage('');
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;
    const s = this.diver;
    if (this.phase === 'attempt' && s) {
      // Fester Zeitschritt bis zur aktuellen Sim-Zeit
      const target = this.simTime;
      while (s.time + SIM_DT <= target) {
        for (const e of stepDive(s, SIM_DT)) this.handleEvent(s, e);
      }
      this.updateHint(s);
      if (this.surfacedAt !== null && !this.verdict.visible && this.elapsed - this.surfacedAt >= VERDICT_DELAY) this.showVerdict();
      this.verdict.update(this.elapsed);
      this.hud.update(this.elapsed, s, minPower(s.def));
    } else if (this.phase === 'board') {
      this.board.update(this.elapsed);
    } else {
      this.selectPanel.update(this.elapsed);
    }

    // Senkrechte Kamera: folgt der Hüfte, unten bleibt sie in der Beckenansicht stehen
    let follow = 0;
    if (this.phase === 'select') follow = this.camFor(DIVE.platform + DIVE.standHip);
    else if (s && (s.phase === 'walk' || s.phase === 'ready' || s.phase === 'swing' || s.phase === 'air')) follow = this.camFor(s.y);
    this.camY = Math.round(follow);

    const excitement = s?.phase === 'air' ? 0.6 : this.verdict.visible ? 0.8 : s ? 0.1 : 0.3;
    this.hall.update(this.camY, dt, this.elapsed, excitement);
    this.drawJudges();
    this.cards.update(this.elapsed, this.camY);
    this.drawDiverAndWater(dt);
  }

  private camFor(hipM: number): number {
    return Phaser.Math.Clamp(FOLLOW_Y - (DIVE_HALL.waterY - hipM * PX_PER_M), 0, CAM_MAX);
  }

  private handleEvent(s: DiveState, e: DiveEvent): void {
    switch (e.type) {
      case 'peak':
        sfx.swingTick();
        break;
      case 'takeoff':
        this.tuckAt = s.time;
        sfx.diveTakeoff();
        sfx.crowd(0.35);
        if (e.auto) this.flash('ABSPRUNG VERPASST', '', '#e8442e', 1, 16, TOWER_MSG);
        else if (e.quality >= 0.75) this.flash('GUTER ABSPRUNG', '', '#4cd964', 0.6, 16, TOWER_MSG);
        else this.hud.setMessage('');
        break;
      case 'tuck':
        this.tuckAt = s.time;
        break;
      case 'halfTurn':
        sfx.spinWhoosh((e.n * 180) / targetRot(s.def));
        break;
      case 'open':
        sfx.open();
        break;
      case 'twistStart':
        sfx.twist();
        break;
      case 'entry':
        this.onEntry(s);
        break;
      case 'surface':
        this.onSurface();
        break;
      default:
        break;
    }
  }

  private onEntry(s: DiveState): void {
    const j = judge(s);
    this.judgement = j;
    this.entryX = this.hipScreenX(s);
    this.entryAt = this.elapsed;
    this.drops.push(...splashDrops(j.splash, this.entryX));
    if (j.splash === 0) sfx.rip();
    else if (j.splash < 3) sfx.plunge(j.splash === 1 ? 0.55 : 1);
    else {
      sfx.slap();
      sfx.missed();
      this.cameras.main.shake(120, 0.004);
    }
    if (j.splash === 3) sfx.crowd(0.05);
    // Die Kampfrichter reagieren sofort: Nicken bei sauberem Eintauchen, Kopfschütteln beim Fehlsprung
    if (j.fail || j.splash === 3) this.judgeReact = { kind: 'shake', at: this.elapsed };
    else if (j.rating === 'perfect' || j.rating === 'clean') this.judgeReact = { kind: 'nod', at: this.elapsed };
    const r = ratingText(j, s.def);
    this.flash(r.text, '', r.color, 3, 24, POOL_MSG);
  }

  private onSurface(): void {
    const j = this.judgement!;
    this.surfacedAt = this.elapsed;
    this.shakeDir = 1;
    this.drops.push(...splashDrops(1, this.entryX + 30).slice(0, 6));
    this.cards.show(j.notes, j.dropped, this.elapsed);
    for (let i = 0; i < 5; i++) this.time.delayedCall(i * CARD_STEP * 1000, () => sfx.cardFlip());
    sfx.crowd(j.base >= 8 ? 1 : j.base <= 3 ? 0.15 : 0.55);
    if (j.base >= 6) sfx.applause((j.base - 6) / 4);
    if (j.base >= 8) sfx.finish();
  }

  private showVerdict(): void {
    const s = this.diver!;
    const j = this.judgement!;
    const r = verdictTitle(j, s.def);
    this.hud.setMessage('');
    this.messageUntil = this.elapsed;
    this.hall.setBoardTextVisible(false);
    this.verdict.show(
      {
        rating: r.text,
        ratingColor: r.color,
        sum: j.sum,
        dd: j.dd,
        points: j.points,
        tip: tipText(j.tip, j),
        measures: `ABSPRUNG ${Math.round(j.quality * 100)}%   SCHWUNG ${Math.round(j.swing * 100)}%   EINTAUCHEN ${Math.round(Math.abs(j.delta))}°`,
      },
      this.elapsed,
    );
    sfx.scoreCount(0.6);
    this.hud.setInfo(this.round + 1, s.def, diverTotal(this.player.competitor) + j.points);
    this.verdictReady = true;
  }

  // --------------------------------------------------------------- Zeichnen

  private hipScreenX(s: DiveState): number {
    return DIVE_HALL.edgeX - HIP_BACK + s.x * PX_PER_M;
  }

  /** Kampfrichter auf ihren Stühlen; sie heben nacheinander die Tafeln */
  private drawJudges(): void {
    const g = this.judgeGfx;
    g.clear();
    if (this.camY > 170) return;
    const react = this.judgeReact;
    DIVE_HALL.judgeX.forEach((x, i) => {
      // Leicht versetzt, damit nicht alle gleichzeitig nicken
      const age = react ? this.elapsed - react.at - i * 0.07 : -1;
      const r: JudgeReaction | null = react && age >= 0 ? { kind: react.kind, age } : null;
      drawJudge(g, x, DIVE_HALL.judgeSeatY + this.camY, this.officials[i], this.cards.raise(i, this.elapsed), this.elapsed + i, r);
    });
  }

  private drawDiverAndWater(dt: number): void {
    const g = this.diverGfx;
    const w = this.waterGfx;
    const fx = this.fxGfx;
    g.clear();
    w.clear();
    fx.clear();
    const waterY = DIVE_HALL.waterY + this.camY;
    const s = this.diver;
    const t = this.elapsed;

    if (s && this.phase === 'attempt') this.drawAttempt(g, s, waterY);

    // Wasser vor dem Springer: Teile unter der Oberfläche wirken bläulich
    if (waterY < 360) {
      w.fillStyle(COLORS.water, 0.38);
      w.fillPoints(
        [
          new Phaser.Math.Vector2(poolLeftAt(DIVE_HALL.waterY), waterY),
          new Phaser.Math.Vector2(GAME_WIDTH, waterY),
          new Phaser.Math.Vector2(GAME_WIDTH, DIVE_HALL.poolNearY + this.camY),
          new Phaser.Math.Vector2(poolLeftAt(DIVE_HALL.poolNearY), DIVE_HALL.poolNearY + this.camY),
        ],
        true,
      );
    }

    // Spritzer und Tropfen
    for (const d of this.drops) {
      d.life -= dt;
      d.x += d.vx * dt;
      d.h += d.vh * dt;
      d.vh -= 220 * dt;
    }
    this.drops = this.drops.filter((d) => d.life > 0 && d.h > -1);
    if (s?.rating) drawEntrySplash(fx, this.entryX, waterY, s.splash, t - this.entryAt, t);
    drawDrops(fx, this.drops, 0, waterY);
  }

  private drawAttempt(g: Phaser.GameObjects.Graphics, s: DiveState, waterY: number): void {
    const t = this.elapsed;
    const look = this.player.look;
    const platformY = diveScreenY(DIVE.platform, this.camY);
    const edgeHip = DIVE_HALL.edgeX - HIP_BACK;

    switch (s.phase) {
      case 'walk': {
        const u = Math.min(1, (s.time - s.phaseStart) / DIVE.walkTime);
        const pose = diverWalkPose(u);
        drawDiver(g, edgeHip - (1 - u) * WALK_PX, platformY - pose.hip * DIVER_SCALE, pose, look, { time: t });
        return;
      }
      case 'ready':
      case 'swing': {
        const lift = armLift(s);
        const pose = s.phase === 'ready' ? diverStandPose() : diverSwingPose(lift, s.swing);
        drawDiver(g, edgeHip, platformY - pose.hip * DIVER_SCALE, pose, look, { time: t, mood: s.swing > 0.8 ? 'effort' : 'neutral' });
        drawTaktScale(g, edgeHip + 24, platformY - 66, lift);
        return;
      }
      case 'air': {
        const x = this.hipScreenX(s);
        const hipY = diveScreenY(s.y, this.camY);
        const since = s.time - s.takeoffAt!;
        const def = s.def;
        let pose: Pose;
        let twistPhase: number | null = null;
        if (s.twistStart !== null) {
          pose = twistPose();
          twistPhase = (s.time - s.twistStart) / DIVE.twistTime;
        } else if (s.held) {
          const from = since < 0.12 ? diverTakeoffPose() : linePose();
          pose = blendPose(from, positionPose(def.position), (s.time - this.tuckAt) / POSE_BLEND);
        } else {
          const from = s.autoTakeoff && since < 0.15 ? diverTakeoffPose() : positionPose(def.position);
          pose = blendPose(from, linePose(), (s.time - (s.openAt ?? s.time)) / POSE_BLEND);
        }
        // Am Turm steht der (größer gezeichnete) Springer etwas höher als die Hüfte der Sim – kurz angleichen
        const lift = (DIVER_SCALE - 1) * 25 * Math.max(0, 1 - since / 0.3);
        drawDiver(g, x, hipY - lift, pose, look, {
          rotation: (s.rot * Math.PI) / 180,
          twist: twistPhase,
          mood: 'effort',
          time: t,
          pointToes: since > 0.06,
        });
        return;
      }
      case 'water':
        this.drawUnderwater(g, s, waterY);
        return;
      case 'done':
        this.drawSurfaced(g, waterY);
        return;
    }
  }

  /** Abtauchen, Gleiten mit Delfin-Beinschlag und Aufsteigen; Klatscher liegen erst kurz flach auf dem Wasser */
  private drawUnderwater(g: Phaser.GameObjects.Graphics, s: DiveState, waterY: number): void {
    const te = s.time - s.entryAt!;
    const look = this.player.look;
    const rot = (s.rot * Math.PI) / 180;
    const slap = s.rating === 'belly' || s.rating === 'back';
    if (slap && te < 0.35) {
      // Flach auf dem Wasser liegen, dann sinkt er ein
      const lie = s.rating === 'belly' ? Math.PI / 2 : -Math.PI / 2;
      drawDiver(g, this.entryX + 4, waterY - 3 + te * 10, flatPose(), look, { rotation: lie, mood: 'ouch', time: this.elapsed });
      return;
    }
    // Abtauchen (bremst im Wasser), dann schräg nach vorne gleiten und zur Oberfläche steigen
    const sink = Math.min(1, te / 0.45);
    const depth = 50 * (1 - (1 - sink) * (1 - sink)) - Math.max(0, te - 0.6) * 30;
    const glide = Math.max(0, te - 0.4);
    const x = this.entryX + 4 + glide * 30;
    const hipY = waterY - 26 + 26 * Math.min(1, te / 0.12) + depth;
    if (s.rating === 'bomb') {
      // Nicht geöffnet: in der Sprungposition (gehockt als Kugel) ins Wasser
      const pose = s.def.position === 'tuck' ? bombPose() : positionPose(s.def.position);
      drawDiver(g, x, hipY, pose, look, { rotation: rot, time: this.elapsed, mood: 'ouch', pointToes: true });
      drawBubbles(g, x + 4, hipY - 6, this.elapsed, 8);
      return;
    }
    // Kopf zeigt erst schräg nach vorne unten, dann nach vorne oben (Winkel relativ zur Eintauchlage)
    const mod = ((s.rot % 360) + 360) % 360;
    const down = rot - ((mod - 115) * Math.PI) / 180;
    const up = rot - ((mod - 70) * Math.PI) / 180;
    const k1 = Phaser.Math.Clamp((te - 0.3) / 0.45, 0, 1);
    const k2 = Phaser.Math.Clamp((te - 0.75) / 0.45, 0, 1);
    const angle = Phaser.Math.Linear(Phaser.Math.Linear(rot, down, k1), up, k2);
    drawDiver(g, x, hipY, glidePose(te), look, { rotation: angle, time: this.elapsed, pointToes: true });
    // Luftbläschen steigen von Mund und Füßen auf
    drawBubbles(g, x + 6, hipY - 4, this.elapsed, 5);
    drawBubbles(g, x - 10, hipY + 2, this.elapsed + 0.4, 3);
  }

  /** Aufgetaucht: Wassertreten und winken – oder den Kopf schütteln, dass die Tropfen fliegen */
  private drawSurfaced(g: Phaser.GameObjects.Graphics, waterY: number): void {
    const j = this.judgement;
    const happy = j !== null && !j.fail && j.base >= 6;
    const since = this.surfacedAt !== null ? this.elapsed - this.surfacedAt : 0;
    const shaking = !happy && since > 0.25 && since < 1.5;
    const dir: 1 | -1 = shaking && Math.floor(since * 7) % 2 === 1 ? -1 : 1;
    const x = this.entryX + 30;
    const rise = 1 - Math.pow(1 - Math.min(1, since / 0.35), 2);
    const hipY = waterY + 30 - 18 * rise + Math.sin(this.elapsed * 3) * 1;
    const headH = waterY - (hipY - (BODY_TO_HEAD * DIVER_SCALE));
    // Bei jedem Kopfrucken fliegen Tropfen aus den Haaren
    if (dir !== this.shakeDir) {
      this.shakeDir = dir;
      for (let i = 0; i < 4; i++) {
        this.drops.push({
          x: x + dir * 4,
          h: headH,
          vx: -dir * (40 + Math.random() * 50),
          vh: 20 + Math.random() * 40,
          life: 0.5,
          size: Math.random() < 0.5 ? 1 : 2,
        });
      }
    }
    // Wasser tropft aus den Haaren
    if (since > 0.3 && this.elapsed >= this.dripAt) {
      this.dripAt = this.elapsed + 0.35 + Math.random() * 0.3;
      this.drops.push({ x: x + (Math.random() - 0.5) * 8, h: headH - 4, vx: 0, vh: -5, life: 0.6, size: 1 });
    }
    const pose = treadPose(this.elapsed, happy, shaking ? 1 : 0);
    const mood: Mood = happy ? 'joy' : j?.fail ? 'ouch' : 'tired';
    drawDiver(g, x, hipY, pose, this.player.look, { mood, time: this.elapsed, dir, waterY });
    drawWaterRing(g, x, waterY, 10 + Math.sin(this.elapsed * 2) * 2, this.elapsed);
    if (since < 0.6) drawWaterRing(g, x, waterY, 6 + since * 30, this.elapsed + 1);
  }
}
