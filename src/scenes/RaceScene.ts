import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import {
  CAMERA_LEAD_X,
  COLORS,
  FONT,
  GAME_WIDTH,
  HAIR_COLORS,
  LANE_COUNT,
  LANE_DEPTH,
  PX_PER_M,
  SKIN_TONES,
  TRACK_FAR_Y,
  TRACK_NEAR_Y,
  laneCenterY,
  skewAt,
} from '../config';
import { COUNTRIES, type Country } from '../data/countries';
import { Hud } from '../gfx/hud';
import {
  cheerPose,
  crouchPose,
  drawRunner,
  drawShadow,
  jumpPose,
  runPose,
  standPose,
  stumblePose,
  type Pose,
  type RunnerLook,
} from '../gfx/runner';
import { Stadium } from '../gfx/stadium';
import { CPU_PROFILES, CpuController } from '../sim/cpu';
import {
  HURDLE_POSITIONS,
  PHYSICS,
  TRACK,
  createRunner,
  hurdlesHit,
  isAirborne,
  isFinished,
  jump,
  jumpHeight,
  step,
  tap,
  type RunnerEvent,
  type RunnerState,
  type Side,
} from '../sim/hurdles';
import type { RaceResult } from './ResultScene';

const SIM_DT = 1 / 120;
const PLAYER_LANE = 2;
/** Wie lange nach dem eigenen Zieleinlauf noch weitergelaufen wird */
const AFTER_FINISH = 4;
/** Hüfte steht in der Hocke hinter der Startlinie */
const CROUCH_OFFSET_PX = 12;

type Phase = 'ready' | 'marks' | 'set' | 'falseStart' | 'race';

interface Competitor {
  country: Country;
  look: RunnerLook;
  lane: number;
  state: RunnerState;
  cpu: CpuController | null;
  isPlayer: boolean;
  place: number | null;
  /** Rennzeit, zu der die jeweilige Hürde umgerissen wurde */
  fallenAt: (number | null)[];
  dust: { x: number; y: number; vx: number; vy: number; life: number }[];
  runnerGfx: Phaser.GameObjects.Graphics;
  hurdleGfx: Phaser.GameObjects.Graphics;
}

export interface RaceSceneData {
  countryIndex: number;
}

export class RaceScene extends Phaser.Scene {
  private stadium!: Stadium;
  private hud!: Hud;
  private trackGfx!: Phaser.GameObjects.Graphics;
  private frontGfx!: Phaser.GameObjects.Graphics;
  private laneLabels: Phaser.GameObjects.Text[] = [];
  private finishLabel!: Phaser.GameObjects.Text;
  private competitors: Competitor[] = [];
  private player!: Competitor;
  private countryIndex = 0;

  private phase: Phase = 'ready';
  /** performance.now() beim Startschuss */
  private gunAt = 0;
  private simTime = 0;
  private phaseTimer = 0;
  private setDelay = 0;
  private crouch = 0;
  private finishOrder = 0;
  private playerFinishedAt: number | null = null;
  private camPx = 0;
  private elapsed = 0;
  private falseStarts = 0;
  private resultsShown = false;

  constructor() {
    super('race');
  }

  init(data: RaceSceneData): void {
    this.countryIndex = data.countryIndex ?? 0;
    this.phase = 'ready';
    this.simTime = 0;
    this.phaseTimer = 0;
    this.crouch = 0;
    this.finishOrder = 0;
    this.playerFinishedAt = null;
    this.elapsed = 0;
    this.falseStarts = 0;
    this.resultsShown = false;
    this.competitors = [];
    this.laneLabels = [];
  }

  create(): void {
    this.stadium = new Stadium(this);
    this.trackGfx = this.add.graphics().setDepth(-5);
    this.frontGfx = this.add.graphics().setDepth(100);
    this.finishLabel = this.add
      .text(0, 0, 'ZIEL', { fontFamily: FONT, fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(-4);

    this.setupCompetitors();
    this.hud = new Hud(this, '110 M HÜRDEN');
    this.showReadyMessage();

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    kb.on('keydown', this.onKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', this.onKeyDown, this));

    sfx.crowd(0.3);
  }

  private setupCompetitors(): void {
    const others = COUNTRIES.filter((_, i) => i !== this.countryIndex);
    Phaser.Utils.Array.Shuffle(others);
    const profiles = Phaser.Utils.Array.Shuffle([...CPU_PROFILES]);
    let cpuIndex = 0;

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const isPlayer = lane === PLAYER_LANE;
      const country = isPlayer ? COUNTRIES[this.countryIndex] : others[cpuIndex];
      const state = createRunner();
      const look: RunnerLook = {
        jersey: country.jersey,
        shorts: country.shorts,
        skin: Phaser.Utils.Array.GetRandom([...SKIN_TONES]),
        hair: Phaser.Utils.Array.GetRandom([...HAIR_COLORS]),
      };
      const cpu = isPlayer
        ? null
        : new CpuController(state, profiles[cpuIndex++ % profiles.length], Math.random);
      const c: Competitor = {
        country,
        look,
        lane,
        state,
        cpu,
        isPlayer,
        place: null,
        fallenAt: Array<number | null>(TRACK.hurdleCount).fill(null),
        dust: [],
        hurdleGfx: this.add.graphics().setDepth(lane * 10 + 1),
        runnerGfx: this.add.graphics().setDepth(lane * 10 + 5),
      };
      this.competitors.push(c);
      if (isPlayer) this.player = c;

      this.laneLabels.push(
        this.add
          .text(0, 0, String(lane + 1), { fontFamily: FONT, fontSize: '8px', color: '#f4efe6' })
          .setOrigin(0.5)
          .setDepth(-4),
      );
    }
  }

  // ---------------------------------------------------------------- Eingabe

  private onKeyDown(ev: KeyboardEvent): void {
    sfx.unlock();
    if (ev.repeat) return;

    if (ev.code === 'Escape') {
      this.scene.start('title');
      return;
    }
    if (ev.code === 'KeyM') {
      sfx.toggleMute();
      return;
    }

    const side: Side | null =
      ev.code === 'ArrowLeft' || ev.code === 'KeyA' ? 'L' : ev.code === 'ArrowRight' || ev.code === 'KeyD' ? 'R' : null;
    const isJump = ev.code === 'Space';
    const isConfirm = ev.code === 'Enter' || ev.code === 'NumpadEnter';

    switch (this.phase) {
      case 'ready':
        if (isConfirm || isJump) this.startCalls();
        break;
      case 'marks':
      case 'set':
        if (side || isJump) this.falseStart();
        break;
      case 'race': {
        if (this.playerFinishedAt !== null && isConfirm) {
          this.showResults();
          return;
        }
        if (ev.code === 'KeyR') {
          this.scene.restart({ countryIndex: this.countryIndex });
          return;
        }
        const t = this.raceTimeAt(ev.timeStamp);
        if (side) {
          const valid = tap(this.player.state, side, t);
          this.hud.registerTap(side, valid, this.elapsed);
        } else if (isJump && jump(this.player.state)) {
          sfx.jump();
        }
        break;
      }
      case 'falseStart':
        break;
    }
  }

  private raceTimeAt(timeStamp: number): number {
    // Eingaben werden erst im nächsten Frame verarbeitet – der Zeitstempel
    // des Tastendrucks sorgt trotzdem für eine exakte Reaktionszeit.
    const stamp = timeStamp > 0 ? timeStamp : performance.now();
    return Math.max(0, (stamp - this.gunAt) / 1000);
  }

  // ---------------------------------------------------------- Startablauf

  private showReadyMessage(): void {
    const warn = this.falseStarts > 0 ? `FEHLSTARTS: ${this.falseStarts}\n\n` : '';
    this.hud.setMessage(
      '110 M HÜRDEN',
      `${warn}PFEIL LINKS/RECHTS ABWECHSELND = LAUFEN\nLEERTASTE = SPRINGEN\n\nENTER: BEREIT`,
    );
  }

  private startCalls(): void {
    this.phase = 'marks';
    this.phaseTimer = 0;
    this.hud.setMessage('AUF DIE PLÄTZE', '');
    sfx.call(false);
  }

  private falseStart(): void {
    this.phase = 'falseStart';
    this.phaseTimer = 0;
    this.falseStarts++;
    this.hud.setMessage('FEHLSTART!', 'NICHT VOR DEM SCHUSS LOSLAUFEN', '#e8442e');
    sfx.falseStart();
  }

  private updateStartPhases(dt: number): void {
    this.phaseTimer += dt;
    switch (this.phase) {
      case 'marks':
        this.crouch = Math.min(1, this.crouch + dt * 3);
        if (this.phaseTimer > 1.6) {
          this.phase = 'set';
          this.phaseTimer = 0;
          this.setDelay = Phaser.Math.FloatBetween(1.0, 2.2);
          this.hud.setMessage('FERTIG', '');
          sfx.call(true);
        }
        break;
      case 'set':
        this.crouch = Math.min(2, this.crouch + dt * 3);
        if (this.phaseTimer > this.setDelay) this.fireGun();
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

  private fireGun(): void {
    this.phase = 'race';
    this.gunAt = performance.now();
    this.simTime = 0;
    this.hud.setMessage('LOS!', '');
    this.time.delayedCall(700, () => {
      if (this.playerFinishedAt === null) this.hud.setMessage('', '');
    });
    sfx.gun();
    sfx.crowd(0.6);
  }

  // ------------------------------------------------------------ Rennen

  private updateRace(): void {
    const target = (performance.now() - this.gunAt) / 1000;
    // Fixer Zeitschritt: gleiches Ergebnis unabhängig von der Bildrate.
    while (this.simTime + SIM_DT <= target) {
      this.simTime += SIM_DT;
      for (const c of this.competitors) {
        c.cpu?.update(this.simTime);
        const events = step(c.state, SIM_DT, this.simTime);
        for (const e of events) this.handleEvent(c, e);
      }
    }

    if (this.playerFinishedAt !== null && !this.resultsShown) {
      const allDone = this.competitors.every((c) => isFinished(c.state));
      if (this.simTime - this.playerFinishedAt > AFTER_FINISH || (allDone && this.simTime - this.playerFinishedAt > 2)) {
        this.showResults();
      }
    }
  }

  private handleEvent(c: Competitor, e: RunnerEvent): void {
    switch (e.type) {
      case 'footstep':
        if (c.isPlayer) sfx.footstep();
        if (c.state.v > 4) {
          for (let i = 0; i < 2; i++) {
            c.dust.push({
              x: c.state.x * PX_PER_M - 2,
              y: 0,
              vx: -20 - Math.random() * 30,
              vy: -10 - Math.random() * 15,
              life: 0.35,
            });
          }
        }
        break;
      case 'hit':
        c.fallenAt[e.hurdle] = this.simTime;
        if (c.isPlayer) {
          sfx.hurdleHit();
          this.cameras.main.shake(120, 0.004);
        }
        break;
      case 'finish':
        c.place = ++this.finishOrder;
        if (c.isPlayer) {
          this.playerFinishedAt = this.simTime;
          sfx.finish();
          sfx.crowd(1);
          const placeText = `${c.place}. PLATZ`;
          const color = c.place === 1 ? '#f7c843' : '#ffffff';
          this.hud.setMessage(e.time.toFixed(2), `${placeText}\n\nENTER: ERGEBNIS`, color);
        }
        break;
      default:
        break;
    }
  }

  private showResults(): void {
    if (this.resultsShown) return;
    this.resultsShown = true;
    const results: RaceResult[] = this.competitors.map((c) => ({
      country: c.country,
      look: c.look,
      time: c.state.finishTime,
      x: c.state.x,
      hits: hurdlesHit(c.state),
      reaction: c.state.firstTapTime,
      isPlayer: c.isPlayer,
    }));
    this.cameras.main.fadeOut(300, 16, 16, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('result', { results, countryIndex: this.countryIndex, falseStarts: this.falseStarts });
    });
  }

  // ---------------------------------------------------------- Darstellung

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;

    if (this.phase === 'race') this.updateRace();
    else this.updateStartPhases(dt);

    const raceTime = this.phase === 'race' ? this.simTime : 0;
    const p = this.player.state;
    const targetCam = p.x * PX_PER_M + skewAt(laneCenterY(PLAYER_LANE)) - CAMERA_LEAD_X;
    this.camPx = Math.round(targetCam);

    const remaining = TRACK.distance - p.x;
    const excitement =
      this.phase !== 'race' ? 0.1 : this.playerFinishedAt !== null ? 1 : Phaser.Math.Clamp(1 - remaining / 60, 0.3, 0.9);
    this.stadium.update(this.camPx, dt, this.elapsed, excitement);

    this.drawTrackMarkings();
    for (const c of this.competitors) {
      this.drawHurdles(c, raceTime);
      this.drawCompetitor(c, raceTime, dt);
    }
    this.drawFinishFront();

    this.hud.update(
      this.elapsed,
      raceTime,
      this.competitors.map((c) => ({ state: c.state, color: c.country.jersey, isPlayer: c.isPlayer })),
    );
  }

  private screenX(meters: number, y: number): number {
    return Math.round(meters * PX_PER_M - this.camPx + skewAt(y));
  }

  /** Startlinie, Ziellinie, Bahnnummern und Ziel-Tor (hinterer Teil). */
  private drawTrackMarkings(): void {
    const g = this.trackGfx;
    g.clear();

    // Linie quer über alle Bahnen als Parallelogramm
    const crossLine = (meters: number, width: number, color: number) => {
      const nx = this.screenX(meters, TRACK_NEAR_Y);
      const fx = this.screenX(meters, TRACK_FAR_Y);
      g.fillStyle(color, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(nx, TRACK_NEAR_Y),
          new Phaser.Math.Vector2(nx + width, TRACK_NEAR_Y),
          new Phaser.Math.Vector2(fx + width, TRACK_FAR_Y),
          new Phaser.Math.Vector2(fx, TRACK_FAR_Y),
        ],
        true,
      );
    };

    crossLine(0, 3, COLORS.laneLine);
    crossLine(TRACK.distance, 4, COLORS.laneLine);
    // Schachbrett an der Ziellinie
    for (let y = TRACK_FAR_Y; y < TRACK_NEAR_Y; y += 2) {
      const x = this.screenX(TRACK.distance, y);
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(x + ((y / 2) % 2 === 0 ? 0 : 2), y, 2, 2);
    }

    // Startblöcke und Bahnnummern
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const y = laneCenterY(lane);
      const bx = this.screenX(-0.5, y);
      g.fillStyle(0x3a3f55, 1);
      g.fillRect(bx - 6, y + 2, 7, 3);
      g.fillStyle(0x8e93a8, 1);
      g.fillRect(bx - 3, y - 1, 2, 4);
      g.fillRect(bx - 7, y, 2, 3);
      this.laneLabels[lane].setPosition(this.screenX(-3, y + 6), y + 6);
    }

    // Ziel-Schild hinter der Bahn, dem Publikum zugewandt
    const fx = this.screenX(TRACK.distance, TRACK_FAR_Y - 4);
    if (fx > -40 && fx < GAME_WIDTH + 40) {
      const top = TRACK_FAR_Y - 64;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(fx - 20, top + 14, 4, 50);
      g.fillRect(fx + 18, top + 14, 4, 50);
      g.fillStyle(0xd0d0d0, 1);
      g.fillRect(fx - 19, top + 14, 2, 50);
      g.fillRect(fx + 19, top + 14, 2, 50);
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(fx - 27, top - 1, 56, 18);
      g.fillStyle(COLORS.red, 1);
      g.fillRect(fx - 26, top, 54, 16);
      for (let i = 0; i < 27; i++) {
        g.fillStyle(i % 2 ? 0xffffff : COLORS.outline, 1);
        g.fillRect(fx - 26 + i * 2, top + 13, 2, 3);
      }
      this.finishLabel.setPosition(fx + 1, top + 7).setVisible(true);
    } else {
      this.finishLabel.setVisible(false);
    }
  }

  private drawFinishFront(): void {
    const g = this.frontGfx;
    g.clear();
    // Zielpfosten mit Lichtschranke vorne am Bahnrand
    const nearY = TRACK_NEAR_Y + 6;
    const nx = this.screenX(TRACK.distance, nearY) + 1;
    if (nx < -10 || nx > GAME_WIDTH + 10) return;
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(nx - 1, nearY - 30, 4, 32);
    g.fillRect(nx - 3, nearY - 34, 8, 6);
    g.fillStyle(0xe8e8e8, 1);
    g.fillRect(nx, nearY - 30, 2, 30);
    g.fillStyle(COLORS.red, 1);
    g.fillRect(nx - 2, nearY - 33, 6, 4);
  }

  private drawHurdles(c: Competitor, raceTime: number): void {
    const g = c.hurdleGfx;
    g.clear();
    const farY = TRACK_FAR_Y + c.lane * LANE_DEPTH + 5;
    const nearY = farY + LANE_DEPTH - 9;
    const height = Math.round(TRACK.hurdleHeight * PX_PER_M);

    HURDLE_POSITIONS.forEach((pos, i) => {
      const fx = this.screenX(pos, farY);
      if (fx < -60 || fx > GAME_WIDTH + 40) return;
      const nx = this.screenX(pos, nearY);
      const fell = c.fallenAt[i];
      const angle = fell === null ? 0 : Math.min(1.45, ((raceTime - fell) / 0.25) * 1.45);
      const dx = Math.sin(angle) * height;
      const dy = -Math.cos(angle) * height;

      // Schatten
      g.fillStyle(0x000000, 0.22);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(fx + 1, farY + 1),
          new Phaser.Math.Vector2(nx + 1, nearY + 1),
          new Phaser.Math.Vector2(nx + 1 + height * 0.6, nearY + 1),
          new Phaser.Math.Vector2(fx + 1 + height * 0.6, farY + 1),
        ],
        true,
      );

      const post = (x: number, y: number) => {
        g.fillStyle(0x5d6278, 1);
        g.fillRect(x - 10, y - 1, 11, 2);
        g.lineStyle(4, COLORS.outline, 1);
        g.lineBetween(x, y, x + dx, y + dy);
        g.lineStyle(2, 0xe0e0e0, 1);
        g.lineBetween(x, y, x + dx, y + dy);
      };

      post(fx, farY);
      // Querbrett mit Streifen
      const thick = Math.max(1, Math.round(5 * Math.cos(angle)));
      const segs = 4;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs;
        const t1 = (s + 1) / segs;
        const ax = fx + dx + (nx - fx) * t0;
        const ay = farY + dy + (nearY - farY) * t0;
        const bx = fx + dx + (nx - fx) * t1;
        const by = farY + dy + (nearY - farY) * t1;
        const quad = [
          new Phaser.Math.Vector2(ax, ay - 1),
          new Phaser.Math.Vector2(bx, by - 1),
          new Phaser.Math.Vector2(bx, by - 1 + thick),
          new Phaser.Math.Vector2(ax, ay - 1 + thick),
        ];
        g.lineStyle(2, COLORS.outline, 1);
        g.strokePoints(quad, true);
        g.fillStyle(s % 2 === 0 ? 0xffffff : 0x1a1a1a, 1);
        g.fillPoints(quad, true);
      }
      post(nx, nearY);
    });
  }

  private poseFor(c: Competitor, raceTime: number): Pose {
    const s = c.state;
    if (this.phase !== 'race') {
      if (this.crouch <= 0) return standPose();
      if (this.crouch < 1) return lerpPose(standPose(), crouchPose(0), this.crouch);
      return crouchPose(this.crouch - 1);
    }
    if (isFinished(s) && s.v < 1.2) {
      return c.place === 1 || (c.isPlayer && (c.place ?? 9) <= 3) ? cheerPose(this.elapsed) : standPose();
    }
    if (isAirborne(s)) return jumpPose(s.air / PHYSICS.jumpDuration);
    let pose: Pose;
    if (s.stumble > 0) pose = stumblePose(s.stride, s.stumble / PHYSICS.stumbleDuration, this.elapsed);
    else pose = runPose(s.stride, Math.min(1, s.v / 9));
    if (isFinished(s)) pose = lerpPose(standPose(), pose, Math.min(1, s.v / 4));
    // Bis zum ersten Tipp im Startblock bleiben, dann in den Laufschritt übergehen
    if (s.firstTapTime === null) return crouchPose(1);
    const sinceStart = raceTime - s.firstTapTime;
    if (sinceStart < 0.3) pose = lerpPose(crouchPose(1), pose, Math.max(0, sinceStart / 0.3));
    return pose;
  }

  private drawCompetitor(c: Competitor, raceTime: number, dt: number): void {
    const g = c.runnerGfx;
    g.clear();
    const s = c.state;
    const y = laneCenterY(c.lane) + 4;
    const offset = s.firstTapTime === null ? CROUCH_OFFSET_PX : Math.max(0, 1 - (raceTime - s.firstTapTime) / 0.3) * CROUCH_OFFSET_PX;
    const x = this.screenX(s.x, y) - offset;
    if (x < -40 || x > GAME_WIDTH + 40) {
      c.dust.length = 0;
      return;
    }

    // Staubwölkchen
    for (const d of c.dust) {
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 60 * dt;
    }
    c.dust = c.dust.filter((d) => d.life > 0);
    for (const d of c.dust) {
      g.fillStyle(0xe9b48f, Math.min(1, d.life * 3));
      g.fillRect(Math.round(d.x - this.camPx + skewAt(y)), Math.round(y + Math.min(0, d.y)), 2, 2);
    }

    const lift = jumpHeight(s) * PX_PER_M;
    drawShadow(g, x, y, lift);
    drawRunner(g, x, y, this.poseFor(c, raceTime), c.look, lift);

    if (c.isPlayer) {
      // Markierung über dem eigenen Läufer
      const crouched = this.crouch > 0.5 && s.firstTapTime === null;
      const my = y - (crouched ? 30 : 48) - lift + Math.round(Math.sin(this.elapsed * 6));
      g.fillStyle(COLORS.outline, 1);
      g.fillTriangle(x - 5, my - 1, x + 5, my - 1, x, my + 5);
      g.fillStyle(COLORS.yellow, 1);
      g.fillTriangle(x - 3, my, x + 3, my, x, my + 3);
    }
  }
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const limb = (x: Pose['nearLeg'], y: Pose['nearLeg']) => ({ upper: l(x.upper, y.upper), lower: l(x.lower, y.lower) });
  return {
    hip: l(a.hip, b.hip),
    lean: l(a.lean, b.lean),
    nearLeg: limb(a.nearLeg, b.nearLeg),
    farLeg: limb(a.farLeg, b.farLeg),
    nearArm: limb(a.nearArm, b.nearArm),
    farArm: limb(a.farArm, b.farArm),
  };
}
