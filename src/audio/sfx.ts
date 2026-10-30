// Chiptune-Soundeffekte, komplett per Web Audio synthetisiert.

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private crowdGain: GainNode | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
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
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
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
    osc.connect(gain).connect(this.master);
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
    src.connect(filter).connect(gain).connect(this.master);
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
      this.crowdSource.connect(band).connect(this.crowdGain).connect(this.master);
      this.crowdSource.start();
    }
    this.crowdGain!.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.3);
  }
}

export const sfx = new Sfx();
