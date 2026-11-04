import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { CAMERA_LEAD_X, COLORS, GAME_WIDTH, LANE_COUNT, PX_PER_M, skewAt } from '../config';
import { COUNTRIES, countryByCode, type Country } from '../data/countries';
import { getCompetition } from '../data/session';
import { loadLookSeed } from '../data/storage';
import { SwimHall, blockTopY, waterLineY } from '../gfx/pool';
import { createLook, lerpPose, standPose, type Mood, type Pose, type RunnerLook } from '../gfx/runner';
import { SwimHud } from '../gfx/swimHud';
import {
  SWIMMER_HEAD_LEAD,
  armCirclePose,
  blockCrouchPose,
  divePose,
  drawDrops,
  drawFlipTurn,
  drawSwimmer,
  drawSplashCrown,
  drawSwimmerUpright,
  drawWake,
  drawWaterRing,
  ropeRestPose,
  waterCheerPose,
  type Drop,
  type SwimKind,
} from '../gfx/swimmer';
import type { Side } from '../sim/hurdles';
import {
  SWIM,
  SWIM_CPU_PROFILES,
  SwimCpu,
  breathe,
  createSwimmer,
  dive,
  flipTurn,
  heading,
  isFinished,
  poolX,
  step,
  stroke,
  taktRatio,
  toWall,
  type SwimEvent,
  type SwimmerState,
  type TurnRating,
} from '../sim/swim';
import { confirmAbort, confirmPending } from './ConfirmScene';
import type { ResultCell, ResultRow, ResultSceneData } from './ResultScene';

const SIM_DT = 1 / 120;
const PLAYER_LANE = 2;
/** Wie lange nach dem eigenen Anschlag noch weitergeschwommen wird */
const AFTER_FINISH = 4;
/** Bildschirm-X des Schwimmers auf der Rückbahn (Hinbahn: CAMERA_LEAD_X) */
const CAMERA_LEAD_BACK = 470;
/** Die Kamera bleibt zwischen −4 m und 54 m */
const CAMERA_MIN_PX = -4 * PX_PER_M;
const CAMERA_MAX_PX = 54 * PX_PER_M - GAME_WIDTH;
/** Übergang eines Armzugs in der Animation (halber Zyklus) */
const STROKE_ANIM = 0.12;
/** Ohne Zug taucht der Schwimmer nach dieser Zeit wieder auf */
const GLIDE_MAX = 2;
/** Hinweis auf die Wende so weit vor der Wand */
const TURN_HINT_AT = 8;
/** Kopf bis Fußspitze eines Schwimmers in Pixeln */
const BODY_PX = 48;
/** Auf dieser Strecke nach der Wende rückt der gezeichnete Körper an seine wahre Lage */
const PUSH_BLEND_PX = 6 * PX_PER_M;
/** Wie lange eine Wasserkrone steht */
const CROWN_LIFE = 0.6;

type Phase = 'ready' | 'block' | 'marks' | 'falseStart' | 'race';

interface Competitor {
  country: Country;
  look: RunnerLook;
  lane: number;
  state: SwimmerState;
  cpu: SwimCpu | null;
  isPlayer: boolean;
  place: number | null;
  /** Seit dem Eintauchen bzw. Abstoßen gleitet der Schwimmer bis zum ersten Zug */
  glideFrom: number;
  drops: Drop[];
  rings: { x: number; r: number; life: number }[];
  /** Wasserkronen beim Eintauchen und an der Wand (Welt-X, Restzeit) */
  crowns: { x: number; life: number }[];
  gfx: Phaser.GameObjects.Graphics;
}

export interface SwimSceneData {
  countryIndex: number;
}

const TURN_TEXT: Record<TurnRating, { cell: string; color: string }> = {
  perfect: { cell: 'PERFEKT', color: '#4cd964' },
  good: { cell: 'GUT', color: '#ffffff' },
  early: { cell: 'FRÜH', color: '#f08a24' },
  late: { cell: 'SPÄT', color: '#f08a24' },
  open: { cell: 'KEINE', color: '#e8442e' },
};

export class SwimScene extends Phaser.Scene {
  private hall!: SwimHall;
  private hud!: SwimHud;
  private competitors: Competitor[] = [];
  private player!: Competitor;
  private countryIndex = 0;

  private phase: Phase = 'ready';
  /** performance.now() beim Startsignal */
  private gunAt = 0;
  private simTime = 0;
  private phaseTimer = 0;
  private setDelay = 0;
  private crouch = 0;
  private finishOrder = 0;
  private playerFinishedAt: number | null = null;
  private camPx = 0;
  /** 0 = Kamera-Vorlauf der Hinbahn, 1 = der Rückbahn */
  private camBlend = 0;
  private elapsed = 0;
  private falseStarts = 0;
  private resultsShown = false;
  /** Bis dahin bleibt eine Meldung stehen, danach erscheinen wieder Hinweise */
  private messageUntil = 0;

  constructor() {
    super('swim');
  }

  init(data: SwimSceneData): void {
    this.countryIndex = data.countryIndex ?? 0;
    this.phase = 'ready';
    this.simTime = 0;
    this.phaseTimer = 0;
    this.crouch = 0;
    this.finishOrder = 0;
    this.playerFinishedAt = null;
    this.camBlend = 0;
    this.elapsed = 0;
    this.falseStarts = 0;
    this.resultsShown = false;
    this.messageUntil = 0;
    this.competitors = [];
  }

  create(): void {
    this.hall = new SwimHall(this);
    this.setupCompetitors();
    this.hud = new SwimHud(this);
    this.showReadyMessage();

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    kb.on('keydown', this.onKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', this.onKeyDown, this));

    // Pfiff, Platscher und Publikum hallen in der Schwimmhalle nach
    sfx.setRoom('hall');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sfx.setRoom('open'));
    sfx.crowd(0.3);
  }

  private setupCompetitors(): void {
    const others = COUNTRIES.filter((_, i) => i !== this.countryIndex);
    Phaser.Utils.Array.Shuffle(others);
    const profiles = Phaser.Utils.Array.Shuffle([...SWIM_CPU_PROFILES]);
    // Im Wettkampf tritt immer dasselbe Feld an
    const field = getCompetition()?.field;
    const cpuField = field?.filter((f) => !f.isPlayer);
    let cpuIndex = 0;

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const isPlayer = lane === PLAYER_LANE;
      const entry = isPlayer ? field?.find((f) => f.isPlayer) : cpuField?.[cpuIndex];
      const country = isPlayer ? COUNTRIES[this.countryIndex] : entry ? countryByCode(entry.code) : others[cpuIndex];
      const state = createSwimmer();
      const seed = entry ? entry.lookSeed : isPlayer ? loadLookSeed() : Math.floor(Math.random() * 1e9);
      const profile = entry?.profile != null ? SWIM_CPU_PROFILES[entry.profile] : profiles[cpuIndex % profiles.length];
      const c: Competitor = {
        country,
        look: createLook(country, seed, lane + 1),
        lane,
        state,
        cpu: isPlayer ? null : new SwimCpu(state, profile, Math.random),
        isPlayer,
        place: null,
        glideFrom: 0,
        drops: [],
        rings: [],
        crowns: [],
        gfx: this.add.graphics().setDepth(lane * 10 + 5),
      };
      if (!isPlayer) cpuIndex++;
      this.competitors.push(c);
      if (isPlayer) this.player = c;
    }
  }

  // ---------------------------------------------------------------- Eingabe

  private onKeyDown(ev: KeyboardEvent): void {
    sfx.unlock();
    if (ev.repeat || confirmPending()) return;
    const competition = getCompetition() !== null;

    if (ev.code === 'Escape') {
      // Im Wettkampf mit Rückfrage; die Rennzeit läuft währenddessen nicht weiter
      if (competition) {
        if (!this.resultsShown) confirmAbort(this, (ms) => (this.gunAt += ms));
      } else this.scene.start('title');
      return;
    }
    if (ev.code === 'KeyM') {
      sfx.toggleMute();
      return;
    }

    const side: Side | null =
      ev.code === 'ArrowLeft' || ev.code === 'KeyA' ? 'L' : ev.code === 'ArrowRight' || ev.code === 'KeyD' ? 'R' : null;
    const isAction = ev.code === 'Space';
    const isUp = ev.code === 'ArrowUp' || ev.code === 'KeyW';
    const isConfirm = ev.code === 'Enter' || ev.code === 'NumpadEnter';

    switch (this.phase) {
      case 'ready':
        if (isConfirm || isAction) this.startCalls();
        break;
      case 'block':
      case 'marks':
        if (side || isAction) this.falseStart();
        break;
      case 'race': {
        if (this.playerFinishedAt !== null && isConfirm) {
          this.showResults();
          return;
        }
        if (ev.code === 'KeyR') {
          if (!competition) this.scene.restart({ countryIndex: this.countryIndex });
          return;
        }
        const s = this.player.state;
        const t = this.raceTimeAt(ev.timeStamp);
        if (side) {
          const quality = stroke(s, side, t);
          this.hud.registerTap(side, quality !== null, this.elapsed);
        } else if (isAction) {
          if (s.phase === 'block') dive(s, t);
          else if (!flipTurn(s, t) && !isFinished(s)) this.hud.registerMiss(this.elapsed);
        } else if (isUp) {
          breathe(s);
        }
        break;
      }
      case 'falseStart':
        break;
    }
  }

  private raceTimeAt(timeStamp: number): number {
    // Der Zeitstempel des Tastendrucks zählt, nicht erst das nächste Bild
    const stamp = timeStamp > 0 ? timeStamp : performance.now();
    return Math.max(0, (stamp - this.gunAt) / 1000);
  }

  // ---------------------------------------------------------- Startablauf

  private showReadyMessage(): void {
    const warn = this.falseStarts > 0 ? `FEHLSTARTS: ${this.falseStarts}\n\n` : '';
    this.hud.setMessage(
      '100 M FREISTIL',
      `${warn}PFEIL LINKS/RECHTS IM TAKT = KRAULEN\nNICHT HÄMMERN – ZU SCHNELL = VERSCHLUCKEN\nPFEIL HOCH = ATMEN   LEERTASTE = START/WENDE\n\nENTER: BEREIT`,
    );
  }

  private startCalls(): void {
    this.phase = 'block';
    this.phaseTimer = 0;
    this.hud.setMessage('AUF DEN BLOCK', '');
    sfx.whistle();
  }

  private falseStart(): void {
    this.phase = 'falseStart';
    this.phaseTimer = 0;
    this.falseStarts++;
    this.hud.setMessage('FEHLSTART!', 'NICHT VOR DEM SIGNAL SPRINGEN', '#e8442e');
    sfx.falseStart();
  }

  private updateStartPhases(dt: number): void {
    this.phaseTimer += dt;
    switch (this.phase) {
      case 'block':
        if (this.phaseTimer > 1.6) {
          this.phase = 'marks';
          this.phaseTimer = 0;
          this.setDelay = Phaser.Math.FloatBetween(1.0, 2.2);
          this.hud.setMessage('AUF DIE PLÄTZE', '');
          sfx.call(false);
        }
        break;
      case 'marks':
        this.crouch = Math.min(1, this.crouch + dt * 3);
        if (this.phaseTimer > this.setDelay) this.fireSignal();
        break;
      case 'falseStart':
        this.crouch = Math.max(0, this.crouch - dt * 3);
        if (this.phaseTimer > 1.8) {
          this.phase = 'ready';
          this.showReadyMessage();
        }
        break;
      default:
        break;
    }
  }

  private fireSignal(): void {
    this.phase = 'race';
    this.gunAt = performance.now();
    this.simTime = 0;
    this.flash('LOS!', '', '#f7d038', 0.7);
    sfx.startBeep();
    sfx.crowd(0.6);
  }

  // ------------------------------------------------------------ Rennen

  /** Meldung für eine Weile stehen lassen */
  private flash(text: string, sub: string, color: string, seconds: number): void {
    this.hud.setMessage(text, sub, color);
    this.messageUntil = this.elapsed + seconds;
  }

  /** Hinweise, solange keine Meldung steht */
  private updateHint(): void {
    if (this.playerFinishedAt !== null || this.elapsed < this.messageUntil) return;
    const s = this.player.state;
    let hint = '';
    if (s.phase === 'block' && this.simTime > 1) hint = 'LEERTASTE = SPRINGEN!';
    else if (s.phase === 'swim' && s.air < SWIM.lowAir) hint = 'LUFT HOLEN: PFEIL HOCH!';
    else if (s.phase === 'swim' && !s.turned && toWall(s) <= TURN_HINT_AT) hint = 'WENDE: LEERTASTE KURZ VOR DER WAND';
    this.hud.setMessage('', hint);
  }

  private updateRace(): void {
    const target = (performance.now() - this.gunAt) / 1000;
    // Fixer Zeitschritt: gleiches Ergebnis unabhängig von der Bildrate
    while (this.simTime + SIM_DT <= target) {
      this.simTime += SIM_DT;
      for (const c of this.competitors) {
        c.cpu?.update(this.simTime);
        for (const e of step(c.state, SIM_DT, this.simTime)) this.handleEvent(c, e);
      }
    }

    if (this.playerFinishedAt !== null && !this.resultsShown) {
      const allDone = this.competitors.every((c) => isFinished(c.state));
      if (this.simTime - this.playerFinishedAt > AFTER_FINISH || (allDone && this.simTime - this.playerFinishedAt > 2)) {
        this.showResults();
      }
    }
  }

  private handleEvent(c: Competitor, e: SwimEvent): void {
    const p = c.isPlayer;
    switch (e.type) {
      case 'dive':
        if (p) {
          sfx.jump();
          if (e.auto) this.flash('ZU SPÄT GESPRUNGEN', '', '#f08a24', 1);
        }
        break;
      case 'entry':
        c.glideFrom = this.simTime;
        this.splash(c, this.headWorldX(c) - heading(c.state) * 8, 20, 1.15);
        c.rings.push({ x: this.headWorldX(c), r: 5, life: 0.9 });
        c.crowns.push({ x: this.headWorldX(c) - heading(c.state) * 6, life: CROWN_LIFE });
        if (p) sfx.plunge();
        break;
      case 'stroke':
        this.splash(c, this.headWorldX(c) + heading(c.state) * 6, 3 + (c.state.strokes % 2), 0.6);
        if (p) {
          sfx.stroke(e.side);
          this.hud.registerStroke(e.quality, e.inTakt);
        }
        break;
      case 'choke':
        if (p) {
          sfx.choke();
          this.flash('VERSCHLUCKT!', 'ZU SCHNELL – RUHIG IM TAKT TIPPEN', '#e8442e', 0.9);
          this.cameras.main.shake(100, 0.003);
        }
        break;
      case 'breath':
        if (p) sfx.breath();
        break;
      case 'lowAir':
        if (p) sfx.lowAir();
        break;
      case 'gasp':
        if (p) {
          sfx.gasp();
          this.flash('LUFTNOT!', 'FRÜHER ATMEN – PFEIL HOCH', '#e8442e', 1.2);
        }
        break;
      case 'turn':
        if (p) this.showTurn(e.rating);
        if (e.rating === 'open') {
          this.splash(c, SWIM.poolLength * PX_PER_M, 6, 0.8);
          if (p) sfx.touch();
        } else if (p) {
          sfx.flip();
        }
        break;
      case 'wall':
        this.splash(c, SWIM.poolLength * PX_PER_M - 10, 10, 1);
        c.crowns.push({ x: SWIM.poolLength * PX_PER_M - 12, life: CROWN_LIFE * 0.7 });
        break;
      case 'push':
        c.glideFrom = this.simTime;
        break;
      case 'finish':
        c.place = ++this.finishOrder;
        this.hall.touch(c.lane, c.place, this.elapsed);
        this.splash(c, 4, 10, 1);
        c.rings.push({ x: 4, r: 4, life: 0.7 });
        if (p) {
          this.playerFinishedAt = this.simTime;
          sfx.touch();
          sfx.finish();
          sfx.crowd(1);
          const color = c.place === 1 ? '#f7c843' : '#ffffff';
          this.hud.setMessage(e.time.toFixed(2), `${c.place}. PLATZ\n\nENTER: ERGEBNIS`, color);
        }
        break;
      default:
        break;
    }
  }

  private showTurn(rating: TurnRating): void {
    switch (rating) {
      case 'perfect':
        this.flash('PERFEKTE WENDE!', '', '#f7c843', 1.2);
        break;
      case 'good':
        this.flash('GUTE WENDE', '', '#ffffff', 1.2);
        break;
      case 'early':
        this.flash('WENDE ZU FRÜH', 'NÄHER AN DER WAND DREHEN', '#f08a24', 1.4);
        break;
      case 'late':
        this.flash('WENDE ZU SPÄT', 'ETWAS FRÜHER DREHEN', '#f08a24', 1.4);
        break;
      case 'open':
        this.flash('ANGESCHLAGEN!', 'WENDE MIT LEERTASTE VOR DER WAND', '#e8442e', 1.6);
        break;
    }
  }

  /** Wer noch schwimmt, schlägt im Schnelldurchlauf an */
  private finishRemaining(): void {
    let t = this.simTime;
    while (this.competitors.some((c) => !isFinished(c.state)) && t < this.simTime + 120) {
      t += SIM_DT;
      for (const c of this.competitors) {
        if (c.isPlayer || isFinished(c.state)) continue;
        c.cpu?.update(t);
        step(c.state, SIM_DT, t);
      }
    }
  }

  private showResults(): void {
    if (this.resultsShown) return;
    this.resultsShown = true;
    this.finishRemaining();
    const ranked = [...this.competitors].sort(
      (a, b) => (a.state.finishTime ?? Infinity) - (b.state.finishTime ?? Infinity) || b.state.d - a.state.d,
    );
    const rows: ResultRow[] = ranked.map((c) => {
      const s = c.state;
      const turn = TURN_TEXT[s.turnRating ?? 'open'];
      const takt = Math.round(taktRatio(s) * 100);
      const cells: ResultCell[] = [
        { text: s.finishTime !== null ? s.finishTime.toFixed(2) : '-' },
        { text: turn.cell, color: turn.color },
        { text: `${takt}%`, color: takt >= 80 ? '#4cd964' : takt >= 60 ? '#f7d038' : '#e8442e' },
      ];
      // Keine Disqualifikation: alle kommen an und sind gültig
      return { country: c.country, look: c.look, isPlayer: c.isPlayer, valid: true, cells };
    });
    const data: ResultSceneData = {
      event: 'swim',
      headers: ['ZEIT', 'WENDE', 'TAKT'],
      rows,
      playerScore: this.player.state.finishTime,
      worldRecord: SWIM.worldRecord,
      notes: this.notes(),
      replay: { scene: 'swim', data: { countryIndex: this.countryIndex } },
    };
    this.cameras.main.fadeOut(300, 16, 16, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('result', data);
    });
  }

  /** Rückmeldung: ein Tipp nach Zeitverlust, Zusammenfassung, ggf. Fehlstarts */
  private notes(): string[] {
    const s = this.player.state;
    const takt = taktRatio(s);
    const rate = s.swimTime > 0 ? s.strokes / s.swimTime : 0;
    let tip = 'SAUBERES RENNEN – STARK!';
    if (s.gasps > 0) tip = `LUFT AUSGEGANGEN (${s.gasps}X) – FRÜHER PFEIL HOCH`;
    else if (s.chokes >= 2) tip = `${s.chokes}X VERSCHLUCKT – NICHT HÄMMERN, IM TAKT TIPPEN`;
    else if (s.turnRating === 'open') tip = 'ANGESCHLAGEN – LEERTASTE CA. 1 M VOR DER WAND';
    else if (s.turnRating === 'early') tip = 'WENDE ZU FRÜH – NÄHER AN DER WAND DREHEN';
    else if (s.turnRating === 'late') tip = 'WENDE ZU SPÄT – ETWAS FRÜHER DREHEN';
    else if (takt < 0.6) tip = 'VIELE HEKTISCHE ZÜGE – ETWAS RUHIGER TIPPEN';
    else if (s.earlyBreaths >= 3) tip = 'ZU OFT GEATMET – ERST BEI GELBER LUFT';
    else if (rate < 8.5) tip = 'MEHR TEMPO – SCHNELLER TIPPEN (IDEAL CA. 10/S)';
    const reaction = s.reaction !== null ? s.reaction.toFixed(2) : '-';
    const turn = TURN_TEXT[s.turnRating ?? 'open'].cell;
    const notes = [tip, `REAKTION ${reaction} S   WENDE: ${turn}   TAKT ${Math.round(takt * 100)}%`];
    if (this.falseStarts > 0) notes.push(`FEHLSTARTS: ${this.falseStarts}`);
    return notes;
  }

  // ---------------------------------------------------------- Darstellung

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;

    if (this.phase === 'race') {
      this.updateRace();
      this.updateHint();
    } else {
      this.updateStartPhases(dt);
    }

    const raceTime = this.phase === 'race' ? this.simTime : 0;
    const p = this.player.state;
    // Auf der Rückbahn liegt der Vorlauf auf der anderen Seite – weich überblendet
    const back = heading(p) < 0 ? 1 : 0;
    this.camBlend = back > this.camBlend ? Math.min(back, this.camBlend + dt) : Math.max(back, this.camBlend - dt);
    const blend = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);
    const lead = Phaser.Math.Linear(CAMERA_LEAD_X, CAMERA_LEAD_BACK, blend);
    const targetCam = poolX(p) * PX_PER_M + skewAt(waterLineY(PLAYER_LANE)) - lead;
    this.camPx = Math.round(Phaser.Math.Clamp(targetCam, CAMERA_MIN_PX, CAMERA_MAX_PX));

    const remaining = SWIM.distance - p.d;
    const excitement =
      this.phase !== 'race' ? 0.1 : this.playerFinishedAt !== null ? 1 : Phaser.Math.Clamp(1 - remaining / 60, 0.3, 0.9);
    // Weltrekord-Linie im Tempo von 46.50 s
    const wr = (raceTime / SWIM.worldRecord) * SWIM.distance;
    const wrOn = this.phase === 'race' && raceTime > 0 && wr <= SWIM.distance;
    this.hall.setRecordLine(wrOn ? (wr <= SWIM.poolLength ? wr : SWIM.distance - wr) : null);
    this.hall.update(this.camPx, dt, this.elapsed, excitement, p.finishTime ?? raceTime);

    for (const c of this.competitors) this.drawCompetitor(c, raceTime, dt);

    const inZone = p.phase === 'swim' && !p.turned && toWall(p) <= SWIM.turnZone;
    this.hud.update(
      this.elapsed,
      raceTime,
      this.competitors.map((c) => ({ state: c.state, color: c.country.jersey, isPlayer: c.isPlayer })),
      {
        actionLabel: p.diveAt === null ? 'START' : 'WENDE',
        actionLit: (this.phase === 'race' && p.phase === 'block') || inZone,
      },
    );
  }

  private screenX(worldPx: number, y: number): number {
    return Math.round(worldPx - this.camPx + skewAt(y));
  }

  /**
   * Gezeichnete Kopfspitze (Welt-Pixel): Nach dem Abstoß liegen die Füße an der Wand,
   * deshalb wird der Körper auf den ersten Metern weich von der Wand weggeschoben.
   */
  private drawnHeadPx(s: SwimmerState): number {
    const head = poolX(s) * PX_PER_M;
    if (heading(s) > 0 || s.phase === 'flip' || s.phase === 'wall' || s.phase === 'open') return head;
    const fromWall = SWIM.poolLength * PX_PER_M - head;
    if (fromWall >= PUSH_BLEND_PX) return head;
    return SWIM.poolLength * PX_PER_M - (BODY_PX + fromWall * (1 - BODY_PX / PUSH_BLEND_PX));
  }

  /** Welt-X (Pixel) der Kopfspitze */
  private headWorldX(c: Competitor): number {
    return poolX(c.state) * PX_PER_M;
  }

  /** Tropfen am Handeintritt bzw. an der Wand */
  private splash(c: Competitor, worldX: number, count: number, power: number): void {
    const dir = heading(c.state);
    for (let i = 0; i < count; i++) {
      c.drops.push({
        x: worldX + (Math.random() - 0.5) * 6,
        h: 1,
        vx: (Math.random() - 0.5) * 50 * power + dir * 10,
        vh: (30 + Math.random() * 45) * power,
        life: 0.45 + Math.random() * 0.25,
        size: Math.random() < 0.3 ? 1 : Math.random() < 0.8 ? 2 : 3,
      });
    }
  }

  private updateEffects(c: Competitor, dt: number): void {
    for (const d of c.drops) {
      d.life -= dt;
      d.x += d.vx * dt;
      d.h += d.vh * dt;
      d.vh -= 220 * dt;
    }
    c.drops = c.drops.filter((d) => d.life > 0 && d.h > -1);
    for (const r of c.rings) {
      r.life -= dt;
      r.r += 18 * dt;
    }
    c.rings = c.rings.filter((r) => r.life > 0);
    for (const k of c.crowns) k.life -= dt;
    c.crowns = c.crowns.filter((k) => k.life > 0);
  }

  private drawCompetitor(c: Competitor, raceTime: number, dt: number): void {
    const g = c.gfx;
    g.clear();
    this.updateEffects(c, dt);
    const s = c.state;
    const waterY = waterLineY(c.lane);
    const dir = heading(s);
    const t = this.elapsed;
    // Kopfspitze liegt bei poolX, die Schulter etwas dahinter
    const shoulderX = this.screenX(this.drawnHeadPx(s) - dir * SWIMMER_HEAD_LEAD, waterY);
    let markerY = waterY - 30;
    let markerX = shoulderX;

    if (this.phase !== 'race' || s.phase === 'block') {
      // Auf dem Block: Armkreisen, still stehen, dann Startposition
      const groundY = blockTopY(c.lane);
      const crouching = this.phase === 'race' ? 1 : this.crouch;
      const x = this.screenX(-0.3 * PX_PER_M - crouching * 4, groundY);
      const stand = this.phase === 'ready' ? armCirclePose(t, c.look.seed) : standPose();
      const pose = crouching > 0 ? lerpPose(stand, blockCrouchPose(), crouching) : stand;
      drawSwimmerUpright(g, x, groundY, pose, c.look, { dir: 1, time: t });
      markerX = x;
      markerY = groundY - (crouching > 0.5 ? 42 : 66);
    } else if (s.phase === 'dive') {
      const u = Phaser.Math.Clamp((raceTime - s.diveAt!) / SWIM.diveFlight, 0, 1);
      const groundY = blockTopY(c.lane);
      const startHipY = groundY - blockCrouchPose().hip;
      const hipY = Phaser.Math.Linear(startHipY, waterY + 3, u) - 12 * 4 * u * (1 - u);
      const hipM = Phaser.Math.Linear(-0.4, SWIM.diveDistance - (SWIMMER_HEAD_LEAD + 15) / PX_PER_M, u);
      const x = this.screenX(hipM * PX_PER_M, hipY);
      const tilt = Phaser.Math.Linear(-0.17, 0.44, u);
      const pose = divePose();
      drawSwimmerUpright(g, x, hipY + pose.hip, pose, c.look, { dir: 1, time: t, rotation: Math.PI / 2 + tilt });
      markerX = x;
      markerY = hipY - 26;
    } else if (s.phase === 'flip' || s.phase === 'wall') {
      const u = Math.min(1, (raceTime - s.flipAt!) / SWIM.flipTime);
      drawFlipTurn(g, shoulderX, waterY, u, c.look, 1, t);
    } else if (s.phase === 'open') {
      drawSwimmer(g, shoulderX, waterY, 'touch', c.look, { dir, cycle: 0, kick: t * 4, time: t });
    } else if (s.phase === 'done') {
      this.drawFinished(c, shoulderX, waterY, raceTime);
      markerY = waterY - 44;
    } else {
      const kind: SwimKind =
        s.stunKind === 'choke'
          ? 'choke'
          : s.stunKind === 'gasp'
            ? 'gasp'
            : s.breathing > 0
              ? 'breath'
              : s.lastStrokeAt < c.glideFrom && raceTime - c.glideFrom < GLIDE_MAX
                ? 'glide'
                : 'crawl';
      // Jeder Zug schaltet die Arme einen halben Zyklus weiter
      const since = raceTime - s.lastStrokeAt;
      const cycle = Math.max(0, s.strokes - 1) * 0.5 + 0.5 * Math.min(1, since / STROKE_ANIM);
      const kick = kind === 'glide' ? t * 3 : t * (10 + s.v * 3);
      if (kind !== 'glide') drawWake(g, shoulderX, waterY, dir, s.v, t);
      drawSwimmer(g, shoulderX, waterY, kind, c.look, { dir, cycle, kick, time: t });
    }

    const camX = this.camPx - skewAt(waterY);
    for (const r of c.rings) drawWaterRing(g, r.x - camX, waterY, r.r, t);
    for (const k of c.crowns) drawSplashCrown(g, k.x - camX, waterY, 1 - k.life / CROWN_LIFE);
    drawDrops(g, c.drops, camX, waterY);

    if (c.isPlayer) {
      // Markierung über dem eigenen Schwimmer
      const my = markerY + Math.round(Math.sin(t * 6));
      g.fillStyle(COLORS.outline, 1);
      g.fillTriangle(markerX - 5, my - 1, markerX + 5, my - 1, markerX, my + 5);
      g.fillStyle(COLORS.yellow, 1);
      g.fillTriangle(markerX - 3, my, markerX + 3, my, markerX, my + 3);
    }
  }

  /** Nach dem Anschlag: Arm an der Wand, dann Jubel oder müde an der Leine */
  private drawFinished(c: Competitor, shoulderX: number, waterY: number, raceTime: number): void {
    const g = c.gfx;
    const s = c.state;
    const t = this.elapsed;
    const since = raceTime - (s.finishTime ?? raceTime);
    if (since < 0.6) {
      drawSwimmer(g, shoulderX, waterY, 'touch', c.look, { dir: -1, cycle: 0, kick: t * 4, time: t });
      return;
    }
    const medal = (c.place ?? 9) <= 3;
    const happy = c.place === 1 || (c.isPlayer && medal);
    const pose: Pose = happy ? waterCheerPose(t) : ropeRestPose(t + c.look.seed);
    const mood: Mood = happy ? 'joy' : 'tired';
    const x = this.screenX(0.7 * PX_PER_M, waterY);
    // Hüfte knapp unter der Wasserlinie
    drawSwimmerUpright(g, x, waterY + pose.hip + 4, pose, c.look, { dir: -1, mood, time: t, waterY });
  }
}
