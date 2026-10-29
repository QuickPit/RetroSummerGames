export type FlagSpec =
  | { kind: 'h'; colors: number[]; weights?: number[] }
  | { kind: 'v'; colors: number[] }
  | { kind: 'nordic'; bg: number; cross: number }
  | { kind: 'swiss'; bg: number; cross: number }
  | { kind: 'circle'; bg: number; circle: number }
  | { kind: 'usa' }
  | { kind: 'jamaica' };

export interface Country {
  code: string;
  name: string;
  flag: FlagSpec;
  jersey: number;
  shorts: number;
  /** Akzentfarbe für Streifen, Schweißbänder und Stirnband */
  accent: number;
}

export const COUNTRIES: readonly Country[] = [
  { code: 'GER', name: 'DEUTSCHLAND', flag: { kind: 'h', colors: [0x000000, 0xdd0000, 0xffce00] }, jersey: 0xf2f2f2, shorts: 0x262626, accent: 0xffce00 },
  { code: 'AUT', name: 'ÖSTERREICH', flag: { kind: 'h', colors: [0xed2939, 0xffffff, 0xed2939] }, jersey: 0xed2939, shorts: 0xffffff, accent: 0xffffff },
  { code: 'SUI', name: 'SCHWEIZ', flag: { kind: 'swiss', bg: 0xd52b1e, cross: 0xffffff }, jersey: 0xd52b1e, shorts: 0xd52b1e, accent: 0xffffff },
  { code: 'FRA', name: 'FRANKREICH', flag: { kind: 'v', colors: [0x0055a4, 0xffffff, 0xef4135] }, jersey: 0x0055a4, shorts: 0xffffff, accent: 0xef4135 },
  { code: 'ITA', name: 'ITALIEN', flag: { kind: 'v', colors: [0x009246, 0xffffff, 0xce2b37] }, jersey: 0x2f7fd6, shorts: 0xffffff, accent: 0x009246 },
  { code: 'NED', name: 'NIEDERLANDE', flag: { kind: 'h', colors: [0xae1c28, 0xffffff, 0x21468b] }, jersey: 0xff7f00, shorts: 0x1a1a1a, accent: 0xffffff },
  { code: 'ESP', name: 'SPANIEN', flag: { kind: 'h', colors: [0xaa151b, 0xf1bf00, 0xaa151b], weights: [1, 2, 1] }, jersey: 0xaa151b, shorts: 0xf1bf00, accent: 0xf1bf00 },
  { code: 'SWE', name: 'SCHWEDEN', flag: { kind: 'nordic', bg: 0x006aa7, cross: 0xfecc02 }, jersey: 0xfecc02, shorts: 0x006aa7, accent: 0x006aa7 },
  { code: 'POL', name: 'POLEN', flag: { kind: 'h', colors: [0xffffff, 0xdc143c] }, jersey: 0xffffff, shorts: 0xdc143c, accent: 0xdc143c },
  { code: 'USA', name: 'USA', flag: { kind: 'usa' }, jersey: 0x1f2a5c, shorts: 0xbf0a30, accent: 0xffffff },
  { code: 'JAM', name: 'JAMAIKA', flag: { kind: 'jamaica' }, jersey: 0xfed100, shorts: 0x009b3a, accent: 0x10101c },
  { code: 'JPN', name: 'JAPAN', flag: { kind: 'circle', bg: 0xffffff, circle: 0xbc002d }, jersey: 0xbc002d, shorts: 0xffffff, accent: 0xffffff },
];
