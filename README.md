# Retro Summer Games

Ein Browser-Remake im Geiste der klassischen Sommerspiele der 80er – mit
16-Bit-Pixelgrafik, Chiptune-Sounds und dem guten alten „Joystick-Rütteln“,
diesmal per Tastatur.

**Spielen:** https://quickpit.github.io/RetroSummerGames/

## Aktueller Stand (v0.3 – Solo-Prototyp)

Zwei Disziplinen gegen drei Computer-Gegner (Rookie, Profi, Champion). Im Startbildschirm wählst du
mit **↑ / ↓** die Zeile (Disziplin, Nation, Athlet) und änderst sie mit **← / →**.

### 110 m Hürden

| Taste | Aktion |
| --- | --- |
| ← / → (oder A / D) | **abwechselnd** tippen = laufen – zweimal dieselbe Taste zählt nicht |
| Leertaste | über die Hürde springen |
| R | Rennen neu starten |

- Startsequenz „Auf die Plätze – Fertig – Schuss“ mit zufälliger Wartezeit; wer zu früh tippt, verursacht einen Fehlstart.
- Ideal ist der Absprung so, dass der höchste Punkt des Sprungs über der Hürde liegt. Wer eine Hürde reißt, verliert viel Tempo und stolpert.

### Stabhochsprung

| Taste | Aktion |
| --- | --- |
| ← / → (oder A / D) | abwechselnd tippen = Anlauf |
| Leertaste (1.) | an der weißen Marke den Stab einstechen |
| Leertaste (2.) | loslassen, wenn der Stab senkrecht steht |
| P | aktuelle Höhe auslassen (vor dem ersten Versuch an dieser Höhe) |
| E | als Letzter im Wettkampf aufhören |

- Je schneller der Anlauf, desto höher der Sprung – Einstich und Loslassen entscheiden, wie viel davon ankommt.
- Wettkampf nach echten Regeln: die Latte steigt von 3,80 m an, drei Versuche pro Höhe, nach drei Fehlversuchen ist Schluss.
  Bei gleicher Höhe entscheiden die wenigeren Fehlversuche.
- Nach jedem Sprung gibt es Rückmeldung zu Sprunghöhe, Einstich und Loslassen.

### Allgemein

| Taste | Aktion |
| --- | --- |
| Enter | Start bestätigen / weiter / nochmal |
| M | Ton an/aus |
| Esc | zurück zum Menü |

- Ergebnis mit Siegerpodest, Medaillen und gespeicherter persönlicher Bestleistung je Disziplin.
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
  sim/        Reine Spiellogik ohne Grafik (Physik, Hürden, Stabhochsprung, Wettkampf, Gegner) – getestet
  gfx/        Prozedurale Grafik: Läufer-Animation, Stadion, Flaggen, HUD
  audio/      Per Web Audio synthetisierte Soundeffekte
  scenes/     Phaser-Szenen: Titel, Hürdenlauf, Stabhochsprung, Ergebnis
  data/       Disziplinen, Nationen und lokale Speicherung (Bestleistungen, Auswahl)
```

Alle Grafiken und Sounds werden zur Laufzeit erzeugt – es gibt keine fremden Assets.
Die Spielgefühl-Parameter (Beschleunigung pro Tipp, Sprungdauer, Strafe beim Reißen …)
stehen gesammelt in `PHYSICS` (`src/sim/hurdles.ts`) und `VAULT` (`src/sim/polevault.ts`).

## Ausblick

- Online-Multiplayer: jeder am eigenen Rechner, gleichzeitiges Rennen
- Betrieb im Docker-Container
- Weitere Disziplinen
