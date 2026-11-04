import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { Medal } from '../sim/competition';

// Bausteine für Medaillenspiegel und Rückfrage. Ziffern und Texte setzt die
// Szene als Text darüber – hier wird nur gezeichnet.

export const MEDAL_COLORS: Record<Medal, number> = {
  gold: COLORS.gold,
  silver: COLORS.silver,
  bronze: COLORS.bronze,
};

export const PLACE_MEDALS: readonly Medal[] = ['gold', 'silver', 'bronze'];

/** Medaillenkreis als Spaltenkopf (G/S/B), etwa 12 px groß, Mitte bei cx/cy. */
export function drawMedalHeader(g: Phaser.GameObjects.Graphics, cx: number, cy: number, medal: Medal): void {
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(cx, cy, 6);
  g.fillStyle(MEDAL_COLORS[medal], 1);
  g.fillCircle(cx, cy, 5);
}

/** Platz-Plakette 12 px für Platz 1–3, die Ziffer kommt als Text darüber. */
export function drawPlaceBadge(g: Phaser.GameObjects.Graphics, cx: number, cy: number, place: 1 | 2 | 3): void {
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(cx, cy, 6);
  g.fillStyle(MEDAL_COLORS[PLACE_MEDALS[place - 1]], 1);
  g.fillCircle(cx, cy, 5);
}

/** Hervorhebung der eigenen Zeile in Tabellen */
export function drawPlayerRow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(COLORS.yellow, 0.15);
  g.fillRect(x, y, w, h);
}

/** Dunkler Kasten mit gelbem Rahmen (z. B. „NÄCHSTE“ oder Gesamtsieger) */
export function drawInfoBox(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(COLORS.hudBg, 0.8);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, COLORS.yellow, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export const CONFIRM_BOX = { x: 140, y: 130, w: 360, h: 100 } as const;

/** Rückfrage: Abdunklung des ganzen Bilds und Kasten mit gelbem Rahmen */
export function drawConfirmBox(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(COLORS.hudBg, 0.7);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const { x, y, w, h } = CONFIRM_BOX;
  g.fillStyle(COLORS.hudBg, 1);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, COLORS.yellow, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** Auswahl-Dreieck vor einer Option; x/y = linke obere Ecke einer 16-px-Zeile */
export function drawChoiceMarker(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(COLORS.yellow, 1);
  g.fillTriangle(x, y + 2, x, y + 14, x + 7, y + 8);
}
