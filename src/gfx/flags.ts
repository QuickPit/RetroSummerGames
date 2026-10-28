import type Phaser from 'phaser';
import type { FlagSpec } from '../data/countries';

/** Zeichnet eine Flagge (mit dunklem Rahmen) in ein Graphics-Objekt. */
export function drawFlag(g: Phaser.GameObjects.Graphics, spec: FlagSpec, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x10101c, 1);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);

  switch (spec.kind) {
    case 'h': {
      const weights = spec.weights ?? spec.colors.map(() => 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let yy = y;
      spec.colors.forEach((c, i) => {
        const hh = i === spec.colors.length - 1 ? y + h - yy : Math.round((h * weights[i]) / total);
        g.fillStyle(c, 1);
        g.fillRect(x, yy, w, hh);
        yy += hh;
      });
      break;
    }
    case 'v': {
      const n = spec.colors.length;
      spec.colors.forEach((c, i) => {
        const x0 = x + Math.round((w * i) / n);
        const x1 = x + Math.round((w * (i + 1)) / n);
        g.fillStyle(c, 1);
        g.fillRect(x0, y, x1 - x0, h);
      });
      break;
    }
    case 'nordic': {
      const t = Math.max(2, Math.round(h / 5));
      g.fillStyle(spec.bg, 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(spec.cross, 1);
      g.fillRect(x + Math.round(w * 0.3), y, t, h);
      g.fillRect(x, y + Math.round((h - t) / 2), w, t);
      break;
    }
    case 'swiss': {
      g.fillStyle(spec.bg, 1);
      g.fillRect(x, y, w, h);
      const t = Math.max(2, Math.round(h / 5));
      const l = Math.round(h * 0.6);
      g.fillStyle(spec.cross, 1);
      g.fillRect(x + Math.round((w - t) / 2), y + Math.round((h - l) / 2), t, l);
      g.fillRect(x + Math.round((w - l) / 2), y + Math.round((h - t) / 2), l, t);
      break;
    }
    case 'circle': {
      g.fillStyle(spec.bg, 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(spec.circle, 1);
      g.fillCircle(x + w / 2, y + h / 2, h * 0.3);
      break;
    }
    case 'usa': {
      const stripes = 7;
      for (let i = 0; i < stripes; i++) {
        g.fillStyle(i % 2 === 0 ? 0xbf0a30 : 0xffffff, 1);
        const y0 = y + Math.round((h * i) / stripes);
        const y1 = y + Math.round((h * (i + 1)) / stripes);
        g.fillRect(x, y0, w, y1 - y0);
      }
      const cw = Math.round(w * 0.45);
      const ch = Math.round((h * 4) / stripes);
      g.fillStyle(0x002868, 1);
      g.fillRect(x, y, cw, ch);
      g.fillStyle(0xffffff, 1);
      for (let sx = x + 2; sx < x + cw - 1; sx += 3) {
        for (let sy = y + 1; sy < y + ch - 1; sy += 3) g.fillRect(sx, sy, 1, 1);
      }
      break;
    }
    case 'jamaica': {
      g.fillStyle(0x009b3a, 1);
      g.fillRect(x, y, w, h);
      g.fillStyle(0x000000, 1);
      g.fillTriangle(x, y, x, y + h, x + w / 2, y + h / 2);
      g.fillTriangle(x + w, y, x + w, y + h, x + w / 2, y + h / 2);
      g.lineStyle(Math.max(2, h / 6), 0xfed100, 1);
      g.lineBetween(x, y, x + w, y + h);
      g.lineBetween(x + w, y, x, y + h);
      break;
    }
  }
}
