import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_WIDTH, PX_PER_M, skewAt } from '../config';
import { COUNTRIES, countryByCode, type Country } from '../data/countries';
import { currentDifficulty, getCompetition } from '../data/session';
import { loadLookSeed } from '../data/storage';
import { Beach } from '../gfx/beach';
import { drawBmx, drawCrash, type RiderStance } from '../gfx/bike';
import { BmxHud } from '../gfx/bmxHud';
import { createLook, type Mood, type RunnerLook } from '../gfx/runner';
import {
  BmxCpu,
  bmxCpuProfiles,
  COURSE,
  createRider,
  groundHeight,
  hop,
  pedal,
  startRider,
  stepRider,
  timeBonus,
  totalScore,
  type JumpScore,
  type RiderEvent,
  type RiderState,
} from '../sim/bmx';
import type { Side } from '../sim/hurdles';
import { confirmAbort, confirmPending } from './ConfirmScene';
import type { ResultRow, ResultSceneData } from './ResultScene';

const SIM_DT = 1 / 120;
const LANES = 4;
const LANE_DEPTH = 22;
const FAR_Y = 232;
const NEAR_Y = FAR_Y + LANES * LANE_DEPTH;
const PLAYER_LANE = 2;
const CAMERA_LEAD = 190;
/** Wie lange nach dem eigenen Ziel/Ausscheiden noch weitergefahren wird */
const AFTER_FINISH = 5;
const STEP = 0.25;

type Phase = 'ready' | 'countdown' | 'race';

interface Particle {
  x: number;
  h: number;
  vx: number;
  vh: number;
  life: number;
  color: number;
  laneY: number;
}

interface Rider {
  country: Country;
  look: RunnerLook;
  lane: number;
  state: RiderState;
  cpu: BmxCpu | null;
  isPlayer: boolean;
  frameColor: number;
  helmetColor: number;
  crashAt: number;
  place: number | null;
  gfx: Phaser.GameObjects.Graphics;
}

interface Popup {
  text: Phaser.GameObjects.Text;
  x: number;
  h: number;
  born: number;
}

export interface BmxSceneData {
  countryIndex: number;
}

function laneY(lane: number): number {
  return FAR_Y + (lane + 0.5) * LANE_DEPTH + 3;
}

/** Name für einen gestandenen Sprung, z. B. „SALTO + SUPERMAN“ */
function describeJump(s: JumpScore): string {
  const parts: string[] = [];
  if (s.flips === 1) parts.push('SALTO');
  else if (s.flips > 1) parts.push(`${s.flips}-FACH SALTO`);
  if (s.trickTime > 0) parts.push('SUPERMAN');
  if (s.bigAir) parts.push('BIG AIR');
  if (!s.clean) parts.push('WACKLIG');
  return parts.join(' + ');
}

export class BmxScene extends Phaser.Scene {
  private beach!: Beach;
  private hud!: BmxHud;
  private trackGfx!: Phaser.GameObjects.Graphics;
  private propsGfx!: Phaser.GameObjects.Graphics;
  private frontGfx!: Phaser.GameObjects.Graphics;
  private finishLabel!: Phaser.GameObjects.Text;
  private riders: Rider[] = [];
  private player!: Rider;
  private countryIndex = 0;
  private phase: Phase = 'ready';
  private countdown = 0;
  private gateDropAt: number | null = null;
  private raceTime = 0;
  private simAccum = 0;
  private elapsed = 0;
  private camPx = 0;
  private finishOrder = 0;
  private playerDoneAt: number | null = null;
  private resultsShown = false;
  private held = { left: false, right: false, trick: false };
  private particles: Particle[] = [];
  private popups: Popup[] = [];

  constructor() {
    super('bmx');
  }

  init(data: BmxSceneData): void {
    this.countryIndex = data.countryIndex ?? 0;
    this.riders = [];
    this.phase = 'ready';
    this.countdown = 0;
    this.gateDropAt = null;
    this.raceTime = 0;
    this.simAccum = 0;
    this.elapsed = 0;
    this.finishOrder = 0;
    this.playerDoneAt = null;
    this.resultsShown = false;
    this.held = { left: false, right: false, trick: false };
    this.particles = [];
    this.popups = [];
  }

  create(): void {
    this.beach = new Beach(this);
    this.trackGfx = this.add.graphics().setDepth(-5);
    this.propsGfx = this.add.graphics().setDepth(-4);
    this.frontGfx = this.add.graphics().setDepth(100);
    this.finishLabel = this.add
      .text(0, 0, 'ZIEL', { fontFamily: FONT, fontSize: '8px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(-3);
    this.setupRiders();
    this.hud = new BmxHud(this);
    this.hud.setMessage(
      'BMX',
      'PFEIL LINKS/RECHTS: TRETEN   PFEIL HOCH: HOPSER\nIN DER LUFT: L/R HALTEN = SALTO   LEERTASTE = SUPERMAN\nSAUBER LANDEN – SONST STURZ!\n\nENTER: BEREIT',
    );

    const kb = this.input.keyboard!;
    kb.addCapture('LEFT,RIGHT,UP,DOWN,SPACE');
    kb.on('keydown', this.onKeyDown, this);
    kb.on('keyup', this.onKeyUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', this.onKeyDown, this);
      kb.off('keyup', this.onKeyUp, this);
    });
    sfx.crowd(0.35);
    this.cameras.main.fadeIn(300, 16, 16, 28);
  }

  private setupRiders(): void {
    const others = Phaser.Utils.Array.Shuffle(COUNTRIES.filter((_, i) => i !== this.countryIndex));
    const list = bmxCpuProfiles(currentDifficulty());
    const profiles = Phaser.Utils.Array.Shuffle([...list]);
    // Im Wettkampf tritt immer dasselbe Feld an
    const field = getCompetition()?.field;
    const cpuField = field?.filter((f) => !f.isPlayer);
    let cpuIndex = 0;
    for (let lane = 0; lane < LANES; lane++) {
      const isPlayer = lane === PLAYER_LANE;
      const entry = isPlayer ? field?.find((f) => f.isPlayer) : cpuField?.[cpuIndex];
      const country = isPlayer ? COUNTRIES[this.countryIndex] : entry ? countryByCode(entry.code) : others[cpuIndex];
      const seed = entry ? entry.lookSeed : isPlayer ? loadLookSeed() : Math.floor(Math.random() * 1e9);
      const look = createLook(country, seed, lane + 1);
      const state = createRider();
      const profile = entry?.profile != null ? list[entry.profile] : profiles[cpuIndex];
      const cpu = isPlayer ? null : new BmxCpu(state, profile, Math.random);
      if (!isPlayer) cpuIndex++;
      const rider: Rider = {
        country,
        look,
        lane,
        state,
        cpu,
        isPlayer,
        frameColor: look.shoe,
        helmetColor: country.jersey,
        crashAt: 0,
        place: null,
        gfx: this.add.graphics().setDepth(lane * 10 + 5),
      };
      this.riders.push(rider);
      if (isPlayer) this.player = rider;
    }
  }

  // ---------------------------------------------------------------- Eingabe

  private sideOf(code: string): Side | null {
    if (code === 'ArrowLeft' || code === 'KeyA') return 'L';
    if (code === 'ArrowRight' || code === 'KeyD') return 'R';
    return null;
  }

  private onKeyDown(ev: KeyboardEvent): void {
    sfx.unlock();
    const side = this.sideOf(ev.code);
    if (side === 'L') this.held.left = true;
    if (side === 'R') this.held.right = true;
    if (ev.code === 'Space') this.held.trick = true;
    if (ev.repeat || confirmPending()) return;
    const competition = getCompetition() !== null;

    if (ev.code === 'Escape') {
      // Gehaltene Tasten gelten nach der Rückfrage als losgelassen
      if (competition) {
        if (!this.resultsShown) confirmAbort(this, () => (this.held = { left: false, right: false, trick: false }));
      }
      else this.scene.start('title');
      return;
    }
    if (ev.code === 'KeyM') {
      sfx.toggleMute();
      return;
    }
    const confirm = ev.code === 'Enter' || ev.code === 'NumpadEnter';
    if (this.phase === 'ready') {
      if (confirm || ev.code === 'Space') this.startCountdown();
      return;
    }
    if (this.phase !== 'race') return;
    if (this.playerDoneAt !== null && confirm) {
      this.showResults();
      return;
    }
    if (ev.code === 'KeyR') {
      if (!competition) this.scene.restart({ countryIndex: this.countryIndex });
      return;
    }
    const s = this.player.state;
    if (side) {
      const valid = pedal(s, side);
      this.hud.registerTap(side, valid, this.elapsed);
    } else if (ev.code === 'ArrowUp' || ev.code === 'KeyW') {
      if (hop(s)) sfx.takeoff();
    }
  }

  private onKeyUp(ev: KeyboardEvent): void {
    const side = this.sideOf(ev.code);
    if (side === 'L') this.held.left = false;
    if (side === 'R') this.held.right = false;
    if (ev.code === 'Space') this.held.trick = false;
  }

  // ------------------------------------------------------------------ Ablauf

  private startCountdown(): void {
    this.phase = 'countdown';
    this.countdown = 0;
    this.hud.setMessage('FERTIG?', 'GLEICH FÄLLT DAS STARTGATTER');
    sfx.call(false);
  }

  private updateCountdown(dt: number): void {
    const before = Math.floor(this.countdown / 0.7);
    this.countdown += dt;
    const step = Math.floor(this.countdown / 0.7);
    if (step === before) return;
    if (step >= 1 && step <= 3) {
      this.hud.setMessage(String(4 - step), '');
      sfx.call(false);
    } else if (step === 4) {
      this.phase = 'race';
      this.gateDropAt = this.elapsed;
      for (const r of this.riders) startRider(r.state);
      this.hud.setMessage('LOS!', '');
      this.time.delayedCall(700, () => {
        if (this.playerDoneAt === null) this.hud.setMessage('', '');
      });
      sfx.call(true);
      sfx.gate();
      sfx.crowd(0.7);
    }
  }

  private updateRace(dt: number): void {
    this.simAccum += dt;
    while (this.simAccum >= SIM_DT) {
      this.simAccum -= SIM_DT;
      this.raceTime += SIM_DT;
      const p = this.player.state;
      // Gehaltene Tasten steuern in der Luft Drehung und Trick
      p.rotInput = p.phase === 'air' ? Number(this.held.right) - Number(this.held.left) : 0;
      p.trickHeld = p.phase === 'air' && this.held.trick;
      for (const r of this.riders) {
        r.cpu?.update(this.raceTime);
        for (const e of stepRider(r.state, SIM_DT, this.raceTime)) this.handleEvent(r, e);
      }
    }

    if (this.playerDoneAt !== null && !this.resultsShown) {
      const allDone = this.riders.every((r) => r.state.finishTime !== null || r.state.phase === 'out');
      const waited = this.raceTime - this.playerDoneAt;
      if (waited > AFTER_FINISH || (allDone && waited > 2.5)) this.showResults();
    }
  }

  private handleEvent(r: Rider, e: RiderEvent): void {
    const s = r.state;
    switch (e.type) {
      case 'takeoff':
        if (r.isPlayer) sfx.takeoff();
        break;
      case 'land': {
        this.spray(s.x, s.y, laneY(r.lane), 0xd9a070, 6);
        if (!r.isPlayer) break;
        sfx.bikeLand(e.score.clean);
        if (e.score.points > 0) {
          sfx.trick(e.score.points);
          this.popup(s.x, s.y + 2.4, `+${e.score.points}\n${describeJump(e.score)}`, e.score.clean ? '#f7d038' : '#f08a24');
        } else if (!e.score.clean) {
          this.popup(s.x, s.y + 2.4, 'WACKLIG', '#f08a24');
        }
        break;
      }
      case 'crash':
        r.crashAt = this.elapsed;
        this.spray(s.x, s.y, laneY(r.lane), 0xd9a070, 12);
        if (r.isPlayer) {
          sfx.crash();
          this.cameras.main.shake(160, 0.006);
          const why = { landing: 'SCHIEF GELANDET', trick: 'TRICK ZU SPÄT BEENDET', log: 'BAUMSTAMM!', wall: 'ZU LANGSAM FÜR DIE LÜCKE' };
          this.popup(s.x, s.y + 2.6, `STURZ!\n${why[e.reason]}`, '#e8442e');
        }
        break;
      case 'splash':
        this.spray(s.x, 0, laneY(r.lane), 0x7fc8f0, 14);
        if (r.isPlayer) sfx.splash();
        break;
      case 'finish':
        r.place = ++this.finishOrder;
        if (r.isPlayer) {
          this.playerDoneAt = this.raceTime;
          sfx.finish();
          sfx.crowd(1);
          this.hud.setMessage(
            `${totalScore(s)} PUNKTE`,
            `TRICKS ${s.points} + ZEITBONUS ${timeBonus(s)}\n${r.place}. IM ZIEL – ${e.time.toFixed(2)} S\n\nENTER: ERGEBNIS`,
          );
        }
        break;
      case 'out':
        if (r.isPlayer) {
          this.playerDoneAt = this.raceTime;
          sfx.missed();
          this.hud.setMessage('AUSGESCHIEDEN', `DREI STÜRZE – ${s.points} TRICKPUNKTE\n\nENTER: ERGEBNIS`, '#e8442e');
        }
        break;
    }
  }

  private spray(x: number, h: number, ly: number, color: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        h,
        vx: (Math.random() - 0.7) * 4,
        vh: 1 + Math.random() * 3,
        life: 0.4 + Math.random() * 0.4,
        color,
        laneY: ly,
      });
    }
  }

  private popup(x: number, h: number, text: string, color: string): void {
    const t = this.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: '8px',
        color,
        stroke: '#10101c',
        strokeThickness: 4,
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(150);
    this.popups.push({ text: t, x, h, born: this.elapsed });
  }

  /** Wer noch unterwegs ist, fährt im Schnelldurchlauf zu Ende */
  private finishRemaining(): void {
    let t = this.raceTime;
    const pending = () => this.riders.some((r) => r.state.finishTime === null && r.state.phase !== 'out');
    while (pending() && t < this.raceTime + 120) {
      t += SIM_DT;
      for (const r of this.riders) {
        if (r.isPlayer) continue;
        r.cpu?.update(t);
        stepRider(r.state, SIM_DT, t);
      }
    }
  }

  private showResults(): void {
    if (this.resultsShown) return;
    this.resultsShown = true;
    this.finishRemaining();
    const ranked = [...this.riders].sort((a, b) => {
      const fa = a.state.finishTime !== null ? 1 : 0;
      const fb = b.state.finishTime !== null ? 1 : 0;
      return fb - fa || totalScore(b.state) - totalScore(a.state);
    });
    const rows: ResultRow[] = ranked.map((r) => {
      const s = r.state;
      return {
        country: r.country,
        look: r.look,
        isPlayer: r.isPlayer,
        valid: s.finishTime !== null,
        cells: [
          { text: `${totalScore(s)}` },
          { text: s.finishTime !== null ? s.finishTime.toFixed(2) : 'DNF' },
          { text: s.crashes === 0 ? 'KEINE' : `${s.crashes}`, color: s.crashes === 0 ? '#4cd964' : '#e8442e' },
        ],
      };
    });
    const p = this.player.state;
    const data: ResultSceneData = {
      event: 'bmx',
      headers: ['PUNKTE', 'ZEIT', 'STÜRZE'],
      rows,
      playerScore: p.finishTime !== null ? totalScore(p) : null,
      notes: [`DEINE TRICKS ${p.points} + ZEITBONUS ${timeBonus(p)}`],
      replay: { scene: 'bmx', data: { countryIndex: this.countryIndex } },
    };
    this.cameras.main.fadeOut(300, 16, 16, 28);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('result', data));
  }

  // --------------------------------------------------------------- Zeichnen

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;
    if (this.phase === 'countdown') this.updateCountdown(dt);
    else if (this.phase === 'race') this.updateRace(dt);

    const p = this.player.state;
    this.camPx = Math.round(p.x * PX_PER_M + skewAt(laneY(PLAYER_LANE)) - CAMERA_LEAD);
    const excitement = this.phase !== 'race' ? 0.15 : p.phase === 'air' ? 0.9 : this.playerDoneAt !== null ? 1 : 0.4;
    this.beach.update(this.camPx, dt, this.elapsed, excitement);

    this.drawTrack();
    this.drawProps();
    for (const r of this.riders) this.drawRider(r);
    this.updateParticles(dt);
    this.updatePopups();
    this.hud.update(
      this.elapsed,
      this.raceTime,
      this.riders.map((r) => ({ state: r.state, color: r.country.jersey, isPlayer: r.isPlayer })),
      this.held.trick,
    );
  }

  private pt(m: number, h: number, y: number): Phaser.Types.Math.Vector2Like {
    return { x: Math.round(m * PX_PER_M - this.camPx + skewAt(y)), y: Math.round(y - h * PX_PER_M) };
  }

  private visibleRange(): [number, number] {
    const x0 = Math.floor((this.camPx - 40) / PX_PER_M / STEP) * STEP;
    const x1 = (this.camPx + GAME_WIDTH + 20) / PX_PER_M;
    return [x0, x1];
  }

  /** Erdstrecke: Oberfläche mit Licht und Schatten, Seitenwände der Rampen */
  private drawTrack(): void {
    const g = this.trackGfx;
    g.clear();
    const [x0, x1] = this.visibleRange();
    for (let x = x0; x < x1; x += STEP) {
      const ha = groundHeight(x);
      const hb = groundHeight(x + STEP);
      const slope = (hb - ha) / STEP;
      const color = slope > 0.05 ? 0xc98a55 : slope < -0.05 ? 0x93562f : 0xb06c3c;
      g.fillStyle(color, 1);
      g.fillPoints([this.pt(x, ha, FAR_Y), this.pt(x + STEP, hb, FAR_Y), this.pt(x + STEP, hb, NEAR_Y), this.pt(x, ha, NEAR_Y)], true);
      if (ha > 0 || hb > 0) {
        g.fillStyle(0x7a4524, 1);
        g.fillPoints([this.pt(x, ha, NEAR_Y), this.pt(x + STEP, hb, NEAR_Y), this.pt(x + STEP, 0, NEAR_Y), this.pt(x, 0, NEAR_Y)], true);
      }
    }
    // Spurlinien und Kanten folgen dem Gelände
    const line = (y: number, color: number, alpha: number) => {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let x = x0; x < x1; x += STEP) pts.push(this.pt(x, groundHeight(x), y));
      g.lineStyle(1, color, alpha);
      g.strokePoints(pts, false);
    };
    for (let i = 1; i < LANES; i++) line(FAR_Y + i * LANE_DEPTH, 0xe0a878, 0.45);
    line(FAR_Y, 0x5e3218, 1);
    line(NEAR_Y, 0xd99a66, 1);
  }

  private drawProps(): void {
    const g = this.propsGfx;
    g.clear();
    const f = this.frontGfx;
    f.clear();
    const [x0, x1] = this.visibleRange();
    const inView = (m: number) => m > x0 - 3 && m < x1 + 3;

    // Pfützen
    for (const [a, b] of COURSE.puddles) {
      if (!inView(a) && !inView(b)) continue;
      g.fillStyle(0x3f8fd6, 0.9);
      g.fillPoints([this.pt(a, 0, FAR_Y + 4), this.pt(b, 0, FAR_Y + 4), this.pt(b, 0, NEAR_Y - 4), this.pt(a, 0, NEAR_Y - 4)], true);
      g.lineStyle(1, 0xbfe6ff, 0.8);
      for (let k = 0; k < 4; k++) {
        const m = a + ((this.elapsed * 0.8 + k * 0.27) % 1) * (b - a);
        const y = FAR_Y + 10 + k * 19;
        const p0 = this.pt(m, 0, y);
        g.lineBetween(p0.x, p0.y, p0.x + 10, p0.y);
      }
    }

    // Baumstämme quer über die Strecke
    for (const l of COURSE.logs) {
      if (!inView(l)) continue;
      const a = this.pt(l, 0.22, FAR_Y + 2);
      const b = this.pt(l, 0.22, NEAR_Y - 2);
      g.lineStyle(13, COLORS.outline, 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(11, 0x7a4d2a, 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(1, 0x5a3a1e, 1);
      g.lineBetween(a.x - 2, a.y - 2, b.x - 2, b.y - 2);
      g.lineBetween(a.x + 2, a.y + 3, b.x + 2, b.y + 3);
      g.fillStyle(COLORS.outline, 1);
      g.fillCircle(b.x, b.y, 6.5);
      g.fillStyle(0xd9a066, 1);
      g.fillCircle(b.x, b.y, 5.5);
      g.lineStyle(1, 0xa8743f, 1);
      g.strokeCircle(b.x, b.y, 3);
    }

    // Startgatter: klappt beim Start nach vorne um
    if (inView(0)) {
      const t = this.gateDropAt === null ? 0 : Math.min(1, (this.elapsed - this.gateDropAt) / 0.2);
      const h = 0.6 * (1 - t) + 0.05;
      const lean = 0.5 * t;
      const quad = [this.pt(0.6, 0, FAR_Y), this.pt(0.6 + lean, h, FAR_Y), this.pt(0.6 + lean, h, NEAR_Y), this.pt(0.6, 0, NEAR_Y)];
      g.fillStyle(COLORS.outline, 1);
      g.fillPoints(quad, true);
      g.fillStyle(0xb8bcd0, 1);
      g.fillPoints([this.pt(0.62, 0.03, FAR_Y + 1), this.pt(0.6 + lean, h - 0.04, FAR_Y + 1), this.pt(0.6 + lean, h - 0.04, NEAR_Y - 1), this.pt(0.62, 0.03, NEAR_Y - 1)], true);
      g.fillStyle(COLORS.yellow, 1);
      for (let k = 0; k < 4; k++) {
        const y = FAR_Y + 8 + k * 22;
        const p0 = this.pt(0.6 + lean * 0.6, h * 0.6, y);
        g.fillRect(p0.x - 1, p0.y - 1, 3, 3);
      }
    }

    // Ziel: Linie und Schild hinter der Strecke, Pfosten vorne
    const L = COURSE.length;
    if (inView(L)) {
      for (let y = FAR_Y; y < NEAR_Y; y += 2) {
        const p0 = this.pt(L, 0, y);
        g.fillStyle((y / 2) % 2 === 0 ? 0xffffff : COLORS.outline, 1);
        g.fillRect(p0.x, p0.y, 2, 2);
        g.fillStyle((y / 2) % 2 === 0 ? COLORS.outline : 0xffffff, 1);
        g.fillRect(p0.x + 2, p0.y, 2, 2);
      }
      const s = this.pt(L, 0, FAR_Y - 4);
      const top = s.y - 70;
      g.fillStyle(COLORS.outline, 1);
      g.fillRect(s.x - 20, top + 14, 4, 56);
      g.fillRect(s.x + 18, top + 14, 4, 56);
      g.fillRect(s.x - 27, top - 1, 56, 18);
      g.fillStyle(0xd0d0d0, 1);
      g.fillRect(s.x - 19, top + 14, 2, 56);
      g.fillRect(s.x + 19, top + 14, 2, 56);
      g.fillStyle(COLORS.red, 1);
      g.fillRect(s.x - 26, top, 54, 16);
      this.finishLabel.setPosition(s.x + 1, top + 7).setVisible(true);
      const n = this.pt(L, 0, NEAR_Y + 6);
      f.fillStyle(COLORS.outline, 1);
      f.fillRect(n.x - 1, n.y - 30, 4, 32);
      f.fillStyle(0xe8e8e8, 1);
      f.fillRect(n.x, n.y - 30, 2, 30);
      f.fillStyle(COLORS.red, 1);
      f.fillRect(n.x - 2, n.y - 33, 6, 4);
    } else {
      this.finishLabel.setVisible(false);
    }
  }

  private drawRider(r: Rider): void {
    const g = r.gfx;
    g.clear();
    const s = r.state;
    const ly = laneY(r.lane);
    const pos = this.pt(s.x, s.y, ly);
    if (pos.x! < -60 || pos.x! > GAME_WIDTH + 60) return;

    const ground = this.pt(s.x, groundHeight(s.x), ly);
    const air = Math.max(0, (s.y - groundHeight(s.x)) * PX_PER_M);
    const k = Math.max(0.35, 1 - air / 80);
    g.fillStyle(0x000000, 0.25 * k);
    g.fillEllipse(ground.x!, ground.y!, 30 * k, 5 * k);

    const opts = {
      crank: s.crank,
      stance: 'pedal' as RiderStance,
      mood: 'neutral' as Mood,
      time: this.elapsed,
      frameColor: r.frameColor,
      helmetColor: r.helmetColor,
      speed: s.vx,
    };
    if (s.phase === 'crashed' || s.phase === 'out') {
      drawCrash(g, pos.x!, pos.y!, r.look, opts, this.elapsed - r.crashAt);
      return;
    }
    if (s.phase === 'air') {
      opts.stance = s.trickHeld ? 'trick' : 'air';
      opts.mood = s.trickHeld ? 'joy' : 'effort';
    } else if (s.finishTime !== null) {
      opts.mood = r.place === 1 ? 'joy' : 'tired';
    } else if (s.vx > 7) {
      opts.mood = 'effort';
    }
    drawBmx(g, pos.x!, pos.y!, s.angle, r.look, opts);

    if (r.isPlayer) {
      const my = pos.y! - 62 + Math.round(Math.sin(this.elapsed * 6));
      g.fillStyle(COLORS.outline, 1);
      g.fillTriangle(pos.x! - 5, my - 1, pos.x! + 5, my - 1, pos.x!, my + 5);
      g.fillStyle(COLORS.yellow, 1);
      g.fillTriangle(pos.x! - 3, my, pos.x! + 3, my, pos.x!, my + 3);
    }
  }

  private updateParticles(dt: number): void {
    const g = this.frontGfx;
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.h += p.vh * dt;
      p.vh -= 9.81 * dt;
      if (p.h < groundHeight(p.x)) p.h = groundHeight(p.x);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      const s = this.pt(p.x, p.h, p.laneY);
      g.fillStyle(p.color, Math.min(1, p.life * 3));
      g.fillRect(s.x!, s.y!, 2, 2);
    }
  }

  private updatePopups(): void {
    for (const p of this.popups) {
      const age = this.elapsed - p.born;
      const s = this.pt(p.x, p.h + age * 1.2, laneY(PLAYER_LANE));
      p.text.setPosition(s.x!, s.y!).setAlpha(Math.max(0, 1 - Math.max(0, age - 0.9) / 0.4));
    }
    this.popups = this.popups.filter((p) => {
      if (this.elapsed - p.born < 1.3) return true;
      p.text.destroy();
      return false;
    });
  }
}
