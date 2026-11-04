import { describe, expect, it } from 'vitest';
import { createRng } from './cpu';
import {
  DIVE,
  DIVES,
  DIVE_CPU_PROFILES,
  cpuDiveRate,
  createDive,
  createDiver,
  diveById,
  diverTotal,
  flightTime,
  judge,
  minPower,
  nextDive,
  rankDivers,
  runCpuDive,
  setHold,
  simulateCpuDive,
  spinSpeed,
  stepDive,
  swingTap,
  takeoff,
  targetRot,
  timeToPeak,
  twist,
  usedDives,
  type DiveCpuProfile,
  type DiveDef,
  type DiveEvent,
  type DiveId,
  type DiveState,
  type EntryRating,
} from './dive';

const DT = 1 / 120;

function toReady(def: DiveDef): DiveState {
  const s = createDive(def);
  while (s.phase === 'walk') stepDive(s, DT);
  return s;
}

/** Tippt gleichmäßig abwechselnd bis `until` – Eingaben mit Zeitstempel vor jedem Schritt, wie in der Szene. */
function tapUntil(s: DiveState, rate: number, until: number, events: DiveEvent[] = []): void {
  let next = s.time;
  let side: 'L' | 'R' = s.lastSide === 'L' ? 'R' : 'L';
  while (s.time < until - 1e-9) {
    const end = Math.min(until, s.time + DT);
    while (next < end) {
      swingTap(s, side, next);
      side = side === 'L' ? 'R' : 'L';
      next += 1 / rate;
    }
    events.push(...stepDive(s, end - s.time));
  }
}

interface JumpPlan {
  rate?: number;
  swingTime?: number;
  /** Absprung so weit nach (+) bzw. vor (−) dem Hochpunkt */
  offset?: number;
}

/** Schwung holen und am (nächsten) Hochpunkt + offset abspringen */
function jumpOff(def: DiveDef, { rate = 11, swingTime = 3, offset = 0 }: JumpPlan = {}): DiveState {
  const s = toReady(def);
  tapUntil(s, rate, s.time + swingTime);
  let peak = s.time + timeToPeak(s)!;
  if (peak + offset < s.time + 0.01) peak += DIVE.swingPeriod;
  tapUntil(s, rate, peak + offset);
  expect(takeoff(s, peak + offset)).toBe(true);
  return s;
}

/** Fliegt bis zum Auftauchen; öffnet `release` s nach dem Absprung (null = nie). */
function fly(s: DiveState, release: number | null, events: DiveEvent[] = []): DiveState {
  const at = release === null ? null : s.takeoffAt! + release;
  while (s.phase !== 'done') {
    if (at !== null && s.held && at < s.time + DT) setHold(s, false, Math.max(at, s.time));
    events.push(...stepDive(s, DT));
  }
  return s;
}

/** Öffnet so, dass rot das Ziel − lead erreicht hätte */
function releaseFor(s: DiveState, lead = 15): number {
  return (targetRot(s.def) - lead) / spinSpeed(s.def, s.power);
}

/** Konstruierter Fall: kurz vor dem Eintauchen offen mit der Abweichung δ */
function entryWith(id: DiveId, delta: number, held = false): DiveState {
  const s = jumpOff(diveById(id));
  if (!held) setHold(s, false);
  const entry = s.takeoffAt! + flightTime(s.power);
  while (s.time + DT < entry) stepDive(s, DT);
  s.rot = targetRot(s.def) + delta;
  if (!held) s.openAt = s.takeoffAt;
  while (s.phase === 'air') stepDive(s, DT);
  return s;
}

describe('Schwung am Turm', () => {
  it('zählt nur abwechselnde Tipps', () => {
    const s = toReady(diveById('25h'));
    expect(swingTap(s, 'L')).toBe(true);
    expect(s.phase).toBe('swing');
    expect(swingTap(s, 'L')).toBe(false);
    expect(swingTap(s, 'R')).toBe(true);
    expect(s.raw).toBeCloseTo(2 * DIVE.swingImpulse, 6);
  });

  it('ignoriert Tipps beim Gang an die Kante', () => {
    const s = createDive(diveById('25h'));
    expect(swingTap(s, 'L')).toBe(false);
    expect(s.phase).toBe('walk');
  });

  it('ergibt mit 8/s einen Schwung von 0,68–0,74 und mit 11/s mindestens 0,95', () => {
    const at = (rate: number) => {
      const s = toReady(diveById('25h'));
      tapUntil(s, rate, s.time + 3);
      return s.swing;
    };
    expect(at(8)).toBeGreaterThanOrEqual(0.68);
    expect(at(8)).toBeLessThanOrEqual(0.74);
    expect(at(11)).toBeGreaterThanOrEqual(0.95);
    expect(at(14)).toBe(1);
  });

  it('springt mit der Leertaste vor dem ersten Tipp nicht ab', () => {
    const s = toReady(diveById('25h'));
    expect(takeoff(s)).toBe(false);
    expect(s.phase).toBe('ready');
    stepDive(s, 1);
    expect(s.phase).toBe('ready');
  });

  it('meldet die Hochpunkte zur selben Sim-Zeit wie timeToPeak', () => {
    const s = toReady(diveById('25h'));
    const t0 = s.time;
    let peaks = 0;
    let next = s.time;
    let side: 'L' | 'R' = 'L';
    while (s.time < t0 + 3.3) {
      while (next < s.time + DT) {
        swingTap(s, side, next);
        side = side === 'L' ? 'R' : 'L';
        next += 0.1;
      }
      const before = timeToPeak(s);
      const events = stepDive(s, DT);
      if (events.some((e) => e.type === 'peak')) {
        peaks++;
        // Der Hochpunkt liegt in genau diesem Schritt
        expect(before === null || before >= -1e-9).toBe(true);
        expect(timeToPeak(s)!).toBeLessThanOrEqual(1e-9);
        expect(timeToPeak(s)!).toBeGreaterThan(-DT - 1e-9);
      }
    }
    // Hochpunkte bei t0 + 0,25 / 1,25 / 2,25 / 3,25
    expect(peaks).toBe(4);
  });
});

describe('Absprung', () => {
  it('hat am Hochpunkt Güte 1 und ±0,2 s daneben Güte 0', () => {
    expect(jumpOff(diveById('25h')).quality).toBeCloseTo(1, 6);
    expect(jumpOff(diveById('25h'), { offset: 0.2 }).quality).toBeCloseTo(0, 6);
    const early = jumpOff(diveById('25h'), { offset: -0.2 });
    expect(early.quality).toBeCloseTo(0, 6);
    expect(early.takeoffOffset).toBeLessThan(0);
  });

  it('wertet den Zeitstempel der Taste, nicht den Schritt', () => {
    const s = jumpOff(diveById('25h'), { offset: 0.1 + 0.3 * DT });
    expect(s.quality).toBeCloseTo(1 - (0.1 + 0.3 * DT) / DIVE.takeoffWindow, 6);
  });

  it('verliert Kraft bei schlechtem Timing', () => {
    const good = jumpOff(diveById('25h'));
    const bad = jumpOff(diveById('25h'), { offset: 0.2 });
    expect(good.power).toBeCloseTo(good.swing, 6);
    expect(bad.power).toBeCloseTo(bad.swing * DIVE.takeoffMinFactor, 6);
  });

  it('springt 6 s nach dem ersten Tipp automatisch ab', () => {
    const s = toReady(diveById('25h'));
    const t0 = s.time;
    const events: DiveEvent[] = [];
    tapUntil(s, 10, t0 + 5.99, events);
    expect(s.phase).toBe('swing');
    while (s.phase === 'swing') events.push(...stepDive(s, DT));
    const ev = events.find((e) => e.type === 'takeoff');
    expect(ev).toMatchObject({ type: 'takeoff', auto: true, quality: 0 });
    expect(s.takeoffAt!).toBeCloseTo(t0 + DIVE.maxSwingTime, 9);
    expect(s.held).toBe(false);
  });
});

describe('Flug', () => {
  it('dauert 1,55–1,95 s', () => {
    for (const p of [0, 0.5, 1]) {
      expect(flightTime(p)).toBeGreaterThanOrEqual(1.55);
      expect(flightTime(p)).toBeLessThanOrEqual(1.95);
    }
    const s = jumpOff(diveById('25h'));
    fly(s, releaseFor(s));
    expect(s.entryAt! - s.takeoffAt!).toBeCloseTo(flightTime(s.power), 9);
    expect(s.entryAt! - s.takeoffAt!).toBeGreaterThan(1.55);
    expect(s.entryAt! - s.takeoffAt!).toBeLessThan(1.95);
  });

  it('dreht gehalten mit Kraft × spinRate', () => {
    for (const id of ['25h', '25p', 'kopf'] as DiveId[]) {
      const s = jumpOff(diveById(id), { rate: 9 });
      for (let i = 0; i < 60; i++) stepDive(s, DT);
      const def = diveById(id);
      expect(s.rot).toBeCloseTo(s.power * DIVE.spinRate[def.position] * 360 * 0.5, 6);
    }
  });

  it('dreht offen nicht weiter, wenn das Ziel weit weg ist', () => {
    const s = jumpOff(diveById('35h'));
    stepDive(s, 0.2);
    setHold(s, false);
    const rot = s.rot;
    expect(targetRot(s.def) - rot).toBeGreaterThan(DIVE.alignRange);
    stepDive(s, 0.5);
    expect(s.rot).toBe(rot);
  });

  it('richtet sich offen mit höchstens 70°/s aus, nur innerhalb von ±60°', () => {
    const s = jumpOff(diveById('25h'));
    const target = targetRot(s.def);
    const release = (target - 50) / spinSpeed(s.def, s.power);
    while (s.time + DT < s.takeoffAt! + release) stepDive(s, DT);
    setHold(s, false, s.takeoffAt! + release);
    expect(s.rot).toBeCloseTo(target - 50, 6);
    stepDive(s, 0.2);
    expect(s.rot).toBeCloseTo(target - 50 + DIVE.alignRate * 0.2, 6);
    stepDive(s, 1);
    // Kein Überschießen
    expect(s.rot).toBeLessThanOrEqual(target + 1e-9);
  });

  it('richtet sich nicht aus, solange eine Schraube läuft', () => {
    const s = jumpOff(diveById('15s2'));
    const target = targetRot(s.def);
    const release = (target - 40) / spinSpeed(s.def, s.power);
    while (s.time + DT < s.takeoffAt! + release) stepDive(s, DT);
    expect(twist(s)).toBe(true);
    setHold(s, false);
    const rot = s.rot;
    stepDive(s, 0.3);
    expect(s.rot).toBe(rot);
    const events = stepDive(s, 0.2);
    expect(events).toContainEqual({ type: 'twistEnd', n: 1 });
    expect(s.rot).toBeGreaterThan(rot);
  });

  it('meldet jede halbe Drehung, das Öffnen und erneutes Halten', () => {
    const s = jumpOff(diveById('25h'));
    const events: DiveEvent[] = [];
    fly(s, releaseFor(s, 10), events);
    expect(events.filter((e) => e.type === 'halfTurn').map((e) => (e as { n: number }).n)).toEqual([1, 2, 3, 4]);
    expect(events.filter((e) => e.type === 'open')).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: 'surface' });

    const again = jumpOff(diveById('25h'));
    stepDive(again, DT);
    setHold(again, false);
    setHold(again, true, again.time + 0.001);
    expect(stepDive(again, DT).map((e) => e.type)).toEqual(['open', 'tuck']);
  });
});

describe('Eintauchen', () => {
  it('ist perfekt und spritzt nicht bei rechtzeitigem Öffnen', () => {
    const s = jumpOff(diveById('25h'));
    fly(s, releaseFor(s));
    expect(s.rating).toBe('perfect');
    expect(s.splash).toBe(0);
    expect(Math.abs(s.delta)).toBeLessThan(1);
    expect(s.line).toBeGreaterThanOrEqual(DIVE.lineTimeFull);
    const j = judge(s);
    expect(j.base).toBeGreaterThan(9);
    expect(j.tip).toBe('dream');
  });

  it('bewertet konstruierte Fälle', () => {
    const cases: [DiveId, number, EntryRating, number][] = [
      ['25h', -3, 'perfect', 0],
      ['25h', -15, 'clean', 1],
      ['25h', 15, 'clean', 1],
      ['25h', -40, 'early', 2],
      ['25h', 40, 'late', 2],
      ['35h', -100, 'belly', 3],
      ['35h', 100, 'back', 3],
      ['35h', -300, 'wrong', 2],
      ['35h', 290, 'wrong', 2],
    ];
    for (const [id, delta, rating, splash] of cases) {
      const s = entryWith(id, delta);
      expect([delta, s.rating]).toEqual([delta, rating]);
      expect([delta, s.splash]).toEqual([delta, splash]);
    }
    const bomb = entryWith('15h', 0, true);
    expect(bomb.rating).toBe('bomb');
    expect(bomb.splash).toBe(3);
    expect(bomb.line).toBe(0);
  });

  it('spritzt bei perfektem Winkel, aber zu kurzer Linie etwas', () => {
    expect(entryWith('25h', 0).splash).toBe(0);
    // Ziel genau getroffen, aber erst 0,1 s vor dem Wasser geöffnet
    const short = jumpOff(diveById('25h'));
    while (short.time + DT < short.takeoffAt! + flightTime(short.power) - 0.1) stepDive(short, DT);
    short.rot = targetRot(short.def);
    setHold(short, false);
    fly(short, null);
    expect(short.rating).toBe('perfect');
    expect(short.splash).toBe(1);
    expect(judge(short).tip).toBe('openLate');
  });

  it('deckelt Fehlsprünge bei 2,0, sie bleiben aber gültig', () => {
    const fails: [DiveId, number, boolean][] = [
      ['35h', -100, false],
      ['35h', 100, false],
      ['35h', -300, false],
      ['15h', 0, true],
    ];
    for (const [id, delta, held] of fails) {
      const j = judge(entryWith(id, delta, held));
      expect(j.fail).toBe(true);
      expect(j.base).toBeLessThanOrEqual(DIVE.failCap);
      expect(j.points).toBeGreaterThan(0);
      for (const n of j.notes) expect(n).toBeLessThanOrEqual(3);
    }
    expect(judge(entryWith('25h', -40)).fail).toBe(false);
  });

  it('gibt Tipps nach Priorität', () => {
    expect(judge(entryWith('15h', 0, true)).tip).toBe('notOpened');
    expect(judge(entryWith('35h', -300)).tip).toBe('wrongShort');
    expect(judge(entryWith('35h', 290)).tip).toBe('wrongLong');
    expect(judge(entryWith('25h', -40)).tip).toBe('openEarly');
    expect(judge(entryWith('25h', 40)).tip).toBe('openLate');
    // Zu wenig Schwung für den Sprung: früh geöffnet ist dann ein Kraftproblem
    const weak = jumpOff(diveById('45h'), { rate: 8 });
    fly(weak, flightTime(weak.power) - 0.3);
    expect(weak.power).toBeLessThan(minPower(weak.def));
    expect(judge(weak).tip).toBe('lowPower');
    const late = jumpOff(diveById('25h'), { offset: 0.15 });
    fly(late, releaseFor(late));
    expect(judge(late).tip).toBe('takeoffLate');
    const early = jumpOff(diveById('25h'), { offset: -0.15 });
    fly(early, releaseFor(early));
    expect(judge(early).tip).toBe('takeoffEarly');
    const slow = jumpOff(diveById('15h'), { rate: 8 });
    fly(slow, releaseFor(slow));
    expect(judge(slow).tip).toBe('moreHeight');
  });
});

describe('Schrauben', () => {
  it('wirken nur beim Schraubensprung, eine zur Zeit, höchstens angesagt viele', () => {
    const plain = jumpOff(diveById('25h'));
    expect(twist(plain)).toBe(false);

    const s = jumpOff(diveById('15s2'));
    expect(twist(s, s.time)).toBe(true);
    expect(twist(s, s.time + 0.1)).toBe(false);
    stepDive(s, DIVE.twistTime + 0.01);
    expect(s.twistsDone).toBe(1);
    expect(twist(s)).toBe(true);
    stepDive(s, DIVE.twistTime + 0.01);
    expect(s.twistsDone).toBe(2);
    expect(twist(s)).toBe(false);
    expect(twist(createDive(diveById('15s2')))).toBe(false);
  });

  it('kosten 2,5 Notenpunkte je fehlender oder unfertiger Schraube', () => {
    const dive = (twists: number, lastLate = false) => {
      const s = jumpOff(diveById('15s2'));
      const release = s.takeoffAt! + releaseFor(s);
      const entry = s.takeoffAt! + flightTime(s.power);
      let due = twists;
      let at = s.time + 0.05;
      while (s.phase !== 'done') {
        if (s.held && release < s.time + DT) setHold(s, false, Math.max(release, s.time));
        if (due > 0 && at < s.time + DT && twist(s, Math.max(at, s.time))) {
          due--;
          at = lastLate && due === 1 ? entry - 0.2 : s.time + DIVE.twistTime + 0.05;
        }
        stepDive(s, DT);
      }
      return s;
    };
    const full = judge(dive(2));
    const one = judge(dive(1));
    const none = judge(dive(0));
    const open = dive(2, true);
    expect(full.rating).toBe('perfect');
    expect(full.missingTwists).toBe(0);
    expect(one.missingTwists).toBe(1);
    expect(full.base - one.base).toBeCloseTo(DIVE.twistPenalty, 6);
    expect(full.base - none.base).toBeCloseTo(2 * DIVE.twistPenalty, 6);
    expect(one.tip).toBe('twistMissing');
    // Schraube beim Eintauchen noch offen
    expect(open.twistOpen).toBe(true);
    expect(open.splash).toBe(1);
    const jo = judge(open);
    expect(jo.missingTwists).toBe(1);
    expect(jo.tip).toBe('twistOpen');
  });
});

describe('Kampfrichter', () => {
  const sample = (seed: number) => {
    const rng = createRng(seed);
    const p = DIVE_CPU_PROFILES[seed % 3];
    return simulateCpuDive(p, DIVES[Math.floor(rng() * DIVES.length)], rng);
  };

  it('vergeben 5 Noten in 0,5er-Schritten, streichen die höchste und niedrigste, × SG', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const j = sample(seed);
      expect(j.notes).toHaveLength(5);
      for (const n of j.notes) {
        expect(n * 2).toBe(Math.round(n * 2));
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(10);
      }
      const [hi, lo] = j.dropped;
      expect(hi).not.toBe(lo);
      expect(j.notes[hi]).toBe(Math.max(...j.notes));
      expect(j.notes[lo]).toBe(Math.min(...j.notes));
      const rest = j.notes.filter((_, i) => i !== hi && i !== lo);
      expect(j.sum).toBe(rest.reduce((a, b) => a + b, 0));
      expect(j.points).toBe(Math.round(j.sum * j.dd * 100) / 100);
      expect(Math.max(...j.notes) - Math.min(...j.notes)).toBeLessThanOrEqual(1.5);
    }
  });

  it('geben bei gleicher Ausführung identische Noten', () => {
    const a = jumpOff(diveById('35h'));
    fly(a, releaseFor(a, 20));
    const b = jumpOff(diveById('35h'));
    fly(b, releaseFor(b, 20));
    expect(judge(a)).toEqual(judge(b));
    // Andere Ausführung, andere Streuung
    const c = jumpOff(diveById('35h'));
    fly(c, releaseFor(c, 22));
    expect(judge(c).notes).not.toEqual(judge(a).notes);
  });

  it('streichen bei gleichen Noten zwei verschiedene Tafeln', () => {
    const s = entryWith('kopf', 0);
    s.quality = 0;
    s.power = 0;
    s.line = 0;
    s.delta = -75;
    s.rating = 'belly';
    const j = judge(s);
    expect(j.base).toBe(0);
    expect(j.dropped[0]).not.toBe(j.dropped[1]);
  });
});

describe('Sprungliste', () => {
  it('minPower ergibt den nötigen Schwung der Liste (±1 %)', () => {
    const table: Record<DiveId, number> = {
      kopf: 0.24, '15h': 0.36, '15p': 0.46, '25h': 0.58, '25p': 0.72, '15s2': 0.66, '35h': 0.77, '45h': 0.96,
    };
    for (const d of DIVES) expect(Math.abs(minPower(d) - table[d.id])).toBeLessThanOrEqual(0.01);
  });

  it('ist nach Schwierigkeit geordnet', () => {
    expect(DIVES.map((d) => d.id)).toEqual(['kopf', '15h', '15p', '25h', '25p', '15s2', '35h', '45h']);
    for (let i = 1; i < DIVES.length; i++) expect(DIVES[i].dd).toBeGreaterThanOrEqual(DIVES[i - 1].dd);
  });
});

describe('Wettkampf', () => {
  it('springt Durchgang für Durchgang und merkt sich die Sprünge', () => {
    const a = createDiver(0, true);
    const b = createDiver(1, false);
    const order: number[] = [];
    for (let turn = nextDive([a, b]); turn; turn = nextDive([a, b])) {
      order.push(turn.diver.id);
      turn.diver.attempts[turn.round] = { dive: DIVES[turn.round].id, points: 50 + turn.round };
    }
    expect(order).toEqual([0, 1, 0, 1, 0, 1]);
    expect(usedDives(a)).toEqual(['kopf', '15h', '15p']);
    expect(diverTotal(a)).toBe(153);
  });

  it('entscheidet bei Punktgleichheit der beste, dann der zweitbeste Sprung', () => {
    const mk = (id: number, pts: number[]) => {
      const d = createDiver(id, false);
      d.attempts = pts.map((points) => ({ dive: 'kopf' as DiveId, points }));
      return d;
    };
    const a = mk(0, [60, 60, 60]);
    const b = mk(1, [80, 50, 50]);
    const c = mk(2, [80, 55, 45]);
    const d = mk(3, [90, 50, 41]);
    expect(rankDivers([a, b, c, d]).map((x) => x.id)).toEqual([3, 2, 1, 0]);
    expect(rankDivers([mk(0, [100, 1, 1]), mk(1, [99, 99, 0])]).map((x) => x.id)).toEqual([1, 0]);
  });
});

// ---------------------------------------------------------------- Balancing

function series(p: DiveCpuProfile, rng: () => number, rate: number) {
  let total = 0;
  let fails = 0;
  for (const id of p.dives) {
    const j = simulateCpuDive(p, diveById(id), rng, rate);
    total += j.points;
    if (j.fail) fails++;
  }
  return { total, fails };
}

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

/** Spieler-Modell gegen das Feld Rookie + Profi + Champion */
function versusField(p: DiveCpuProfile, n: number, seed: number) {
  const rng = createRng(seed);
  const totals: number[] = [];
  let medal = 0;
  let gold = 0;
  let wr = 0;
  for (let i = 0; i < n; i++) {
    const own = series(p, rng, p.tapRate).total;
    const field = DIVE_CPU_PROFILES.map((c) => series(c, rng, cpuDiveRate(c, rng)).total);
    const better = field.filter((f) => f > own).length;
    totals.push(own);
    if (better < 3) medal++;
    if (better === 0) gold++;
    if (own >= DIVE.worldRecord) wr++;
  }
  return { avg: avg(totals), medal: medal / n, gold: gold / n, wr: wr / n };
}

const player = (tapRate: number, tapJitter: number, to: number, re: number, dives: DiveId[]): DiveCpuProfile => ({
  name: `${tapRate}/s`,
  tapRate,
  tapJitter,
  takeoffError: to,
  releaseError: re,
  dives,
});

describe('Balancing', () => {
  it('Computer-Gegner: je 40 Serien Ø Rookie 140–165, Profi 205–232, Champion 238–262 unter dem Weltrekord', () => {
    const rng = createRng(7);
    const means = DIVE_CPU_PROFILES.map((p) =>
      avg(Array.from({ length: 40 }, () => series(p, rng, cpuDiveRate(p, rng)).total)),
    );
    expect(means[0]).toBeGreaterThanOrEqual(140);
    expect(means[0]).toBeLessThanOrEqual(165);
    expect(means[1]).toBeGreaterThanOrEqual(205);
    expect(means[1]).toBeLessThanOrEqual(232);
    expect(means[2]).toBeGreaterThanOrEqual(238);
    expect(means[2]).toBeLessThanOrEqual(262);
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
    expect(means[2]).toBeLessThan(DIVE.worldRecord);
  });

  it('Computer-Gegner springen kaum Fehlsprünge', () => {
    const rng = createRng(8);
    for (const p of DIVE_CPU_PROFILES) {
      const fails = Array.from({ length: 40 }, () => series(p, rng, cpuDiveRate(p, rng)).fails);
      expect(avg(fails)).toBeLessThan(0.3);
    }
  });

  it('8 Tipps/s (σ 80/60 ms) mit 15p, 25h, 15s2 erreicht Ø ≥ 140 und oft eine Medaille', () => {
    const r = versusField(player(8, 0.2, 0.08, 0.06, ['15p', '25h', '15s2']), 150, 11);
    expect(r.avg).toBeGreaterThanOrEqual(140);
    expect(r.medal).toBeGreaterThan(0.35);
    expect(r.medal).toBeLessThan(0.75);
    expect(r.gold).toBeLessThan(0.05);
  });

  it('8 Tipps/s: zu schwer gewählt kostet Punkte', () => {
    const fit = versusField(player(8, 0.2, 0.08, 0.06, ['15p', '25h', '15s2']), 80, 12).avg;
    const hard = versusField(player(8, 0.2, 0.08, 0.06, ['15s2', '35h', '45h']), 80, 12).avg;
    expect(hard).toBeLessThan(fit - 25);
  });

  it('6 Tipps/s bleibt mit leichten Sprüngen im Spiel, aber selten auf dem Podest', () => {
    const r = versusField(player(6, 0.25, 0.1, 0.07, ['kopf', '15h', '15p']), 100, 13);
    expect(r.avg).toBeGreaterThan(85);
    expect(r.avg).toBeLessThan(125);
    expect(r.medal).toBeLessThan(0.15);
  });

  it('11 Tipps/s (σ 45/35 ms) mit 15s2, 35h, 45h ist auf Augenhöhe mit dem Champion', () => {
    const r = versusField(player(11, 0.12, 0.045, 0.035, ['15s2', '35h', '45h']), 150, 14);
    expect(r.avg).toBeGreaterThan(230);
    expect(r.avg).toBeLessThan(260);
    expect(r.gold).toBeGreaterThan(0.3);
    expect(r.gold).toBeLessThan(0.6);
    expect(r.wr).toBeLessThan(0.05);
  });

  it('14 Tipps/s hämmern bringt kaum mehr als 11/s, schadet aber nicht', () => {
    const dives: DiveId[] = ['15s2', '35h', '45h'];
    const r11 = versusField(player(11, 0.12, 0.045, 0.035, dives), 120, 15).avg;
    const r14 = versusField(player(14, 0.3, 0.045, 0.035, dives), 120, 15).avg;
    expect(r14).toBeGreaterThan(r11 - 5);
    expect(r14).toBeLessThan(r11 + 15);
  });

  it('der Weltrekord braucht nahezu fehlerfreies Timing', () => {
    const perfect = versusField(player(12, 0, 0, 0, ['25p', '35h', '45h']), 5, 16);
    expect(perfect.avg).toBeGreaterThanOrEqual(DIVE.worldRecord);
    expect(perfect.avg).toBeLessThan(DIVE.worldRecord + 6);
    expect(perfect.gold).toBe(1);
  });

  it('ein eigener Sprung dauert 5,5–8,5 s Sim-Zeit, der Durchgang passt in 30–90 s', () => {
    const rng = createRng(17);
    const s = runCpuDive(player(10, 0.15, 0.05, 0.04, []), diveById('25h'), rng);
    expect(s.phase).toBe('done');
    expect(s.time).toBeGreaterThan(5.5);
    expect(s.time).toBeLessThan(8.5);
    // Grobe Schätzung: + 5 s für Wahl und Wertung je eigenem Sprung, 1,5 s je Tafel-Einblendung der Gegner
    const total = DIVE.rounds * (s.time + 5) + DIVE.rounds * 3 * 1.5;
    expect(total).toBeGreaterThan(30);
    expect(total).toBeLessThan(90);
  });
});

// QA-Regressionstests (RSG-09): Fairness unabhängig von der Bildrate und Tippen in der Luft
describe('Fairness (QA)', () => {
  type Input = { t: number; run: (s: DiveState, t: number) => void };

  /** Spielt Eingaben mit festen Zeitstempeln ab wie die Szene: Eingaben vor dem Bild, dann feste Schritte bis zur Bildzeit. */
  function playFrames(def: DiveDef, inputs: Input[], frameDt: () => number): DiveState {
    const s = createDive(def);
    const queue = [...inputs].sort((a, b) => a.t - b.t);
    let now = 0;
    while (s.phase !== 'done' && now < 30) {
      now += frameDt();
      while (queue.length && queue[0].t <= now) {
        const i = queue.shift()!;
        i.run(s, Math.max(s.time, i.t));
      }
      while (s.time + DT <= now) stepDive(s, DT);
    }
    return s;
  }

  function plan(release: number, extra: Input[] = []): Input[] {
    const rng = createRng(99);
    const inputs: Input[] = [];
    let side: 'L' | 'R' = 'L';
    for (let t = 1.0; t < 4.3; t += (1 + 0.15 * (2 * rng() - 1)) / 10.5) {
      const sd = side;
      inputs.push({ t, run: (s, at) => void swingTap(s, sd, at) });
      side = side === 'L' ? 'R' : 'L';
    }
    const press = 1.0 + 0.25 + 3 + 0.013;
    inputs.push({ t: press, run: (s, at) => void takeoff(s, at) });
    inputs.push({ t: press + release, run: (s, at) => setHold(s, false, at) });
    return [...inputs, ...extra.map((e) => ({ ...e, t: press + e.t }))];
  }

  const frameRates: [string, () => number][] = [
    ['60 Hz', () => 1 / 60],
    ['144 Hz', () => 1 / 144],
    ['30 Hz', () => 1 / 30],
    [
      'ruckelnd',
      (() => {
        const r = createRng(5);
        return () => 0.005 + 0.04 * r();
      })(),
    ],
  ];

  it('gleiche Eingaben ergeben bei jeder Bildrate dieselben Noten', () => {
    const cases: [DiveId, number, Input[]][] = [
      ['25h', 0.93, []],
      ['35h', 1.3, []],
      [
        '15s2',
        1.06,
        [
          { t: 0.15, run: (s, at) => void twist(s, at) },
          { t: 0.65, run: (s, at) => void twist(s, at) },
        ],
      ],
    ];
    for (const [id, release, extra] of cases) {
      const def = diveById(id);
      const results = frameRates.map(([, f]) => judge(playFrames(def, plan(release, extra), f)));
      // Gültige, gute Sprünge – sonst prüft der Vergleich nur Deckelungen
      expect(results[0].fail).toBe(false);
      expect(results[0].base).toBeGreaterThan(7);
      for (const j of results.slice(1)) {
        expect(j.notes).toEqual(results[0].notes);
        expect(j.points).toBe(results[0].points);
        expect(j.rating).toBe(results[0].rating);
        expect(j.tip).toBe(results[0].tip);
      }
    }
  });

  it('Tippen in der Luft ändert weder Kraft noch Wertung', () => {
    const def = diveById('25h');
    const airTaps: Input[] = Array.from({ length: 14 }, (_, i) => ({
      t: 0.05 + i * 0.09,
      run: (s, at) => {
        expect(swingTap(s, i % 2 ? 'R' : 'L', at)).toBe(false);
      },
    }));
    const a = playFrames(def, plan(0.93), () => 1 / 60);
    const b = playFrames(def, plan(0.93, airTaps), () => 1 / 60);
    expect(b.power).toBe(a.power);
    expect(judge(b)).toEqual(judge(a));
  });
});
