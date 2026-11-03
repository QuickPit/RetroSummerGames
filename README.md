# Retro Summer Games

Ein Browser-Remake im Geiste der klassischen Sommerspiele der 80er – mit
16-Bit-Pixelgrafik, Chiptune-Sounds und dem guten alten „Joystick-Rütteln“,
diesmal per Tastatur.

**Spielen:** https://quickpit.github.io/RetroSummerGames/

## Aktueller Stand (v0.4 – Solo-Prototyp)

Drei Disziplinen gegen drei Computer-Gegner (Rookie, Profi, Champion). Im Startbildschirm wählst du
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

### BMX (Strandkurs)

Inspiriert vom BMX-Rennen aus den kalifornischen Sommerspielen der 80er: alle vier Fahrer starten gleichzeitig
aus dem Startgatter, gewertet wird **Trickpunkte + Zeitbonus**.

| Taste | Aktion |
| --- | --- |
| ← / → (oder A / D) | abwechselnd tippen = treten |
| ↑ (oder W) | Hopser – z. B. über Baumstämme |
| ← / → in der Luft halten | Rückwärts-/Vorwärtssalto bzw. das Rad für die Landung ausrichten |
| Leertaste in der Luft halten | „Superman“ – vor der Landung loslassen, sonst Sturz! |

- Strecke mit Wellen, Rampen mit Lücken (dafür braucht man Tempo), Table, Baumstämmen und Pfützen.
- Punkte gibt es nur bei sauberer Landung: Salto 1000, Superman 1000 pro Sekunde, Big Air 200. Wackelige Landungen halbieren die Punkte.
- Drei Stürze und man ist raus – ohne Zeitbonus.

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
  sim/        Reine Spiellogik ohne Grafik (Hürden, Stabhochsprung, BMX, Wettkampf, Gegner) – getestet
  gfx/        Prozedurale Grafik: Athleten, BMX-Rad, Stadion, Strand, Flaggen, HUD
  audio/      Per Web Audio synthetisierte Soundeffekte
  scenes/     Phaser-Szenen: Titel, Hürdenlauf, Stabhochsprung, BMX, Ergebnis
  data/       Disziplinen, Nationen und lokale Speicherung (Bestleistungen, Auswahl)
```

Alle Grafiken und Sounds werden zur Laufzeit erzeugt – es gibt keine fremden Assets.
Die Spielgefühl-Parameter (Beschleunigung pro Tipp, Sprungdauer, Strafe beim Reißen …)
stehen gesammelt in `PHYSICS` (`src/sim/hurdles.ts`), `VAULT` (`src/sim/polevault.ts`) und `BMX` (`src/sim/bmx.ts`).

## Ausblick

- Online-Multiplayer: jeder am eigenen Rechner, gleichzeitiges Rennen
- Betrieb im Docker-Container
- Weitere Disziplinen
