// Regression (QA RSG-02): Im Wettkampf gilt die beim Start festgeschriebene Stufe,
// auch wenn sich die gespeicherte Menüwahl später ändert (D7, Abnahmekriterium 4).

import { afterEach, describe, expect, it } from 'vitest';
import { currentDifficulty, endCompetition, setCompetition } from '../data/session';
import { createCompetition } from './competition';

describe('currentDifficulty (QA)', () => {
  const g = globalThis as { localStorage?: unknown };
  const data = new Map<string, string>();
  afterEach(() => {
    endCompetition();
    data.clear();
    delete g.localStorage;
  });

  function stub(): void {
    g.localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  }

  it('liest ohne Wettkampf die Menüwahl', () => {
    stub();
    data.set('rsg.difficulty', 'hard');
    expect(currentDifficulty()).toBe('hard');
    data.set('rsg.difficulty', 'kaputt');
    expect(currentDifficulty()).toBe('normal');
  });

  it('bleibt im Wettkampf bei der Startstufe, auch wenn die Menüwahl sich ändert', () => {
    stub();
    data.set('rsg.difficulty', 'easy');
    setCompetition(createCompetition('GER', ['GER', 'FRA', 'ITA', 'ESP', 'USA'], () => 0.5, 1, 'easy'));
    data.set('rsg.difficulty', 'hard');
    expect(currentDifficulty()).toBe('easy');
    endCompetition();
    expect(currentDifficulty()).toBe('hard');
  });

  it('ein Wettkampf ohne Angabe läuft auf NORMAL', () => {
    stub();
    data.set('rsg.difficulty', 'hard');
    setCompetition(createCompetition('GER', ['GER', 'FRA', 'ITA', 'ESP'], () => 0.3, 1));
    expect(currentDifficulty()).toBe('normal');
  });
});
