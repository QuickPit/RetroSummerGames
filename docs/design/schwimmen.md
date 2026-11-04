# RSG-06 100 m Freistil (Schwimmen)

## Ziel und Spielgefühl

Rhythmus statt Hämmern: Jeder Tipp ist ein Armzug, und ein Arm braucht Zeit, bis er wieder vorne ist.
Wer ruhig und gleichmäßig im Takt tippt, gleitet schnell durchs Wasser. Wer hämmert, verschluckt sich.
Dazu kommen das Atmen mit ↑ nach der Luftanzeige, der Startsprung auf das Signal und eine Rollwende an
der 50-m-Wand als Timing-Moment. Bezug zum Original: das Freistil-Rennen der Sommerspiele der 80er
(Startsprung, Armzug-Rhythmus, Atmen, Wende). Grafik, Klang und Namen sind eigene.

## Entscheidungen

| # | Entscheidung | Begründung |
|---|---|---|
| S1 | **50-m-Becken × 2 mit Rollwende, schon in Version 1.** Die Wende wird mit der Leertaste ausgelöst. | Ohne Wende gäbe es außer der Reaktion keinen Timing-Moment (Prinzip 2). Die Wende teilt das Rennen in zwei kurze Bahnen, bringt Spannung zur Hälfte, bietet eine Aufholchance und entspricht der echten Disziplin. Sie folgt derselben Logik wie die Hürde („Leertaste kurz vor dem Hindernis“) und ist damit schnell gelernt. |
| S2 | **Der Takt wird je Arm gemessen.** Gewertet wird der Abstand zum letzten Zug **desselben** Arms (L zu L), nicht zum letzten Tipp. | Das ist physikalisch begründet (ein Arm muss erst wieder nach vorne) und fair: Menschen tippen abwechselnd oft „hinkend“ (z. B. 70/130 ms). Gemessen pro Arm stört das nicht (siehe Messung). |
| S3 | **Weiche Strafzone statt harter Kante:** Unterhalb von 0,19 s Armzyklus wird ein Zug linear schwächer. Erst unter 0,13 s gibt es Verschlucken, und danach höchstens einmal je 1,5 s. | So kostet eine einzelne Tipp-Schwankung nur wenig (kein Zufall, Prinzip 4). Hämmern ab etwa 13 Tipps/s ist trotzdem deutlich schlechter als ruhige 10 Tipps/s. Die Sperrzeit verhindert eine Todesspirale: Selbst 18 Tipps/s kommen unter 90 s ins Ziel. |
| S4 | **Jeder Zug kostet Luft** (keine Zeituhr). ↑ füllt die Luft wieder auf, kostet aber 10 % Tempo. Bei leerer Luft schnappt der Schwimmer automatisch nach Luft (halbes Tempo, 0,8 s ohne Vortrieb). | Die Regel ist sichtbar (der Balken sinkt mit jedem Tipp) und ergibt eine echte Abwägung: Wer zu früh atmet, atmet zu oft. Wer zu spät atmet, verliert viel. Das automatische Luftschnappen verhindert ein Steckenbleiben. |
| S5 | **Startablauf wie bei den Hürden:** Pfiff („AUF DEN BLOCK“), dann „AUF DIE PLÄTZE“ mit zufälliger Wartezeit von 1,0–2,2 s, dann das Startsignal. ←/→/Leertaste vor dem Signal = Fehlstart (wird gezählt, keine Disqualifikation). Springt man nicht, folgt nach 3 s ein automatischer Startsprung. | Einheitlich mit den Hürden. Der Auto-Sprung verhindert, dass das Rennen hängen bleibt. |
| S6 | **Anschlag im Ziel automatisch**, wenn die Hand die Startwand berührt (die Zeit wird innerhalb des Schritts interpoliert). | Ein dritter Leertasten-Moment wäre zu viel. Das Ziel ist ohnehin spannend, weil die Gegner sichtbar nebeneinander anschlagen. |
| S7 | **Wettkampf-Position 4:** `['110h', 'long', 'pole', 'swim', 'bmx']`. | Die Disziplinen sind nach Ort gruppiert: Stadion ×3, dann Halle, dann Strand. Das Turmspringen (RSG-09) kommt später neben das Schwimmen in dieselbe Halle. BMX bleibt das spektakuläre Finale. Nach dem timing-lastigen Stabhochsprung ist ein Rhythmus-Rennen eine Abwechslung. |
| S8 | **Im Menü als 5. Eintrag ans Ende** von `EVENTS`. | Die gespeicherte Menüwahl bleibt so gültig, und nichts verrutscht. |
| S9 | **Keine Disqualifikation, kein DNF.** Alle kommen an (`valid: true`). | Fehlstarts werden wie bei den Hürden nur gezählt. Ein ungültiges Schwimmrennen wäre frustrierend und brächte spielerisch nichts. |
| S10 | **Weltrekord 46.50 s** (fiktiv, knapp über dem echten Wert). | Nur ein sehr gleichmäßiges Rennen mit sauberer Wende schlägt ihn (siehe Messung). Der Champion bleibt in 400 Läufen darüber. |

## Steuerung

| Taste | Wirkung |
|---|---|
| PFEIL LINKS/RECHTS (A/D) abwechselnd | Armzug. Gleiche Seite doppelt zählt nicht. |
| PFEIL HOCH (W) | Atmen (0,4 s, füllt danach die Luft). Wirkt nur beim Schwimmen. |
| LEERTASTE | Startsprung nach dem Signal; Rollwende bis 3 m vor der 50-m-Wand. Weiter weg ohne Wirkung (Taste blinkt rot). |
| ENTER | BEREIT / nach dem Anschlag: ERGEBNIS |
| ESC / M / R | wie RaceScene: Einzelmodus = Menü bzw. Neustart. Im Wettkampf öffnet ESC `confirmAbort(this, ms => gunAt += ms)`, solange `resultsShown` falsch ist; R ist aus. |

Fairness: Alle Tasten werden über `raceTimeAt(ev.timeStamp)` gewertet, `ev.repeat` wird ignoriert. Die Sim
läuft mit festem Schritt 1/120 s. Tipps während Startsprung, Wende, Husten und Luftschnappen zählen nicht
(sie geben keinen Zug und lösen kein Verschlucken aus); die Seite wird trotzdem gemerkt.

## Ablauf und Regeln (Sim `src/sim/swim.ts`)

Die Strecke `d` läuft von 0 bis 100 m. Die Position im Becken ist `poolX = d ≤ 50 ? d : 100 − d`, die
Richtung ist +1 bzw. −1. Die Zeit t = 0 ist das Startsignal.

1. **Block** (`block`): Leertaste → `dive`. Die Reaktion ist der Zeitpunkt des Sprungs.
2. **Startsprung** (`dive`): 0,55 s Flug, Eintauchen bei 4,0 m mit 3,0 m/s → `swim`. Unter Wasser
   gleitet der Schwimmer, bis der erste Zug kommt (das ist nur Optik).
3. **Schwimmen** (`swim`): Ein gültiger Tipp ist ein Zug. Es zählt der Armzyklus `c = t − armAt[side]`:
   - `c ≥ fullCycle` (0,19 s ≈ 10,5 Tipps/s): **voller Zug**, `v += strokeImpulse`.
   - `chokeCycle ≤ c < fullCycle`: **hektisch**, der Faktor fällt linear von 1 auf `hastyFactor` (0,35).
   - `c < chokeCycle` (0,13 s): **Verschluckt**, wenn das letzte Verschlucken mindestens 1,5 s zurückliegt.
     Dann gilt `v ×= 0,85`, die Luft sinkt um 0,10, und 0,5 s lang gibt es keinen Vortrieb (Husten).
     Innerhalb der Sperrzeit zählt der Zug als hektisch mit `hastyFactor`.
   - Für die Anzeige gilt ein Zug als „im Takt“, wenn `c ≥ 0,18`.
   - Die Höchstgeschwindigkeit kappt nur den Zuwachs: `v = max(v, min(maxSpeed, v + I·f))`, damit
     Tempo aus Sprung oder Abstoß nicht abgeschnitten wird.
   - Wasserwiderstand: `dv/dt = −(dragLinear·v + dragQuad·v²)`.
4. **Luft**: Sie startet bei 1,0, und jeder Zug kostet 0,012. Bei < 0,25 kommt das Ereignis `lowAir`
   (einmal je Füllung). ↑ zieht 10 % Tempo ab, nach 0,4 s ist die Luft wieder 1,0. Wird bei > 0,6 geatmet,
   zählt das als „früh geatmet“. Bei 0 schnappt der Schwimmer automatisch nach Luft: `v ×= 0,5`,
   0,8 s ohne Vortrieb, Luft 1,0.
5. **Wende**: Leertaste bei einem Wandabstand `w ≤ 3 m` → `flip`. Der Idealabstand ist
   `w* = v · flipTime` (0,45 s Rolle), die Güte `q = clamp(1 − |w − w*| / 0,8)`.
   Die Rolle treibt mit dem aktuellen Tempo (mindestens 0,5 m/s) zur Wand, ohne Vortrieb. An der Wand
   bleibt der Schwimmer, bis 0,45 s seit dem Druck vergangen sind (`wall`), und stößt dann mit
   `lerp(1,6; 2,9; q)` m/s ab. Die Armzyklen werden zurückgesetzt.
   Bewertung: `q ≥ 0,75` PERFEKT, `q ≥ 0,4` GUT, sonst FRÜH (w > w*) oder SPÄT.
   **Ohne Druck** schlägt der Schwimmer an (`open`): v = 0, nach 1,0 s Abstoß mit 1,6 m/s.
6. **Ziel**: Bei d = 100 kommt das Ereignis `finish` mit interpolierter Zeit. Danach wird gebremst wie bei
   den Hürden. Läuft der Spieler vor den Gegnern ein, schwimmen diese per `finishRemaining()` im
   Schnelldurchlauf zu Ende.

**Schnittstelle (Skizze):** `createSwimmer()`, `dive(s,t)`, `stroke(s, side, t): 'full'|'hasty'|'choke'|null`,
`breathe(s,t)`, `flipTurn(s,t)`, `step(s, dt, t): SwimEvent[]`, `poolX(s)`, `heading(s)`, `toWall(s)`.
Die Ereignisse sind `entry`, `stroke{side,quality}`, `choke`, `breath`, `lowAir`, `gasp`, `turn{rating}`, `push`,
`finish{time}`. Im Zustand werden für die Rückmeldung mitgezählt: `strokes`, `inTakt`, `chokes`, `breaths`,
`earlyBreaths`, `gasps`, `turnRating`, `reaction`.

## Startwerte

```ts
export const SWIM = {
  poolLength: 50, distance: 100,
  diveFlight: 0.55, diveDistance: 4.0, diveSpeed: 3.0, autoDiveAfter: 3,
  strokeImpulse: 0.1, dragLinear: 0.2, dragQuad: 0.136, maxSpeed: 2.6,
  fullCycle: 0.19, inTaktCycle: 0.18, chokeCycle: 0.13, hastyFactor: 0.35,
  chokeSpeedFactor: 0.85, chokeAir: 0.1, chokeStun: 0.5, chokeCooldown: 1.5,
  airPerStroke: 0.012, lowAir: 0.25, earlyBreathAbove: 0.6,
  breathTime: 0.4, breathSpeedFactor: 0.9, gaspSpeedFactor: 0.5, gaspStun: 0.8,
  turnZone: 3.0, flipTime: 0.45, flipMinSpeed: 0.5, turnTolerance: 0.8,
  turnPerfect: 0.75, turnGood: 0.4, turnPushMax: 2.9, turnPushMin: 1.6, openTurnDelay: 1.0,
  finishDrag: 1.6,
  worldRecord: 46.5,
} as const;

// Reihenfolge Rookie/Profi/Champion – wird in competition.test.ts geprüft!
export const SWIM_CPU_PROFILES: readonly SwimCpuProfile[] = [
  { name: 'Rookie',   tapRate: 8.0, tapJitter: 0.2,  reaction: 0.26, turnError: 0.4,  breathAt: 0.3 },
  { name: 'Profi',    tapRate: 9.0, tapJitter: 0.14, reaction: 0.2,  turnError: 0.25, breathAt: 0.22 },
  { name: 'Champion', tapRate: 9.9, tapJitter: 0.08, reaction: 0.16, turnError: 0.15, breathAt: 0.15 },
];
```

**Computer-Gegner** (`SwimCpu`, gleiche Eingaben wie ein Mensch): Die Rate wird je Rennen mit 0,95–1,05
multipliziert, die Reaktion mit 0,85–1,15. Die Tipps kommen mit gleichverteilter Schwankung ±`tapJitter`.
Der Gegner atmet, sobald die Luft unter `breathAt` fällt. Beim ersten Eintritt in die Wendezone plant er
`w* + N(0, turnError)` und drückt bei diesem Abstand. Er hämmert nie.

## Balancing (Messung)

Gemessen mit einem temporären Node-Prototyp des Modells oben, je 400 Läufe; das Skript ist wieder gelöscht.
Die Spieler-Modelle tippen mit gleichverteilter Schwankung. Die Reaktion liegt bei 0,35 / 0,30 / 0,22 s, der
Wendefehler (σ) bei 0,5 / 0,35 / 0,2 m, und sie atmen bei 30 / 25 / 20 % Luft.

| Modell | Ø Zeit | beste – schlechteste | im Takt | Medaille / Gold gg. R+P+C |
|---|---|---|---|---|
| Spieler 6 Tipps/s (±25 %) | 64.7 | 63.4 – 66.7 | 100 % | 0 % / 0 % |
| Spieler 8 Tipps/s (±20 %) | 54.2 | 53.5 – 55.8 | 100 % | 57 % / 0 % |
| Spieler 10 Tipps/s (±12 %) | 47.7 | 47.4 – 48.4 | 99 % | 100 % / 50 % |
| Spieler 11 Tipps/s (±12 %) | 47.8 | 47.5 – 48.3 | 58 % | 100 % / 46 % |
| Sehr gut 10,3/s (±5 %, Wende σ 0,1) | 46.6 | 46.5 – 46.8 | 100 % | – |
| Perfekt 10,4/s, ideale Wende | 46.1 | – | 100 % | – |
| Hämmern 12 / 13 / 15 / 18 Tipps/s | 51.0 / 60.8 / 86.7 / 89.3 | 13/s: 0–12 × verschluckt | 18 / 5 / 12 / 11 % | 13/s: 0 % |
| 10/s, aber 10,3/s unruhig (±25 %) | 48.4 | – | 75 % | – |
| 10/s „hinkend“ (L/R 70/130 ms) | 47.5 | – | 100 % | – |
| 10/s ohne Wende (Anschlagen) | 49.2 | – | – | – |
| 10/s, atmet schon bei 60 % | 48.5 | 12 statt 6 Atemzüge | – | – |
| 10/s, atmet nie (5 × Luftschnappen) | 53.7 | – | – | – |
| **CPU Rookie** | 54.4 | 52.3 – 57.2 | 100 % | – |
| **CPU Profi** | 50.5 | 48.9 – 52.6 | 100 % | – |
| **CPU Champion** | 47.8 | 46.6 – 49.2 | 100 % | – |

Fazit: Mit 8 Tipps/s liegt man auf Rookie-Niveau und hat Bronze-Chancen. Mit 10–11 Tipps/s ist man auf
Augenhöhe mit dem Champion. Gleichmäßigkeit bringt rund 1,8 s, die Wende 1,5 s. Hämmern ab 13/s ist
deutlich schlechter. Alle Durchgänge liegen bei 46–90 s.

## Szene `swim` und Kulisse Schwimmhalle (640×360)

Für die Schräge gilt dieselbe Geometrie wie im Stadion (`laneCenterY`, `skewAt`, `PX_PER_M = 26`), Bahn 2 ist
die des Spielers. Ein Becken ist 50 m = 1300 px lang. Die Kamera folgt `poolX` mit `CAMERA_LEAD_X = 170`
in Schwimmrichtung. Auf der Rückbahn liegt der Vorlauf auf der anderen Seite (470); der Wechsel wird über
1,0 s weich überblendet. Die Kamera bleibt zwischen −4 m und 54 m.

```
y  0– 24  HUD oben
y 24– 70  Hallenwand mit großen Fenstern, Dachträger (Parallaxe 0,1), Hallenuhr über der Startwand
y 70–150  Tribüne mit Publikum, 2 Jubel-Frames (Parallaxe 0,55, Erregung wie Stadium.update)
y150–164  Glasbande mit Fantasie-Werbetafeln (0,95)
y164–192  Beckenumgang aus Fliesen in Schrägansicht (1,0)
y192–198  hinterer Beckenrand mit Überlaufrinne
y198–318  Wasser: 4 Bahnen à 30 px, Bahnnummern 1–4 auf den Startblöcken
y318–326  vorderer Beckenrand
y326–360  HUD unten
```

- **Wasser:** Grundton plus Lichtkringel als Kachel mit 4 Frames bei 6 fps, mitlaufend mit der Kamera und leicht
  driftend. In jeder Bahnmitte liegt ein dunkler Bodenstreifen, der 2 m vor jeder Wand in einem „T“ endet.
- **Leinen:** 3 innere und 2 äußere Leinen aus Schwimmkörpern (4×3 px). Die letzten 5 m an jeder Wand sind rot,
  sonst abwechselnd blau und weiß. Bei 15 m sitzt ein gelber Schwimmkörper. Sie wippen ±1 px mit der Welle.
- **Wände:** Die Startwand (x = 0) hat Startblöcke (14 px breit, 18 px hoch, Nummernschild) und Anschlagplatten,
  die beim Anschlag aufblitzen und die Platzzahl zeigen. Die Wendewand liegt bei x = 50 m.
- **Rückenwimpel** quer über alle Bahnen 5 m vor jeder Wand, auf Pfosten am Umgang.
- Farben neu in `COLORS`: `water`, `waterLight`, `waterDark`, `tile`, `tileGrout`, `lane rope` (rot/blau/weiß).

**Athlet (`gfx/swimmer.ts`, `drawSwimmer`, gespiegelt für Richtung −1):**
- Badekappe in Trikotfarbe der Nation und Schwimmbrille. Die Mimik kommt aus dem vorhandenen `mood`-System.
- Posen:
  - Stehen auf dem Block mit Armkreisen (auch als Menü-Vorschau)
  - Hocke am Block
  - Startsprung gestreckt (Rotation −10° bis +25°)
  - Gleiten unter Wasser (abgedunkelt, mit Bläschen)
  - Kraul-Zyklus mit 4 Frames: Jeder gültige Zug schaltet um einen halben Zyklus weiter (Übergang 0,12 s),
    so folgen die Arme sichtbar den Tipps.
  - Atmen: Kopf zur Kamera gedreht, Mund „O“
  - Verschlucken: Kopf hoch, Augen zu, Wasserstrahl
  - Luftschnappen
  - Rolle mit 4 Frames (meist nur Füße und Gischt sichtbar)
  - Anschlag mit gestrecktem Arm
  - Jubel: Oberkörper aus dem Wasser, Faust hoch
  - Müde an der Leine hängen
- **Spritzer:**
  - Bei jedem Zug 3–4 Tropfen am Handeintritt
  - Ab 1 m/s eine Schaumspur hinter den Füßen und eine V-Bugwelle am Kopf
  - Beim Eintauchen nach dem Startsprung 12 Tropfen und ein Ring
  - Gischt an der Wand bei Wende und Anschlag

**HUD (`gfx/swimHud.ts`, Bausteine aus `gfx/hud.ts`):**
- **Oben:** `100 M FREISTIL` (x8), Mini-Karte x180–440 für 0–100 m mit Strich bei 50 und Zielflagge, Zeit 16 px rechts.
- **Unten:**
  - `TEMPO` mit `drawSpeedBar(v, SWIM.maxSpeed)` bei x8–152
  - `drawKeyCaps` (x186/214)
  - `drawActionKey` (x243–295) mit Beschriftung `START` bzw. `WENDE` darüber. Die Taste leuchtet nach dem
    Signal bis zum Sprung und in der Wendezone.
  - `TAKT` (x316): die letzten 8 Züge als Kästchen 9×13 px im Abstand 11 px, grün = im Takt, gelb = hektisch,
    rot = verschluckt.
  - `LUFT ↑` (x420): 16 Segmente à 11 px. Bis 50 % hellblau, darunter gelb, unter 25 % rot und blinkend.
    Während des Atmens füllt sich der Balken sichtbar auf.
- Neuer gemeinsamer Baustein **`drawUpKey`** in `hud.ts` (kleine ↑-Taste, leuchtet beim Atmen); BMX kann ihn
  später mitbenutzen.
- **Meldungen** im Stil von `Hud.setMessage` (24 px bei y110, Unterzeile 8 px bei y142), siehe Texte.

## Texte

| Ort | Text |
|---|---|
| Bereit | `100 M FREISTIL` / `PFEIL LINKS/RECHTS IM TAKT = KRAULEN` · `NICHT HÄMMERN – ZU SCHNELL = VERSCHLUCKEN` · `PFEIL HOCH = ATMEN   LEERTASTE = START/WENDE` · `ENTER: BEREIT` (bei Fehlstarts davor `FEHLSTARTS: {n}`) |
| Start | `AUF DEN BLOCK` · `AUF DIE PLÄTZE` · `LOS!` · nach 1 s ohne Sprung: `LEERTASTE = SPRINGEN!` · Auto-Sprung: `ZU SPÄT GESPRUNGEN` · `FEHLSTART!` / `NICHT VOR DEM SIGNAL SPRINGEN` (rot) |
| Rennen | `VERSCHLUCKT!` / `ZU SCHNELL – RUHIG IM TAKT TIPPEN` (rot, 0,9 s) · Luft < 25 %: Unterzeile `LUFT HOLEN: PFEIL HOCH!` · `LUFTNOT!` / `FRÜHER ATMEN – PFEIL HOCH` · 8 m vor der Wand: `WENDE: LEERTASTE KURZ VOR DER WAND` |
| Wende | `PERFEKTE WENDE!` (gold) · `GUTE WENDE` · `WENDE ZU FRÜH` / `NÄHER AN DER WAND DREHEN` · `WENDE ZU SPÄT` / `ETWAS FRÜHER DREHEN` · `ANGESCHLAGEN!` / `WENDE MIT LEERTASTE VOR DER WAND` |
| Ziel | Zeit (24 px) / `{n}. PLATZ` + `ENTER: ERGEBNIS` |
| Ergebnis | Spalten `ZEIT` · `WENDE` (`PERFEKT` grün, `GUT`, `FRÜH`/`SPÄT` orange, `KEINE` rot) · `TAKT` (`96%`, grün ≥ 80, gelb ≥ 60, sonst rot) |
| Menü (`events.ts`) | `PFEIL LINKS/RECHTS` = `IM TAKT TIPPEN = KRAULEN` · `PFEIL HOCH` = `ATMEN, BEVOR DIE LUFT AUSGEHT` · `LEERTASTE` = `STARTSPRUNG UND WENDE` · `NICHT HÄMMERN!` = `ZU SCHNELL = VERSCHLUCKEN` (Taste ≤ 18, Text ≤ 30 Zeichen) |
| Eintrag | `key: 'swim'`, `name: '100 M FREISTIL'`, `scene: 'swim'`, `bestLabel: 'BESTZEIT'`, `lowerIsBetter: true`, `format: v.toFixed(2)` |

**Rückmeldung nach dem Lauf (Prinzip 5):** `notes` hat höchstens 3 Zeilen (y288/302/316).

Zeile 1 ist **ein** Tipp. Es gilt der erste, der zutrifft, sortiert nach Zeitverlust:
1. `LUFT AUSGEGANGEN ({n}X) – FRÜHER PFEIL HOCH`
2. ab 2 × Verschlucken: `{n}X VERSCHLUCKT – NICHT HÄMMERN, IM TAKT TIPPEN`
3. Wende `open`, `early` oder `late`:
   - `ANGESCHLAGEN – LEERTASTE CA. 1 M VOR DER WAND`
   - `WENDE ZU FRÜH – NÄHER AN DER WAND DREHEN`
   - `WENDE ZU SPÄT – ETWAS FRÜHER DREHEN`
4. weniger als 60 % im Takt: `VIELE HEKTISCHE ZÜGE – ETWAS RUHIGER TIPPEN`
5. ab 3 × früh geatmet: `ZU OFT GEATMET – ERST BEI GELBER LUFT`
6. unter 8,5 Zügen/s: `MEHR TEMPO – SCHNELLER TIPPEN (IDEAL CA. 10/S)`
7. sonst: `SAUBERES RENNEN – STARK!`

Zeile 2: `REAKTION 0.21 S   WENDE: PERFEKT   TAKT 96%`. Zeile 3 nur bei Fehlstarts: `FEHLSTARTS: {n}`.

**Sounds (`sfx.ts`, alle synthetisiert):**
- `whistle()`: langer Pfiff, etwa 2,8 kHz mit Vibrato
- `startBeep()`: elektronischer Startton, Rechteck 880 Hz, 0,25 s
- Fehlstart: das vorhandene `falseStart()`
- `plunge()`: Eintauchen, Rauschen mit Tiefpass
- `stroke(side)`: leiser Wasserschlag, L und R leicht verschieden hoch; nur für den Spieler
- `choke()`: Husten, zwei Rauschstöße
- `breath()`: Einatmen, steigendes Rauschen
- `lowAir()`: Doppel-Piep, einmal je Füllung
- `gasp()`: Luftschnappen
- `flip()`: Blubbern, fallende Blips, mit Stoß an der Wand
- `touch()`: Anschlag-Piep der Platte, danach `finish()` und `crowd(1)`
- Publikum: `crowd()` wie bisher

## Wettkampf und Medaillenspiegel

- `COMPETITION_ORDER = ['110h', 'long', 'pole', 'swim', 'bmx']` (S7). Den Test in `competition.test.ts`
  anpassen und `SWIM_CPU_PROFILES` in den Reihenfolge-Test aufnehmen.
- Die Szene liest Feld, Profil-Index und Look-Seed aus der Session (wie RaceScene).
- `ResultSceneData.event = 'swim'`, `replay` nur im Einzelmodus.
- **Titel:** `ALLE {COMPETITION_ORDER.length}` statt fest `ALLE 4`. Die Hilfe `REIHENFOLGE` lautet
  `HÜR - WEIT - STAB - SCHW - BMX` (30 Zeichen, gleiche Kürzel wie im Spiegel).
- **Menü-Vorschau:** Schwimmer in Badekleidung auf dem Fliesenboden, mit Armkreisen.
- **`MedalsScene`, neues Spaltenraster für 5 Disziplinen:**
  - `COL`: tag 46, place 76, flag 100, code 122, name 154. Die Medaillen rücken zusammen:
    **gold 266, silver 294, bronze 322**.
  - Trennlinie bei **x342**.
  - `EVENT_COLS` wird mit **Mitten** angegeben, die Beschriftung ist darauf zentriert: HÜR **368**,
    WEIT **420**, STAB **472**, SCHW **524**, BMX **576** (Abstand 52 px).
  - Platzhalter: Der längste Name (11 Zeichen) endet bei x242, die Goldscheibe beginnt bei x260. BMX endet
    bei x590 und liegt damit im Panel, das bis x602 reicht.
  - Unterzeilen und Zähler kommen aus `COMPETITION_ORDER.length` (`VON 5`).

## Spieltest-Bot (`scripts/e2e/smoke.cjs`)

- **Einzellauf:** `DISCIPLINES.swim = { scene: 'swim' }` und `BOT_OF_SCENE.swim = 'swim'`.
- **Bot:**
  - `ready` → Enter.
  - Im Rennen bei `player.state.phase === 'block'` die Leertaste drücken.
  - Gleichmäßig mit 9,5 Tipps/s tippen.
  - ↑ bei `air < 0.3`, wenn er nicht gerade atmet.
  - Auf Bahn 1 die Leertaste einmal drücken, sobald `50 − d ≤ v · 0.45` gilt.
  - Nach `finishTime` Enter drücken.
  - Protokoll: Zeit, Wende-Bewertung, Verschlucken, Luftschnappen.
- **Prüfung:** Ergebnis-Szene erreicht, Zeit < 60 s, Wende ≠ `open`, 0 × Luftschnappen.
- **Öffentlich lesbar:** `phase`, `player.state`, `simTime`, `falseStarts`.
- **Wettkampf:** Die Reihenfolgeprüfung lautet `race,longjump,polevault,swim,bmx`. Screenshots im Rennen,
  an der Wende und vom Ergebnis.

## Abnahmekriterien

1. Im Menü gibt es `100 M FREISTIL` als 5. Disziplin mit 4 Hilfezeilen (Taste ≤ 18, Text ≤ 30 Zeichen) und der Schwimmer-Vorschau.
2. Startablauf: Pfiff, `AUF DEN BLOCK`, `AUF DIE PLÄTZE`, Signal. ←/→/Leertaste vor dem Signal ergibt
   `FEHLSTART!` und den Zähler; das Rennen startet neu. Ohne Sprung springt der Schwimmer nach 3 s automatisch.
3. `swim.test.ts` deckt ab:
   - Nur abwechselnde Tipps zählen.
   - Armzyklus ≥ 0,19 s = volle Wirkung. Zwischen 0,13 und 0,19 s anteilig. Unter 0,13 s Verschlucken
     (Tempo, Luft, Husten). Ein zweites Verschlucken innerhalb von 1,5 s ist nicht möglich.
   - „Hinkendes“ Tippen (70/130 ms) erzeugt kein Verschlucken.
   - Luft sinkt je Zug. ↑ füllt nach 0,4 s auf und kostet Tempo. Bei 0 schnappt der Schwimmer automatisch nach Luft.
   - Wende: am Idealabstand `perfect`; ohne Druck `open` mit 1,0 s Wartezeit; Druck > 3 m ohne Wirkung.
     Danach sinkt `poolX`.
   - Die Zielzeit wird interpoliert.
   - Computer-Gegner (je 40 Läufe): Ø Rookie 53–56 s, Profi 49,5–51,5 s, Champion 47–48,7 s, streng
     geordnet. Alle sind < 90 s und der Champion-Durchschnitt liegt über dem Weltrekord.
   - Ein Spieler-Modell mit gleichmäßigen 10/s ist schneller als eines, das mit 13/s hämmert.
4. `SWIM_CPU_PROFILES` heißen `Rookie`, `Profi`, `Champion` in dieser Reihenfolge (`competition.test.ts`).
5. Die Halle zeigt 4 Bahnen mit Leinen, Startblöcken, Wimpeln, Tribüne und bewegtem Wasser.
   Der Spieler schwimmt auf Bahn 2. Auf der Rückbahn schwimmen alle gespiegelt nach links, und die
   Kamera blendet weich um.
6. Die Arme folgen sichtbar jedem Tipp. Beim Atmen dreht sich der Kopf, beim Verschlucken gibt es Husten
   mit Meldung. Die Kästchen der TAKT-Anzeige färben sich je Zug, und die LUFT-Anzeige blinkt unter 25 %.
7. Die Wende-Bewertung erscheint als Meldung. Im Ergebnis stehen die Spalten ZEIT/WENDE/TAKT, darunter
   die Tipp-Zeile nach der Prioritätsliste und die Zusammenfassung.
8. Die Bestzeit wird gespeichert (niedriger ist besser). Unter 46.50 erscheint `WELTREKORD!`.
9. Der Wettkampf spielt die Disziplinen in der Reihenfolge Hürden, Weitsprung, Stabhochsprung, Schwimmen, BMX.
   Der Medaillenspiegel zeigt 5 Spalten nach dem neuen Raster, ohne Überlappung. ESC im Rennen öffnet
   die Rückfrage, und nach NEIN gibt es keinen Zeitsprung und keinen Fehlstart. R ist im Wettkampf aus.
10. `npm run typecheck`, `npm test`, `npm run build` und `npm run e2e` (inklusive `swim` und `wettkampf`) sind
    grün. Die Screenshots sind angesehen: keine ←/→-Glyphen, alle Texte lesbar.
11. Ein Durchgang dauert 46–90 s, gemessen im Test mit den Spieler-Modellen 6/s und 18/s (Hämmern).
12. README (Steuerung/Regeln), CHANGELOG, ROADMAP (RSG-06 abgehakt) und die nächste Minor-Version
    (Paket und Titel) sind aktualisiert.

## Aufgaben

- **Game-Engineer:**
  - `sim/swim.ts` mit Tests und `SwimCpu`.
  - `scenes/SwimScene.ts` nach dem Muster von RaceScene: Startphasen, `finishRemaining`, `confirmAbort`.
  - `events.ts`, `main.ts`, `competition.ts` mit Test.
  - Titel (`ALLE n`, Hilfe), Spaltenraster in `MedalsScene`.
  - Bot, README, CHANGELOG, Version.
- **Pixel-Artist:**
  - `gfx/pool.ts` (Klasse `SwimHall` wie `Stadium`, Texturen in `textures.ts`).
  - `gfx/swimmer.ts` (Posen, Spiegelung, Badeoutfit).
  - Spritzer und Partikel.
  - `gfx/swimHud.ts` und `drawUpKey` in `hud.ts`.
  - Optional: eine gelbe Weltrekord-Linie `WR`, die im Tempo von 46.50 durchs Becken läuft.
