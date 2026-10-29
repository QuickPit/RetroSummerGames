# Retro Summer Games

Ein Browser-Remake im Geiste der klassischen Sommerspiele der 80er – mit
16-Bit-Pixelgrafik, Chiptune-Sounds und dem guten alten „Joystick-Rütteln“,
diesmal per Tastatur.

**Spielen:** https://quickpit.github.io/RetroSummerGames/

## Aktueller Stand (v0.2 – Solo-Prototyp)

Disziplin **110 m Hürden** gegen drei Computer-Gegner (Rookie, Profi, Champion).

| Taste | Aktion |
| --- | --- |
| ← / → (oder A / D) | **abwechselnd** tippen = laufen – zweimal dieselbe Taste zählt nicht |
| Leertaste | über die Hürde springen |
| ↑ / ↓ (im Menü) | Aussehen des eigenen Athleten wählen |
| Enter | Start bestätigen / Ergebnis anzeigen / nochmal |
| R | Rennen neu starten |
| M | Ton an/aus |
| Esc | zurück zum Menü |

- Startsequenz „Auf die Plätze – Fertig – Schuss“ mit zufälliger Wartezeit; wer zu früh tippt, verursacht einen Fehlstart.
- Ideal ist der Absprung so, dass der höchste Punkt des Sprungs über der Hürde liegt. Wer eine Hürde reißt, verliert viel Tempo und stolpert.
- Ergebnis mit Siegerpodest, Medaillen, Reaktionszeit und gespeicherter persönlicher Bestzeit (Weltrekord: 12,80 s).
- Liebevoll animierte Athleten: verschiedene Frisuren, 80er-Stirnbänder, Mimik (konzentriert, angestrengt, „Autsch“, Jubel, erschöpft), Wippen vor dem Start, Jubeln oder Verschnaufen im Ziel.

## Entwicklung

Voraussetzung: Node.js 22+

```bash
npm install
npm run dev       # Entwicklungsserver mit Hot Reload (http://localhost:5173)
npm test          # Unit-Tests der Spiellogik
npm run build     # Produktions-Build nach dist/
```

Jeder Push auf `main` wird per GitHub Actions getestet, gebaut und auf GitHub Pages veröffentlicht
(`.github/workflows/deploy.yml`).

## Aufbau

```
src/
  sim/        Reine Spiellogik ohne Grafik (Physik, Hürden, Computer-Gegner) – getestet
  gfx/        Prozedurale Grafik: Läufer-Animation, Stadion, Flaggen, HUD
  audio/      Per Web Audio synthetisierte Soundeffekte
  scenes/     Phaser-Szenen: Titel, Rennen, Ergebnis
  data/       Nationen und lokale Speicherung (Bestzeit, Nation)
```

Alle Grafiken und Sounds werden zur Laufzeit erzeugt – es gibt keine fremden Assets.
Die Spielgefühl-Parameter (Beschleunigung pro Tipp, Sprungdauer, Strafe beim Reißen …)
stehen gesammelt in `PHYSICS` in `src/sim/hurdles.ts`.

## Ausblick

- Online-Multiplayer: jeder am eigenen Rechner, gleichzeitiges Rennen
- Betrieb im Docker-Container
- Weitere Disziplinen
