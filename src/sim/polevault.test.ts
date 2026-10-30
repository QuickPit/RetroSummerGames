import { describe, expect, it } from 'vitest';
import { createRng } from './cpu';
import {
  Competition,
  HEIGHTS,
  VAULT,
  VAULT_CPU_PROFILES,
  bestHeightIndex,
  cpuAttempt,
  createVault,
  createVaulter,
  plant,
  release,
  stepVault,
  vaultTap,
  type VaultState,
} from './polevault';

const DT = 1 / 120;

/** Simuliert einen Sprung mit fester Tipprate und Absprung-/Loslass-Zeitpunkt. */
function vault(bar: number, tapRate: number, plantAt: number | null, releaseAt: number | null): VaultState {
  const s = createVault(bar);
  let t = 0;
  let nextTap = 0;
  let side: 'L' | 'R' = 'L';
  while (s.phase !== 'landed' && s.phase !== 'runthrough' && t < 20) {
    t += DT;
    if ((s.phase === 'ready' || s.phase === 'runup') && t >= nextTap) {
      vaultTap(s, side);
      side = side === 'L' ? 'R' : 'L';
      nextTap += 1 / tapRate;
    }
    if (s.phase === 'runup' && plantAt !== null && -s.x <= plantAt) plant(s);
    if (s.phase === 'vault' && releaseAt !== null && s.p >= releaseAt) release(s);
    stepVault(s, DT);
  }
  return s;
}

describe('Sprung', () => {
  it('läuft durch, wenn nie eingestochen wird', () => {
    const s = vault(4.0, 10, null, null);
    expect(s.outcome).toBe('runthrough');
  });

  it('schafft mit gutem Anlauf und perfektem Timing eine gute Höhe', () => {
    const s = vault(5.0, 10, VAULT.takeoffIdeal, VAULT.releaseIdeal);
    expect(s.plantQuality).toBeGreaterThan(0.9);
    expect(s.releaseQuality).toBeGreaterThan(0.9);
    expect(s.peak).toBeGreaterThan(5.0);
    expect(s.peak).toBeLessThan(6.0);
    expect(s.outcome).toBe('clear');
  });

  it('springt höher, je schneller angelaufen wird', () => {
    const slow = vault(4.0, 7, VAULT.takeoffIdeal, VAULT.releaseIdeal);
    const fast = vault(4.0, 12, VAULT.takeoffIdeal, VAULT.releaseIdeal);
    expect(fast.peak).toBeGreaterThan(slow.peak + 0.5);
  });

  it('verliert Höhe bei schlechtem Einstich oder Loslassen', () => {
    const perfect = vault(4.0, 10, VAULT.takeoffIdeal, VAULT.releaseIdeal);
    const badPlant = vault(4.0, 10, VAULT.takeoffIdeal + 1.0, VAULT.releaseIdeal);
    const earlyRelease = vault(4.0, 10, VAULT.takeoffIdeal, 0.6);
    expect(badPlant.peak).toBeLessThan(perfect.peak - 0.2);
    expect(earlyRelease.peak).toBeLessThan(perfect.peak - 0.4);
  });

  it('ignoriert einen Doppeldruck direkt nach dem Einstich', () => {
    const s = createVault(4.0);
    s.phase = 'runup';
    s.v = 9;
    s.x = -VAULT.takeoffIdeal;
    plant(s);
    stepVault(s, 0.05);
    expect(release(s)).toBeNull();
    expect(s.phase).toBe('vault');
  });

  it('reißt die Latte, wenn sie zu hoch liegt', () => {
    const s = vault(6.5, 10, VAULT.takeoffIdeal, VAULT.releaseIdeal);
    expect(s.outcome).toBe('knock');
  });

  it('rutscht ab, wenn nie losgelassen wird', () => {
    const s = vault(4.0, 10, VAULT.takeoffIdeal, null);
    expect(s.releaseP).toBeGreaterThanOrEqual(VAULT.hangAt);
    expect(s.releaseQuality).toBeLessThan(0.5);
  });
});

describe('Wettkampf', () => {
  it('scheidet nach drei Fehlversuchen aus', () => {
    const a = createVaulter(0, true);
    const c = new Competition([a]);
    for (let i = 0; i < 3; i++) {
      const turn = c.nextTurn()!;
      expect(turn.attempt).toBe(i + 1);
      c.record(a, false);
    }
    expect(a.out).toBe(true);
    expect(c.nextTurn()).toBeNull();
  });

  it('legt die Latte nach gültigen Versuchen höher', () => {
    const a = createVaulter(0, true);
    const b = createVaulter(1, false);
    const c = new Competition([a, b]);
    c.record(c.nextTurn()!.vaulter, true);
    c.record(c.nextTurn()!.vaulter, true);
    c.nextTurn();
    expect(c.height).toBe(HEIGHTS[1]);
  });

  it('lässt Höhen auslassen und steigt bei der Einstiegshöhe ein', () => {
    const a = createVaulter(0, true);
    const b = createVaulter(1, false, 4.4);
    const c = new Competition([a, b]);
    const t1 = c.nextTurn()!;
    expect(t1.vaulter).toBe(a);
    expect(c.height).toBe(HEIGHTS[0]);
    c.pass(a);
    c.nextTurn();
    c.pass(a);
    const t2 = c.nextTurn()!;
    expect(c.height).toBe(4.2);
    c.pass(t2.vaulter);
    const t3 = c.nextTurn()!;
    expect(c.height).toBe(4.4);
    expect([a, b]).toContain(t3.vaulter);
  });

  it('wertet bei gleicher Höhe die Fehlversuche', () => {
    const a = createVaulter(0, true);
    const b = createVaulter(1, false);
    a.marks[0] = 'XO';
    b.marks[0] = 'O';
    const c = new Competition([a, b]);
    expect(c.ranking()[0]).toBe(b);
    expect(bestHeightIndex(a)).toBe(0);
  });

  it('endet immer – auch nur mit Computer-Gegnern', () => {
    const rng = createRng(5);
    const vaulters = VAULT_CPU_PROFILES.map((p, i) => createVaulter(i, false, p.opening));
    const c = new Competition(vaulters);
    let turns = 0;
    for (let turn = c.nextTurn(); turn; turn = c.nextTurn()) {
      c.record(turn.vaulter, cpuAttempt(VAULT_CPU_PROFILES[turn.vaulter.id], c.height, rng));
      turns++;
    }
    expect(turns).toBeGreaterThan(5);
    expect(bestHeightIndex(c.ranking()[0])).toBeGreaterThan(3);
  });
});
