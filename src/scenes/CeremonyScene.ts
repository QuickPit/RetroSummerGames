import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { countryByCode } from '../data/countries';
import { endCompetition, getCompetition } from '../data/session';
import {
  Confetti,
  CrowdLights,
  FLAG_H,
  FLAG_W,
  Fireworks,
  NIGHT,
  PODIUM_MEDALS,
  createFlagTexture,
  createNightTextures,
  drawConfettiCannon,
  drawFloodlightTower,
  drawFlagpole,
  drawLampGlow,
  drawLightCone,
  drawPodiumStep,
  drawTrophy,
} from '../gfx/ceremony';
import { cheerPose, createLook, drawRunner, handOffset, trophyPose, wavePose, type RunnerLook } from '../gfx/runner';
import { ceremonyPodium, medalTable, type CompetitionState, type PodiumGroup } from '../sim/competition';

const PODIUM_BASE = 296;
const STEP_H: Record<number, number> = { 1: 46, 2: 36, 3: 28 };
const MAST_TOP: Record<number, number> = { 1: 56, 2: 74, 3: 88 };
const MAST_BOTTOM = NIGHT.grassY + 4;
const MAST_GAP = 48;
const ATHLETE_GAP = 30;
const TOWERS = [
  { x: 26, top: 42 },
  { x: GAME_WIDTH - 26, top: 42 },
];
/** Konfettikanonen links und rechts vom Podest, Rohr zur Mitte geneigt */
const CANNONS = [
  { x: GAME_WIDTH / 2 - 150, dir: 1 },
  { x: GAME_WIDTH / 2 + 150, dir: -1 },
];
const ROCKET_START_Y = 180;
/** Streifen je Flagge zum Wehen */
const SLICE = 2;

const TIMING = {
  /** Beginn der Siegermelodie und des Fahnenhissens */
  anthemAt: 1.0,
  /** Ersatzdauer der Melodie, falls kein Ton läuft */
  anthemFallback: 8.6,
  /** Kleine Salve alle … Sekunden nach dem Finale */
  salvoEvery: 14,
} as const;

interface Athlete {
  code: string;
  rank: number;
  x: number;
  base: number;
  look: RunnerLook;
  isPlayer: boolean;
  phase: number;
}

interface Mast {
  rank: number;
  x: number;
  top: number;
  slices: Phaser.GameObjects.Image[];
}

/** Abschlussfeier nach dem Endstand: Nacht im Stadion, Podest der Nationen, Flaggen, Feuerwerk. */
export class CeremonyScene extends Phaser.Scene {
  /** Öffentlich lesbar für den Spieltest */
  podium: PodiumGroup[] = [];
  elapsed = 0;
  private state!: CompetitionState;
  private athletes: Athlete[] = [];
  private masts: Mast[] = [];
  private fireworks!: Fireworks;
  private confetti!: Confetti;
  private crowdLights!: CrowdLights;
  private stands!: Phaser.GameObjects.TileSprite;
  private gfx!: {
    beams: Phaser.GameObjects.Graphics;
    sky: Phaser.GameObjects.Graphics;
    crowd: Phaser.GameObjects.Graphics;
    masts: Phaser.GameObjects.Graphics;
    cones: Phaser.GameObjects.Graphics;
    athletes: Phaser.GameObjects.Graphics;
    front: Phaser.GameObjects.Graphics;
  };
  private youTag: Phaser.GameObjects.Text | null = null;
  private anthemLength: number = TIMING.anthemFallback;
  private anthemStarted = false;
  private finaleDone = false;
  private nextRocket = 0.4;
  private nextSalvo = 0;
  private salvoLeft = 0;
  private lastBang = 0;
  private crowdTimer = 0;
  private crowdFrame = 0;
  /** Szenenwechsel ist angestoßen – keine weiteren Tasten */
  private leaving = false;

  constructor() {
    super('ceremony');
  }

  init(): void {
    this.elapsed = 0;
    this.athletes = [];
    this.masts = [];
    this.youTag = null;
    this.anthemLength = TIMING.anthemFallback;
    this.anthemStarted = false;
    this.finaleDone = false;
    this.nextRocket = 0.4;
    this.nextSalvo = 0;
    this.salvoLeft = 0;
    this.lastBang = 0;
    this.crowdTimer = 0;
    this.leaving = false;
  }

  create(): void {
    const state = getCompetition();
    if (!state) {
      this.scene.start('title');
      return;
    }
    this.state = state;
    this.podium = ceremonyPodium(state);
    createNightTextures(this);

    this.buildBackdrop();
    this.buildPodium();
    this.buildTexts();

    this.fireworks = new Fireworks(state.field.reduce((n, f) => n + f.lookSeed, 0) % 9973);
    this.confetti = new Confetti(120, GAME_WIDTH - 120, PODIUM_BASE + 4);
    this.crowdLights = new CrowdLights(NIGHT.standsY, NIGHT.boardsY);
    this.cameras.main.fadeIn(600, 6, 6, 26);
    sfx.crowd(0.5);

    const kb = this.input.keyboard!;
    const createdAt = performance.now();
    const onKey = (ev: KeyboardEvent) => {
      sfx.unlock();
      // Tasten aus dem Endstand nicht übernehmen
      if (ev.repeat || this.leaving || (ev.timeStamp > 0 && ev.timeStamp < createdAt)) return;
      if (['Enter', 'NumpadEnter', 'Space', 'Escape'].includes(ev.code)) {
        this.leaving = true;
        sfx.stopAll();
        sfx.confirm();
        endCompetition();
        this.scene.start('title');
      } else if (ev.code === 'KeyM') {
        sfx.toggleMute();
      }
    };
    kb.on('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', onKey);
      if (!this.leaving) sfx.stopAll();
    });
  }

  private text(x: number, y: number, s: string, size = 8, color = '#ffffff'): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#10101c', strokeThickness: size >= 16 ? 4 : 3 })
      .setDepth(10);
  }

  private playerCode(): string {
    return this.state.field.find((f) => f.isPlayer)!.code;
  }

  /** Himmel, Ränge, Banden, Rasen und Flutlichtmasten */
  private buildBackdrop(): void {
    this.add.image(0, 0, 'nightSky').setOrigin(0).setDepth(-20);
    this.add.rectangle(0, NIGHT.skyH, GAME_WIDTH, NIGHT.standsY + 20 - NIGHT.skyH, 0x4a2f62).setOrigin(0).setDepth(-20);
    const beams = this.add.graphics().setDepth(-19).setBlendMode(Phaser.BlendModes.ADD);
    const sky = this.add.graphics().setDepth(-18);
    this.stands = this.add
      .tileSprite(0, NIGHT.standsY, GAME_WIDTH, NIGHT.standsH, 'stands0')
      .setOrigin(0)
      .setDepth(-15)
      .setTint(NIGHT.standsTint);
    this.stands.tilePositionY = 150 - NIGHT.standsH;
    this.add.tileSprite(0, NIGHT.boardsY, GAME_WIDTH, 14, 'boards').setOrigin(0).setDepth(-15).setTint(NIGHT.boardsTint);
    this.add
      .tileSprite(0, NIGHT.grassY, GAME_WIDTH, GAME_HEIGHT - NIGHT.grassY, 'grass')
      .setOrigin(0)
      .setDepth(-15)
      .setTint(NIGHT.grassTint);
    const crowd = this.add.graphics().setDepth(-14);

    const g = this.add.graphics().setDepth(-13);
    // Geländer über den Rängen
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(0, NIGHT.standsY - 2, GAME_WIDTH, 3);
    g.fillStyle(0x8a86b8, 1);
    g.fillRect(0, NIGHT.standsY - 2, GAME_WIDTH, 1);
    for (const t of TOWERS) drawFloodlightTower(g, t.x, t.top, NIGHT.boardsY + 4);

    const masts = this.add.graphics().setDepth(-12);
    const cones = this.add.graphics().setDepth(-10).setBlendMode(Phaser.BlendModes.ADD);
    const athletes = this.add.graphics().setDepth(-7);
    const front = this.add.graphics().setDepth(-6);
    this.gfx = { beams, sky, crowd, masts, cones, athletes, front };
  }

  /** Stufen, Athleten und Masten nach dem Medaillenspiegel */
  private buildPodium(): void {
    const g = this.add.graphics().setDepth(-9);
    for (const c of CANNONS) drawConfettiCannon(g, c.x, PODIUM_BASE, c.dir);
    const width = (n: number) => Math.max(64, n * ATHLETE_GAP + 16);
    const group = (rank: number) => this.podium.find((p) => p.rank === rank);
    const center = group(1);
    if (!center) return;
    const wCenter = width(center.codes.length);
    // Platz 2 links, Platz 1 Mitte, Platz 3 rechts – fehlt eine Stufe, bleibt ihr Platz leer
    const slots: { group: PodiumGroup | undefined; cx: number }[] = [
      { group: group(2), cx: 0 },
      { group: center, cx: GAME_WIDTH / 2 },
      { group: group(3), cx: 0 },
    ];
    if (slots[0].group) slots[0].cx = GAME_WIDTH / 2 - wCenter / 2 - width(slots[0].group.codes.length) / 2;
    if (slots[2].group) slots[2].cx = GAME_WIDTH / 2 + wCenter / 2 + width(slots[2].group.codes.length) / 2;

    const me = this.playerCode();
    const lookNo = new Map(this.state.field.map((f, i) => [f.code, i + 1]));
    const order: { code: string; rank: number }[] = [];
    for (const { group: grp, cx } of slots) {
      if (!grp) continue;
      const h = STEP_H[grp.rank] ?? 28;
      drawPodiumStep(g, cx, PODIUM_BASE, width(grp.codes.length), h, grp.rank);
      this.add
        .text(cx + 1, PODIUM_BASE - h + 7, String(grp.rank), { fontFamily: FONT, fontSize: '16px', color: '#10101c' })
        .setOrigin(0.5, 0)
        .setDepth(-8);
      grp.codes.forEach((code, i) => {
        const entry = this.state.field.find((f) => f.code === code)!;
        const country = countryByCode(code);
        this.athletes.push({
          code,
          rank: grp.rank,
          x: Math.round(cx + (i - (grp.codes.length - 1) / 2) * ATHLETE_GAP),
          base: PODIUM_BASE - h - 2,
          look: createLook(country, entry.lookSeed, lookNo.get(code) ?? 1),
          isPlayer: code === me,
          phase: this.athletes.length * 0.9,
        });
        order.push({ code, rank: grp.rank });
      });
    }

    // Masten in der Reihenfolge der Athleten, Mast und Flagge zusammen mittig
    order.forEach(({ code, rank }, i) => {
      const x = Math.round(GAME_WIDTH / 2 + (i - (order.length - 1) / 2) * MAST_GAP - FLAG_W / 2 - 8);
      const key = `ceremonyFlag-${code}`;
      createFlagTexture(this, key, countryByCode(code).flag);
      const slices: Phaser.GameObjects.Image[] = [];
      for (let s = 0; s < FLAG_W / SLICE; s++) {
        slices.push(
          this.add
            .image(x + 3, MAST_BOTTOM, key)
            .setOrigin(0)
            .setCrop(s * SLICE, 0, SLICE, FLAG_H)
            .setDepth(-11),
        );
      }
      this.masts.push({ rank, x, top: MAST_TOP[rank] ?? 88, slices });
    });

    if (this.athletes.some((a) => a.isPlayer)) {
      this.youTag = this.text(0, 0, 'DU', 8, '#f7d038').setOrigin(0.5, 0);
    }
  }

  private buildTexts(): void {
    const winners = this.podium.find((p) => p.rank === 1)?.codes ?? [];
    this.text(GAME_WIDTH / 2, 10, 'ABSCHLUSSFEIER', 16, '#f7d038').setOrigin(0.5, 0);
    if (winners.length === 0) {
      this.text(GAME_WIDTH / 2, 236, 'DIE SPIELE SIND BEENDET', 16, '#ffffff').setOrigin(0.5, 0);
    } else {
      const name =
        winners.length === 1
          ? countryByCode(winners[0]).name
          : `${winners.slice(0, -1).join(', ')} UND ${winners[winners.length - 1]}`;
      this.text(GAME_WIDTH / 2, 32, `GESAMTSIEGER: ${name}`, 8, '#f7c843').setOrigin(0.5, 0);
    }
    this.text(GAME_WIDTH / 2, 312, this.feedback(), 8, '#ffffff').setOrigin(0.5, 0);
    const prompt = this.text(GAME_WIDTH / 2, 336, 'ENTER: ZUM MENÜ', 8, '#f7d038').setOrigin(0.5, 0);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
  }

  private feedback(): string {
    const me = this.playerCode();
    const name = countryByCode(me).name;
    const group = this.podium.find((p) => p.codes.includes(me));
    if (this.podium.length === 0) return 'NIEMAND HOLT EINE MEDAILLE – AUF EIN NEUES!';
    if (group?.rank === 1) return group.codes.length === 1 ? 'DU HAST DIE SPIELE GEWONNEN!' : `GETEILTER SIEG FÜR ${name} – STARK!`;
    if (group) return `PLATZ ${group.rank} FÜR ${name} – STARK!`;
    const rank = medalTable(this.state).find((r) => r.code === me)?.rank ?? 4;
    return `PLATZ ${rank} FÜR ${name} – AUF EIN NEUES!`;
  }

  // ------------------------------------------------------------ Ablauf

  private launch(minX?: number, maxX?: number): void {
    if (this.fireworks.launchRandom(ROCKET_START_Y, minX, maxX)) sfx.fireworkLaunch();
  }

  private timeline(dt: number): void {
    const t = this.elapsed;
    if (!this.anthemStarted && t >= TIMING.anthemAt) {
      this.anthemStarted = true;
      const length = sfx.victoryTheme();
      if (length > 0) this.anthemLength = length;
      sfx.crowd(0.35);
    }
    const finaleAt = TIMING.anthemAt + this.anthemLength;
    if (!this.finaleDone && t >= finaleAt) {
      this.finaleDone = true;
      this.salvoLeft = 7;
      this.nextRocket = 0;
      this.nextSalvo = t + TIMING.salvoEvery;
      this.confetti.shoot(CANNONS.map((c) => ({ x: c.x + c.dir * 5, y: PODIUM_BASE - 16, dir: c.dir })));
      this.crowdLights.rate = 10;
      sfx.crowd(0.9);
    }
    if (this.finaleDone && t >= this.nextSalvo) {
      this.salvoLeft = 4;
      this.nextSalvo = t + TIMING.salvoEvery;
    }
    this.nextRocket -= dt;
    if (this.nextRocket <= 0) {
      if (this.salvoLeft > 0) {
        this.salvoLeft--;
        this.launch();
        this.nextRocket = 0.18;
      } else {
        this.launch();
        this.nextRocket = this.finaleDone ? 0.6 + Math.random() * 0.8 : 1.2 + Math.random() * 0.9;
      }
    }
    const bangs = this.fireworks.update(dt);
    if (bangs > 0 && t - this.lastBang > 0.12) {
      this.lastBang = t;
      sfx.fireworkBang(this.salvoLeft > 0);
    }
  }

  /** Fahne: 0 unten, 1 oben – gehisst wird während der Siegermelodie */
  private hoist(): number {
    const p = (this.elapsed - TIMING.anthemAt - 0.3) / (this.anthemLength - 0.6);
    const c = Math.max(0, Math.min(1, p));
    return c < 0.92 ? c : 0.92 + (1 - Math.pow(1 - (c - 0.92) / 0.08, 2)) * 0.08;
  }

  update(_time: number, deltaMs: number): void {
    if (!this.state) return;
    const dt = Math.min(0.05, deltaMs / 1000);
    this.elapsed += dt;
    const t = this.elapsed;
    this.timeline(dt);
    this.confetti.update(dt);
    this.crowdLights.update(dt);

    // Publikum wechselt die Jubel-Bilder
    this.crowdTimer += dt;
    if (this.crowdTimer >= (this.finaleDone ? 0.14 : 0.3)) {
      this.crowdTimer = 0;
      this.crowdFrame = 1 - this.crowdFrame;
      this.stands.setTexture(`stands${this.crowdFrame}`);
    }

    const { beams, sky, crowd, masts, cones, athletes, front } = this.gfx;
    // Suchscheinwerfer hinter den Rängen schwenken über den Himmel
    beams.clear();
    for (const [i, bx] of [170, 470].entries()) {
      const a = Math.sin(t * 0.45 + i * 2.1) * 0.55 + (i === 0 ? -0.15 : 0.15);
      drawLightCone(beams, bx, NIGHT.standsY + 6, bx + Math.sin(a) * 150, NIGHT.standsY + 6 - Math.cos(a) * 150, 12, 0x9fc0ff, 0.06);
    }

    sky.clear();
    this.fireworks.draw(sky, NIGHT.standsY);

    crowd.clear();
    this.crowdLights.draw(crowd);

    // Fahnen hissen und wehen lassen
    masts.clear();
    const h = this.hoist();
    for (const m of this.masts) {
      const flagTop = Math.round(MAST_BOTTOM - 26 - (MAST_BOTTOM - 26 - (m.top + 2)) * h);
      drawFlagpole(masts, m.x, m.top, MAST_BOTTOM, flagTop);
      const n = m.slices.length;
      m.slices.forEach((img, s) => {
        const wave = t * 4.2 - s * 0.5 + m.x * 0.05;
        const amp = (s / (n - 1)) * 2.2;
        img.y = flagTop + Math.round(Math.sin(wave) * amp);
        // Licht von oben links: abfallende Falten dunkler
        const light = 0.86 + 0.14 * Math.cos(wave);
        const v = Math.round(255 * light);
        img.setTint((v << 16) | (v << 8) | v);
      });
    }

    // Flutlicht auf das Podest
    cones.clear();
    if (this.athletes.length > 0) {
      for (const [i, tw] of TOWERS.entries()) {
        const sway = Math.sin(t * 0.7 + i * 1.7) * 14;
        drawLightCone(cones, tw.x, tw.top, GAME_WIDTH / 2 + sway, PODIUM_BASE - 30, 58, 0xfff0c0, 0.07);
      }
      cones.fillStyle(0xfff0c0, 0.08);
      cones.fillEllipse(GAME_WIDTH / 2, PODIUM_BASE + 1, 300, 18);
    }
    for (const tw of TOWERS) drawLampGlow(cones, tw.x, tw.top, Math.sin(t * 3));

    // Athleten
    athletes.clear();
    let tagY = 0;
    let tagX = 0;
    for (const a of this.athletes) {
      const at = t + a.phase;
      const champion = a.rank === 1;
      const pose = champion ? trophyPose(at) : a.rank === 2 ? wavePose(at) : cheerPose(at * 0.8);
      const lift = champion ? Math.abs(Math.sin(at * 3)) * 3 : Math.abs(Math.sin(at * 4)) * 1.5;
      drawRunner(athletes, a.x - 6, a.base, pose, a.look, {
        lift,
        mood: 'joy',
        time: at,
        medal: PODIUM_MEDALS[a.rank - 1],
      });
      let top = a.base - pose.hip - lift - 30;
      if (champion) {
        const hand = handOffset(pose);
        const hx = a.x - 6 + hand.x;
        const hy = a.base - pose.hip - lift + hand.y;
        drawTrophy(athletes, hx, hy + 1, at);
        top = hy - 15;
      }
      if (a.isPlayer) {
        tagX = a.x - 4;
        tagY = Math.round(top - 14 + Math.sin(t * 5) * 1.5);
      }
    }
    this.youTag?.setPosition(tagX, tagY);

    front.clear();
    this.confetti.draw(front);
  }
}
