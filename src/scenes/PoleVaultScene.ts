import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { CAMERA_LEAD_X, COLORS, GAME_WIDTH, LANE_DEPTH, PX_PER_M, TRACK_FAR_Y, laneCenterY, skewAt } from '../config';
import { COUNTRIES, type Country } from '../data/countries';
import { loadLookSeed } from '../data/storage';
import {
  carryPole,
  createLook,
  drawRunner,
  drawShadow,
  flightPose,
  handOffset,
  idlePose,
  lyingPose,
  rotatePoint,
  runPose,
  standPose,
  vaultPose,
  vaultRotation,
  type Mood,
  type Pose,
  type RunnerLook,
} from '../gfx/runner';
import { Stadium } from '../gfx/stadium';
import { VaultBoard, type BoardRow } from '../gfx/vaultBoard';
import { VaultHud } from '../gfx/vaultHud';
import type { Side } from '../sim/hurdles';
import {
  Competition,
  HEIGHTS,
  VAULT,
  VAULT_CPU_PROFILES,
  bestHeightIndex,
  cpuAttempt,
  createVault,
  createVaulter,
  flightProgress,
  isCleared,
  plant,
  release,
  stepVault,
  totalFails,
  vaultTap,
  type VaultCpuProfile,
  type VaultEvent,
  type VaultState,
  type Vaulter,
} from '../sim/polevault';
import type { ResultRow, ResultSceneData } from './ResultScene';

const SIM_DT = 1 / 120;
const RUNWAY_LANE = 2;
const GROUND_Y = laneCenterY(RUNWAY_LANE) + 4;
/** Ständer stehen links und rechts neben der Anlaufbahn */
const POST_FAR_Y = TRACK_FAR_Y + RUNWAY_LANE * LANE_DEPTH - 10;
const POST_NEAR_Y = TRACK_FAR_Y + (RUNWAY_LANE + 1) * LANE_DEPTH + 10;
const MAT = { x0: 0.6, x1: 6.2, height: 0.8, farY: POST_FAR_Y - 8, nearY: POST_NEAR_Y + 8 };
/** Stablänge beim Anlauf in Metern */
const CARRY_LENGTH = 4.8;
/** Bildschirmposition des Einstichkastens, sobald die Kamera stehen bleibt */
const BOX_SCREEN_X = 290;

interface Entrant {
  country: Country;
  look: RunnerLook;
  vaulter: Vaulter;
  profile: VaultCpuProfile | null;
}

type Mode = 'board' | 'attempt';

export interface PoleVaultSceneData {
  countryIndex: number;
}

export class PoleVaultScene extends Phaser.Scene {
  private stadium!: Stadium;
  private hud!: VaultHud;
  private board!: VaultBoard;
  private worldGfx!: Phaser.GameObjects.Graphics;
  private poleGfx!: Phaser.GameObjects.Graphics;
  private athleteGfx!: Phaser.GameObjects.Graphics;
  private frontGfx!: Phaser.GameObjects.Graphics;

  private countryIndex = 0;
  private entrants: Entrant[] = [];
  private player!: Entrant;
  private competition!: Competition;
  private mode: Mode = 'board';
  private turn: { vaulter: Vaulter; attempt: number } | null = null;
  private waitingForPlayer = false;

  private vault: VaultState | null = null;
  private simTime = 0;
  private elapsed = 0;
  private camPx = 0;
  /** Zeitpunkte (elapsed) für Animationen */
  private releasedAt = 0;
  private landedAt: number | null = null;
  private barHitAt: number | null = null;
  private barCrossAt: number | null = null;
  private attemptDone = false;
  private finished = false;

  constructor() {
    super('polevault');
  }

  init(data: PoleVaultSceneData): void {
    this.countryIndex = data.countryIndex ?? 0;
    this.entrants = [];
    this.mode = 'board';
    this.turn = null;
    this.waitingForPlayer = false;
    this.vault = null;
    this.elapsed = 0;
    this.finished = false;
  }

  create(): void {
    this.stadium = new Stadium(this);
    this.worldGfx = this.add.graphics().setDepth(-5);
    this.poleGfx = this.add.graphics().setDepth(20);
    this.athleteGfx = this.add.graphics().setDepth(25);
    this.frontGfx = this.add.graphics().setDepth(40);
    this.hud = new VaultHud(this);
    this.board = new VaultBoard(this, 4);
    this.setupEntrants();

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    kb.on('keydown', this.onKeyDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => kb.off('keydown', this.onKeyDown, this));

    sfx.crowd(0.3);
    this.cameras.main.fadeIn(300, 16, 16, 28);
    this.nextTurn();
  }

  private setupEntrants(): void {
    const others = Phaser.Utils.Array.Shuffle(COUNTRIES.filter((_, i) => i !== this.countryIndex));
    const profiles = Phaser.Utils.Array.Shuffle([...VAULT_CPU_PROFILES]);
    const country = COUNTRIES[this.countryIndex];
    this.player = {
      country,
      look: createLook(country, loadLookSeed(), 1),
      vaulter: createVaulter(0, true),
      profile: null,
    };
    const cpus: Entrant[] = profiles.map((profile, i) => ({
      country: others[i],
      look: createLook(others[i], Math.floor(Math.random() * 1e9), i + 2),
      vaulter: createVaulter(i + 1, false, profile.opening),
      profile,
    }));
    // Zufällige Reihenfolge – wie bei der Auslosung im echten Wettkampf
    this.entrants = Phaser.Utils.Array.Shuffle([this.player, ...cpus]);
    this.competition = new Competition(this.entrants.map((e) => e.vaulter));
  }

  private entrantOf(v: Vaulter): Entrant {
    return this.entrants.find((e) => e.vaulter === v)!;
  }

  // ------------------------------------------------------- Wettkampfablauf

  private nextTurn(): void {
    this.turn = this.competition.nextTurn();
    this.waitingForPlayer = false;
    if (!this.turn) {
      this.finish();
      return;
    }
    const { vaulter, attempt } = this.turn;
    if (vaulter.isPlayer) {
      this.waitingForPlayer = true;
      this.showBoard(`DU BIST DRAN – ${attempt}. VERSUCH`, this.playerOptions());
      return;
    }
    const e = this.entrantOf(vaulter);
    const note = this.player.vaulter.out ? 'DU BIST AUSGESCHIEDEN – ESC: MENÜ' : '';
    this.showBoard(`${e.country.name} – ${attempt}. VERSUCH`, note);
    // Ist man selbst ausgeschieden, läuft der Rest zügiger durch
    const delay = this.player.vaulter.out ? 350 : 900;
    this.time.delayedCall(delay, () => {
      const ok = cpuAttempt(e.profile!, this.competition.height, Math.random);
      this.competition.record(vaulter, ok);
      sfx.board(ok);
      this.showBoard(`${e.country.name} – ${ok ? 'GÜLTIG!' : 'FEHLVERSUCH'}`, note);
      this.time.delayedCall(delay * 0.7, () => this.nextTurn());
    });
  }

  private playerOptions(): string {
    const v = this.player.vaulter;
    const parts = ['ENTER: SPRINGEN'];
    if (this.competition.canPass(v)) parts.push('P: AUSLASSEN');
    if (this.competition.isLastStanding(v) && bestHeightIndex(v) >= 0) parts.push('E: BEENDEN');
    return parts.join('   ');
  }

  private showBoard(footer: string, footer2: string): void {
    this.mode = 'board';
    this.hud.setVisible(false);
    const h = this.competition.heightIndex;
    const rows: BoardRow[] = this.entrants.map((e) => {
      const v = e.vaulter;
      const best = bestHeightIndex(v);
      const marks = v.marks[h] ?? '';
      let status = '';
      if (v.out) status = 'AUSGESCHIEDEN';
      else if (v.opening > h) status = `AB ${HEIGHTS[v.opening].toFixed(2)}`;
      else if (marks.includes('O')) status = 'GESCHAFFT';
      else if (marks === '-') status = 'AUSGELASSEN';
      return {
        flag: e.country.flag,
        label: `${e.country.code} ${e.country.name}${v.isPlayer ? ' (DU)' : ''}`,
        isPlayer: v.isPlayer,
        current: this.turn?.vaulter === v,
        out: v.out,
        best: best >= 0 ? HEIGHTS[best].toFixed(2) : '-',
        marks,
        status,
      };
    });
    this.board.show(this.competition.height, rows, footer, footer2);
  }

  private startAttempt(): void {
    const v = this.player.vaulter;
    this.mode = 'attempt';
    this.board.setVisible(false);
    this.hud.setVisible(true);
    this.vault = createVault(this.competition.height);
    this.simTime = 0;
    this.landedAt = null;
    this.barHitAt = null;
    this.barCrossAt = null;
    this.attemptDone = false;
    const best = bestHeightIndex(v);
    this.hud.setAttempt(
      this.competition.height,
      this.turn!.attempt,
      v.marks[this.competition.heightIndex],
      best >= 0 ? `BEST ${HEIGHTS[best].toFixed(2)}` : '',
    );
    this.hud.setMessage(
      `${this.competition.height.toFixed(2)} M`,
      'PFEIL LINKS/RECHTS: ANLAUFEN\nLEERTASTE AN DER WEISSEN MARKE: EINSTECHEN\nLEERTASTE BEI SENKRECHTEM STAB: LOSLASSEN',
    );
    sfx.crowd(0.45);
  }

  /** Nach dem Sprung: Ergebnis eintragen und zurück zur Anzeigetafel */
  private endAttempt(): void {
    if (!this.vault || this.mode !== 'attempt') return;
    const ok = this.vault.outcome === 'clear';
    this.competition.record(this.player.vaulter, ok);
    this.vault = null;
    sfx.crowd(0.3);
    this.nextTurn();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const ranking = this.competition.ranking();
    const rows: ResultRow[] = ranking.map((v) => {
      const e = this.entrantOf(v);
      const best = bestHeightIndex(v);
      return {
        country: e.country,
        look: e.look,
        isPlayer: v.isPlayer,
        valid: best >= 0,
        cells: [
          { text: best >= 0 ? `${HEIGHTS[best].toFixed(2)} M` : 'O.G.V.' },
          { text: String(totalFails(v)) },
          { text: best >= 0 ? v.marks[best] : '-' },
        ],
      };
    });
    const playerBest = bestHeightIndex(this.player.vaulter);
    const data: ResultSceneData = {
      event: 'pole',
      headers: ['HÖHE', 'FEHLV.', 'LETZTE'],
      rows,
      playerScore: playerBest >= 0 ? HEIGHTS[playerBest] : null,
      notes: playerBest < 0 ? ['O.G.V. = OHNE GÜLTIGEN VERSUCH'] : [],
      replay: { scene: 'polevault', data: { countryIndex: this.countryIndex } },
    };
    this.cameras.main.fadeOut(300, 16, 16, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('result', data));
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
    const confirm = ev.code === 'Enter' || ev.code === 'NumpadEnter';

    if (this.mode === 'board') {
      if (!this.waitingForPlayer) return;
      const v = this.player.vaulter;
      if (confirm || ev.code === 'Space') {
        sfx.confirm();
        this.startAttempt();
      } else if (ev.code === 'KeyP' && this.competition.canPass(v)) {
        sfx.menu();
        this.competition.pass(v);
        this.nextTurn();
      } else if (ev.code === 'KeyE' && this.competition.isLastStanding(v) && bestHeightIndex(v) >= 0) {
        this.competition.retire(v);
        this.finish();
      }
      return;
    }

    const s = this.vault;
    if (!s) return;
    if (this.attemptDone && (confirm || ev.code === 'Space')) {
      this.endAttempt();
      return;
    }
    const side: Side | null =
      ev.code === 'ArrowLeft' || ev.code === 'KeyA' ? 'L' : ev.code === 'ArrowRight' || ev.code === 'KeyD' ? 'R' : null;
    if (side) {
      const wasReady = s.phase === 'ready';
      const valid = vaultTap(s, side);
      this.hud.registerTap(side, valid, this.elapsed);
      if (wasReady && valid) this.hud.setMessage('', '');
    } else if (ev.code === 'Space') {
      this.hud.registerAction(this.elapsed);
      if (s.phase === 'runup' && plant(s) !== null) {
        sfx.plant();
        sfx.bend();
      } else if (s.phase === 'vault' && release(s) !== null) {
        this.releasedAt = this.elapsed;
        sfx.release();
      }
    }
  }

  // --------------------------------------------------------------- Ablauf

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;

    const s = this.vault;
    if (this.mode === 'attempt' && s) {
      this.simTime += dt;
      while (this.simTime >= SIM_DT) {
        this.simTime -= SIM_DT;
        for (const e of stepVault(s, SIM_DT)) this.handleEvent(s, e);
      }
      this.hud.update(this.elapsed, s);
    } else {
      this.board.update(this.elapsed);
    }

    this.updateCamera();
    const excitement = s && (s.phase === 'vault' || s.phase === 'flight') ? 0.8 : s?.outcome === 'clear' ? 1 : 0.2;
    this.stadium.update(this.camPx, dt, this.elapsed, excitement);
    this.drawWorld();
    this.drawAthlete();
  }

  private handleEvent(s: VaultState, e: VaultEvent): void {
    switch (e.type) {
      case 'footstep':
        sfx.footstep();
        break;
      case 'hang':
        // Nicht losgelassen – man rutscht vom Stab
        this.releasedAt = this.elapsed;
        sfx.release();
        break;
      case 'clear':
        this.barCrossAt = this.elapsed;
        break;
      case 'knock':
        this.barHitAt = this.elapsed;
        sfx.barFall();
        break;
      case 'land': {
        this.landedAt = this.elapsed;
        sfx.matLand();
        const ok = s.outcome === 'clear';
        if (ok) {
          sfx.finish();
          sfx.crowd(1);
        } else {
          sfx.missed();
        }
        this.time.delayedCall(350, () => this.showVerdict(s));
        break;
      }
      case 'runthrough':
        sfx.missed();
        this.time.delayedCall(600, () => this.showVerdict(s));
        break;
      default:
        break;
    }
  }

  /** Bewertung des Sprungs mit Tipps, was man besser machen kann */
  private showVerdict(s: VaultState): void {
    if (this.vault !== s) return;
    this.attemptDone = true;
    if (s.outcome === 'runthrough') {
      this.hud.setMessage('DURCHGELAUFEN', 'STAB AN DER WEISSEN MARKE EINSTECHEN!\n\nENTER: WEITER', '#e8442e');
    } else {
      const d = -(s.plantX ?? 0);
      const plantText =
        Math.abs(d - VAULT.takeoffIdeal) < 0.25 ? 'PERFEKT' : d > VAULT.takeoffIdeal ? 'ZU FRÜH' : 'ZU SPÄT';
      const r = s.releaseP ?? 0;
      const releaseText =
        r >= VAULT.hangAt
          ? 'VERPASST'
          : Math.abs(r - VAULT.releaseIdeal) < 0.06
            ? 'PERFEKT'
            : r < VAULT.releaseIdeal
              ? 'ZU FRÜH'
              : 'ZU SPÄT';
      const ok = isCleared(s);
      this.hud.setMessage(
        ok ? 'GÜLTIG!' : 'GERISSEN',
        `SPRUNGHÖHE ${s.peak.toFixed(2)} M\nEINSTICH: ${plantText}   LOSLASSEN: ${releaseText}\n\nENTER: WEITER`,
        ok ? '#4cd964' : '#e8442e',
      );
    }
    this.time.delayedCall(4000, () => {
      if (this.vault === s) this.endAttempt();
    });
  }

  private updateCamera(): void {
    const fixed = skewAt(GROUND_Y) - BOX_SCREEN_X;
    const s = this.vault;
    if (this.mode !== 'attempt' || !s) {
      this.camPx = Math.round(fixed);
      return;
    }
    const follow = s.x * PX_PER_M + skewAt(GROUND_Y) - CAMERA_LEAD_X;
    this.camPx = Math.round(Math.min(follow, fixed));
  }

  // ------------------------------------------------------------ Zeichnen

  private sx(meters: number, y: number): number {
    return Math.round(meters * PX_PER_M - this.camPx + skewAt(y));
  }

  /** Ein Punkt in der Welt: x in Metern, h Höhe in Metern, y Bildschirmtiefe */
  private pt(meters: number, h: number, y: number): Phaser.Types.Math.Vector2Like {
    return { x: this.sx(meters, y), y: Math.round(y - h * PX_PER_M) };
  }

  private drawWorld(): void {
    const g = this.worldGfx;
    g.clear();
    const f = this.frontGfx;
    f.clear();

    // Absprungmarke und Meter-Markierungen auf der Anlaufbahn
    const laneTop = TRACK_FAR_Y + RUNWAY_LANE * LANE_DEPTH;
    const laneBottom = laneTop + LANE_DEPTH;
    const crossLine = (m: number, w: number, color: number, alpha = 1) => {
      g.fillStyle(color, alpha);
      g.fillPoints(
        [
          { x: this.sx(m, laneBottom), y: laneBottom },
          { x: this.sx(m, laneBottom) + w, y: laneBottom },
          { x: this.sx(m, laneTop) + w, y: laneTop },
          { x: this.sx(m, laneTop), y: laneTop },
        ],
        true,
      );
    };
    for (let m = -VAULT.runup; m < -4; m += 5) crossLine(m, 1, 0xffffff, 0.35);
    crossLine(-VAULT.takeoffIdeal, 3, 0xffffff);
    crossLine(-VAULT.takeoffIdeal - 0.15, 1, COLORS.yellow);

    // Einstichkasten
    g.fillStyle(0x2a2e40, 1);
    g.fillPoints(
      [
        { x: this.sx(-1.0, GROUND_Y + 2), y: GROUND_Y + 2 },
        { x: this.sx(0, GROUND_Y + 3), y: GROUND_Y + 3 },
        { x: this.sx(0, GROUND_Y - 5), y: GROUND_Y - 5 },
        { x: this.sx(-1.0, GROUND_Y - 3), y: GROUND_Y - 3 },
      ],
      true,
    );
    g.fillStyle(0x8e93a8, 1);
    g.fillRect(this.sx(0, GROUND_Y) - 1, GROUND_Y - 6, 2, 9);

    this.drawMat(g);

    // Ständer und Latte
    const bar = this.vault?.bar ?? this.competition.height;
    const post = (gfx: Phaser.GameObjects.Graphics, y: number) => {
      const base = this.pt(VAULT.barX, 0, y);
      const top = this.pt(VAULT.barX, bar + 0.3, y);
      gfx.fillStyle(COLORS.outline, 1);
      gfx.fillRect(base.x - 2, top.y - 1, 5, base.y - top.y + 2);
      gfx.fillRect(base.x - 6, base.y - 2, 13, 4);
      gfx.fillStyle(0xd0d4e0, 1);
      gfx.fillRect(base.x - 1, top.y, 3, base.y - top.y);
      gfx.fillStyle(0x8e93a8, 1);
      gfx.fillRect(base.x - 5, base.y - 1, 11, 2);
      // Auflage für die Latte
      const peg = this.pt(VAULT.barX, bar, y);
      gfx.fillStyle(COLORS.outline, 1);
      gfx.fillRect(peg.x + 1, peg.y, 4, 2);
    };
    post(g, POST_FAR_Y);
    this.drawBar(g, bar);
    post(f, POST_NEAR_Y);
  }

  private drawMat(g: Phaser.GameObjects.Graphics): void {
    const { x0, x1, height, farY, nearY } = MAT;
    const top = [this.pt(x0, height, nearY), this.pt(x1, height, nearY), this.pt(x1, height, farY), this.pt(x0, height, farY)];
    const front = [this.pt(x0, 0, nearY), this.pt(x1, 0, nearY), this.pt(x1, height, nearY), this.pt(x0, height, nearY)];
    const side = [this.pt(x0, 0, nearY), this.pt(x0, height, nearY), this.pt(x0, height, farY), this.pt(x0, 0, farY)];
    g.lineStyle(2, COLORS.outline, 1);
    for (const poly of [top, front, side]) g.strokePoints(poly, true);
    g.fillStyle(0x1f4fb0, 1);
    g.fillPoints(front, true);
    g.fillStyle(0x2a5fcf, 1);
    g.fillPoints(side, true);
    g.fillStyle(0x3a76e8, 1);
    g.fillPoints(top, true);
    // Nähte und Aufschrift-Streifen
    g.lineStyle(1, 0x2a5fcf, 1);
    for (let m = x0 + 1.4; m < x1; m += 1.4) {
      const a = this.pt(m, height, nearY);
      const b = this.pt(m, height, farY);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    g.fillStyle(COLORS.yellow, 1);
    const s0 = this.pt(x0 + 1.2, height * 0.55, nearY);
    const s1 = this.pt(x1 - 1.2, height * 0.55, nearY);
    g.fillRect(s0.x, s0.y - 1, s1.x - s0.x, 3);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, bar: number): void {
    let h = bar;
    let xShift = 0;
    let wobble = 0;
    if (this.barHitAt !== null) {
      // Latte fällt herunter und bleibt auf der Matte liegen
      const t = this.elapsed - this.barHitAt;
      h = Math.max(MAT.height + 0.05, bar - 0.5 * 9.81 * t * t);
      xShift = Math.min(0.6, t * 1.5);
    } else if (this.barCrossAt !== null && this.vault) {
      // Knapp drüber: die Latte zittert, bleibt aber liegen
      const margin = this.vault.peak - bar;
      const t = this.elapsed - this.barCrossAt;
      if (margin < 0.15) wobble = Math.sin(t * 45) * 2 * Math.exp(-3 * t);
    }
    const a = this.pt(VAULT.barX + xShift, h, POST_FAR_Y);
    const b = this.pt(VAULT.barX + xShift, h, POST_NEAR_Y);
    const segments = 7;
    g.lineStyle(5, COLORS.outline, 1);
    g.lineBetween(a.x + 3, a.y, b.x + 3, b.y + wobble);
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      g.lineStyle(3, i % 2 === 0 ? 0xffffff : COLORS.red, 1);
      g.lineBetween(
        a.x + 3 + (b.x - a.x) * t0,
        a.y + (b.y + wobble - a.y) * t0,
        a.x + 3 + (b.x - a.x) * t1,
        a.y + (b.y + wobble - a.y) * t1,
      );
    }
  }

  private drawAthlete(): void {
    const g = this.athleteGfx;
    const pg = this.poleGfx;
    g.clear();
    pg.clear();
    const s = this.vault;
    const look = this.player.look;
    const t = this.elapsed;

    if (!s) {
      // Auf der Anzeigetafel: der eigene Athlet wartet am Anlauf
      const x = this.sx(-VAULT.runup, GROUND_Y);
      if (x > -40 && x < GAME_WIDTH + 40) drawRunner(g, x, GROUND_Y, idlePose(t, look.seed), look, { time: t });
      return;
    }

    const hx = this.sx(s.x, GROUND_Y);
    switch (s.phase) {
      case 'ready':
      case 'runup':
      case 'runthrough': {
        const moving = s.v > 0.8;
        const pose = carryPole(
          s.phase === 'ready' ? idlePose(t, look.seed) : moving ? runPose(s.stride, Math.min(1, s.v / 9)) : standPose(),
        );
        const mood: Mood = s.phase === 'runthrough' ? 'ouch' : s.v > 6 ? 'effort' : 'neutral';
        drawShadow(g, hx, GROUND_Y, 0);
        drawRunner(g, hx, GROUND_Y, pose, look, { mood, time: t, speed: s.v });
        const hand = handOffset(pose);
        const distance = -s.x;
        const angle =
          s.phase === 'ready' ? 1.3 : Phaser.Math.DegToRad(8 + 52 * Phaser.Math.Clamp((distance - 5) / 22, 0, 1));
        this.drawCarriedPole(pg, hx + hand.x, GROUND_Y - pose.hip + hand.y, angle);
        break;
      }
      case 'vault': {
        const pose = vaultPose(s.p);
        const rot = vaultRotation(s.p);
        const hy = GROUND_Y - s.y * PX_PER_M;
        drawShadow(g, hx, GROUND_Y, s.y * PX_PER_M);
        const hand = rotatePoint(handOffset(pose).x, handOffset(pose).y, rot);
        this.drawBentPole(pg, hx + hand.x, hy + hand.y, (s.grip + 0.3) * PX_PER_M);
        drawRunner(g, hx, hy + pose.hip, pose, look, { rotation: rot, mood: 'effort', time: t, speed: 4 });
        break;
      }
      case 'flight':
      case 'landed': {
        const landed = s.phase === 'landed';
        const u = flightProgress(s);
        const startRot = vaultRotation(s.releaseP ?? 1);
        const rot = landed ? -Math.PI / 2 : startRot + (-Math.PI / 2 - startRot) * u;
        const ok = s.outcome === 'clear';
        let pose: Pose = flightPose(u);
        let mood: Mood = s.outcome === null ? 'effort' : ok ? 'joy' : 'ouch';
        let bounce = 0;
        if (landed) {
          const since = t - (this.landedAt ?? t);
          pose = lyingPose(ok, t);
          bounce = Math.abs(Math.sin(since * 14)) * 6 * Math.exp(-6 * since);
          mood = ok ? 'joy' : 'ouch';
        }
        const hy = GROUND_Y - s.y * PX_PER_M - bounce;
        // Über der Matte fällt der Schatten auf ihre Oberseite
        const overMat = s.x > MAT.x0;
        const floor = overMat ? MAT.height : 0;
        drawShadow(g, hx, GROUND_Y - floor * PX_PER_M, Math.max(0, (s.y - floor) * PX_PER_M - 20));
        this.drawFallingPole(pg, (s.grip + 0.3) * PX_PER_M);
        drawRunner(g, hx, hy + pose.hip, pose, look, { rotation: rot, mood, time: t });
        break;
      }
    }
  }

  private drawPoleLine(g: Phaser.GameObjects.Graphics, points: Phaser.Types.Math.Vector2Like[]): void {
    g.lineStyle(4, COLORS.outline, 1);
    g.strokePoints(points, false);
    g.lineStyle(2, 0xf7d038, 1);
    g.strokePoints(points, false);
    // Griffband am oberen Ende
    const n = points.length;
    const a = points[n - 1];
    const b = points[n - 2];
    g.lineStyle(2, 0x2a2e40, 1);
    g.lineBetween(a.x!, a.y!, a.x! + (b.x! - a.x!) * 0.6, a.y! + (b.y! - a.y!) * 0.6);
  }

  private drawCarriedPole(g: Phaser.GameObjects.Graphics, handX: number, handY: number, angle: number): void {
    const dx = Math.cos(angle);
    const dy = -Math.sin(angle);
    const back = 0.9 * PX_PER_M;
    const front = (CARRY_LENGTH - 0.9) * PX_PER_M;
    // Von der Spitze zum Griffende – das Griffband liegt hinten
    this.drawPoleLine(g, [
      { x: handX + dx * front, y: handY + dy * front },
      { x: handX, y: handY },
      { x: handX - dx * back, y: handY - dy * back },
    ]);
  }

  /** Gebogener Stab vom Einstichkasten bis zu den Händen */
  private drawBentPole(g: Phaser.GameObjects.Graphics, topX: number, topY: number, length: number): void {
    const tipX = this.sx(0, GROUND_Y) - 2;
    const tipY = GROUND_Y - 2;
    const cx = topX - tipX;
    const cy = topY - tipY;
    const chord = Math.hypot(cx, cy) || 1;
    // Je kürzer die Sehne, desto stärker die Biegung (Bogenlänge bleibt gleich)
    const bulge = chord < length ? Math.min(0.22 * chord, Math.sqrt((3 * chord * (length - chord)) / 8)) : 0;
    let nx = -cy / chord;
    let ny = cx / chord;
    if (nx < 0) {
      nx = -nx;
      ny = -ny;
    }
    const mx = tipX + cx / 2 + nx * bulge * 2;
    const my = tipY + cy / 2 + ny * bulge * 2;
    const points: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      points.push({ x: a * tipX + b * mx + c * topX, y: a * tipY + b * my + c * topY });
    }
    this.drawPoleLine(g, points);
  }

  /** Nach dem Loslassen kippt der Stab zurück auf die Anlaufbahn */
  private drawFallingPole(g: Phaser.GameObjects.Graphics, length: number): void {
    const t = this.elapsed - this.releasedAt;
    const angle = Math.min(Math.PI / 2 - 0.04, 0.12 + 2.4 * t * t);
    const tipX = this.sx(0, GROUND_Y) - 2;
    const tipY = GROUND_Y - 2;
    this.drawPoleLine(g, [
      { x: tipX, y: tipY },
      { x: tipX - Math.sin(angle) * length, y: tipY - Math.cos(angle) * length },
    ]);
  }
}
