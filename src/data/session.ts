// Laufender Wettkampf – bewusst nur im Speicher, nie in localStorage.
// Nach einem Neuladen der Seite beginnt alles von vorn.

import type { CompetitionState } from '../sim/competition';
import type { Difficulty } from '../sim/difficulty';
import { loadDifficulty } from './storage';

let current: CompetitionState | null = null;

export function getCompetition(): CompetitionState | null {
  return current;
}

export function setCompetition(state: CompetitionState): void {
  current = state;
}

export function endCompetition(): void {
  current = null;
}

/** Gegnerstärke: im Wettkampf die beim Start festgeschriebene, sonst die Menüwahl */
export function currentDifficulty(): Difficulty {
  return current?.difficulty ?? loadDifficulty();
}
