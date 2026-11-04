// Laufender Wettkampf – bewusst nur im Speicher, nie in localStorage.
// Nach einem Neuladen der Seite beginnt alles von vorn.

import type { CompetitionState } from '../sim/competition';

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
