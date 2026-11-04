// Chiptune-Soundeffekte, komplett per Web Audio synthetisiert.

export type Room = 'open' | 'hall';
/** Anteil, der in den Hall geht */
const ROOM_SEND: Record<Room, number> = { open: 0, hall: 0.45 };

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private crowdGain: GainNode | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  /** Sammelschiene aller Klänge; von hier geht es trocken und über den Hall zum Master */
  private bus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private room: Room = 'open';
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('rsg.muted') === '1';
    } catch {
      // Ohne localStorage bleibt der Ton einfach an.
    }
  }

  /** Muss aus einem Tastatur-/Klick-Ereignis heraus aufgerufen werden. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.bus = this.ctx.createGain();
      this.bus.connect(this.master);
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = ROOM_SEND[this.room];
      const reverb = this.ctx.createConvolver();
      reverb.buffer = this.hallImpulse(1.8);
      this.bus.connect(this.reverbSend).connect(reverb).connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Ziel aller Klänge (nur nach unlock() aufrufen) */
  private get out(): AudioNode {
    return this.bus ?? this.master!;
  }

  /** Raumklang: in der Schwimmhalle hallt alles nach */
  setRoom(room: Room): void {
    this.room = room;
    if (this.reverbSend && this.ctx) this.reverbSend.gain.setTargetAtTime(ROOM_SEND[room], this.ctx.currentTime, 0.05);
  }

  /** Synthetische Impulsantwort: abklingendes Rauschen, Höhen verklingen schneller */
  private hallImpulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Tiefpass, der mit der Zeit dunkler wird
        const k = 0.5 - 0.42 * t;
        low += (Math.random() * 2 - 1 - low) * k;
        data[i] = low * Math.pow(1 - t, 3) * (i < ctx.sampleRate * 0.012 ? 0 : 1);
      }
    }
    return buf;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('rsg.muted', this.muted ? '1' : '0');
    } catch {
      // ignorieren
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  menu(): void {
    this.tone(660, 0.06, 'square', 0.12);
  }

  confirm(): void {
    this.tone(523, 0.07, 'square', 0.12);
    this.tone(784, 0.1, 'square', 0.12, undefined, 0.07);
  }

  /** „Auf die Plätze“ / „Fertig“ */
  call(high: boolean): void {
    this.tone(high ? 880 : 587, 0.18, 'square', 0.14);
  }

  gun(): void {
    this.burst(0.35, 0.9, 3500);
    this.tone(140, 0.25, 'triangle', 0.6, 40);
  }

  falseStart(): void {
    this.tone(220, 0.25, 'sawtooth', 0.18);
    this.tone(220, 0.35, 'sawtooth', 0.18, undefined, 0.3);
  }

  footstep(): void {
    this.burst(0.04, 0.12, 900);
  }

  jump(): void {
    this.tone(300, 0.15, 'square', 0.08, 700);
  }

  hurdleHit(): void {
    this.tone(180, 0.2, 'square', 0.18, 60);
    this.burst(0.18, 0.4, 1800, 'bandpass');
  }

  finish(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.12, undefined, i * 0.09));
  }

  fanfare(): void {
    const notes: [number, number][] = [
      [523, 0.15], [523, 0.15], [523, 0.15], [659, 0.45],
      [587, 0.15], [659, 0.15], [784, 0.7],
    ];
    let t = 0;
    for (const [f, d] of notes) {
      this.tone(f, d * 0.95, 'square', 0.12, undefined, t);
      this.tone(f / 2, d * 0.95, 'triangle', 0.15, undefined, t);
      t += d;
    }
  }

  /** Glitzern der neu blinkenden Medaillen im Spiegel; `step` 0..2 steigt in der Tonhöhe */
  medalShine(step: number): void {
    const base = [1319, 1568, 1976][Math.max(0, Math.min(2, step))];
    this.tone(base, 0.05, 'square', 0.05);
    this.tone(base * 1.5, 0.12, 'triangle', 0.09, undefined, 0.05);
  }

  // ---- Stabhochsprung

  /** Stab rammt in den Einstichkasten */
  plant(): void {
    this.tone(95, 0.18, 'triangle', 0.5, 55);
    this.burst(0.08, 0.35, 700);
  }

  /** Stab biegt sich */
  bend(): void {
    this.tone(110, 0.7, 'sawtooth', 0.04, 260);
  }

  /** Loslassen und Abdrücken */
  release(): void {
    this.burst(0.3, 0.25, 1500, 'bandpass');
    this.tone(420, 0.22, 'square', 0.07, 950);
  }

  barFall(): void {
    this.tone(320, 0.18, 'square', 0.14, 140);
    this.tone(260, 0.15, 'square', 0.1, 120, 0.22);
    this.tone(220, 0.1, 'square', 0.07, 110, 0.38);
  }

  matLand(): void {
    this.burst(0.25, 0.5, 400);
    this.tone(70, 0.2, 'triangle', 0.4, 45);
  }

  /** Enttäuschtes „Ohhh“ */
  missed(): void {
    this.tone(330, 0.6, 'triangle', 0.12, 160);
  }

  /** Kurzer Ton, wenn auf der Anzeigetafel ein Versuch erscheint */
  board(ok: boolean): void {
    if (ok) this.tone(880, 0.09, 'square', 0.08);
    else this.tone(196, 0.14, 'square', 0.08);
  }

  // ---- BMX

  /** Startgatter klappt herunter */
  gate(): void {
    this.tone(160, 0.2, 'square', 0.2, 70);
    this.burst(0.15, 0.4, 2500, 'bandpass');
  }

  takeoff(): void {
    this.burst(0.2, 0.12, 2200, 'bandpass');
  }

  bikeLand(clean: boolean): void {
    this.burst(0.12, 0.35, 500);
    this.tone(clean ? 110 : 80, 0.12, 'triangle', 0.3, 60);
  }

  crash(): void {
    this.burst(0.4, 0.6, 900);
    this.tone(200, 0.3, 'square', 0.15, 50);
    this.tone(500, 0.08, 'square', 0.08, 300, 0.12);
  }

  splash(): void {
    this.burst(0.35, 0.35, 3000, 'highpass');
  }

  /** Trick gestanden – je mehr Punkte, desto höher der Ton */
  trick(points: number): void {
    const base = Math.min(1200, 520 + points / 4);
    this.tone(base, 0.08, 'square', 0.1);
    this.tone(base * 1.5, 0.14, 'square', 0.1, undefined, 0.08);
  }

  // ---- Weitsprung

  /** Fuß trifft das Absprungbrett */
  boardHit(): void {
    this.tone(130, 0.12, 'triangle', 0.45, 70);
    this.burst(0.06, 0.3, 1200);
  }

  sandLand(): void {
    this.burst(0.4, 0.45, 700);
    this.tone(65, 0.18, 'triangle', 0.3, 40);
  }

  /** Kampfrichter hebt die Fahne */
  flag(valid: boolean): void {
    if (valid) {
      this.tone(988, 0.08, 'square', 0.08);
      this.tone(1319, 0.12, 'square', 0.08, undefined, 0.09);
    } else {
      this.falseStart();
    }
  }

  // ---- Schwimmen

  /** Langer Pfiff des Kampfrichters: Vibrato und das Schnarren der Kugel in der Pfeife */
  whistle(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    const trill = this.ctx.createOscillator();
    const trillDepth = this.ctx.createGain();
    const trem = this.ctx.createGain();
    const soft = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 2800;
    lfo.frequency.value = 28;
    depth.gain.value = 90;
    lfo.connect(depth).connect(osc.frequency);
    // Schnarren: Lautstärke flattert schnell
    trill.type = 'triangle';
    trill.frequency.value = 34;
    trem.gain.value = 0.7;
    trillDepth.gain.value = 0.3;
    trill.connect(trillDepth).connect(trem.gain);
    // Obertöne etwas zähmen, damit der Pfiff nicht sticht
    soft.type = 'lowpass';
    soft.frequency.value = 4200;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
    gain.gain.setValueAtTime(0.07, t + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    osc.connect(soft).connect(trem).connect(gain).connect(this.out);
    for (const o of [osc, lfo, trill]) {
      o.start(t);
      o.stop(t + 0.9);
    }
  }

  /** Elektronisches Startsignal */
  startBeep(): void {
    this.tone(880, 0.25, 'square', 0.16);
  }

  /** Eintauchen nach dem Startsprung */
  plunge(): void {
    this.burst(0.45, 0.55, 900);
    this.tone(180, 0.25, 'triangle', 0.25, 70);
  }

  /** Leiser Wasserschlag eines Armzugs, links und rechts leicht verschieden */
  stroke(side: 'L' | 'R'): void {
    this.burst(0.07, 0.13, side === 'L' ? 1500 : 1800, 'bandpass');
    // Weiches „Plopp“ der eintauchenden Hand
    this.tone(side === 'L' ? 240 : 270, 0.05, 'triangle', 0.05, 140);
  }

  /** Husten nach dem Verschlucken */
  choke(): void {
    this.burst(0.12, 0.35, 1100, 'bandpass');
    this.burst(0.12, 0.3, 900, 'bandpass', 0.18);
    this.tone(160, 0.1, 'square', 0.06, 110, 0.02);
  }

  /** Einatmen: steigendes Rauschen */
  breath(): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(filter).connect(gain).connect(this.out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.4);
  }

  /** Warnung: Luft wird knapp */
  lowAir(): void {
    this.tone(1175, 0.07, 'square', 0.08);
    this.tone(1175, 0.07, 'square', 0.08, undefined, 0.12);
  }

  /** Luftschnappen */
  gasp(): void {
    this.burst(0.25, 0.3, 2000, 'bandpass');
    this.tone(500, 0.2, 'triangle', 0.12, 900);
  }

  /** Rollwende: Blubbern mit Stoß an der Wand */
  flip(): void {
    [700, 560, 450, 360].forEach((f, i) => this.tone(f, 0.05, 'square', 0.06, f * 0.8, i * 0.06));
    this.burst(0.2, 0.3, 700, 'lowpass', 0.3);
    this.tone(90, 0.15, 'triangle', 0.3, 50, 0.32);
  }

  /** Anschlagplatte im Ziel */
  touch(): void {
    this.tone(1568, 0.12, 'square', 0.1);
  }

  /** Publikumsrauschen; `level` 0..1 */
  crowd(level: number): void {
    if (!this.ctx || !this.master || !this.noise) return;
    if (!this.crowdSource) {
      this.crowdSource = this.ctx.createBufferSource();
      this.crowdSource.buffer = this.noise;
      this.crowdSource.loop = true;
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 900;
      band.Q.value = 0.6;
      this.crowdGain = this.ctx.createGain();
      this.crowdGain.gain.value = 0;
      this.crowdSource.connect(band).connect(this.crowdGain).connect(this.out);
      this.crowdSource.start();
    }
    this.crowdGain!.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.3);
  }
}

export const sfx = new Sfx();
