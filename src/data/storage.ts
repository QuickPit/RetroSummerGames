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
  time: number;
  country: string;
}

export function loadBest(event: string): PersonalBest | null {
  const raw = read(`rsg.best.${event}`);
  if (!raw) return null;
  try {
    const best = JSON.parse(raw) as PersonalBest;
    return typeof best.time === 'number' ? best : null;
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
