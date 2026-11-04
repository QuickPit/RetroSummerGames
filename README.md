# Retro Summer Games

Ein Browser-Remake im Geiste der klassischen Sommerspiele der 80er – mit
16-Bit-Pixelgrafik, Chiptune-Sounds und dem guten alten „Joystick-Rütteln“,
diesmal per Tastatur.

**Spielen:** https://quickpit.github.io/RetroSummerGames/

## Aktueller Stand (v0.8 – Einzelspieler)

Fünf Disziplinen gegen drei Computer-Gegner (Rookie, Profi, Champion). Im Startbildschirm wählst du
mit **↑ / ↓** die Zeile (Modus, Disziplin, Nation, Athlet) und änderst sie mit **← / →**.

### Wettkampf „Die Spiele“

Menüzeile **MODUS: WETTKAMPF** – alle fünf Disziplinen nacheinander in fester Reihenfolge
(110 m Hürden, Weitsprung, Stabhochsprung, 100 m Freistil, BMX) gegen dieselben drei Nationen.

- Jede Disziplin gibt es nur **einmal** – „Nochmal“ und R sind im Wettkampf aus (dafür gibt es den Einzelmodus).
- Nach jeder Siegerehrung zeigt **Enter** den Medaillenspiegel der Nationen (Gold vor Silber vor Bronze;
  gleiche Medaillen = gleicher Platz) und die Steuerung der nächsten Disziplin.
- Medaillen gibt es nur für gültige Leistungen auf Platz 1–3 – wer z. B. im Weitsprung nur Fehlversuche hat, geht leer aus, und niemand rückt nach.
- Am Ende steht der **Endstand** mit Gesamtsieger (bei Gleichstand gewinnen mehrere Nationen gemeinsam).
- Danach führt **Enter** zur **Abschlussfeier**: Nachtstadion, Podest der besten drei Nationen mit Flaggen,
  der Gesamtsieger stemmt den Pokal, eigene Siegermelodie, Feuerwerk und Konfetti. Enter = zurück ins Menü.
- **Esc** fragt nach („WETTKAMPF ABBRECHEN?“) und pausiert solange das Spiel – die Zeit läuft nicht weiter.
- Der Spielstand wird bewusst nicht gespeichert: Neu laden = neuer Wettkampf. Persönliche Bestleistungen zählen aber auch hier.

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

### Weitsprung

| Taste | Aktion |
| --- | --- |
| ← / → (oder A / D) | abwechselnd tippen = Anlauf |
| Leertaste am Brett | gedrückt halten = Absprungwinkel steigt, loslassen = Absprung |
| Leertaste in der Luft | kurz vor der Landung: Beine nach vorne strecken |

- Gemessen wird ab der Brettkante – wer zu früh abspringt, verschenkt Weite, wer übertritt, hat einen Fehlversuch (rote Fahne).
- Der beste Absprungwinkel liegt um 30°. Ohne Beinestrecken fällt man nach hinten in den Sand und verliert fast einen Meter.
- Drei Durchgänge gegen drei Computer-Gegner, der beste Versuch zählt; bei Gleichstand entscheidet der zweitbeste.
- Anzeigetafel nach jedem Versuch, Führungs- und Weltrekordlinie (8,95 m) in der Grube, Maßband nach der Landung.

### 100 m Freistil (Schwimmhalle)

| Taste | Aktion |
| --- | --- |
| Leertaste (Start) | Startsprung nach dem Signal – zu früh = Fehlstart |
| ← / → (oder A / D) | **im Takt** abwechselnd tippen = Armzüge |
| ↑ (oder W) | Luft holen |
| Leertaste (an der Wand) | Rollwende kurz vor der Wand (bei 50 m) |

- Rhythmus statt Hämmern: Am schnellsten ist man mit gleichmäßigen ~10 Tipps pro Sekunde. Wer zu hektisch tippt,
  verschluckt sich und verliert Tempo (Anzeige TAKT).
- Jeder Zug kostet Luft (Anzeige LUFT). Atmen kostet kurz Tempo – wer gar nicht atmet, schnappt irgendwann nach Luft.
- Wende: Leertaste im richtigen Abstand zur Wand = PERFEKT; ohne Wende schlägt man an und verliert gut eine Sekunde.
- Gelbe Weltrekord-Linie (46,50 s) im Becken, Siegerehrung in der Halle.

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
| Esc | zurück zum Menü (im Wettkampf mit Rückfrage) |

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

Automatischer Spieltest – ein Bot spielt alle Disziplinen im Headless-Browser durch
(nutzt das global installierte Playwright, Screenshots landen in `e2e-output/`):

```bash
NODE_PATH=$(npm root -g) npm run e2e
```

### Entwicklung mit dem Agenten-Team

Das Spiel wird mit einem Claude-Code-Agenten-Team weiterentwickelt:

| Agent | Aufgabe |
| --- | --- |
| `game-designer` | Spezifikationen, Balancing, Regeln, Texte (`docs/design/`) |
| `game-engineer` | Umsetzung von Disziplinen, Modi und Fehlerbehebungen inkl. Tests |
| `pixel-artist` | Prozedurale Pixelgrafik, Animationen, Sounds |
| `qa-tester` | Tests, Spieltest, Screenshot-Prüfung, Fehlerberichte |
| `code-reviewer` | Unabhängiges Review jedes Diffs |

`/sprint` arbeitet den nächsten Punkt aus [`docs/ROADMAP.md`](docs/ROADMAP.md) ab – Design, Umsetzung,
Test, Review und Veröffentlichung. Was sich geändert hat, steht im [`CHANGELOG.md`](CHANGELOG.md);
Projektwissen und Regeln für alle Agenten in [`CLAUDE.md`](CLAUDE.md).

## Aufbau

```
src/
  sim/        Reine Spiellogik ohne Grafik (Hürden, Stabhochsprung, Weitsprung, BMX, Schwimmen, Wettkampf, Gegner) – getestet
  gfx/        Prozedurale Grafik: Athleten, Schwimmer, BMX-Rad, Stadion, Strand, Schwimmhalle, Flaggen, HUD
  audio/      Per Web Audio synthetisierte Soundeffekte
  scenes/     Phaser-Szenen: Titel, Hürdenlauf, Stabhochsprung, Weitsprung, BMX, Schwimmen, Ergebnis, Medaillenspiegel, Abschlussfeier, Rückfrage
  data/       Disziplinen, Nationen, lokale Speicherung (Bestleistungen, Auswahl) und Wettkampf-Spielstand (nur im Speicher)
scripts/e2e/  Automatischer Spieltest (Bot je Disziplin)
docs/         Roadmap und Design-Spezifikationen
.claude/      Agenten-Team und /sprint-Ablauf
```

Alle Grafiken und Sounds werden zur Laufzeit erzeugt – es gibt keine fremden Assets.
Die Spielgefühl-Parameter (Beschleunigung pro Tipp, Sprungdauer, Strafe beim Reißen …)
stehen gesammelt in `PHYSICS` (`src/sim/hurdles.ts`), `VAULT` (`src/sim/polevault.ts`), `LJ` (`src/sim/longjump.ts`), `BMX` (`src/sim/bmx.ts`) und `SWIM` (`src/sim/swim.ts`).

## Ausblick

- Online-Multiplayer: jeder am eigenen Rechner, gleichzeitiges Rennen
- Betrieb im Docker-Container
- Weitere Disziplinen
