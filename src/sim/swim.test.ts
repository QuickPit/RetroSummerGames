import { describe, expect, it } from 'vitest';
import {
  SWIM,
  SWIM_CPU_PROFILES,
  breathe,
  createSwimmer,
  dive,
  flipTurn,
  heading,
  idealTurnDistance,
  poolX,
  simulateRace,
  step,
  stroke,
  toWall,
  type SwimCpuProfile,
  type SwimEvent,
  type SwimmerState,
} from './swim';

const DT = 1 / 120;

/** Läuft bis zum Zeitpunkt `until` und sammelt die Ereignisse. */
function run(s: SwimmerState, from: number, until: number): { t: number; events: SwimEvent[] } {
  const events: SwimEvent[] = [];
  let t = from;
  while (t + DT <= until + 1e-9) {
    t += DT;
    events.push(...step(s, DT, t));
  }
  return { t, events };
}

/** Schwimmer nach Startsprung und Eintauchen, Zeit t zurück */
function inWater(): { s: SwimmerState; t: number } {
  const s = createSwimmer();
  dive(s, 0);
  const { t } = run(s, 0, SWIM.diveFlight + DT);
  expect(s.phase).toBe('swim');
  return { s, t };
}

/** Spieler-Modell über dieselben Eingaben wie die Computer-Gegner */
function model(tapRate: number, tapJitter: number, extra: Partial<SwimCpuProfile> = {}): SwimCpuProfile {
  return { name: `${tapRate}/s`, tapRate, tapJitter, reaction: 0.3, turnError: 0.35, breathAt: 0.25, ...extra };
}

function average(profile: SwimCpuProfile, runs: number, seed = 1): { avg: number; max: number; min: number } {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) times.push(simulateRace(profile, seed + i).finishTime ?? Infinity);
  return { avg: times.reduce((a, b) => a + b, 0) / runs, max: Math.max(...times), min: Math.min(...times) };
}

describe('Start', () => {
  it('springt mit der Reaktionszeit ab und taucht bei 4 m ein', () => {
    const s = createSwimmer();
    expect(dive(s, 0.21)).toBe(true);
    expect(dive(s, 0.3)).toBe(false);
    expect(s.reaction).toBeCloseTo(0.21);
    const { events } = run(s, 0, 0.21 + SWIM.diveFlight + DT);
    expect(events.some((e) => e.type === 'entry')).toBe(true);
    expect(s.d).toBeGreaterThanOrEqual(SWIM.diveDistance);
    expect(s.v).toBeGreaterThan(2.9);
  });

  it('springt nach 3 s von selbst', () => {
    const s = createSwimmer();
    const { events } = run(s, 0, SWIM.autoDiveAfter + DT);
    expect(events).toContainEqual({ type: 'dive', auto: true });
    expect(s.reaction).toBe(SWIM.autoDiveAfter);
  });

  it('wertet keine Züge auf dem Block und im Flug', () => {
    const s = createSwimmer();
    expect(stroke(s, 'L', 0.1)).toBeNull();
    dive(s, 0.2);
    expect(stroke(s, 'R', 0.3)).toBeNull();
    expect(s.strokes).toBe(0);
  });
});

describe('Armzug', () => {
  it('zählt nur abwechselnde Tipps', () => {
    const { s, t } = inWater();
    expect(stroke(s, 'L', t)).toBe('full');
    expect(stroke(s, 'L', t + 0.1)).toBeNull();
    expect(stroke(s, 'R', t + 0.1)).toBe('full');
    expect(s.strokes).toBe(2);
  });

  it('gibt ab 0,19 s Armzyklus die volle Wirkung', () => {
    const { s, t } = inWater();
    s.v = 1.5;
    stroke(s, 'L', t);
    expect(s.v).toBeCloseTo(1.5 + SWIM.strokeImpulse);
    stroke(s, 'R', t + 0.1);
    s.v = 1.5;
    expect(stroke(s, 'L', t + 0.191)).toBe('full');
    expect(s.v).toBeCloseTo(1.5 + SWIM.strokeImpulse);
  });

  it('wirkt zwischen 0,13 und 0,19 s anteilig', () => {
    const { s, t } = inWater();
    stroke(s, 'L', t);
    stroke(s, 'R', t + 0.08);
    s.v = 1.5;
    expect(stroke(s, 'L', t + 0.16)).toBe('hasty');
    // Mitte der Zone: Faktor (1 + 0,35) / 2
    expect(s.v - 1.5).toBeCloseTo(SWIM.strokeImpulse * (1 + SWIM.hastyFactor) / 2, 5);
    expect(s.inTakt).toBe(2);
  });

  it('verschluckt sich unter 0,13 s: Tempo, Luft und Husten', () => {
    const { s, t } = inWater();
    stroke(s, 'L', t);
    stroke(s, 'R', t + 0.06);
    s.v = 2;
    const air = s.air;
    expect(stroke(s, 'L', t + 0.12)).toBe('choke');
    expect(s.v).toBeCloseTo(2 * SWIM.chokeSpeedFactor);
    expect(s.air).toBeCloseTo(air - SWIM.chokeAir);
    expect(s.chokes).toBe(1);
    // Husten: keine Züge, aber die Seite wird gemerkt
    expect(stroke(s, 'R', t + 0.3)).toBeNull();
    expect(stroke(s, 'R', t + 0.35)).toBeNull();
    expect(s.lastSide).toBe('R');
    const { events } = run(s, t, t + SWIM.chokeStun + DT);
    expect(events).toContainEqual({ type: 'choke' });
    expect(s.stun).toBe(0);
    expect(stroke(s, 'L', t + 0.7)).toBe('full');
  });

  it('kann sich innerhalb der Sperrzeit nicht ein zweites Mal verschlucken', () => {
    const { s, t } = inWater();
    stroke(s, 'L', t);
    stroke(s, 'R', t + 0.05);
    expect(stroke(s, 'L', t + 0.1)).toBe('choke');
    let now = run(s, t, t + 0.6).t;
    // Hämmern bis knapp vor Ablauf der Sperrzeit: höchstens hektische Züge
    let side: 'L' | 'R' = 'R';
    while (now < t + 0.1 + SWIM.chokeCooldown - 0.1) {
      expect(stroke(s, side, now)).not.toBe('choke');
      side = side === 'L' ? 'R' : 'L';
      now = run(s, now, now + 0.05).t;
    }
    expect(s.chokes).toBe(1);
    now = run(s, now, t + 0.1 + SWIM.chokeCooldown + 0.05).t;
    const other = side === 'L' ? 'R' : 'L';
    stroke(s, side, now);
    stroke(s, other, now + 0.05);
    expect(stroke(s, side, now + 0.1)).toBe('choke');
    expect(s.chokes).toBe(2);
  });

  it('verzeiht „hinkendes“ Tippen (70/130 ms)', () => {
    const { s, t } = inWater();
    let now = t;
    let side: 'L' | 'R' = 'L';
    for (let i = 0; i < 80; i++) {
      stroke(s, side, now);
      side = side === 'L' ? 'R' : 'L';
      now = run(s, now, now + (i % 2 === 0 ? 0.07 : 0.13)).t;
      if (s.air < 0.3) breathe(s);
    }
    expect(s.chokes).toBe(0);
    expect(s.inTakt).toBe(s.strokes);
    expect(s.strokes).toBe(80);
  });
});

describe('Luft', () => {
  it('sinkt mit jedem Zug und warnt einmal unter 25 %', () => {
    const { s, t } = inWater();
    stroke(s, 'L', t);
    expect(s.air).toBeCloseTo(1 - SWIM.airPerStroke);
    s.air = 0.255;
    stroke(s, 'R', t + 0.2);
    const { events } = run(s, t + 0.2, t + 0.3);
    stroke(s, 'L', t + 0.4);
    const later = run(s, t + 0.4, t + 0.5).events;
    expect(events.filter((e) => e.type === 'lowAir')).toHaveLength(1);
    expect(later.filter((e) => e.type === 'lowAir')).toHaveLength(0);
  });

  it('füllt sich beim Atmen nach 0,4 s und kostet 10 % Tempo', () => {
    const { s, t } = inWater();
    s.air = 0.3;
    s.v = 2;
    expect(breathe(s)).toBe(true);
    expect(s.v).toBeCloseTo(1.8);
    expect(breathe(s)).toBe(false);
    run(s, t, t + 0.3);
    expect(s.air).toBeCloseTo(0.3);
    run(s, t + 0.3, t + SWIM.breathTime + DT);
    expect(s.air).toBe(1);
    expect(s.breaths).toBe(1);
    expect(s.earlyBreaths).toBe(0);
  });

  it('zählt Atmen bei über 60 % Luft als früh', () => {
    const { s } = inWater();
    breathe(s);
    expect(s.earlyBreaths).toBe(1);
  });

  it('schnappt bei leerer Luft automatisch nach Luft', () => {
    const { s, t } = inWater();
    s.air = SWIM.airPerStroke;
    s.v = 2;
    stroke(s, 'L', t);
    expect(s.gasps).toBe(1);
    expect(s.v).toBeCloseTo((2 + SWIM.strokeImpulse) * SWIM.gaspSpeedFactor);
    expect(s.air).toBe(1);
    expect(s.stun).toBeCloseTo(SWIM.gaspStun);
    expect(stroke(s, 'R', t + 0.3)).toBeNull();
    const { events } = run(s, t, t + SWIM.gaspStun + DT);
    expect(events).toContainEqual({ type: 'gasp' });
    expect(stroke(s, 'L', t + 0.9)).toBe('full');
  });
});

describe('Wende', () => {
  /** Schwimmer kurz vor der Wendewand mit Tempo v */
  function nearWall(w: number, v = 2): { s: SwimmerState; t: number } {
    const { s, t } = inWater();
    s.d = SWIM.poolLength - w;
    s.v = v;
    return { s, t };
  }

  it('wird am Idealabstand perfekt und stößt kräftig ab', () => {
    const { s, t } = nearWall(idealTurnDistance(2) + 0.001);
    expect(flipTurn(s, t)).toBe(true);
    expect(s.turnRating).toBe('perfect');
    const { events } = run(s, t, t + SWIM.flipTime + 2 * DT);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['turn', 'wall', 'push']));
    expect(s.phase).toBe('swim');
    expect(s.v).toBeGreaterThan(SWIM.turnPushMax - 0.05);
    expect(heading(s)).toBe(-1);
    const x = poolX(s);
    run(s, t + 0.5, t + 1.5);
    expect(poolX(s)).toBeLessThan(x);
    expect(toWall(s)).toBeCloseTo(poolX(s));
  });

  it('bewertet zu früh und zu spät', () => {
    let { s, t } = nearWall(2.5);
    flipTurn(s, t);
    expect(s.turnRating).toBe('early');
    ({ s, t } = nearWall(0.05));
    flipTurn(s, t);
    expect(s.turnRating).toBe('late');
    ({ s, t } = nearWall(idealTurnDistance(2) + 0.4));
    flipTurn(s, t);
    expect(s.turnRating).toBe('good');
  });

  it('hat weiter als 3 m vor der Wand keine Wirkung', () => {
    const { s, t } = nearWall(3.2);
    expect(flipTurn(s, t)).toBe(false);
    expect(s.phase).toBe('swim');
    expect(s.turnRating).toBeNull();
  });

  it('schlägt ohne Druck an und wartet 1,0 s', () => {
    const { s, t } = nearWall(0.5);
    const first = run(s, t, t + 0.5);
    expect(first.events).toContainEqual({ type: 'turn', rating: 'open' });
    expect(s.phase).toBe('open');
    expect(s.v).toBe(0);
    const touchAt = s.flipAt!;
    const waiting = run(s, first.t, touchAt + SWIM.openTurnDelay - 0.02);
    expect(waiting.events.some((e) => e.type === 'push')).toBe(false);
    const pushed = run(s, waiting.t, touchAt + SWIM.openTurnDelay + 0.02);
    expect(pushed.events).toContainEqual({ type: 'push' });
    expect(s.v).toBeCloseTo(SWIM.turnPushMin, 1);
  });

  it('wirkt auf der Rückbahn nicht noch einmal', () => {
    const { s, t } = nearWall(1);
    flipTurn(s, t);
    run(s, t, t + 1);
    s.d = SWIM.distance - 1;
    expect(flipTurn(s, t + 1)).toBe(false);
  });
});

describe('Ziel', () => {
  it('interpoliert die Zielzeit innerhalb des Schritts', () => {
    const { s } = inWater();
    s.turned = true;
    s.d = SWIM.distance - 0.01;
    s.v = 2;
    const events = step(s, DT, 40);
    const finish = events.find((e) => e.type === 'finish');
    expect(finish).toBeDefined();
    expect(s.finishTime).toBeGreaterThan(40 - DT);
    expect(s.finishTime).toBeLessThan(40);
    // Ohne Interpolation wäre es das Schrittende
    expect(s.finishTime! - (40 - DT)).toBeCloseTo(0.01 / s.v, 4);
    expect(s.d).toBe(SWIM.distance);
    expect(stroke(s, 'L', 40.1)).toBeNull();
  });
});

describe('Computer-Gegner und Balancing', () => {
  it('sind streng geordnet und schwimmen realistische Zeiten (je 40 Läufe)', () => {
    const [rookie, profi, champion] = SWIM_CPU_PROFILES.map((p) => average(p, 40, 100));
    expect(rookie.avg).toBeGreaterThan(53);
    expect(rookie.avg).toBeLessThan(56);
    expect(profi.avg).toBeGreaterThan(49.5);
    expect(profi.avg).toBeLessThan(51.5);
    expect(champion.avg).toBeGreaterThan(47);
    expect(champion.avg).toBeLessThan(48.7);
    expect(rookie.avg).toBeGreaterThan(profi.avg);
    expect(profi.avg).toBeGreaterThan(champion.avg);
    expect(champion.avg).toBeGreaterThan(SWIM.worldRecord);
    expect(rookie.max).toBeLessThan(90);
  });

  it('belohnt ruhiges Tippen: 10/s ist schneller als Hämmern mit 13/s', () => {
    const calm = average(model(10, 0.12), 40, 7);
    const hammer = average(model(13, 0.12), 40, 7);
    expect(calm.avg).toBeLessThan(hammer.avg - 3);
  });

  it('dauert auch für langsame und hämmernde Spieler 46–90 s', () => {
    for (const p of [model(6, 0.25, { reaction: 0.35, turnError: 0.5, breathAt: 0.3 }), model(18, 0.12)]) {
      const { min, max } = average(p, 40, 300);
      expect(min).toBeGreaterThan(46);
      expect(max).toBeLessThan(90);
    }
  });
});

describe('Grenzfälle (QA)', () => {
  it('wertet keine Züge während Rolle, Wand und Anschlag – merkt sich aber die Seite', () => {
    const { s, t } = inWater();
    s.d = SWIM.poolLength - 1;
    s.v = 2;
    stroke(s, 'L', t);
    expect(flipTurn(s, t + 0.2)).toBe(true);
    const strokes = s.strokes;
    expect(stroke(s, 'R', t + 0.25)).toBeNull();
    expect(s.lastSide).toBe('R');
    run(s, t, t + 0.4);
    expect(s.phase === 'wall' || s.phase === 'flip').toBe(true);
    expect(stroke(s, 'L', t + 0.45)).toBeNull();
    expect(s.strokes).toBe(strokes);
    expect(breathe(s)).toBe(false);

    // Anschlagen ohne Rolle: ebenfalls keine Züge
    const o = inWater();
    o.s.d = SWIM.poolLength - 0.05;
    o.s.v = 2;
    run(o.s, o.t, o.t + 0.1);
    expect(o.s.phase).toBe('open');
    expect(stroke(o.s, 'L', o.t + 0.2)).toBeNull();
    expect(flipTurn(o.s, o.t + 0.2)).toBe(false);
    expect(o.s.strokes).toBe(0);
  });

  it('gibt nach dem Abstoß sofort einen vollen Zug (Armzyklen zurückgesetzt)', () => {
    const { s, t } = inWater();
    s.d = SWIM.poolLength - idealTurnDistance(2);
    s.v = 2;
    stroke(s, 'L', t - 0.05);
    flipTurn(s, t);
    const { t: after } = run(s, t, t + SWIM.flipTime + 2 * DT);
    expect(s.phase).toBe('swim');
    expect(s.turned).toBe(true);
    // Unmittelbar nach dem Abstoß: R kommt zuerst (L war zuletzt), dann L – beide voll
    expect(stroke(s, 'R', after)).toBe('full');
    expect(stroke(s, 'L', after + 0.01)).toBe('full');
  });

  it('wirkt genau an der Grenze der Wendezone (3,0 m), nicht im Startsprung', () => {
    const d = createSwimmer();
    dive(d, 0);
    expect(flipTurn(d, 0.1)).toBe(false);
    const { s, t } = inWater();
    s.d = SWIM.poolLength - SWIM.turnZone;
    s.v = 2;
    expect(flipTurn(s, t)).toBe(true);
    expect(s.turnRating).toBe('early');
  });

  it('nimmt nach dem Anschlag im Ziel keine Eingaben mehr an', () => {
    const { s } = inWater();
    s.turned = true;
    s.d = SWIM.distance - 0.01;
    s.v = 2;
    step(s, DT, 40);
    expect(s.finishTime).not.toBeNull();
    const ft = s.finishTime;
    expect(stroke(s, 'R', 40.2)).toBeNull();
    expect(breathe(s)).toBe(false);
    expect(flipTurn(s, 40.2)).toBe(false);
    run(s, 40, 42);
    expect(s.finishTime).toBe(ft);
    expect(s.d).toBe(SWIM.distance);
  });

  it('ist deterministisch: gleiche Eingaben ergeben die gleiche Zeit', () => {
    for (const p of SWIM_CPU_PROFILES) {
      expect(simulateRace(p, 4242).finishTime).toBe(simulateRace(p, 4242).finishTime);
    }
  });

  it('hält Hämmern in jeder Stärke deutlich hinter ruhigen 10/s', () => {
    const calm = average(model(10, 0.1), 10, 11).avg;
    for (const rate of [13, 16, 20, 25, 30, 40]) {
      expect(average(model(rate, 0.1), 10, 11).avg).toBeGreaterThan(calm + 3);
    }
  });
});

describe('Fixrunde nach Review', () => {
  it('schnappt mitten im Atemzug nicht nach Luft', () => {
    const { s, t } = inWater();
    s.air = 0.02;
    expect(breathe(s)).toBe(true);
    let now = t;
    const sides = ['L', 'R', 'L', 'R'] as const;
    for (const side of sides) {
      stroke(s, side, now);
      now = run(s, now, now + 0.08).t;
    }
    expect(s.strokes).toBe(4);
    expect(s.gasps).toBe(0);
    run(s, now, t + SWIM.breathTime + 2 * DT);
    expect(s.breathing).toBe(0);
    expect(s.air).toBe(1);
  });

  it('rechnet den Wandabstand auf den Zeitpunkt des Tastendrucks hoch', () => {
    const { s, t } = inWater();
    s.d = SWIM.poolLength - 1.4;
    s.v = 2;
    // Taste 0,25 s nach dem letzten Schritt: in Wahrheit nur noch 0,9 m vor der Wand = ideal
    expect(flipTurn(s, t + 0.25)).toBe(true);
    expect(s.turnRating).toBe('perfect');
    expect(s.d).toBeCloseTo(SWIM.poolLength - 0.9, 5);
    // Die Rolle beginnt beim Tastendruck: an der Wand genau nach der Rollzeit
    const { events } = run(s, t, t + 0.25 + SWIM.flipTime + 2 * DT);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['wall', 'push']));
    expect(s.v).toBeGreaterThan(SWIM.turnPushMax - 0.05);
  });

  it('wertet einen bei der Wende laufenden Atemzug als vollendet', () => {
    const { s, t } = inWater();
    s.d = SWIM.poolLength - 1;
    s.v = 2;
    s.air = 0.2;
    breathe(s);
    expect(flipTurn(s, t)).toBe(true);
    expect(s.breathing).toBe(0);
    expect(s.air).toBe(1);
  });

  it('bringt in der Sperrzeit umso weniger, je kürzer der Armzyklus', () => {
    const { s, t } = inWater();
    stroke(s, 'L', t);
    stroke(s, 'R', t + 0.03);
    expect(stroke(s, 'L', t + 0.06)).toBe('choke');
    let now = run(s, t, t + SWIM.chokeStun + 0.05).t;
    stroke(s, 'R', now);
    now += 0.06;
    stroke(s, 'L', now);
    s.v = 1;
    // Armzyklus 0,12 s innerhalb der Sperrzeit: anteilig weniger als ein hektischer Zug an der Grenze
    expect(stroke(s, 'R', now + 0.06)).toBe('hasty');
    const short = s.v - 1;
    expect(short).toBeGreaterThan(0);
    expect(short).toBeCloseTo((SWIM.strokeImpulse * SWIM.hastyFactor * 0.12) / SWIM.chokeCycle, 5);
  });

  it('bleibt auch beim Hämmern ohne Atmen unter 90 s', () => {
    for (const p of [model(15, 0.12, { breathAt: -1 }), model(18, 0.12, { breathAt: -1 }), model(25, 0, { breathAt: -1 })]) {
      expect(average(p, 40, 500).max).toBeLessThan(90);
    }
    // Atmen lohnt sich trotzdem deutlich
    expect(average(model(10, 0.12, { breathAt: -1 }), 40, 7).avg).toBeGreaterThan(average(model(10, 0.12), 40, 7).avg + 3);
  });
});
