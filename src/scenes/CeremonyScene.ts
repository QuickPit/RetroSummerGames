import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { countryByCode, winnersLabel } from '../data/countries';
import { endCompetition, getCompetition } from '../data/session';
import {
  Confetti,
  CrowdLights,
  FLAG_H,
  FLAG_W,
  Fireworks,
  NIGHT,
  PODIUM_MEDALS,
  TROPHY_SIZE,
  createFlagTexture,
  createNightTextures,
  createTrophyTexture,
  drawConfettiCannon,
  drawFloodlightTower,
  drawFlagpole,
  drawLampGlow,
  drawLightCone,
  drawPodiumStep,
  drawTrophySparkle,
} from '../gfx/ceremony';
import { cheerPose, createLook, drawRunner, handOffset, trophyPose, wavePose, type RunnerLook } from '../gfx/runner';
import { ceremonyPodium, medalTable, type CompetitionState, type PodiumGroup } from '../sim/competition';

const PODIUM_BASE = 296;
const STEP_H: Record<number, number> = { 1: 46, 2: 36, 3: 28 };
const MAST_TOP: Record<number, number> = { 1: 48, 2: 66, 3: 80 };
/** Die Masten stehen auf dem Geländer über den Rängen – so laufen sie nie durch Köpfe oder Hände */
const MAST_BOTTOM = NIGHT.standsY + 1;
/** Oberkante der Flaggen vor dem Hissen (gleich sichtbar, damit man die Nationen sofort erkennt) */
const HOIST_FROM = MAST_BOTTOM - FLAG_H - 4;
/** Abstand der Athleten auf einer geteilten Stufe – breiter als Mast und Flagge (32 px) */
const ATHLETE_GAP = 34;
/** Versatz von der Athletenposition zum Mast, damit die Flagge mittig über dem Athleten hängt */
const MAST_OFFSET = -6 - 3 - FLAG_W / 2;
const TOWERS = [
  { x: 26, top: 42 },
  { x: GAME_WIDTH - 26, top: 42 },
];
/** Konfettikanonen: Mindestabstand von der Bildmitte und Abstand zur äußeren Podestkante */
const CANNON_MIN_DX = 150;
const CANNON_GAP = 18;
/** Suchscheinwerfer hinter den Rängen: Fußpunkt, Phase, Grundneigung */
const SEARCHLIGHTS = [
  { x: 170, phase: 0, bias: -0.15 },
  { x: 470, phase: 2.1, bias: 0.15 },
];
const ROCKET_START_Y = 180;
/** Fester Zeitschritt für Feuerwerk, Konfetti und Publikum – unabhängig von der Bildrate */
const STEP = 1 / 60;
/** Tasten erst nach dieser Zeit annehmen (ein doppeltes ENTER soll die Feier nicht überspringen) */
const INPUT_LOCK_MS = 800;
const TROPHY_KEY = 'ceremonyTrophy';
/** Streifen je Flagge zum Wehen */
const SLICE = 2;

const TIMING = {
  /** Beginn der Siegermelodie und des Fahnenhissens */
  anthemAt: 1.0,
  /** Ohne Medaillen gibt es keine Siegermelodie – das Finale kommt dann nach dieser Zeit */
  quietFinale: 4,
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
  trophy: Phaser.GameObjects.Image | null;
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
  private state: CompetitionState | null = null;
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
  /** Konfettikanonen links und rechts vom Podest, Rohr zur Mitte geneigt */
  private cannons: { x: number; dir: number }[] = [];
  private anthemLength = 0;
  private anthemStarted = false;
  private finaleAt = Infinity;
  private acc = 0;
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
    this.state = null;
    this.youTag = null;
    this.cannons = [];
    this.anthemLength = 0;
    this.anthemStarted = false;
    this.finaleAt = Infinity;
    this.acc = 0;
    this.finaleDone = false;
    this.nextRocket = 0.4;
    this.nextSalvo = 0;
    this.salvoLeft = 0;
    this.lastBang = 0;
    this.crowdTimer = 0;
    this.crowdFrame = 0;
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
    // Ohne Medaille keine Siegermelodie: nur Feuerwerk und Publikum
    if (this.podium.length === 0) this.finaleAt = TIMING.anthemAt + TIMING.quietFinale;
    createNightTextures(this);
    createTrophyTexture(this, TROPHY_KEY);

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
      if (ev.repeat || this.leaving) return;
      if (ev.code === 'KeyM') {
        sfx.toggleMute();
        return;
      }
      // Tasten aus dem Endstand und ein schnelles zweites ENTER nicht übernehmen
      const at = ev.timeStamp > 0 ? ev.timeStamp : performance.now();
      if (at < createdAt + INPUT_LOCK_MS) return;
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space' || ev.code === 'Escape') {
        this.leaving = true;
        sfx.stopAll();
        sfx.confirm();
        endCompetition();
        this.scene.start('title');
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

  private get competition(): CompetitionState {
    if (!this.state) throw new Error('Abschlussfeier ohne Wettkampf');
    return this.state;
  }

  private playerCode(): string {
    return this.competition.field.find((f) => f.isPlayer)!.code;
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
    const width = (n: number) => Math.max(64, n * ATHLETE_GAP + 16);
    const group = (rank: number) => this.podium.find((p) => p.rank === rank);
    const center = group(1);
    // Kanonen außerhalb des Podests – auch ohne Podest (nur Feuerwerk) stehen sie da
    let left = GAME_WIDTH / 2 - CANNON_MIN_DX + CANNON_GAP;
    let right = GAME_WIDTH / 2 + CANNON_MIN_DX - CANNON_GAP;
    const placeCannons = () => {
      this.cannons = [
        { x: Math.round(left - CANNON_GAP), dir: 1 },
        { x: Math.round(right + CANNON_GAP), dir: -1 },
      ];
      for (const c of this.cannons) drawConfettiCannon(g, c.x, PODIUM_BASE, c.dir);
    };
    if (!center) {
      placeCannons();
      return;
    }
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
    const field = this.competition.field;
    const lookNo = new Map(field.map((f, i) => [f.code, i + 1]));
    for (const { group: grp, cx } of slots) {
      if (!grp) continue;
      const h = STEP_H[grp.rank] ?? 28;
      left = Math.min(left, cx - width(grp.codes.length) / 2);
      right = Math.max(right, cx + width(grp.codes.length) / 2);
      drawPodiumStep(g, cx, PODIUM_BASE, width(grp.codes.length), h, grp.rank);
      this.add
        .text(cx + 1, PODIUM_BASE - h + 7, String(grp.rank), { fontFamily: FONT, fontSize: '16px', color: '#10101c' })
        .setOrigin(0.5, 0)
        .setDepth(-8);
      grp.codes.forEach((code, i) => {
        const entry = field.find((f) => f.code === code)!;
        const country = countryByCode(code);
        const x = Math.round(cx + (i - (grp.codes.length - 1) / 2) * ATHLETE_GAP);
        this.athletes.push({
          code,
          rank: grp.rank,
          x,
          base: PODIUM_BASE - h - 2,
          look: createLook(country, entry.lookSeed, lookNo.get(code) ?? 1),
          isPlayer: code === me,
          phase: this.athletes.length * 0.9,
          trophy: grp.rank === 1 ? this.add.image(0, 0, TROPHY_KEY).setOrigin(0).setDepth(-6.5) : null,
        });
        this.addMast(code, grp.rank, x + MAST_OFFSET);
      });
    }

    placeCannons();
    if (this.athletes.some((a) => a.isPlayer)) {
      this.youTag = this.text(0, 0, 'DU', 8, '#f7d038').setOrigin(0.5, 0);
    }
  }

  /** Mast über „seinem“ Athleten; die Flagge weht in schmalen Streifen */
  private addMast(code: string, rank: number, mastX: number): void {
    const x = Math.round(mastX);
    const key = `ceremonyFlag-${code}`;
    createFlagTexture(this, key, countryByCode(code).flag);
    const slices: Phaser.GameObjects.Image[] = [];
    for (let s = 0; s < FLAG_W / SLICE; s++) {
      slices.push(
        this.add
          .image(x + 3, HOIST_FROM, key)
          .setOrigin(0)
          .setCrop(s * SLICE, 0, SLICE, FLAG_H)
          .setDepth(-11),
      );
    }
    this.masts.push({ rank, x, top: MAST_TOP[rank] ?? 80, slices });
  }

  private buildTexts(): void {
    const winners = this.podium.find((p) => p.rank === 1)?.codes ?? [];
    this.text(GAME_WIDTH / 2, 10, 'ABSCHLUSSFEIER', 16, '#f7d038').setOrigin(0.5, 0);
    if (winners.length === 0) {
      this.text(GAME_WIDTH / 2, 236, 'DIE SPIELE SIND BEENDET', 16, '#ffffff').setOrigin(0.5, 0);
    } else {
      this.text(GAME_WIDTH / 2, 32, `GESAMTSIEGER: ${winnersLabel(winners)}`, 8, '#f7c843').setOrigin(0.5, 0);
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
    const rank = medalTable(this.competition).find((r) => r.code === me)?.rank ?? 4;
    return `PLATZ ${rank} FÜR ${name} – AUF EIN NEUES!`;
  }

  // ------------------------------------------------------------ Ablauf

  private launch(big = false): boolean {
    const ok = this.fireworks.launchRandom(ROCKET_START_Y, big);
    if (ok) sfx.fireworkLaunch();
    return ok;
  }

  /** Ein fester Zeitschritt des Ablaufs: Melodie, Finale, Raketen */
  private timeline(dt: number): void {
    const t = this.elapsed;
    if (!this.anthemStarted && this.podium.length > 0 && t >= TIMING.anthemAt) {
      this.anthemStarted = true;
      this.anthemLength = sfx.victoryTheme();
      this.finaleAt = t + this.anthemLength;
      sfx.crowd(0.35);
    }
    if (!this.finaleDone && t >= this.finaleAt) {
      this.finaleDone = true;
      this.salvoLeft = 7;
      this.nextRocket = 0;
      this.nextSalvo = t + TIMING.salvoEvery;
      this.confetti.shoot(this.cannons.map((c) => ({ x: c.x + c.dir * 5, y: PODIUM_BASE - 16, dir: c.dir })));
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
        // Nur gestartete Raketen zählen; die letzte der Salve knallt groß
        if (this.launch(this.salvoLeft === 1)) this.salvoLeft--;
        this.nextRocket = this.salvoLeft > 0 ? 0.18 : 0.8;
      } else {
        this.launch();
        this.nextRocket = this.finaleDone ? 0.6 + Math.random() * 0.8 : 1.2 + Math.random() * 0.9;
      }
    }
    const bang = this.fireworks.update(dt);
    if (bang === 2 || (bang === 1 && t - this.lastBang > 0.12)) {
      this.lastBang = t;
      sfx.fireworkBang(bang === 2);
    }
    this.confetti.update(dt);
    this.crowdLights.update(dt);

    // Publikum wechselt die Jubel-Bilder
    this.crowdTimer += dt;
    if (this.crowdTimer >= (this.finaleDone ? 0.14 : 0.3)) {
      this.crowdTimer = 0;
      this.crowdFrame = 1 - this.crowdFrame;
      this.stands.setTexture(`stands${this.crowdFrame}`);
    }
  }

  /** Fahne: 0 unten, 1 oben – gehisst wird während der Siegermelodie */
  private hoist(): number {
    if (!this.anthemStarted) return 0;
    const p = (this.elapsed - TIMING.anthemAt - 0.3) / (this.anthemLength - 0.6);
    const c = Math.max(0, Math.min(1, p));
    return c < 0.92 ? c : 0.92 + (1 - Math.pow(1 - (c - 0.92) / 0.08, 2)) * 0.08;
  }

  update(_time: number, deltaMs: number): void {
    if (!this.state) return;
    // Fester Zeitschritt; nach einem Hänger höchstens 8 Schritte nachholen
    this.acc = Math.min(this.acc + deltaMs / 1000, 8 * STEP);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.elapsed += STEP;
      this.timeline(STEP);
    }
    const t = this.elapsed;

    const { beams, sky, crowd, masts, cones, athletes, front } = this.gfx;
    // Suchscheinwerfer hinter den Rängen schwenken über den Himmel
    beams.clear();
    for (const sl of SEARCHLIGHTS) {
      const a = Math.sin(t * 0.45 + sl.phase) * 0.55 + sl.bias;
      const y0 = NIGHT.standsY + 6;
      drawLightCone(beams, sl.x, y0, sl.x + Math.sin(a) * 150, y0 - Math.cos(a) * 150, 12, 0x9fc0ff, 0.06);
    }

    sky.clear();
    this.fireworks.draw(sky, NIGHT.standsY);

    crowd.clear();
    this.crowdLights.draw(crowd);

    // Fahnen hissen und wehen lassen
    masts.clear();
    const h = this.hoist();
    for (const m of this.masts) {
      const flagTop = Math.round(HOIST_FROM - (HOIST_FROM - (m.top + 2)) * h);
      drawFlagpole(masts, m.x, m.top, MAST_BOTTOM, flagTop);
      const n = m.slices.length;
      for (let s = 0; s < n; s++) {
        const wave = t * 4.2 - s * 0.5 + m.x * 0.05;
        const amp = (s / (n - 1)) * 2.2;
        const img = m.slices[s];
        img.y = flagTop + Math.round(Math.sin(wave) * amp);
        // Licht von oben links: abfallende Falten dunkler
        const v = Math.round(255 * (0.86 + 0.14 * Math.cos(wave)));
        img.setTint((v << 16) | (v << 8) | v);
      }
    }

    // Flutlicht auf das Podest
    cones.clear();
    if (this.athletes.length > 0) {
      for (let i = 0; i < TOWERS.length; i++) {
        const tw = TOWERS[i];
        const sway = Math.sin(t * 0.7 + i * 1.7) * 14;
        drawLightCone(cones, tw.x, tw.top, GAME_WIDTH / 2 + sway, PODIUM_BASE - 30, 58, 0xfff0c0, 0.07);
      }
      cones.fillStyle(0xfff0c0, 0.08);
      cones.fillEllipse(GAME_WIDTH / 2, PODIUM_BASE + 1, 300, 18);
    }
    for (const tw of TOWERS) drawLampGlow(cones, tw.x, tw.top, Math.sin(t * 3));

    // Athleten (Pokal als Image, das Funkeln liegt mit dem Konfetti davor)
    athletes.clear();
    front.clear();
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
      if (a.trophy) {
        const hand = handOffset(pose);
        const x0 = Math.round(a.x - 6 + hand.x) - 7;
        const y0 = Math.round(a.base - pose.hip - lift + hand.y + 1) - TROPHY_SIZE;
        a.trophy.setPosition(x0, y0);
        drawTrophySparkle(front, x0, y0, at);
        top = y0;
      }
      if (a.isPlayer) {
        tagX = a.x - 4;
        tagY = Math.round(top - 14 + Math.sin(t * 5) * 1.5);
      }
    }
    this.youTag?.setPosition(tagX, tagY);

    this.confetti.draw(front);
  }
}
