// Alle Disziplinen an einem Ort – das Menü und die Ergebnisse lesen hier.

export type EventKey = '110h' | 'pole' | 'bmx';

export interface EventInfo {
  key: EventKey;
  name: string;
  /** Phaser-Szene, die die Disziplin spielt */
  scene: string;
  /** Steuerungshilfe im Menü: [Taste, Wirkung] */
  controls: [string, string][];
  bestLabel: string;
  lowerIsBetter: boolean;
  format: (value: number) => string;
}

export const EVENTS: readonly EventInfo[] = [
  {
    key: '110h',
    name: '110 M HÜRDEN',
    scene: 'race',
    controls: [
      ['PFEIL LINKS/RECHTS', 'ABWECHSELND TIPPEN = LAUFEN'],
      ['LEERTASTE', 'ÜBER DIE HÜRDE SPRINGEN'],
    ],
    bestLabel: 'BESTZEIT',
    lowerIsBetter: true,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'pole',
    name: 'STABHOCHSPRUNG',
    scene: 'polevault',
    controls: [
      ['PFEIL LINKS/RECHTS', 'ABWECHSELND TIPPEN = ANLAUF'],
      ['LEERTASTE (1.)', 'AN DER MARKE: STAB EINSTECHEN'],
      ['LEERTASTE (2.)', 'STAB SENKRECHT: LOSLASSEN'],
    ],
    bestLabel: 'BESTHÖHE',
    lowerIsBetter: false,
    format: (v) => `${v.toFixed(2)} M`,
  },
  {
    key: 'bmx',
    name: 'BMX',
    scene: 'bmx',
    controls: [
      ['PFEIL LINKS/RECHTS', 'ABWECHSELND TIPPEN = TRETEN'],
      ['PFEIL HOCH', 'HOPSER (Z. B. ÜBER STÄMME)'],
      ['IN DER LUFT L/R', 'HALTEN = SALTO / AUSRICHTEN'],
      ['LEERTASTE (LUFT)', 'SUPERMAN – VOR DER LANDUNG LOS!'],
    ],
    bestLabel: 'HIGHSCORE',
    lowerIsBetter: false,
    format: (v) => `${Math.round(v)} P`,
  },
];

export function eventByKey(key: EventKey): EventInfo {
  return EVENTS.find((e) => e.key === key)!;
}
