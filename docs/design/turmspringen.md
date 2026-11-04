# RSG-09 Turmspringen (10 m)

## Ziel und Spielgefühl

Drei Sprünge vom 10-m-Turm, jeder dauert keine zwei Sekunden in der Luft. Am Turm holt man mit
abwechselndem Tippen Schwung (die Arme schwingen immer höher) und springt im Hochpunkt des
Armschwungs ab. In der Luft hält man die Leertaste für den Salto und lässt sie im richtigen Moment los.
Dann öffnet sich der Springer und taucht senkrecht ein. Fünf Kampfrichter heben ihre Tafeln.
Bezug zum Original: das Turmspringen der Sommerspiele der 80er (Sprung ansagen, in der Luft drehen,
öffnen, Punktrichter). Grafik, Klang, Namen und Sprungliste sind eigene.

**Voraussetzung:** RSG-06 (Schwimmhalle, `gfx/pool.ts`, `gfx/swimmer.ts`) ist auf `main`.

## Entscheidungen

| # | Entscheidung | Begründung |
|---|---|---|
| T1 | **Tippen = Schwung holen am Turm.** Jeder gültige Tipp verstärkt den Armschwung. Der geglättete Schwung bestimmt die Absprungkraft und damit **Höhe und Drehimpuls**. In der Luft hat Tippen keine Wirkung. | Das entspricht Prinzip 2 und der Physik (die Drehung kommt aus dem Absprung). So entscheidet das Tippen, welche Sprünge man schafft, statt nur als Pflichtübung vorweg zu laufen. Tippen in der Luft (1,8 s) wäre gleichzeitig mit dem Halten der Leertaste kaum spielbar. |
| T2 | **Zwei Timing-Momente mit einer Taste:** Leertaste **drücken** im Hochpunkt des Armschwungs = Absprung, **halten** = Salto in der Sprungposition, **loslassen** = öffnen. | Es ist dasselbe Muster wie im Weitsprung („HALTEN = WINKEL, LOS = SPRUNG“) und damit schnell gelernt. Der Armschwung hat einen festen Takt von 1,0 s mit Tick-Ton, deshalb ist der Absprung ein vorhersehbarer Rhythmus-Moment und keine Reaktionsprobe. |
| T3 | **Nach dem Öffnen dreht der Körper nicht weiter, sondern richtet sich aus** (höchstens 70°/s, nur bei Fehlern ≤ 60°). Ein Schraubensprung richtet sich erst nach der Schraube aus. | Ohne diese Hilfe läge das Zeitfenster für „perfekt“ bei ±10 ms, das wäre unfair. Mit ihr gilt: Wer früh genug öffnet, hat Zeit zum Ausrichten, wer zu spät öffnet, nicht. Das ergibt die verständliche Regel „lieber etwas früher öffnen“, und schwere Sprünge bleiben knapp (siehe Zeitfenster). |
| T4 | **Sprung wählen aus 8 Sprüngen mit Schwierigkeitsgrad (SG) 1.2–3.7.** Je Wettkampf ist jeder Sprung nur einmal erlaubt. Die Liste zeigt den nötigen Schwung. | Die Wahl ist die strategische Ebene (Risiko gegen Punkte), wie beim echten Turmspringen. Wer 8 Tipps/s schafft, wählt mittlere Sprünge, wer 11/s schafft, wählt den 4½-fachen. „Jeder nur einmal“ sorgt für Abwechslung. Der Kopfsprung und die Sprünge mit 1½ Salti machen auch schwächere Spieler nicht chancenlos. |
| T5 | **3 Durchgänge**, Reihenfolge wie im Weitsprung. Die Computer-Sprünge laufen **nur auf der Anzeigetafel** (Sprung, Noten, Punkte), werden aber mit derselben Sim berechnet. | 3 eigene Sprünge à ~12 s und 9 Tafel-Einblendungen à 1,5 s ergeben ~55–70 s (Prinzip 3). Animierte Gegner-Sprünge würden mehr als 90 s kosten. Die gemeinsame Sim hält die Gegner ehrlich. |
| T6 | **Wertung:** 5 Kampfrichter, Noten 0–10 in 0,5er-Schritten. Höchste und niedrigste Note werden gestrichen, Summe der 3 mittleren × SG. **Deterministisch:** Jeder Richter hat eine feste Tendenz (−0,4 … +0,4), dazu kommt eine Streuung von ±0,3, die aus den Messwerten des Sprungs geseedet wird. | Gleiche Ausführung bedeutet gleiche Noten, und Tests sind reproduzierbar. Die Tafeln wirken trotzdem lebendig. Die Streuung ist klein: σ der Notensumme 0,37, das sind ±1 Punkt je Sprung (Prinzip 4). |
| T7 | **Fehlsprünge** (nicht geöffnet, Klatscher ab 75° Abweichung, falsche Saltozahl) sind gültig, aber auf die Note **2,0** gedeckelt. Es gibt keine Disqualifikation und kein DNF, alle Einträge sind `valid: true`. | Der Sprung ist missglückt, aber nicht ungültig. Ein Wettkampf ohne Ergebnis wäre frustrierend. Die Deckelung macht zu schwere Sprünge zum klaren Risiko: Ein Fehlsprung mit SG 3.7 bringt etwa 22 P, ein sauberer Sprung mit SG 1.6 etwa 37 P. |
| T8 | **Schraube = PFEIL HOCH**, ein Druck je Schraube (0,45 s), nur beim Schraubensprung. | Das ist die einheitliche Zusatzaktion (CLAUDE.md). Eine kurze Taste reicht, die Herausforderung liegt in der Abstimmung mit dem Öffnen. Mehr Schraubensprünge würden die Mechanik verwässern (Prinzip „lieber eine klare Mechanik“). |
| T9 | **Wettkampf-Position 5:** `['110h','long','pole','swim','dive','bmx']`. | Schwimmen und Turmspringen liegen in derselben Halle, so gibt es keinen doppelten Kulissenwechsel. Nach dem Rhythmus-Rennen folgt eine Präzisionsdisziplin. BMX bleibt das Finale am Strand. |
| T10 | **Weltrekord 281.00 P** (fiktiv, für 3 Sprünge). | Mit fehlerfreiem Timing gelingt er in 92 % der Fälle, mit sehr gutem Timing in 3 %. Der Champion kommt in 0,6 % der Fälle darüber (siehe Messung). |
| T11 | Meldung `ARSCHBOMBE!` für das Eintauchen in der Hocke. | Das Wort ist harmlos und in jedem Freibad bekannt. Es ist die kleine Überraschung aus Prinzip 6. Ausweichtext, falls der Owner widerspricht: `BOMBE!`. |

## Steuerung

| Taste | Wirkung |
|---|---|
| PFEIL HOCH/RUNTER (W/S) | Sprungwahl: Zeile wählen |
| ENTER | Sprung bestätigen · nach der Wertung WEITER · Tafel: SPRINGEN. Die Leertaste bestätigt hier **nicht**, damit sie nicht in den Absprung hineinwirkt. |
| PFEIL LINKS/RECHTS (A/D) abwechselnd | Schwung holen (nur am Turm, gleiche Seite doppelt zählt nicht) |
| LEERTASTE drücken | Absprung (erst nach dem ersten Tipp, vorher Hinweis) |
| LEERTASTE halten / loslassen | in der Luft: Sprungposition (Salto) / öffnen. Erneutes Drücken dreht wieder weiter. |
| PFEIL HOCH (W) in der Luft | eine Schraube starten (nur Schraubensprung, sonst blinkt die Taste rot) |
| ESC / M / R | Einzelmodus: Menü / Ton / Neustart der Disziplin. Im Wettkampf öffnet ESC `confirmAbort(this, ms => …)`: Die Zeitanker werden verschoben, eine gehaltene Leertaste gilt nach NEIN als losgelassen. R ist im Wettkampf aus. |

Fairness: Alle Tasten werden über den Zeitstempel (`ev.timeStamp` → Sim-Zeit) gewertet, `ev.repeat` wird ignoriert,
Keyup der Leertaste wird ebenfalls zeitgenau gewertet. Die Sim läuft mit festem Schritt 1/120 s, und Eingaben
wirken exakt zu ihrem Zeitpunkt. Der Schwung wird für den Absprung geglättet.

## Ablauf und Regeln (Sim `src/sim/dive.ts`)

Welt: x in m (0 = Plattformkante, positiv = über dem Becken), y = Hüfthöhe über dem Wasser. Die Drehung
`rot` wird in Grad gezählt (0 = aufrecht, 180 = Kopf unten, vorwärts positiv). Ein Sprung mit n½ Salti hat
das Ziel `target = n,5 · 360°`.

1. **Wahl** (`select`, nur Szene): Liste der 8 Sprünge, bereits gesprungene sind grau. Mit ENTER geht der
   Springer 0,8 s an die Kante (`walk`), danach folgt `ready`.
2. **Bereit** (`ready`): Der Springer steht an der Kante. Der erste gültige Tipp startet `swing` zur Zeit t0.
3. **Schwung** (`swing`): Jeder gültige Tipp ergibt `raw += swingImpulse`. `raw` fällt mit `swingDamping`, und
   `swing = min(1, EMA(raw, swingSmooth))`. Das Gleichgewicht liegt bei ≈ 0,09 × Tipprate (Messung unten).
   Die **Hochpunkte** der Arme liegen bei `t0 + 0,25 + k · swingPeriod` (Ereignis `peak` → Tick).
   - Leertaste → Absprung. `dt` ist der Abstand zum nächstgelegenen Hochpunkt,
     `quality = clamp(1 − |dt| / takeoffWindow)`. Die Richtung (früh/spät) wird für die Rückmeldung gemerkt.
   - `power = swing · lerp(takeoffMinFactor, 1, quality)`
   - Ohne Druck springt der Springer `maxSwingTime` s nach t0 automatisch ab (`quality = 0`, Leertaste nicht gehalten).
4. **Flug** (`air`):
   - `vy0 = lerp(upSpeedMin, upSpeedMax, power)`, `vx = forwardSpeed`. Daraus ergeben sich 1,59–1,89 s Flugzeit
     und ein Scheitel 0,1–0,8 m über der Plattform.
   - **Gehalten:** `rot += power · spinRate[position] · 360 · dt`.
   - **Offen:** keine Eigendrehung. Ist `|rot − target| ≤ alignRange` und läuft keine Schraube, bewegt sich `rot`
     mit höchstens `alignRate` auf `target` zu (ohne Überschießen).
   - **Schraube** (↑): nur bei `twists > 0`, nur eine zur Zeit, höchstens `twists` Stück, Dauer `twistTime`.
   - Ereignisse: `halfTurn` je 180°, `open`, `twistStart`/`twistEnd`.
5. **Eintauchen**, wenn y ≤ `entryHip`. Dabei gilt `δ = rot − target`, `e = |δ|`,
   `line` = Zeit seit dem letzten Öffnen (0, wenn gehalten).

   | Bewertung (`rating`) | Bedingung | Spritzer | Fehlsprung |
   |---|---|---|---|
   | `bomb` | Leertaste beim Eintauchen gehalten | 3 | ja |
   | `wrong` | e ≥ 270° (Salto fehlt / zu viel) | 2 | ja |
   | `belly` / `back` | δ ≤ −75° / δ ≥ +75° (Bauch-/Rückenklatscher) | 3 | ja |
   | `perfect` | e ≤ 8° | 0 (bzw. 1, wenn line < 0,25 s oder Schraube offen) | – |
   | `clean` | e ≤ 20° | 1 | – |
   | `early` / `late` | sonst, δ < 0 / δ > 0 | 2 | – |

6. **Unter Wasser** (`water`) 1,2 s (Bläschen), dann taucht der Springer auf und winkt bzw. schüttelt den Kopf.
   Die Sim liefert `entry{rating, splash}` und `surface`.

**Basisnote** (Teilgüten 0..1):
- `qTakeoff = quality`
- `qHeight = clamp((power − 0,5) / 0,5)`
- `qEntry = clamp(1 − e / 75)`
- `qLine = clamp(line / lineTimeFull)`

`base = 10 · (0,15·qTakeoff + 0,15·qHeight + 0,5·qEntry + 0,2·qLine) − 2,5 · fehlende/unfertige Schrauben`.
Bei einem Fehlsprung gilt `min(base, failCap)`. Die Basisnote wird auf 0..10 begrenzt.

**Kampfrichter** `judge(state, def)`:
- Der Seed ist ein Hash aus `round(δ·10)`, `round(quality·1000)`, `round(power·1000)`, `round(line·1000)`, Schrauben
  und Sprung-ID, daraus `createRng(seed)`.
- Note des Richters i: `clamp(round2(base + judgeBias[i] + judgeNoise · (2·rng() − 1)), 0, 10)`, wobei `round2` auf 0,5 rundet.
- Höchste und niedrigste Note werden gestrichen (bei gleichen Noten die erste gefundene).
- `points = round(Summe · dd, 2)`.
- Rangliste: Gesamtpunkte, dann bester Einzelsprung, dann zweitbester.

**Schnittstelle (Skizze):** `createDive(def)`, `swingTap(s, side, t)`, `takeoff(s, t)`, `setHold(s, held, t)`, `twist(s, t)`,
`stepDive(s, dt, t): DiveEvent[]`, `timeToPeak(s, t)`, `judge(s): Judgement` (`notes[5]`, `dropped[2]`, `sum`, `points`,
`rating`, `splash`, `tip`), `minPower(def)`, `simulateCpuDive(profile, def, rng): Judgement` (headless, dieselben Funktionen).

## Sprungliste und Startwerte

| ID | Name (UI) | Salti | Position | Schr. | SG | nötiger Schwung* |
|---|---|---|---|---|---|---|
| `kopf` | KOPFSPRUNG GESTRECKT | ½ | gestreckt | 0 | 1.2 | 24 % |
| `15h` | 1½ SALTI GEHOCKT | 1½ | Hocke | 0 | 1.6 | 36 % |
| `15p` | 1½ SALTI GEHECHTET | 1½ | Hecht | 0 | 1.9 | 46 % |
| `25h` | 2½ SALTI GEHOCKT | 2½ | Hocke | 0 | 2.2 | 58 % |
| `25p` | 2½ SALTI GEHECHTET | 2½ | Hecht | 0 | 2.6 | 72 % |
| `15s2` | 1½ SALTI 2 SCHRAUBEN | 1½ | gestreckt | 2 | 2.6 | 66 % |
| `35h` | 3½ SALTI GEHOCKT | 3½ | Hocke | 0 | 3.2 | 77 % |
| `45h` | 4½ SALTI GEHOCKT | 4½ | Hocke | 0 | 3.7 | 96 % |

\* `minPower(def)`: kleinste Kraft, bei der das Ziel `lineTimeFull` vor dem Eintauchen erreicht wird (bei perfektem Absprung
= nötiger Schwung). Die Liste in der Sim heißt `DIVES` (Reihenfolge wie oben).

```ts
export const DIVE = {
  platform: 10, standHip: 1.0, entryHip: 1.0, gravity: 9.81, forwardSpeed: 1.2,
  swingPeriod: 1.0, swingFirstPeak: 0.25, swingImpulse: 0.135, swingDamping: 1.5, swingSmooth: 0.3,
  maxSwingTime: 6, walkTime: 0.8,
  takeoffWindow: 0.2, takeoffMinFactor: 0.75, upSpeedMin: 1.5, upSpeedMax: 4.0,
  spinRate: { tuck: 2.9, pike: 2.25, straight: 1.5 },  // Umdrehungen/s bei Kraft 1
  alignRate: 70, alignRange: 60, lineTimeFull: 0.25, twistTime: 0.45,
  perfectAngle: 8, cleanAngle: 20, slapAngle: 75, wrongAngle: 270,
  weights: { takeoff: 0.15, height: 0.15, entry: 0.5, line: 0.2 }, heightLow: 0.5,
  twistPenalty: 2.5, failCap: 2.0,
  judgeBias: [-0.4, 0.2, 0, -0.2, 0.4], judgeNoise: 0.3,
  rounds: 3, worldRecord: 281.0, underwaterTime: 1.2,
} as const;

// Reihenfolge Rookie/Profi/Champion – wird in competition.test.ts geprüft!
export const DIVE_CPU_PROFILES: readonly DiveCpuProfile[] = [
  { name: 'Rookie',   tapRate: 8.0,  tapJitter: 0.2,  takeoffError: 0.07,  releaseError: 0.05,  dives: ['15h', '25h', '15s2'] },
  { name: 'Profi',    tapRate: 9.6,  tapJitter: 0.15, takeoffError: 0.05,  releaseError: 0.038, dives: ['25p', '15s2', '35h'] },
  { name: 'Champion', tapRate: 10.8, tapJitter: 0.1,  takeoffError: 0.035, releaseError: 0.03,  dives: ['15s2', '35h', '45h'] },
];
```

**Computer-Gegner** (gleiche Eingaben wie ein Mensch, `simulateCpuDive`):
- Die Rate wird je Wettkampf mit 0,95–1,05 multipliziert.
- Der Gegner tippt mit ±`tapJitter` 2,5–3,0 s lang und drückt am nächsten Hochpunkt + N(0, `takeoffError`).
- Er hält, bis `rot` das Ziel −15° erreicht hätte, und lässt dann + N(0, `releaseError`) s los.
- Schrauben drückt er bei 0,15 s und jeweils 0,05 s nach dem Ende der vorigen (+|N(0; 0,05)|).

## Balancing (Messung)

Gemessen mit einem temporären Node-Prototyp genau dieses Modells (inzwischen gelöscht), 4000 Serien je Zeile.
Die Spieler-Modelle tippen gleichverteilt mit ±12–25 % Schwankung. Absprung- und Öffnungsfehler sind normalverteilt (σ in ms),
und das Modell zielt beim Öffnen 15° vor das Ziel. Die Sprünge sind die 3 mit dem höchsten Erwartungswert des Modells, „Fehl“ zählt
Fehlsprünge je Serie. Die Medaillen gelten gegen das Feld Rookie + Profi + Champion.

| Modell (Tipps/s · σ Absprung/Öffnen) | Sprünge | Ø Punkte | 10–90 % | Fehl | Medaille / Gold | ≥ WR |
|---|---|---|---|---|---|---|
| 6/s · 100/70 ms | kopf, 15h, 15p | 104.6 | 86–116 | 0.07 | 3 % / 0 % | 0 % |
| **8/s · 80/60 ms** | 15p, 25h, 15s2 | **153.1** | 123–175 | 0.16 | **56 % / 0 %** | 0 % |
| 8/s, zu leicht gewählt | 15h, 15p, 25h | 130.8 | 104–149 | 0.18 | 19 % / 0 % | 0 % |
| 8/s, zu schwer gewählt | 15s2, 35h, 45h | 103.0 | 75–143 | 1.71 | 8 % / 0 % | 0 % |
| 9,5/s · 60/45 ms | 25p, 15s2, 35h | 208.8 | 173–231 | 0.08 | 96 % / 4 % | 0 % |
| **11/s · 45/35 ms** | 15s2, 35h, 45h | **244.9** | 195–273 | 0.10 | **99 % / 45 %** | 0.3 % |
| 11/s ohne 4½ | 25p, 15s2, 35h | 231.8 | 201–245 | 0.05 | 99 % / 20 % | 0 % |
| 11/s · 25/20 ms (sehr gut) | 25p, 35h, 45h | 269.5 | 257–279 | 0.00 | 100 % / 80 % | 2.9 % |
| Perfekt (12/s, 0 ms) | 25p, 35h, 45h | 283.2 | 282–285 | 0 | 100 % / 100 % | 92.5 % |
| 11/s, Absprung ohne Timing (σ 400 ms) | 15s2, 35h, 45h | 155.5 | 120–217 | 0.78 | 44 % / 2 % | 0 % |
| 11/s, öffnet 50 ms zu spät | 15s2, 35h, 45h | 219.0 | 170–266 | 0.29 | 94 % / 23 % | 0.1 % |
| 11/s, öffnet 50 ms zu früh | 15s2, 35h, 45h | 190.5 | 118–254 | 0.66 | 78 % / 11 % | 0 % |
| 14/s hämmern (±30 %) | 15s2, 35h, 45h | 251.3 | 206–277 | 0.09 | 99 % / 55 % | 1.8 % |
| **CPU Rookie** | 15h, 25h, 15s2 | 152.0 | 125–169 | 0.10 | – | 0 % |
| **CPU Profi** | 25p, 15s2, 35h | 219.1 | 194–235 | 0.03 | – | 0 % |
| **CPU Champion** | 15s2, 35h, 45h | 249.8 | 219–274 | 0.05 | – | 0.6 % |

Zusatzwerte:
- Rookie < Profi < Champion gilt in 86 % der Wettkämpfe.
- **Schwung je Tipprate:** 6 → 53 %, 7 → 62 %, 8 → 71 %, 9 → 80 %, 10 → 89 %, 11 → 98 %, 12 → 100 %.
- **Zeitfenster Öffnen** bei perfektem Absprung (perfekt ≤ 8° / ohne Klatscher):

  | Sprung | 8/s | 11/s |
  |---|---|---|
  | 2½ gehockt | −78…+54 ms / ±100 ms | −60…+54 / −78…+70 ms |
  | 3½ gehockt | −28…+12 / −102…+70 ms | −58…+40 / −74…+66 ms |
  | 4½ gehockt | unmöglich | −36…+20 / −78…+70 ms |
  | 1½ mit 2 Schrauben | −116…+74 / −200…+190 ms | −120…+112 / −144…+136 ms |

- Die Kampfrichter-Streuung kostet σ 0,37 Notenpunkte, also ±1 P je Sprung.

**Fazit:** Wer 8 Tipps/s schafft und passend wählt, liegt auf Rookie-Niveau mit Bronze-Chance. Mit 11 Tipps/s ist man auf
Augenhöhe mit dem Champion, und der Weltrekord braucht nahezu fehlerfreies Timing. Absprung-Timing, Öffnen und Sprungwahl
kosten jeweils 20–90 Punkte, Hämmern bringt über 11/s kaum etwas, schadet aber nicht.

## Szene `dive` (640×360)

**Kamera:** Es wird nur senkrecht gescrollt, `PX_PER_M = 26`, und die Plattformkante liegt bei Bildschirm-x 200.
Die Wasserlinie liegt bei `WATER_Y = 232 + camY`. Die Kamera folgt der Hüfte auf Bildschirm-y 150
(`camY = clamp(150 − (232 − y·26), 0, 230)`): oben steht man auf der Plattform (camY ≈ 204), ab y ≈ 3,2 m stoppt die Kamera
in der Beckenansicht. Hallenwand und Dach haben die Parallaxe 0,5.

```
Beckenansicht (camY = 0)
y  0– 24  HUD oben: TURMSPRINGEN · {n}. SPRUNG · Sprungname · SG · rechts GESAMT
y 24–150  Hallendach/-wand mit Fensterband, Bannern und Wimpelkette, Anzeigetafel rechts oben (LED, x300–628, y34–86)
y150–196  Tribüne mit Publikum (2 Jubel-Frames, Texturen aus pool.ts)
y196–232  hinterer Umgang: 5 Kampfrichter auf Hochstühlen (x 344…568, Abstand 56)
y232–318  Sprungbecken ohne Bahnen, tiefblau, Wasserrauhung (Sprudel-Kringel an der Oberfläche)
y318–326  vorderer Beckenrand · y326–360 HUD unten
Links x 40–200: Betonturm mit Plattformen 3/5/7,5/10 m, Höhenschildern, Leiter, Geländer, Fahnen der 4 Nationen des Feldes
```

- **Springer (`gfx/diver.ts`):** Badeanzug in Trikotfarbe, ohne Kappe, Mimik aus `mood`.
  - Posen:
    - Stand an der Kante
    - Armschwung (Amplitude = Schwung, Phase = Hochpunkt-Takt)
    - Abdruck
    - Hocke, Hecht und gestreckt (Arme seitlich)
    - Linie (Arme über dem Kopf = `divePose()` aus swimmer.ts)
    - Schraube (4 Frames)
    - Arschbombe (Kugel)
    - Klatscher (flach)
    - Gleiten unter Wasser
    - Auftauchen mit Winken bzw. Kopfschütteln
  - Drehung über `drawRunner(..., { rotation })`.
  - Anzeige der Position: Hocke und Hecht nur, solange die Leertaste gehalten wird. Der Übergang zur Linie dauert 0,08 s.
- **Spritzer nach `splash`:**
  - 0 = „Rip“: 4 Tropfen und eine Blasensäule, kaum Ring
  - 1: kleine Krone
  - 2: mittlere Krone und Ring
  - 3: große Fontäne (40+ Tropfen, 2 Ringe, Welle)

  Die Bausteine kommen aus `drawDrops` und `drawWaterRing`.
- **Kampfrichter:** Figuren im Blazer (wie der Weitsprung-Offizielle) auf Stühlen. Nach dem Auftauchen heben sie ihre **Tafeln**
  mit 0,15 s Abstand (weiß, 52×26 px, Note in 16 px, schwarz, bei y 170). Nach 0,5 s werden die gestrichenen Tafeln grau mit
  roter Diagonale.
- **Hallentafel** (rechts oben, weit weg von Turm und Flugbahn): Nation und Sprungname, blinkt bei der Ansage kurz.
- **Wertungstafel (Overlay x220–628, y34–118, deckt die Hallentafel ab):**
  - Urteil über die Ausführung (16 px, Farbe nach Güte), nach der Basisnote: `WELTKLASSE!` ≥ 9 · `SEHR GUTER SPRUNG` ≥ 8 ·
    `GUTER SPRUNG` ≥ 7 · `ORDENTLICH` ≥ 5,5 · `WACKELIG` ≥ 4 · sonst `MISSGLÜCKT`; Fehlsprünge: `ARSCHBOMBE!` / `KLAPPMESSER!`
    (nicht geöffnet, gehockt/gehechtet), `KLATSCHER!`, sonst `FEHLSPRUNG`. Die Tippzeile darunter ist nur der Rat –
    so steht nichts doppelt.
  - `25.5 × 3.2 = 81.60` (16 px, zählt in 0,6 s hoch)
  - Tipp-Zeile (8 px)
  - Messwerte (8 px grau)
  - darunter `ENTER: WEITER` (blinkend)
- **HUD unten (`gfx/diveHud.ts`, Bausteine aus `hud.ts`):**
  - `SCHWUNG` mit `drawSpeedBar(swing, 1)` bei x8–152 und weißem Strich `MIN` am nötigen Schwung des Sprungs.
    Nach dem Absprung friert der Balken ein und zeigt die Kraft.
  - `drawKeyCaps` (x186/214).
  - `drawActionKey` (x243–295) mit Beschriftung `SPRUNG`, in der Luft `HALTEN` bzw. `OFFEN`.
  - `drawUpKey` (aus RSG-06) mit `SCHRAUBE 0/2`, nur beim Schraubensprung, sonst grau.
  - `DREHUNG` (x420–632): Balken 0…Ziel mit Teilstrichen je ½ Salto. Die Zone Ziel −40°…Ziel ist grün, darüber kommt der Text `2½/3½`.
- **Takt-Anzeige am Turm:** senkrechte Skala 6×44 px rechts neben dem Springer. Der Strich läuft als Dreieckswelle (unten = Arme hinten,
  oben = Hochpunkt), oben sind 4 px grün. Die Skala ist nur in `ready`/`swing` sichtbar.
- **Tafel/Wahl:**
  - `JumpBoard` wird erweitert um einen optionalen Kopf der Bestspalte (`'GESAMT'`). Die Zellen zeigen Punkte je Sprung.
  - Neues Panel `DiveSelect` (x60–580, y40–300):
    - Titel `DEIN {n}. SPRUNG`
    - 8 Zeilen à 18 px: Name x84, SG x330, Schwung-Balken x380–470 mit Prozent x480. Gesprungene Zeilen sind grau, dort steht
      statt des Balkens die Punktzahl.
    - Zeile `DEIN SCHWUNG ZULETZT: 86%` (ab Sprung 2)
    - Fußzeile `PFEIL HOCH/RUNTER: WÄHLEN   ENTER: SPRINGEN`
- **Menü-Vorschau** (`TitleScene`): Springer an der Plattformkante mit Armschwung, darunter ein Wasserstreifen.

## Texte

| Ort | Text |
|---|---|
| Menü (`events.ts`) | `PFEIL LINKS/RECHTS` = `ABWECHSELND = SCHWUNG HOLEN` · `LEERTASTE` = `ARME OBEN: ABSPRINGEN` · `LEERTASTE HALTEN` = `SALTO DREHEN, LOS = ÖFFNEN` · `PFEIL HOCH` = `SCHRAUBE (WENN ANGESAGT)` |
| Eintrag | `key: 'dive'`, `name: 'TURMSPRINGEN'`, `scene: 'dive'`, `bestLabel: 'BESTWERT'`, `lowerIsBetter: false`, `format: v => \`${v.toFixed(2)} P\`` |
| Tafel | `{n}. DURCHGANG` · `DU BIST DRAN – {n}. SPRUNG` / `ENTER: SPRUNG WÄHLEN   ESC: MENÜ` (Wettkampf `ESC: ABBRECHEN`) · Gegner: `{NATION} – {SPRUNGNAME}`, dann `{NATION}: {Summe} × {SG} = {P}` / `NOTEN 7.5 8.0 8.0 7.5 8.5` (0,7 s + 0,8 s) |
| Bereit | `{SPRUNGNAME}` (16 px) / `SG {dd}   NÖTIGER SCHWUNG {p}%` · `PFEIL LINKS/RECHTS: SCHWUNG HOLEN` · `LEERTASTE, WENN DIE ARME OBEN SIND` · Leertaste ohne Schwung: `ERST SCHWUNG HOLEN!` |
| Absprung | ab Güte 0,75 `GUTER ABSPRUNG` (grün, 0,6 s), sonst keine Meldung. Automatisch: `ABSPRUNG VERPASST` (rot) |
| Eintauchen (24 px) | `PERFEKT!` (gold) · `SAUBER!` · `ZU FRÜH GEÖFFNET` · `ZU SPÄT GEÖFFNET` · `BAUCHKLATSCHER!` · `RÜCKENKLATSCHER!` · `ARSCHBOMBE!` (Hocke) / `KLAPPMESSER!` (Hecht) / `NICHT GEÖFFNET!` (gestreckt) · `SALTO FEHLT!` / `SALTO ZU VIEL!` |
| Tipp (eine Zeile, erste zutreffende) | 1. nicht geöffnet: `NICHT GEÖFFNET – LEERTASTE VOR DEM WASSER LOS` · 2. zu wenig gedreht (δ < −20°) und `power < minPower`: `ZU WENIG SCHWUNG – LEICHTEREN SPRUNG WÄHLEN` · 3. `wrong`, δ < 0: `SALTO FEHLT – LEERTASTE LÄNGER HALTEN`; δ > 0: `SALTO ZU VIEL – FRÜHER LOSLASSEN` · 4. δ < −20°: `ZU FRÜH GEÖFFNET – LEERTASTE LÄNGER HALTEN` · 5. δ > 20° oder line < 0,25 s: `ZU SPÄT GEÖFFNET – FRÜHER LOSLASSEN` · 6. Schraube offen: `SCHRAUBE NICHT FERTIG – FRÜHER PFEIL HOCH`; fehlt: `SCHRAUBE FEHLT – {n}X PFEIL HOCH DRÜCKEN` · 7. Güte < 0,6: `ABSPRUNG ZU FRÜH – ARME GANZ OBEN ABWARTEN` / `ABSPRUNG ZU SPÄT – LEERTASTE, WENN ARME OBEN` · 8. Schwung < 0,85: `MEHR HÖHE – SCHNELLER TIPPEN (IDEAL 11/S)` · 9. Basis ≥ 9: `BESSER GEHT ES KAUM – GENAU SO WEITER!`, sonst Feinschliff an der schwächsten Stelle: `FEINSCHLIFF: GENAU IM HOCHPUNKT ABSPRINGEN` (Güte < 0,9) / `FEINSCHLIFF: GANZ SENKRECHT EINTAUCHEN` (> 8°) / `FEINSCHLIFF: NOCH ETWAS MEHR SCHWUNG` |
| Messwerte | `ABSPRUNG 92%   SCHWUNG 95%   EINTAUCHEN 4°` |
| Ergebnis | Kopfzeilen `PUNKTE` · `SERIE` (`254.35` · `84.80 62.40 70.20`) · Notizen: `BESTER SPRUNG: {SPRUNGNAME} {P}` und den Tipp, der in der Serie am häufigsten kam (bei Gleichstand der mit der höheren Priorität) |

Die längste 8-px-Zeile ist `NICHT GEÖFFNET – LEERTASTE VOR DEM WASSER LOS` mit 45 Zeichen (360 px, passt in die 400 px breite Anzeigetafel), die längste 16-px-Zeile ist `KOPFSPRUNG GESTRECKT` mit 20 Zeichen (320 px).
Das Zeichen ½ ist in der Schrift vorhanden. Ist es in den Screenshots bei 8 px unleserlich, wird `2.5 SALTI …` geschrieben.

## Sounds (`sfx.ts`, synthetisiert)

| Sound | Beschreibung |
|---|---|
| `swingTick()` | leiser Holzklick an jedem Hochpunkt (Metronom für den Absprung) |
| Tipps | kein eigener Ton, nur ein leises Rauschen des Armschwungs, lauter mit dem Schwung |
| `diveTakeoff()` | dumpfer Abdruck; das Publikum wird in `ready` leiser („Psst“) |
| `spinWhoosh(n)` | je ½ Salto, Tonhöhe steigt zum Ziel hin |
| `open()` | kurzer Schnapp-Ton |
| `twist()` | Sirr-Sweep |
| `rip()` | Eintauchen bei Spritzer 0: kurzes „Plopp“, danach Bläschen |
| `plunge(level)` | Spritzer 1 (leiser, heller) und 2 (aus RSG-06) |
| `slap()` | Spritzer 3: lauter Klatsch; dazu „Ohhh“ des Publikums (`crowd` kurz abfallend) |
| `cardFlip()` | je Tafel |
| `scoreCount()` | Hochzählen der Summe |
| Abschluss | `crowd()` nach der Basisnote (≥ 8 laut, ≤ 3 leise), ab Basis 6 `applause()` (dichter, je besser) |

## Wettkampf und Medaillenspiegel

- **Wettkampf:**
  - `COMPETITION_ORDER = ['110h', 'long', 'pole', 'swim', 'dive', 'bmx']` (T9).
  - `competition.test.ts`: Reihenfolge anpassen und `DIVE_CPU_PROFILES` in den Reihenfolge-Test aufnehmen.
  - Die Szene liest Feld, Profil-Index und Look-Seed aus der Session.
  - `ResultSceneData.event = 'dive'`, `replay` nur im Einzelmodus.
- **Titel:**
  - `ALLE {COMPETITION_ORDER.length}` (ergibt `ALLE 6`).
  - Hilfe `REIHENFOLGE` / `HÜR-WEIT-STAB-SCHW-TURM-BMX` (27 Zeichen, ohne Leerzeichen, damit es in den Hilfekasten passt).
- **`MedalsScene`, Raster für 6 Disziplinen** (ersetzt das 5er-Raster aus RSG-06):
  - `COL`: tag 46, place 76, flag 100, code 122, name 154, **gold 256, silver 282, bronze 308** (Scheiben r = 6 → 250–314).
  - Trennlinie bei **x330**.
  - `EVENT_COLS` als **Mitten**, Abstand 44: HÜR **352**, WEIT **396**, STAB **440**, SCHW **484**, TURM **528**, BMX **572**.
  - Prüfung: Der längste Name (11 Zeichen) endet bei x242. Die Beschriftungen sind ≤ 4 Zeichen (32 px), dazwischen bleiben ≥ 12 px Luft.
    HÜR beginnt bei x340 (10 px nach der Trennlinie), BMX endet bei x584 (Panel bis x602).

## Spieltest-Bot (`scripts/e2e/smoke.cjs`)

- **Einzellauf:** `DISCIPLINES.dive = { scene: 'dive' }`, `BOT_OF_SCENE.dive = 'dive'`. Der Wettkampf prüft
  `race,longjump,polevault,swim,dive,bmx`.
- **Bot:**
  - Tafel und Sprungwahl: ENTER. Die Sprünge wählt er mit PFEIL RUNTER in der Reihenfolge `25h`, `15s2`, `15p`.
  - Schwung: abwechselnd mit 10 Tipps/s, nach ≥ 2,5 s Leertaste drücken, sobald `|timeToPeak| < 0.02`.
  - Halten, bis `rot ≥ target − 20°`, dann loslassen.
  - Schraubensprung: ↑ bei 0,12 s Flugzeit und erneut nach `twistEnd`.
  - Nach der Wertung ENTER drücken.
- **Öffentlich lesbar:** `phase`, `diver` (State), `round`, `selection`, `judgement`, `simTime`.
- **Prüfung:** Die Ergebnis-Szene wird erreicht, kein Sprung ist ein Fehlsprung, die Summe ist > 120, und die Dauer liegt bei 30–90 s.
  Protokolliert werden je Sprung Bewertung, Noten und Punkte.
- **Screenshots:** Sprungwahl, Schwung am Turm, Salto in der Luft, Eintauchen, Tafeln mit Anzeigetafel, Ergebnis.

## Abnahmekriterien

1. Im Menü gibt es `TURMSPRINGEN` als 6. Disziplin mit 4 Hilfezeilen (Taste ≤ 18, Text ≤ 30 Zeichen) und der Springer-Vorschau.
2. Ein Durchgang hat 3 Runden à 4 Springer. Der Spieler wählt vor jedem Sprung aus 8 Sprüngen, gesprungene sind gesperrt.
   Die Computer-Sprünge erscheinen nur auf der Tafel.
3. `dive.test.ts` deckt ab:
   - Nur abwechselnde Tipps zählen. Gleichmäßige 8/s ergeben einen Schwung von 0,68–0,74, 11/s ergeben ≥ 0,95.
   - Die Leertaste vor dem ersten Tipp springt nicht ab.
   - Absprung am Hochpunkt ergibt Güte 1, ±0,2 s ergibt 0. Nach 6 s ohne Druck folgt der automatische Absprung.
   - Die Flugzeit liegt bei 1,55–1,95 s. Gehalten dreht der Springer mit `power · spinRate`. Offen gibt es keine Eigendrehung,
     das Ausrichten geht mit ≤ 70°/s und nur innerhalb von ±60° und nicht während einer Schraube.
   - Die Bewertungen `perfect`, `clean`, `early`, `late`, `belly`, `back`, `bomb` und `wrong` werden an konstruierten Fällen geprüft,
     die Fehlsprünge an der Deckelung (Basis ≤ 2,0).
   - ↑ wirkt nur beim Schraubensprung. Eine unfertige oder fehlende Schraube kostet 2,5 Notenpunkte.
   - `judge`: 5 Noten in 0,5er-Schritten von 0–10. Höchste und niedrigste werden gestrichen, `points = Summe × SG` auf 2 Stellen.
     Gleiche Ausführung ergibt identische Noten. Die Spannweite der 5 Noten ist ≤ 1,5.
   - `minPower` ergibt die Werte der Sprungliste (±1 %).
   - Rangliste mit Tie-Break (Gesamt, dann bester, dann zweitbester Sprung).
   - CPU je 40 Serien: Ø Rookie 140–165, Profi 205–232, Champion 238–262. Die Reihenfolge ist streng geordnet, der Champion-Ø liegt unter 281.
   - Ein Spieler-Modell mit 8/s (σ 80/60 ms) und `15p, 25h, 15s2` erreicht Ø ≥ 140.
4. `DIVE_CPU_PROFILES` heißen `Rookie`, `Profi`, `Champion` in dieser Reihenfolge (`competition.test.ts`).
5. Halle mit Turm, Sprungbecken, Publikum und Kampfrichtern:
   - Die Kamera folgt dem Springer ohne Ruckeln von der Plattform bis zum Wasser.
   - Hocke, Hecht, gestreckt, Linie und Schraube sind unterscheidbar.
   - Die Spritzer sind bei `PERFEKT!` sichtbar klein und beim Klatscher groß.
6. Die Takt-Anzeige und der Tick-Ton treffen den Hochpunkt (gleiche Sim-Zeit). Der `MIN`-Strich im SCHWUNG-Balken passt zum gewählten Sprung.
7. Nach jedem Sprung:
   - 5 Tafeln, die gestrichenen grau markiert
   - Rechnung `Summe × SG = Punkte`
   - Bewertung, genau ein Tipp nach der Prioritätsliste und die Messwerte
8. Ergebnis: Spalten PUNKTE/SERIE und 2 Notizen. Die Bestleistung wird gespeichert (höher ist besser), ab 281.00 erscheint `WELTREKORD!`.
9. Wettkampf:
   - Die Reihenfolge ist Hürden, Weitsprung, Stabhochsprung, Schwimmen, Turmspringen, BMX.
   - Der Medaillenspiegel zeigt 6 Spalten im neuen Raster ohne Überlappung.
   - ESC öffnet in jeder Phase die Rückfrage. Nach NEIN gibt es keinen Zeitsprung, und der Takt läuft vom selben Punkt weiter.
   - R ist aus.
10. `npm run typecheck`, `npm test`, `npm run build` und `npm run e2e` (inklusive `dive` und `wettkampf`) sind grün. Die Screenshots
    sind angesehen: keine ←/→-Glyphen, ½ lesbar, nichts überlappt.
11. README (Steuerung/Regeln), CHANGELOG, ROADMAP (RSG-09 abgehakt) und die nächste Minor-Version (Paket und Titel) sind aktualisiert.

## Aufgaben

- **Game-Engineer:**
  - `sim/dive.ts` (DIVE, DIVES, Sim, `judge`, `minPower`, `simulateCpuDive`, Profile) mit `dive.test.ts`.
  - `scenes/DiveScene.ts`: Ablauf wie LongJumpScene (Tafel, Runden) plus Sprungwahl, Kamera, Tasten mit Zeitstempel und Keyup,
    `confirmAbort`.
  - Optionaler Kopf der Bestspalte in `JumpBoard`.
  - `events.ts`, `main.ts`, `competition.ts` mit Test, Titel (Hilfe, Vorschau-Aufruf), Raster in `MedalsScene`.
  - Sounds, Bot, README, CHANGELOG, Version.
- **Pixel-Artist:**
  - `DiveHall` in `gfx/pool.ts`: nutzt die vorhandenen Texturen, neu kommen Dach, Turm, Sprungbecken mit Wasserrauhung,
    Richterstühle und LED-Anzeigetafel dazu.
  - `gfx/diver.ts` mit allen Posen (siehe Szene) und den Spritzer-Stufen 0–3.
  - `gfx/diveHud.ts`: Takt-Skala, DREHUNG-Balken, `MIN`-Strich, Kampfrichter-Tafeln mit Streich-Markierung, Panel `DiveSelect`.
  - Prüfung über eine temporäre Galerie (`deviceScaleFactor: 3`), danach wieder löschen.
