// Bildschirm und Darstellung. Gerendert wird in niedriger Auflösung und
// pixelgenau hochskaliert – das ergibt den 16-Bit-Look.
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 360;

export const FONT = '"Press Start 2P", monospace';

/** Pixel pro Meter in der Spielwelt */
export const PX_PER_M = 26;

export const LANE_COUNT = 4;
/** Bildschirmhöhe einer Bahn in Pixeln */
export const LANE_DEPTH = 30;
/** Unterkante der vordersten Bahn */
export const TRACK_NEAR_Y = 318;
export const TRACK_FAR_Y = TRACK_NEAR_Y - LANE_COUNT * LANE_DEPTH;
/** Schräge Projektion: Verschiebung nach rechts pro Pixel Tiefe */
export const DEPTH_SKEW = 0.35;
/** Bildschirmposition des eigenen Läufers (Kamera folgt ihm) */
export const CAMERA_LEAD_X = 170;

export const COLORS = {
  outline: 0x10101c,
  tartan: 0xc4553a,
  tartanDark: 0xa84530,
  laneLine: 0xf4efe6,
  grass: 0x4c9a3c,
  grassDark: 0x3d7f30,
  hudBg: 0x10101c,
  yellow: 0xf7d038,
  orange: 0xf08a24,
  red: 0xe8442e,
  white: 0xffffff,
  gold: 0xf7c843,
  silver: 0xc9d1d9,
  bronze: 0xcd7f3a,
} as const;

export const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b3e26] as const;
export const HAIR_COLORS = [0x2b1b0e, 0x111111, 0x6a3b16, 0xd9b45a, 0x8a2f12] as const;

export const WORLD_RECORD = 12.8;

/** Laufbahn (0 = hinten) → Bildschirm-Y der Bahnmitte */
export function laneCenterY(lane: number): number {
  return TRACK_FAR_Y + (lane + 0.5) * LANE_DEPTH;
}

/** Schräge Verschiebung einer Bildschirmzeile gegenüber der vorderen Bahnkante */
export function skewAt(y: number): number {
  return (TRACK_NEAR_Y - y) * DEPTH_SKEW;
}
