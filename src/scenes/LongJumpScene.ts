import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import {
  CAMERA_LEAD_X,
  COLORS,
  FONT,
  GAME_WIDTH,
  LANE_DEPTH,
  PX_PER_M,
  TRACK_FAR_Y,
  laneCenterY,
  skewAt,
} from '../config';
import { COUNTRIES, countryByCode, type Country } from '../data/countries';
import { getCompetition } from '../data/session';
import { loadLookSeed } from '../data/storage';
import { drawFlag } from '../gfx/flags';
import { JumpBoard, type JumpBoardRow } from '../gfx/jumpBoard';
import { LongJumpHud } from '../gfx/longJumpHud';
import {
  createLook,
  drawRunner,
  drawShadow,
  flagPose,
  handOffset,
  idlePose,
  lerpPose,
  ljFlightPose,
  ljLandPose,
  ljTakeoffPose,
  runPose,
  sitPose,
  standPose,
  type Mood,
  type Pose,
  type RunnerLook,
} from '../gfx/runner';
import { Stadium } from '../gfx/stadium';
import type { Side } from '../sim/hurdles';
import {
  LJ,
  LJ_CPU_PROFILES,
  ROUNDS,
  bestJump,
  cpuJump,
  createJump,
  createJumper,
  flightDuration,
  ljPress,
  ljRelease,
  ljTap,
  nextJump,
  rankJumpers,
  stepJump,
  type JumpCpuProfile,
  type Jumper,
  type LjEvent,
  type LjState,
} from '../sim/longjump';
import { confirmAbort, confirmPending } from './ConfirmScene';
import type { ResultRow, ResultSceneData } from './ResultScene';

const SIM_DT = 1 / 120;
const RUNWAY_LANE = 2;
const GROUND_Y = laneCenterY(RUNWAY_LANE) + 4;
const LANE_TOP = TRACK_FAR_Y + RUNWAY_LANE * LANE_DEPTH;
const LANE_BOTTOM = LANE_TOP + LANE_DEPTH;
const PIT = { x0: 1.0, x1: 10.0, farY: LANE_TOP - 8, nearY: LANE_BOTTOM + 12 };
const WORLD_RECORD = 8.95;
/** Bildschirmposition der Brettkante, sobald die Kamera stehen bleibt */
const BOARD_SCREEN_X = 150;
const MARKS = [5, 6, 7, 8, 9];

interface Entrant {
  country: Country;
  look: RunnerLook;
  jumper: Jumper;
  profile: JumpCpuProfile | null;
}

interface Grain {
  x: number;
  h: number;
  vx: number;
  vh: number;
  life: number;
}

type Mode = 'board' | 'attempt';

export interface LongJumpSceneData {
  countryIndex: number;
}

function formatAttempt(a: number | null | undefined): string {
  return a === undefined ? '' : a === null ? 'X' : a.toFixed(2);
}

export class LongJumpScene extends Phaser.Scene {
  private stadium!: Stadium;
  private hud!: LongJumpHud;
  private board!: JumpBoard;
  private worldGfx!: Phaser.GameObjects.Graphics;
  private athleteGfx!: Phaser.GameObjects.Graphics;
  private markTexts: Phaser.GameObjects.Text[] = [];
  private countryIndex = 0;
  private entrants: Entrant[] = [];
  private player!: Entrant;
  private official!: RunnerLook;
  private mode: Mode = 'board';
  private turn: { jumper: Jumper; round: number } | null = null;
  private waitingForPlayer = false;
  private jump: LjState | null = null;
  private simAccum = 0;
  private elapsed = 0;
  private camPx = 0;
  private verdictAt: number | null = null;
  private grains: Grain[] = [];
  private finished = false;

  constructor() {
    super('longjump');
  }

  init(data: LongJumpSceneData): void {
    this.countryIndex = data.countryIndex ?? 0;
    this.entrants = [];
    this.markTexts = [];
    this.mode = 'board';
    this.turn = null;
    this.waitingForPlayer = false;
    this.jump = null;
    this.elapsed = 0;
    this.grains = [];
    this.finished = false;
  }

  create(): void {
    this.stadium = new Stadium(this);
    this.worldGfx = this.add.graphics().setDepth(-5);
    this.athleteGfx = this.add.graphics().setDepth(25);
    for (const m of MARKS) {
      this.markTexts.push(
        this.add.text(0, 0, String(m), { fontFamily: FONT, fontSize: '8px', color: '#10101c' }).setOrigin(0.5).setDepth(-4),
      );
    }
    this.hud = new LongJumpHud(this);
    this.board = new JumpBoard(this, 'WEITSPRUNG', 4, ROUNDS);
    this.setupEntrants();

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    kb.on('keydown', this.onKeyDown, this);
    kb.on('keyup', this.onKeyUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', this.onKeyDown, this);
      kb.off('keyup', this.onKeyUp, this);
    });
    sfx.crowd(0.3);
    this.cameras.main.fadeIn(300, 16, 16, 28);
    this.nextTurn();
  }

  private setupEntrants(): void {
    const others = Phaser.Utils.Array.Shuffle(COUNTRIES.filter((_, i) => i !== this.countryIndex));
    const profiles = Phaser.Utils.Array.Shuffle([...LJ_CPU_PROFILES]);
    const country = COUNTRIES[this.countryIndex];
    // Im Wettkampf tritt immer dasselbe Feld an
    const field = getCompetition()?.field;
    const seed = field?.find((f) => f.isPlayer)?.lookSeed ?? loadLookSeed();
    this.player = { country, look: createLook(country, seed, 1), jumper: createJumper(0, true), profile: null };
    const opponents = field
      ? field
          .filter((f) => !f.isPlayer)
          .map((f) => ({ country: countryByCode(f.code), seed: f.lookSeed, profile: LJ_CPU_PROFILES[f.profile ?? 0] }))
      : profiles.map((profile, i) => ({ country: others[i], seed: Math.floor(Math.random() * 1e9), profile }));
    const cpus: Entrant[] = opponents.map(({ country: c, seed: s, profile }, i) => ({
      country: c,
      look: createLook(c, s, i + 2),
      jumper: createJumper(i + 1, false),
      profile,
    }));
    this.entrants = Phaser.Utils.Array.Shuffle([this.player, ...cpus]);
    // Kampfrichter in Blazer und weißer Hose, ohne Startnummer
    this.official = {
      ...createLook(country, 4242, 0),
      jersey: 0x24346b,
      shorts: 0xf0f0f0,
      accent: 0xf7d038,
      headband: false,
      shoe: 0x2a2a30,
    };
  }

  private entrantOf(j: Jumper): Entrant {
    return this.entrants.find((e) => e.jumper === j)!;
  }

  private jumpers(): Jumper[] {
    return this.entrants.map((e) => e.jumper);
  }

  // ------------------------------------------------------- Wettkampfablauf

  private nextTurn(): void {
    this.turn = nextJump(this.jumpers());
    this.waitingForPlayer = false;
    if (!this.turn) {
      this.finish();
      return;
    }
    const { jumper, round } = this.turn;
    if (jumper.isPlayer) {
      this.waitingForPlayer = true;
      const exit = getCompetition() ? 'ESC: ABBRECHEN' : 'ESC: MENÜ';
      this.showBoard(`DU BIST DRAN – ${round + 1}. VERSUCH`, `ENTER: SPRINGEN   ${exit}`);
      return;
    }
    const e = this.entrantOf(jumper);
    this.showBoard(`${e.country.name} – ${round + 1}. VERSUCH`, '');
    this.time.delayedCall(900, () => {
      const d = cpuJump(e.profile!, Math.random);
      jumper.attempts[round] = d;
      sfx.board(d !== null);
      this.showBoard(`${e.country.name} – ${d !== null ? `${d.toFixed(2)} M` : 'ÜBERTRETEN'}`, '');
      this.time.delayedCall(650, () => this.nextTurn());
    });
  }

  private showBoard(footer: string, footer2: string): void {
    this.mode = 'board';
    this.hud.setVisible(false);
    const round = this.turn?.round ?? ROUNDS - 1;
    const rows: JumpBoardRow[] = this.entrants.map((e) => {
      const best = bestJump(e.jumper);
      return {
        flag: e.country.flag,
        label: `${e.country.code} ${e.country.name}${e.jumper.isPlayer ? ' (DU)' : ''}`,
        isPlayer: e.jumper.isPlayer,
        current: this.turn?.jumper === e.jumper,
        attempts: e.jumper.attempts.map(formatAttempt),
        best: best !== null ? best.toFixed(2) : '-',
      };
    });
    this.board.show(`${round + 1}. DURCHGANG`, rows, footer, footer2);
  }

  private startAttempt(): void {
    this.mode = 'attempt';
    this.board.setVisible(false);
    this.hud.setVisible(true);
    this.jump = createJump();
    this.simAccum = 0;
    this.verdictAt = null;
    const best = bestJump(this.player.jumper);
    this.hud.setAttempt(this.turn!.round + 1, best !== null ? `BEST ${best.toFixed(2)}` : '');
    this.hud.setMessage(
      `${this.turn!.round + 1}. VERSUCH`,
      'PFEIL LINKS/RECHTS: ANLAUFEN\nAM BRETT LEERTASTE HALTEN = WINKEL, LOSLASSEN = SPRUNG\nKURZ VOR DER LANDUNG LEERTASTE: BEINE NACH VORNE',
    );
    sfx.crowd(0.45);
  }

  private endAttempt(): void {
    const s = this.jump;
    if (!s || this.mode !== 'attempt') return;
    this.player.jumper.attempts[this.turn!.round] = s.distance;
    this.jump = null;
    sfx.crowd(0.3);
    this.nextTurn();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const rows: ResultRow[] = rankJumpers(this.jumpers()).map((j) => {
      const e = this.entrantOf(j);
      const best = bestJump(j);
      return {
        country: e.country,
        look: e.look,
        isPlayer: j.isPlayer,
        valid: best !== null,
        cells: [{ text: best !== null ? `${best.toFixed(2)} M` : 'O.G.V.' }, { text: j.attempts.map(formatAttempt).join(' ') }],
      };
    });
    const data: ResultSceneData = {
      event: 'long',
      headers: ['WEITE', 'SERIE'],
      rows,
      playerScore: bestJump(this.player.jumper),
      worldRecord: WORLD_RECORD,
      notes: [],
      replay: { scene: 'longjump', data: { countryIndex: this.countryIndex } },
    };
    this.cameras.main.fadeOut(300, 16, 16, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('result', data));
  }

  // ---------------------------------------------------------------- Eingabe

  private onKeyDown(ev: KeyboardEvent): void {
    sfx.unlock();
    if (ev.repeat || confirmPending()) return;
    if (ev.code === 'Escape') {
      if (getCompetition()) {
        if (!this.finished) confirmAbort(this, () => this.releaseHeld());
      }
      else this.scene.start('title');
      return;
    }
    if (ev.code === 'KeyM') {
      sfx.toggleMute();
      return;
    }
    const confirm = ev.code === 'Enter' || ev.code === 'NumpadEnter';
    if (this.mode === 'board') {
      if (this.waitingForPlayer && (confirm || ev.code === 'Space')) {
        sfx.confirm();
        this.startAttempt();
      }
      return;
    }
    const s = this.jump;
    if (!s) return;
    if (this.verdictAt !== null && (confirm || ev.code === 'Space')) {
      this.endAttempt();
      return;
    }
    const side: Side | null =
      ev.code === 'ArrowLeft' || ev.code === 'KeyA' ? 'L' : ev.code === 'ArrowRight' || ev.code === 'KeyD' ? 'R' : null;
    if (side) {
      const wasReady = s.phase === 'ready';
      const valid = ljTap(s, side);
      this.hud.registerTap(side, valid, this.elapsed);
      if (wasReady && valid) this.hud.setMessage('', '');
    } else if (ev.code === 'Space') {
      // Der Tastendruck zählt in dem Moment, in dem er passiert ist
      const lateBy = ev.timeStamp > 0 ? (performance.now() - ev.timeStamp) / 1000 : 0;
      const e = ljPress(s, lateBy);
      if (e?.type === 'takeoff') sfx.boardHit();
    }
  }

  /** Nach der Rückfrage gilt eine gehaltene Leertaste als losgelassen */
  private releaseHeld(): void {
    if (!this.jump) return;
    const e = ljRelease(this.jump);
    if (e) this.handleEvent(this.jump, e);
  }

  private onKeyUp(ev: KeyboardEvent): void {
    if (ev.code === 'Space') this.releaseHeld();
  }

  // ------------------------------------------------------------------ Ablauf

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;
    const s = this.jump;
    if (this.mode === 'attempt' && s) {
      this.simAccum += dt;
      while (this.simAccum >= SIM_DT) {
        this.simAccum -= SIM_DT;
        for (const e of stepJump(s, SIM_DT)) this.handleEvent(s, e);
      }
      this.hud.update(this.elapsed, s);
    } else {
      this.board.update(this.elapsed);
    }

    const follow = (s?.x ?? -LJ.runup) * PX_PER_M + skewAt(GROUND_Y) - CAMERA_LEAD_X;
    const fixed = skewAt(GROUND_Y) - BOARD_SCREEN_X;
    this.camPx = Math.round(this.mode === 'attempt' && s ? Math.min(follow, fixed) : fixed);
    const excitement = s?.phase === 'flight' ? 0.9 : this.verdictAt !== null && s?.distance ? 0.8 : 0.2;
    this.stadium.update(this.camPx, dt, this.elapsed, excitement);
    this.drawWorld();
    this.drawAthletes(dt);
  }

  private handleEvent(s: LjState, e: LjEvent): void {
    switch (e.type) {
      case 'footstep':
        sfx.footstep();
        break;
      case 'launch':
        sfx.takeoff();
        break;
      case 'land':
        sfx.sandLand();
        for (let i = 0; i < 18; i++) {
          this.grains.push({
            x: s.x + 0.3,
            h: 0.1,
            vx: 1 + Math.random() * 3,
            vh: 1 + Math.random() * 2.5,
            life: 0.5 + Math.random() * 0.4,
          });
        }
        this.time.delayedCall(700, () => this.showVerdict(s));
        break;
      case 'runthrough':
        sfx.missed();
        this.time.delayedCall(700, () => this.showVerdict(s));
        break;
      default:
        break;
    }
  }

  private showVerdict(s: LjState): void {
    if (this.jump !== s) return;
    this.verdictAt = this.elapsed;
    sfx.flag(s.distance !== null);
    if (s.distance !== null) {
      sfx.crowd(0.9);
      sfx.finish();
    } else {
      sfx.missed();
    }
    const next = '\n\nENTER: WEITER';
    if (s.phase === 'runthrough') {
      this.hud.setMessage('UNGÜLTIG', `NICHT ABGESPRUNGEN${next}`, '#e8442e');
    } else if (s.foul) {
      const over = Math.max(1, Math.round((s.takeoffX ?? 0) * 100));
      this.hud.setMessage('ÜBERTRETEN!', `${over} CM ÜBER DEM BRETT${next}`, '#e8442e');
    } else {
      const lost = Math.round(-(s.takeoffX ?? 0) * 100);
      const boardText = lost <= 5 ? 'PERFEKT AM BRETT' : `BRETT: ${lost} CM VERSCHENKT`;
      const landText =
        s.landing === 'extended' ? 'BEINE PERFEKT VORGESTRECKT' : s.landing === 'early' ? 'BEINE ZU FRÜH VORGESTRECKT' : 'NACH HINTEN GEFALLEN';
      this.hud.setMessage(
        `${s.distance!.toFixed(2)} M`,
        `WINKEL ${Math.round(s.angle)}°   ${boardText}\n${landText}${next}`,
        s.distance! > WORLD_RECORD ? '#f7c843' : '#4cd964',
      );
    }
    this.time.delayedCall(5000, () => {
      if (this.jump === s) this.endAttempt();
    });
  }

  // --------------------------------------------------------------- Zeichnen

  private pt(m: number, h: number, y: number): Phaser.Types.Math.Vector2Like {
    return { x: Math.round(m * PX_PER_M - this.camPx + skewAt(y)), y: Math.round(y - h * PX_PER_M) };
  }

  /** Linie quer über die Grube bei x Metern */
  private across(g: Phaser.GameObjects.Graphics, m: number, color: number, width = 1, alpha = 1): void {
    const a = this.pt(m, 0, PIT.farY + 2);
    const b = this.pt(m, 0, PIT.nearY - 2);
    g.lineStyle(width, color, alpha);
    g.lineBetween(a.x!, a.y!, b.x!, b.y!);
  }

  private drawWorld(): void {
    const g = this.worldGfx;
    g.clear();
    const lane = (m0: number, m1: number, color: number, alpha = 1, top = LANE_TOP, bottom = LANE_BOTTOM) => {
      g.fillStyle(color, alpha);
      g.fillPoints([this.pt(m0, 0, bottom), this.pt(m1, 0, bottom), this.pt(m1, 0, top), this.pt(m0, 0, top)], true);
    };

    // Markierungen auf der Anlaufbahn
    for (let m = -LJ.runup; m < -2; m += 5) lane(m, m + 0.05, 0xffffff, 0.35);

    // Sandgrube mit Betonrand und Rechenspuren
    g.fillStyle(0xd0d0d0, 1);
    g.fillPoints(
      [this.pt(PIT.x0 - 0.15, 0, PIT.nearY + 2), this.pt(PIT.x1 + 0.15, 0, PIT.nearY + 2), this.pt(PIT.x1 + 0.15, 0, PIT.farY - 2), this.pt(PIT.x0 - 0.15, 0, PIT.farY - 2)],
      true,
    );
    g.fillStyle(0xe6c27f, 1);
    g.fillPoints([this.pt(PIT.x0, 0, PIT.nearY), this.pt(PIT.x1, 0, PIT.nearY), this.pt(PIT.x1, 0, PIT.farY), this.pt(PIT.x0, 0, PIT.farY)], true);
    g.lineStyle(1, 0xd4ad68, 1);
    for (let y = PIT.farY + 6; y < PIT.nearY; y += 6) {
      const a = this.pt(PIT.x0 + 0.1, 0, y);
      const b = this.pt(PIT.x1 - 0.1, 0, y);
      g.lineBetween(a.x!, a.y!, b.x!, b.y!);
    }

    // Absprungbrett mit Plastilinstreifen dahinter
    lane(-0.2, 0, 0xffffff);
    lane(0, 0.1, 0x8aa070);
    const s = this.jump;
    if (s?.foul && s.takeoffX !== null && s.takeoffX > 0) {
      const p = this.pt(Math.min(0.08, s.takeoffX), 0, GROUND_Y);
      g.fillStyle(0x4a5a3a, 1);
      g.fillRect(p.x! - 2, p.y! - 2, 4, 3);
    }

    // Meter-Schilder am vorderen Rand
    MARKS.forEach((m, i) => {
      const p = this.pt(m, 0, PIT.nearY + 8);
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(p.x! - 6, p.y! - 5, 12, 10);
      g.fillStyle(0xffffff, 1);
      g.fillRect(p.x! - 5, p.y! - 4, 10, 8);
      this.markTexts[i].setPosition(p.x! + 0.5, p.y!).setVisible(p.x! > -10 && p.x! < GAME_WIDTH + 10);
    });

    // Weltrekord- und Führungslinie
    this.across(g, WORLD_RECORD, COLORS.yellow, 1, 0.9);
    const wr = this.pt(WORLD_RECORD, 0, PIT.farY - 2);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(wr.x!, wr.y! - 12, 1, 12);
    g.fillRect(wr.x! + 1, wr.y! - 12, 7, 5);
    const leader = rankJumpers(this.jumpers())[0];
    const leaderBest = leader ? bestJump(leader) : null;
    if (leaderBest !== null) {
      this.across(g, leaderBest, 0x4cd964, 2, 0.9);
      const p = this.pt(leaderBest, 0, PIT.farY - 2);
      g.fillStyle(0xffffff, 1);
      g.fillRect(p.x!, p.y! - 14, 1, 14);
      drawFlag(g, this.entrantOf(leader).country.flag, p.x! + 1, p.y! - 14, 10, 7);
    }

    // Abdruck im Sand und Maßband
    if (s && s.phase === 'landed') {
      const feet = s.landing === 'extended' ? LJ.feetExtended : s.landing === 'early' ? LJ.feetEarly : LJ.sitBack;
      const mark = this.pt(s.x + feet, 0, GROUND_Y);
      g.fillStyle(0xb88d4f, 1);
      g.fillEllipse(mark.x!, mark.y!, 8, 4);
      if (s.distance !== null && this.verdictAt !== null) {
        const t = Math.min(1, (this.elapsed - this.verdictAt) / 0.5);
        const from = this.pt(0, 0, PIT.nearY - 3);
        const to = this.pt(s.distance * t, 0, PIT.nearY - 3);
        g.lineStyle(2, COLORS.yellow, 1);
        g.lineBetween(from.x!, from.y!, to.x!, to.y!);
      }
    }
  }

  private drawAthletes(dt: number): void {
    const g = this.athleteGfx;
    g.clear();
    const t = this.elapsed;

    // Kampfrichter am Brett – hebt nach dem Sprung die Fahne
    const s = this.jump;
    const judge = this.pt(-1.2, 0, PIT.nearY + 16);
    const raised = this.verdictAt !== null;
    const jp = flagPose(raised);
    drawShadow(g, judge.x!, judge.y!, 0);
    drawRunner(g, judge.x!, judge.y!, jp, this.official, { time: t });
    if (raised && s) {
      const off = handOffset(jp);
      const hand = { x: judge.x! + off.x, y: judge.y! - jp.hip + off.y };
      g.lineStyle(1, 0x8a6035, 1);
      g.lineBetween(hand.x, hand.y + 6, hand.x, hand.y - 6);
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(hand.x - 9, hand.y - 7, 10, 8);
      g.fillStyle(s.distance !== null ? 0xffffff : COLORS.red, 1);
      g.fillRect(hand.x - 8, hand.y - 6, 8, 6);
    }

    // Sandkörner
    for (const p of this.grains) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.h = Math.max(0, p.h + p.vh * dt);
      p.vh -= 9.81 * dt;
    }
    this.grains = this.grains.filter((p) => p.life > 0);
    for (const p of this.grains) {
      const q = this.pt(p.x, p.h, GROUND_Y);
      g.fillStyle(0xd9b070, Math.min(1, p.life * 3));
      g.fillRect(q.x!, q.y!, 2, 2);
    }

    const look = this.player.look;
    if (!s) {
      const x = this.pt(-LJ.runup, 0, GROUND_Y).x!;
      if (x > -40 && x < GAME_WIDTH + 40) drawRunner(g, x, GROUND_Y, idlePose(t, look.seed), look, { time: t });
      return;
    }
    const hx = this.pt(s.x, 0, GROUND_Y).x!;
    let pose: Pose;
    let hipM: number = LJ.hipHeight;
    let mood: Mood = 'neutral';
    switch (s.phase) {
      case 'ready':
        pose = idlePose(t, look.seed);
        hipM = pose.hip / PX_PER_M;
        break;
      case 'runup':
      case 'runthrough':
        pose = s.v > 0.8 ? runPose(s.stride, Math.min(1, s.v / 9)) : standPose();
        hipM = pose.hip / PX_PER_M;
        mood = s.phase === 'runthrough' ? 'ouch' : s.v > 6 ? 'effort' : 'neutral';
        break;
      case 'takeoff': {
        const u = (s.angle - LJ.angleStart) / (LJ.angleMax - LJ.angleStart);
        pose = ljTakeoffPose(u);
        hipM = pose.hip / PX_PER_M + u * 0.15;
        mood = 'effort';
        break;
      }
      case 'flight': {
        const u = s.flightTime / flightDuration(s);
        pose = ljFlightPose(u);
        if (s.extendAt !== null) pose = lerpPose(pose, ljLandPose(), Math.min(1, (s.flightTime - s.extendAt) / 0.15));
        hipM = s.y;
        mood = 'effort';
        break;
      }
      default: {
        const back = s.landing === 'sitback';
        pose = sitPose(back);
        hipM = pose.hip / PX_PER_M;
        mood = s.distance === null ? 'tired' : back ? 'ouch' : 'joy';
        break;
      }
    }
    const hipY = GROUND_Y - hipM * PX_PER_M;
    drawShadow(g, hx, GROUND_Y, Math.max(0, (hipM - LJ.hipHeight) * PX_PER_M));
    drawRunner(g, hx, hipY + pose.hip, pose, look, { mood, time: t, speed: s.phase === 'flight' ? s.vx : s.v });
  }
}
