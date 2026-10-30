// Kleine Hilfen für localStorage – das Spiel muss auch ohne funktionieren
// (z. B. im privaten Modus).

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignorieren
  }
}

export interface PersonalBest {
  value: number;
  country: string;
}

export function loadBest(event: string): PersonalBest | null {
  const raw = read(`rsg.best.${event}`);
  if (!raw) return null;
  try {
    // Ältere Versionen speicherten die Bestzeit als `time`
    const best = JSON.parse(raw) as Partial<PersonalBest> & { time?: number };
    const value = best.value ?? best.time;
    return typeof value === 'number' ? { value, country: best.country ?? '' } : null;
  } catch {
    return null;
  }
}

export function saveBest(event: string, best: PersonalBest): void {
  write(`rsg.best.${event}`, JSON.stringify(best));
}

export function loadCountryIndex(): number {
  const n = Number(read('rsg.country'));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export function saveCountryIndex(index: number): void {
  write('rsg.country', String(index));
}

/** Startwert für das Aussehen des eigenen Athleten */
export function loadLookSeed(): number {
  const n = Number(read('rsg.look'));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function saveLookSeed(seed: number): void {
  write('rsg.look', String(seed));
}

export function loadEventIndex(): number {
  const n = Number(read('rsg.event'));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export function saveEventIndex(index: number): void {
  write('rsg.event', String(index));
}
