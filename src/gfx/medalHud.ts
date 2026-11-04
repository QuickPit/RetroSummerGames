import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Medal } from '../sim/competition';

// Bausteine für Medaillenspiegel und Rückfrage. Ziffern und Texte setzt die
// Szene als Text darüber – hier wird nur gezeichnet, Pixel für Pixel.

export const MEDAL_COLORS: Record<Medal, number> = {
  gold: COLORS.gold,
  silver: COLORS.silver,
  bronze: COLORS.bronze,
};

export const PLACE_MEDALS: readonly Medal[] = ['gold', 'silver', 'bronze'];

/** Halbe Breite einer Medaille: sie reicht von cx-6 bis cx+6 (13 px). */
export const MEDAL_R = 6;

const FRAME_DIM = 0x6b5a1e;
const RIBBON = { left: COLORS.red, leftDark: 0xa82e20, right: 0x2f6fd6, rightDark: 0x1f4a99 };

function scale(color: number, f: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return Phaser.Display.Color.GetColor(ch(c.red), ch(c.green), ch(c.blue));
}

function mix(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return Phaser.Display.Color.GetColor(m(ca.red, cb.red), m(ca.green, cb.green), m(ca.blue, cb.blue));
}

/** Pixelkreis mit Durchmesser d: je Zeile die erste Spalte (die letzte ist d-1-x0) */
function discRows(d: number): number[] {
  const r = d / 2;
  const rows: number[] = [];
  for (let i = 0; i < d; i++) {
    const y = i + 0.5 - r;
    rows.push(Math.round(r - Math.sqrt(Math.max(0, r * r - y * y))));
  }
  return rows;
}
const DISC13 = discRows(13);
const DISC11 = discRows(11);
const DISC9 = discRows(9);

function inDisc(rows: number[], i: number, j: number): boolean {
  const d = rows.length;
  return j >= 0 && j < d && i >= rows[j] && i <= d - 1 - rows[j];
}

/**
 * Medaille 13×13 mit Kontur, Rand (oben links hell, unten rechts dunkel),
 * glattem Feld für Ziffer/Buchstabe und Glanzpunkt. Mitte bei px/py.
 */
function drawMedalDisc(g: Phaser.GameObjects.Graphics, px: number, py: number, medal: Medal): void {
  const base = MEDAL_COLORS[medal];
  const light = mix(base, 0xffffff, 0.5);
  const dark = scale(base, 0.6);
  const x0 = px - MEDAL_R;
  const y0 = py - MEDAL_R;
  for (let j = 0; j < 13; j++) {
    for (let i = 0; i < 13; i++) {
      if (!inDisc(DISC13, i, j)) continue;
      const dx = i - MEDAL_R;
      const dy = j - MEDAL_R;
      let c: number;
      if (!inDisc(DISC11, i - 1, j - 1)) c = COLORS.outline;
      else if (!inDisc(DISC9, i - 2, j - 2)) c = dx + dy <= -2 ? light : dx + dy >= 2 ? dark : base;
      else c = dx + dy >= 6 ? scale(base, 0.85) : base;
      g.fillStyle(c, 1);
      g.fillRect(x0 + i, y0 + j, 1, 1);
    }
  }
  // Glanzpunkt oben links auf dem Rand
  g.fillStyle(0xffffff, 1);
  g.fillRect(px - 4, py - 3, 1, 2);
  g.fillRect(px - 3, py - 4, 1, 1);
}

// Band über der Medaille (Spaltenkopf): o Kontur, r/R und b/B Bandhälften, c/C Öse
const RIBBON_MAP = ['oooo...oooo', 'orRo...obBo', '.orRo.obBo.', '..orRobBo..', '...ocCco...'];

/** Medaille mit Band als Spaltenkopf (G/S/B). Mitte der Scheibe bei px/py, das Band reicht bis py-11. */
export function drawMedalHeader(g: Phaser.GameObjects.Graphics, px: number, py: number, medal: Medal): void {
  const colors: Record<string, number> = {
    o: COLORS.outline,
    r: RIBBON.left,
    R: RIBBON.leftDark,
    b: RIBBON.right,
    B: RIBBON.rightDark,
    c: scale(MEDAL_COLORS[medal], 0.6),
    C: MEDAL_COLORS[medal],
  };
  RIBBON_MAP.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = colors[row[i]];
      if (c === undefined) continue;
      g.fillStyle(c, 1);
      g.fillRect(px - 5 + i, py - 11 + j, 1, 1);
    }
  });
  drawMedalDisc(g, px, py, medal);
}

/**
 * Platz-Plakette für Platz 1–3 (Medaille ohne Band), Mitte bei px/py.
 * Die Ziffer setzt die Szene mit linker oberer Ecke bei px-3/py-3.
 */
export function drawPlaceBadge(g: Phaser.GameObjects.Graphics, px: number, py: number, place: 1 | 2 | 3): void {
  drawMedalDisc(g, px, py, PLACE_MEDALS[place - 1]);
}

/** Doppelrahmen im HUD-Stil: gelbe Linie außen, gedämpfte innen */
function drawFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, double = true): void {
  g.lineStyle(1, COLORS.yellow, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (double) {
    g.lineStyle(1, FRAME_DIM, 1);
    g.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  }
  // Ecken als kleine Nieten
  g.fillStyle(COLORS.white, 1);
  for (const [cx, cy] of [
    [x, y],
    [x + w - 1, y],
    [x, y + h - 1],
    [x + w - 1, y + h - 1],
  ]) {
    g.fillRect(cx, cy, 1, 1);
  }
}

/**
 * Dunkles Tabellen-Panel für den Medaillenspiegel: Kopfzeile etwas heller,
 * Trennlinie darunter, Zeilen mit leichtem Zebra-Muster.
 */
export function drawTablePanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  headH: number,
  rowYs: readonly number[],
  rowH: number,
): void {
  const last = rowYs[rowYs.length - 1] ?? y + headH;
  const h = last + rowH - y + 4;
  g.fillStyle(COLORS.hudBg, 0.9);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x23263a, 1);
  g.fillRect(x + 1, y + 1, w - 2, headH - 1);
  g.fillStyle(0x4a4e63, 1);
  g.fillRect(x + 1, y + headH, w - 2, 1);
  rowYs.forEach((ry, i) => {
    if (i % 2 === 1) {
      g.fillStyle(0xffffff, 0.04);
      g.fillRect(x + 1, ry, w - 2, rowH);
    }
  });
  drawFrame(g, x, y, w, h, false);
}

/** Senkrechte gepunktete Trennlinie zwischen Spaltengruppen */
export function drawColumnDivider(g: Phaser.GameObjects.Graphics, x: number, y0: number, y1: number): void {
  g.fillStyle(0x4a4e63, 1);
  for (let y = y0; y < y1; y += 2) g.fillRect(x, y, 1, 1);
}

/** Hervorhebung der eigenen Zeile in Tabellen */
export function drawPlayerRow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(COLORS.yellow, 0.16);
  g.fillRect(x, y, w, h);
  g.fillStyle(COLORS.yellow, 0.5);
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
}

/**
 * Gelbes Wimpel-Schild „DU“ am Zeilenanfang (Text setzt die Szene bei x+3/y).
 * x/y = linke obere Ecke der Textzeile; das Schild reicht bis x+24.
 */
export function drawYouTag(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const top = y - 2;
  const edge = (r: number) => x + 19 + Math.min(r, 10 - r);
  for (let r = 0; r <= 10; r++) {
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(x, top + r, edge(r) - x + 1, 1);
  }
  for (let r = 1; r <= 9; r++) {
    g.fillStyle(r === 1 ? 0xfff0a0 : r === 9 ? 0xc49a1c : COLORS.yellow, 1);
    g.fillRect(x + 1, top + r, edge(r) - x - 1, 1);
  }
}

/** Dunkler Kasten mit gelbem Doppelrahmen (z. B. „NÄCHSTE“ oder Gesamtsieger) */
export function drawInfoBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(COLORS.hudBg, 0.88);
  g.fillRect(x, y, w, h);
  drawFrame(g, x, y, w, h);
}

export const CONFIRM_BOX = { x: 140, y: 130, w: 360, h: 100 } as const;

/** Rückfrage: Abdunklung des ganzen Bilds und Kasten mit Schatten und gelbem Doppelrahmen */
export function drawConfirmBox(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(COLORS.hudBg, 0.7);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const { x, y, w, h } = CONFIRM_BOX;
  g.fillStyle(0x000000, 0.45);
  g.fillRect(x + 4, y + 4, w, h);
  g.fillStyle(COLORS.hudBg, 1);
  g.fillRect(x, y, w, h);
  drawFrame(g, x, y, w, h);
}

/**
 * Auswahl-Pfeil vor einer Option; x/y = linke obere Ecke einer 16-px-Zeile.
 * Mit `width` (Breite des Options-Texts) kommt ein heller Balken dahinter.
 */
export function drawChoiceMarker(g: Phaser.GameObjects.Graphics, x: number, y: number, width = 0): void {
  if (width > 0) {
    g.fillStyle(COLORS.yellow, 0.14);
    g.fillRect(x - 4, y - 3, width + 22, 22);
  }
  // Pixel-Pfeil 7×13 mit Kontur, Licht von oben
  for (let r = -1; r <= 13; r++) {
    const w = Math.min(r + 1, 13 - r) + 2;
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(x - 1, y + 2 + r, w, 1);
  }
  for (let r = 0; r <= 12; r++) {
    const w = Math.min(r, 12 - r) + 1;
    g.fillStyle(COLORS.yellow, 1);
    g.fillRect(x, y + 2 + r, w, 1);
    // obere Kante hell, untere dunkel
    g.fillStyle(r <= 6 ? 0xfff0a0 : 0xc49a1c, 1);
    g.fillRect(r <= 6 ? x : x + w - 1, y + 2 + r, 1, 1);
    if (r <= 6) g.fillRect(x + w - 1, y + 2 + r, 1, 1);
  }
}
