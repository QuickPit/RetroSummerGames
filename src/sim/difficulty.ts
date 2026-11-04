// Schwierigkeitsgrad der Computer-Gegner: eine kleine Tabelle für alle Disziplinen.
// Importiert bewusst keine Sims – die Sims leiten ihre Profile von hier ab.

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const satisfies readonly Difficulty[];
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'LEICHT', normal: 'NORMAL', hard: 'SCHWER' };

/** Ein Gegner in zwei Zahlen: Tipps/s und Fehlerfaktor (1 = ordentlich, 0,33 ≈ nahezu perfekt) */
export interface CpuSkill {
  rate: number;
  error: number;
}

// Reihenfolge Rookie/Profi/Champion – wird in difficulty.test.ts geprüft
export const DIFFICULTY_SCALE = {
  easy: [
    { rate: 5.0, error: 1.6 },
    { rate: 6.0, error: 1.3 },
    { rate: 7.0, error: 1.1 },
  ],
  normal: [
    { rate: 7.0, error: 1.2 },
    { rate: 8.0, error: 0.95 },
    { rate: 9.0, error: 0.7 },
  ],
  hard: [
    { rate: 8.5, error: 0.8 },
    { rate: 9.3, error: 0.55 },
    { rate: 10.0, error: 0.4 },
  ],
} as const satisfies Record<Difficulty, readonly [CpuSkill, CpuSkill, CpuSkill]>;

export const CPU_NAMES = ['Rookie', 'Profi', 'Champion'] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function isDifficulty(v: unknown): v is Difficulty {
  return (DIFFICULTIES as readonly unknown[]).includes(v);
}

/** Schwankung des Tipp-Abstands (gleichverteilt ±) */
export function cpuJitter(error: number): number {
  return clamp(0.02 + 0.18 * error, 0.04, 0.3);
}

/** Reaktion auf das Startsignal in Sekunden */
export function cpuReaction(error: number): number {
  return clamp(0.135 + 0.165 * error, 0.15, 0.4);
}

/** Tagesform: Tipprate × 0,95–1,05 – auch Computer haben gute und schlechte Tage */
export function withForm<P extends { tapRate: number }>(p: P, rng: () => number): P {
  return { ...p, tapRate: p.tapRate * (0.95 + 0.1 * rng()) };
}

/** Die drei Gegner einer Stufe, je Disziplin über `make` in ein Profil übersetzt */
export function cpuField<P>(d: Difficulty, make: (skill: CpuSkill, name: string, index: number) => P): P[] {
  return DIFFICULTY_SCALE[d].map((skill, i) => make(skill, CPU_NAMES[i], i));
}
