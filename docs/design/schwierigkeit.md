# RSG-02 Schwierigkeitsgrad (mit neuer Tempo-Kurve)

## Ziel und Spielgefühl

Im Menü wählt man mit **GEGNER: LEICHT / NORMAL / SCHWER**, wie stark die drei Computer-Gegner sind.
Wer gelegentlich spielt, soll auf LEICHT um Medaillen kämpfen. Wer geübt ist, holt auf NORMAL
Medaillen, und Gold verlangt sauberes Timing. SCHWER ist Weltklasse. Bezug zum Original: Auch die
Sommerspiele der 80er hatten Gegner in mehreren Stärken. Hier sind Namen, Stufen und Werte eigene.

**Anlass ist das Owner-Feedback:** „Die Gegner sind meist zu schnell. Man kommt nur sehr schwer an die
Tippgeschwindigkeit heran.“ Die Messung unten bestätigt das. Die Ideale der Spieler-Physik liegen bei
11–12 Tipps/s, und die heutigen Gegner spielen effektiv 8,6 / 9,9 / 11,0 Tipps/s. Auf einer Tastatur hält
man mit abwechselnd ←/→ über 10–60 s aber realistisch nur:

| Spielertyp | Tipprate über 10–60 s |
|---|---|
| Gelegenheitsspieler | 5–6/s |
| geübt | 7–8/s |
| sehr gut | 9–10/s |
| kurzzeitig (Sprint ~13 s) | 11–12/s |

Deshalb setzt die Spec **zwei Hebel** um: (B) eine **Tempo-Kurve** für alle Spieler, bei der ~8/s schon
nahe am Höchsttempo liegt und ~10/s das Ideal ist, und (A) den **Schwierigkeitsgrad**, der die Gegner
in Tipprate und Timing einstellt.

## Entscheidungen

| # | Entscheidung | Begründung |
|---|---|---|
| D1 | **Beide Hebel umsetzen: Tempo-Kurve (B) und Gegnerstärke (A).** | Mit (A) allein bleibt das Ideal bei 11–12/s. Der Tempobalken würde nie voll, und Weltrekorde wären für fast alle unerreichbar (Hürden-WR heute erst ab ~11/s mit perfektem Timing, Weitsprung-WR ab ~12/s). Mit (B) allein bliebe ein einziges, starres Feld. Erst beides zusammen erfüllt die Zielwerte. |
| D2 | **Gesättigte Tempo-Kurve:** Ein Tipp bringt umso weniger, je näher man am Höchsttempo ist: `Δv = gain · vmax · (1 − v / (sat · vmax))`. Kein harter Knick. | Eine lineare Kurve (heute) bestraft 6/s mit 47 % Tempo. Ein harter Deckel bei 8/s würde alles darüber wertlos machen. Die Sättigung gibt 6/s ≈ 80 %, 8/s ≈ 90 % und 10/s ≈ 96 %, darüber nur noch wenig. Tippen bleibt wichtig: 6/s gegen 10/s sind bei den Hürden noch 2,8 s Unterschied. Damit schlägt Können den Zufall. |
| D3 | **Ein Gegner wird durch zwei Zahlen beschrieben: Tipprate und Fehlerfaktor** (`rate`, `error`; 1 = „ordentlich“, 0,33 ≈ „nahezu perfekt“). Jede Disziplin leitet daraus ihr Profil ab. | Das ist dieselbe Sprache wie für Spieler („8/s mit ordentlichem Timing“). Der Schwierigkeitsgrad ist damit **eine** kleine Tabelle für alle sechs Disziplinen. Die Messung zeigt, dass dieselben Werte überall die Zielwerte treffen. Die heutigen Profile passen schon fast in dieses Schema (BMX-Champion ≈ Fehlerfaktor 0,55, Hürden-Rookie ≈ 1,33). |
| D4 | **Weitsprung- und Stabhochsprung-Gegner springen künftig über die echte Sim** (wie schon Turmspringen per `runCpuDive`), statt eine Weite oder Höhe aus Mittelwert und σ zu würfeln. Die Signaturen `cpuJump(p, rng)` und `cpuAttempt(p, bar, rng)` bleiben. | Nur so wirken Tempo-Kurve und Schwierigkeitsgrad dort genauso wie in den anderen vier Disziplinen, ohne handgepflegte Mittelwerte. Jede spätere Physik-Änderung wirkt automatisch auf die Gegner. Übertreten entsteht aus dem Timing statt aus einer festen Quote. Die Rechenzeit ist klein (ein Versuch ≈ 600 Sim-Schritte). |
| D5 | **Beim Stabhochsprung zählt beim Einstich das geglättete Tempo** (`vAvg`, Zeitkonstante 0,25 s, wie beim Weitsprung). | Das ist ein Fairness-Befund der Messung. Heute zählt beim Einstich das momentane `v`. Es springt je Tipp um ~0,85 m/s (Sägezahn), und je nachdem, wann zwischen zwei Tipps man einsticht, schwankt die erreichbare Höhe bei perfektem Timing um bis zu **0,6 m**. Das verstößt gegen die Regel „Tempo für Absprünge glätten“ in CLAUDE.md. |
| D6 | **Standard ist NORMAL.** NORMAL ist deutlich leichter als das heutige Feld. | Das heutige Feld liegt über SCHWER (effektiv 8,6/9,9/11,0 Tipps/s). Der Owner empfindet es als zu schnell. NORMAL spielt 7/8/9 Tipps/s. |
| D7 | **Die Stufe gilt im Einzelmodus und im Wettkampf.** Im Wettkampf wird sie beim Start in `CompetitionState.difficulty` festgeschrieben und bis zur Abschlussfeier nicht mehr gelesen. | Ein Wettkampf soll fair und vergleichbar bleiben. Im Menü kann man die Stufe vor dem Start frei wählen. |
| D8 | **Bestleistungen werden nicht je Stufe getrennt.** | Die eigene Leistung hängt nicht von den Gegnern ab: Zeit, Weite, Höhe und Punkte entstehen allein aus den eigenen Eingaben. Auch beim Stabhochsprung darf man als Letzter weiterspringen. Getrennte Listen würden dieselbe Leistung dreimal zählen. Für RSG-04 (Bestenlisten) genügt eine Liste je Disziplin. |
| D9 | **Weltrekorde bleiben unverändert** (12.80 / 8.95 / 46.50 / 281.00). Die Tempo-Kurve ist so eingestellt, dass sie weiterhin ~10/s **und** nahezu perfektes Timing brauchen (siehe Messung). | Dadurch bleiben die Rekordzahlen bekannt und erkennbar. „WELTREKORD!“ bleibt etwas Besonderes. |
| D10 | **Alte Bestleistungen bleiben gespeichert** (keine Migration). Im CHANGELOG steht der Hinweis, dass sie mit der neuen Kurve meist leichter zu schlagen sind. | Wer bisher bis 10/s getippt hat, schlägt seine alte Marke jetzt leicht, denn die gleiche Eingabe bringt mehr. Nur wer bei Hürden, Weitsprung oder Stab dauerhaft über 11/s gehämmert hat, kann eine alte Marke haben, die nicht mehr erreichbar ist (Hürden heute 13/s → 11,3 s, neu bestenfalls ~12,3 s). Das ist ein seltener Fall, und RSG-04 beginnt ohnehin mit neuen Top-5-Listen (eigener Schlüssel). |
| D11 | **Menü-Reihenfolge:** MODUS, DISZIPLIN, **GEGNER**, NATION, ATHLET. | Die Reihenfolge ist logisch: „Was spiele ich, wie schwer, wer bin ich“. Der Bot-Test „DISZIPLIN wird im Wettkampf übersprungen“ landet weiter auf Zeile 2, die jetzt GEGNER ist. |

## Messung Ist-Zustand (v0.9.0)

**Methode:** Ein temporäres Node-Skript im Scratchpad bündelt die echten Sims aus `src/sim/` und lässt
sie laufen (inzwischen gelöscht). Je Zeile gibt es 300 Wettbewerbe gegen das heutige Feld Rookie + Profi + Champion. „Medaille“ heißt
Platz 1–3 von 4 (also mindestens den Rookie schlagen), „Gold“ heißt Platz 1.

Das Spieler-Modell „ordentlich“ (Fehlerfaktor 1) sieht so aus:
- Tipp-Abstand gleichverteilt ±20 %, Reaktion 0,30 s, Tagesform ×0,95–1,05
- Hürden: Absprung σ 60 ms
- Weitsprung: Absprung σ 40 ms und zielt 1 σ vor das Brett, Winkel 30° ± 4°, Beine 0,15 s vor der Landung ± 60 ms; bester von 3
- Stab: Einstich σ 50 ms × Tempo, Loslassen σ 50 ms; Einstiegshöhe ≈ eigene Ø-Höhe − 0,45 m, danach jede Höhe
- Schwimmen: Wende σ 0,35 m, atmet bei 25 % Luft
- Turm: Absprung/Öffnen σ 80/60 ms, wählt die 3 Sprünge mit dem besten Erwartungswert
- BMX: Hopser-Fehler 80 ms, Salto 30 %, Trick 60 %, Patzer 12 %

### Spieler gegen das heutige Feld

| Tipps/s | 110 m Hürden | Weitsprung | Stabhoch | 100 m Freistil | Turmspringen | BMX |
|---|---|---|---|---|---|---|
| 5 | 26.80 · 0/0 | 2.48 · 3/0 | o.g.V. · 0/0 | 71.9 · 0/0 | 94 · 3/0 | 1123 · 2/0 |
| 6 | 22.68 · 0/0 | 3.13 · 2/0 | o.g.V. · 0/0 | 64.4 · 0/0 | 108 · 6/0 | 1934 · 3/0 |
| 7 | 19.88 · 0/0 | 3.82 · 3/0 | (meist o.g.V.) · 0/0 | 58.7 · 0/0 | 125 · 22/0 | 3639 · 34/0 |
| 8 | 17.66 · 37/0 | 4.60 · 3/0 | 3.99 · 3/0 | 54.1 · 55/0 | 152 · 56/0 | 5049 · 71/1 |
| 9 | 16.03 · 87/0 | 5.47 · 13/0 | 4.80 · 75/0 | 50.7 · 100/0 | 176 · 73/2 | 6224 · 90/3 |
| 10 | 14.65 · 100/0 | 6.41 · 74/0 | 5.45 · 100/14 | 48.6 · 100/20 | 191 · 85/3 | 6988 · 95/6 |

Format: Ø Leistung · Medaille % / Gold %. o.g.V. = ohne gültige Höhe (6/s erreicht nur 3,35 m, die erste Latte liegt bei 3,80 m).

**Wettkampf (6 Disziplinen, Medaillenspiegel):**

| Tipps/s | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|
| Podest im Spiegel | 0 % | 0 % | 3 % | 47 % | 98 % | 100 % |
| Gesamtsieg | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % |
| Ø Medaillen | 0,1 | 0,1 | 0,6 | 2,3 | 4,4 | 5,5 |

**Was Gold heute braucht** (Gold-Quote; „gut“ = Fehlerfaktor 0,67, „perfekt“ = 0,33):

| Disziplin | Gold-Quote |
|---|---|
| Hürden | 11/s gut 23 %, 12/s gut 78 % |
| Weitsprung | 11/s perfekt 18 %, 12/s perfekt 95 % |
| Stab | 10/s perfekt 41 %, 11/s gut 72 % |
| Schwimmen | 10/s perfekt 64 % |
| Turm | 11/s gut 47 % |
| BMX | 10/s perfekt 47 %, 11/s perfekt 76 % |

**Ideale der Spieler-Physik:**
- Hürden: Höchsttempo ab 12,6/s, Weltrekord ab ~11/s mit perfektem Timing
- Weitsprung: Weltrekord ab ~12/s
- Stab: Höchsttempo ab 10,7/s
- Turm: voller Schwung ab 11,1/s
- BMX: Höchsttempo ab 12/s
- Schwimmen: Takt-Ideal 10,5/s

**Effektive Tipprate der heutigen Gegner** (Rookie / Profi / Champion):

| Disziplin | Tipprate | Herleitung |
|---|---|---|
| Hürden | 8,5 / 10 / 11,4 | Profil-Werte, Fehlerfaktor ≈ 1,33 / 0,92 / 0,67 |
| Weitsprung | ≈ 9,6 / 11,2 / 11,9 | statistisch: Ø 5,97 / 7,35 / 8,19 m, umgerechnet über die Spielerkurve |
| Stab | ≈ 8,8 / 9,7 / 10,7 | statistisch: Ø 4,61 / 5,28 / 5,81 m |
| Schwimmen | 8,0 / 9,0 / 9,9 | Profil-Werte |
| Turm | 8,0 / 9,6 / 10,8 | Profil-Werte |
| BMX | 8,5 / 9,8 / 11,0 | Profil-Werte |

Im Mittel spielt das Feld also **8,6 / 9,9 / 11,0 Tipps/s**.

**Fazit:** Ein geübter Spieler (8/s) holt im Wettkampf im Schnitt 2 Medaillen und nie den Gesamtsieg. Beim
Weitsprung ist er chancenlos (4,60 m gegen 5,97 m des Rookies). Ein Gelegenheitsspieler (6/s) holt praktisch
nichts und reißt beim Stab nicht einmal die erste Höhe. Der Owner hat recht.

## Hebel B: Tempo-Kurve (Spieler-Physik, gilt für alle, auch für die Gegner)

Formel für Lauf, Anlauf, Tritt und Armschwung (ein gültiger Tipp):

```
v ← min(vmax, v + faktor · gain · vmax · max(0, 1 − v / (sat · vmax)))
```

Zwischen den Tipps bremst wie bisher `v ← v · e^(−drag·dt)`. Im Gleichgewicht ergibt sich etwa
`v/vmax ≈ sat · r / (r + sat·drag/gain)`. `faktor` ist z. B. 0,5 beim Stolpern über eine Hürde.
Beim Schwimmen bleibt der Wasserwiderstand (linear + quadratisch). Dort sättigt nur der Zuwachs je Zug,
und die Takt-Regel (voller Zug erst ab 0,19 s Armzyklus) bleibt unverändert.

**Startwerte (Änderungen fett):**

```ts
// hurdles.ts – gemeinsam für Hürden, Weitsprung, Stab
export const PHYSICS = {
  /** Tempo-Kurve: Zuwachs je Tipp = tapGain · vmax · (1 − v / (tapSaturation · vmax)) */
  tapGain: 0.19,          // NEU (ersetzt tapImpulse 0.85)
  tapSaturation: 1.48,    // NEU
  groundDrag: 0.7,        // war 0.95 – Antritt bleibt spürbar (90 % Tempo nach ~1,0–1,5 s)
  maxSpeed: 9.55,         // war 11.3 – Hürden-WR bleibt bei ~10/s + perfektem Timing
  // übrige Werte unverändert
} as const;
export function tapSpeed(v: number, vmax: number, factor = 1): number;

// longjump.ts
LJ.maxSpeed = 10.8;            // war 11.2 – Weitsprung-WR 8,95 bleibt bei ~10/s + perfekt
// polevault.ts
VAULT.maxSpeed = 9.6;          // unverändert
VAULT.speedSmooth = 0.25;      // NEU: Zeitkonstante für vAvg; plant() rechnet mit vAvg (D5)
// swim.ts
SWIM.strokeImpulse = 0.29;     // war 0.1
SWIM.strokeSaturation = 1.2;   // NEU: Zuwachs = strokeImpulse · f · (1 − v / (1.2 · maxSpeed))
// dive.ts
DIVE.swingImpulse = 0.21;      // war 0.135
DIVE.swingSaturation = 1.5;    // NEU: raw += swingImpulse · (1 − raw / 1.5)
DIVE.swingDamping = 0.75;      // war 1.5 – Schwung baut sich weiter über ~1 s auf
// bmx.ts
BMX.tapGain = 0.225;           // NEU (ersetzt tapImpulse 0.8)
BMX.tapSaturation = 1.29;      // NEU
BMX.maxSpeed = 10.5;           // war 12 – Zeiten und Punkte bleiben im bisherigen Rahmen
```

### Messung Soll-Kurve

Spieler allein, je 100 Läufe. Oben steht „ordentlich“ (e = 1), darunter „perfekt“ (e = 0,33).

| Tipps/s | Hürden | Weit (bester von 3) | Stab Ø Höhe | Schwimmen | Turm (3 Sprünge) | BMX Punkte / Zeit |
|---|---|---|---|---|---|---|
| 5 | 17.43 / 17.14 | 5.40 / 5.66 | 4.01 / 4.10 | 58.3 / 57.9 | 164 / 217 | 4880 / 6339 · 39,6 s |
| 6 | 15.99 / 15.58 | 6.22 / 6.50 | 4.51 / 4.56 | 54.6 / 54.4 | 183 / 232 | 5607 / 7302 · 36,6 s |
| 7 | 15.02 / 14.69 | 6.98 / 7.23 | 4.90 / 5.00 | 52.2 / 51.9 | 190 / 237 | 6388 / 8337 · 34,4 s |
| 8 | 14.29 / 13.91 | 7.67 / 7.93 | 5.29 / 5.37 | 50.2 / 49.9 | 201 / 258 | 6936 / 9291 · 32,7 s |
| 9 | 13.70 / 13.31 | 8.25 / 8.57 | 5.64 / 5.74 | 48.5 / 48.3 | 196 / 271 | 7302 / 9639 · 31,3 s |
| 10 | 13.24 / 12.85 | 8.45 / 8.88 | 5.82 / 5.95 | 47.6 / 47.0 | 198 / 275 | 7599 / 9994 · 30,3 s |
| 12 | 12.85 / 12.54 | 8.56 / 8.99 | 5.92 / 6.00 | 48.8 / 48.4 | 201 / 277 | 7681 / 10259 · 28,7 s |
| *heute 8 / 10 (ordentlich)* | *17.66 / 14.65* | *4.60 / 6.41* | *3.99 / 5.45* | *54.1 / 48.6* | *152 / 191* | *5049 / 6988* |

- Dive-Schwung je Tipprate: 6/s → 82 %, 8/s → 92 %, 10/s → 100 % (heute 6/s → 53 %, 8/s → 71 %, 10/s → 89 %).
- Turmspringen und BMX bleiben bei ordentlichem Timing ab ~8/s flach. Dort entscheidet das Timing. Das ist gewollt.
- Schwimmen bleibt eine Rhythmus-Disziplin: 12/s ist langsamer als 10/s (hektische Züge).

**Weltrekorde** (Anteil Wettbewerbe mit Rekord, 300 Läufe je Zeile):

| Modell | Hürden < 12.80 | Weit > 8.95 | Schwimmen < 46.50 | Turm > 281 |
|---|---|---|---|---|
| 8/s ordentlich | 0 % | 0 % | 0 % | 0 % |
| 10/s ordentlich | 3 % | 3 % | 0 % | 0 % |
| 10/s gut | 9 % | 3 % | 0 % | 0 % |
| 10/s nahezu perfekt | 29 % | 20 % | 0 % (best 46.60) | 9 % |
| 12/s ordentlich (Hämmern) | 61 % | 12 % | 0 % | 0 % |
| 12/s nahezu perfekt | 100 % | 65 % | 0 % | 12 % |
| Schwimmen 10,4/s ±3 %, Wende σ 0,03 m | – | – | 33 % (heute 44 %) | – |

**Bewertung:** Weltrekorde brauchen ~10/s und nahezu perfektes Timing. Die Ausnahme sind die Hürden: Das
Rennen dauert nur ~13 s, und wer so kurz 12/s hält, schafft den Rekord auch mit ordentlichem Timing. Das ist
bewusst so gewählt („kurzzeitig mehr“), denn der Sprint ist die Hämmer-Disziplin. Beim Schwimmen braucht der
Rekord wie bisher einen nahezu perfekten Takt.

## Hebel A: Schwierigkeitsgrad (Gegnerstärke)

### Gegner-Modell

Ein Gegner ist `{ rate, error }`. Daraus leiten sich gemeinsame Werte ab (`clamp` = begrenzen):

| Wert | Formel | e = 1 | e = 0,4 |
|---|---|---|---|
| Tipp-Schwankung (gleichverteilt ±) | `clamp(0.02 + 0.18·e, 0.04, 0.3)` | 0,20 | 0,092 |
| Reaktion auf das Startsignal | `clamp(0.135 + 0.165·e, 0.15, 0.4)` s | 0,30 s | 0,20 s |
| Tagesform je Wettbewerb | Rate × 0,95–1,05 | – | – |

Die Tagesform gibt es heute schon bei Hürden, Schwimmen und Turm. Neu kommt sie bei Weitsprung, Stab und BMX dazu.

| Disziplin | Profil aus `{rate, error}` (e = error) |
|---|---|
| 110 m Hürden (`CpuProfile`) | `tapRate: rate, tapJitter, reaction, jumpError: 0.06·e` |
| Weitsprung (`JumpCpuProfile`, **neu**) | `tapRate, tapJitter, boardError: 0.04·e` (s), `angleError: 4·e` (Grad), `extendError: 0.06·e` (s) |
| Stabhoch (`VaultCpuProfile`, **neu**) | `tapRate, tapJitter, plantError: 0.05·e` (s), `releaseError: 0.05·e` (s), `opening` (siehe unten) |
| 100 m Freistil (`SwimCpuProfile`) | `tapRate, tapJitter, reaction, turnError: 0.35·e` (m), `breathAt: 0.25` |
| Turmspringen (`DiveCpuProfile`) | `tapRate, tapJitter, takeoffError: 0.08·e, releaseError: 0.06·e, dives` aus der Tabelle unten |
| BMX (`BmxCpuProfile`) | `tapRate, error: 0.08·e, flipChance: clamp(0.9 − 0.9·(e − 0.33), 0, 0.9), trickChance: clamp(0.9 − 0.45·(e − 0.33), 0.2, 0.9), mistakeChance: clamp(0.12·e, 0.02, 0.4)` |

**Weitsprung-Gegner** (`simulateCpuJump(p, rng): LjState`, `cpuJump(p, rng) = …distance`):
- tippt mit `tapRate` und ±`tapJitter`
- Absprung: `ljPress`, sobald die Hüfte `v · (boardError + N(0, boardError))` vor der Brettkante ist (also im Mittel 1 σ Sicherheitsabstand). Das ergibt etwa 16 % Übertreten.
- Winkel: hält bis `30° + N(0, angleError)`
- Beine: streckt bei `flightDuration − flightTime ≤ 0.15 + N(0, extendError)`. Ist dieser Wert negativ, streckt er nicht.

**Stabhoch-Gegner** (`simulateCpuVault(p, rng): VaultState`):
- tippt wie oben
- sticht bei `−x ≤ takeoffIdeal + N(0, plantError) · v` ein
- lässt los bei `p ≥ releaseIdeal + N(0, releaseError) / vaultDuration`, frühestens bei `earliestRelease + 0.01`
- `cpuAttempt(p, bar, rng)` vergleicht `peak ≥ bar + clearance`. Die Höhe hängt nicht von der Latte ab, also läuft je Versuch genau ein Sprung.
- **Einstiegshöhe** `vaultOpening(p)`: Ø von 40 Probesprüngen mit festem Seed (`createRng(7)`), minus 0,45 m,
  abgerundet auf die nächste Höhe aus `HEIGHTS` (mindestens 3,80). Das wird einmal beim Erzeugen des Profils berechnet.
  Gemessen ohne gültige Höhe: LEICHT-Rookie 2,9 %, alle anderen 0 %.

### Stufen (`DIFFICULTY_SCALE`)

| Stufe | Rookie | Profi | Champion | Kurz |
|---|---|---|---|---|
| **LEICHT** | 5,0/s · e 1,6 | 6,0/s · e 1,3 | 7,0/s · e 1,1 | Gelegenheitsspieler-Feld |
| **NORMAL** (Standard) | 7,0/s · e 1,2 | 8,0/s · e 0,95 | 9,0/s · e 0,7 | geübtes Feld, Champion sehr gut |
| **SCHWER** | 8,5/s · e 0,8 | 9,3/s · e 0,55 | 10,0/s · e 0,4 | Weltklasse |
| *heute (zum Vergleich)* | *≈ 8,6 · 1,3* | *≈ 9,9 · 0,9* | *≈ 11,0 · 0,6* | *über SCHWER* |

**Sprunglisten Turmspringen** (die 3 Sprünge mit dem besten Erwartungswert für das Profil, nach SG geordnet):

| Stufe | Rookie | Profi | Champion |
|---|---|---|---|
| LEICHT | 15p, 25h, 15s2 | 25h, 25p, 15s2 | 25p, 15s2, 35h |
| NORMAL | 25p, 15s2, 35h | 25p, 15s2, 35h | 15s2, 35h, 45h |
| SCHWER | 25p, 15s2, 35h | 15s2, 35h, 45h | 15s2, 35h, 45h |

### Messung Soll: Spieler gegen jede Stufe

300 Wettbewerbe je Zelle mit der neuen Physik. Format: Medaille % / Gold %. Die Gegner-Mittelwerte stehen
unter jeder Tabelle.

**LEICHT**

| Spieler | Hürden | Weit | Stab | Schwimmen | Turm | BMX |
|---|---|---|---|---|---|---|
| 5/s ordentlich | 84/0 | 71/0 | 66/0 | 60/0 | 88/20 | 83/16 |
| **6/s ordentlich** | **100/7** | **98/9** | **100/2** | **100/0** | **95/41** | **93/36** |
| 7/s ordentlich | 100/55 | 100/54 | 100/59 | 100/57 | 96/52 | 97/46 |
| **8/s ordentlich** | **100/94** | **99/93** | **100/100** | **100/100** | **96/56** | **99/65** |
| 10/s ordentlich | 100/100 | 99/99 | 100/100 | 100/100 | 96/65 | 100/82 |

Gegner Ø (Rookie/Profi/Champion):

| Disziplin | Rookie / Profi / Champion |
|---|---|
| Hürden | 18.31 / 16.42 / 15.15 |
| Weit | 5.18 / 6.13 / 6.86 |
| Stab | 3.85 / 4.47 / 4.89 |
| Schwimmen | 58.5 / 54.9 / 52.2 |
| Turm | 127 / 155 / 183 |
| BMX | 3621 / 5100 / 5970 |

**NORMAL**

| Spieler | Hürden | Weit | Stab | Schwimmen | Turm | BMX |
|---|---|---|---|---|---|---|
| 6/s ordentlich | 11/0 | 7/0 | 2/0 | 0/0 | 65/6 | 54/1 |
| 7/s ordentlich | 65/0 | 58/0 | 55/0 | 50/0 | 72/15 | 69/4 |
| **8/s ordentlich** | **96/2** | **93/2** | **100/0** | **100/0** | **80/13** | **85/16** |
| 9/s ordentlich | 100/26 | 100/39 | 100/43 | 100/39 | 79/16 | 86/17 |
| **9/s gut (e 0,67)** | **100/50** | **100/52** | **100/46** | **100/50** | **92/55** | **97/47** |
| 10/s ordentlich | 100/76 | 99/68 | 100/94 | 100/96 | 79/20 | 93/29 |
| 10/s nahezu perfekt | 100/99 | 100/97 | 100/100 | 100/100 | 100/92 | 99/89 |

Gegner Ø (Rookie/Profi/Champion):

| Disziplin | Rookie / Profi / Champion |
|---|---|
| Hürden | 15.24 / 14.19 / 13.42 |
| Weit | 6.92 / 7.63 / 8.37 |
| Stab | 4.88 / 5.31 / 5.67 |
| Schwimmen | 52.3 / 50.1 / 48.4 |
| Turm | 176 / 200 / 227 |
| BMX | 5727 / 7110 / 8426 |

**SCHWER**

| Spieler | Hürden | Weit | Stab | Schwimmen | Turm | BMX |
|---|---|---|---|---|---|---|
| **8/s ordentlich** | **12/0** | **17/0** | **9/0** | **4/0** | **40/0** | **32/2** |
| 9/s ordentlich | 62/0 | 68/1 | 88/0 | 86/0 | 40/0 | 42/3 |
| 10/s ordentlich | 90/15 | 91/11 | 100/15 | 100/6 | 47/1 | 46/2 |
| 10/s gut | 100/43 | 98/24 | 100/38 | 100/25 | 76/14 | 77/14 |
| **10/s nahezu perfekt** | **100/53** | **100/57** | **100/71** | **100/55** | **99/57** | **97/50** |

Gegner Ø (Rookie/Profi/Champion):

| Disziplin | Rookie / Profi / Champion |
|---|---|
| Hürden | 13.74 / 13.23 / 12.91 |
| Weit | 8.03 / 8.60 / 8.83 |
| Stab | 5.50 / 5.76 / 5.88 |
| Schwimmen | 49.2 / 48.0 / 47.0 |
| Turm | 217 / 245 / 265 |
| BMX | 7916 / 8907 / 9706 |

**Wettkampf (Medaillenspiegel über 6 Disziplinen, 4000 kombinierte Wettkämpfe):**

| Spieler | LEICHT Podest / Sieg | NORMAL Podest / Sieg | SCHWER Podest / Sieg |
|---|---|---|---|
| 5/s ordentlich | 89 % / 0 % (Ø 4,6 Medaillen) | 12 % / 0 % | 0 % / 0 % |
| 6/s ordentlich | **100 % / 3 %** (Ø 5,9) | 30 % / 0 % | 2 % / 0 % |
| 7/s ordentlich | 100 % / 68 % | 72 % / 0 % | 3 % / 0 % |
| 8/s ordentlich | 100 % / **99 %** | **94 % / 0 %** (Ø 5,5 Medaillen, 0,3 Gold) | 15 % / 0 % |
| 9/s ordentlich | 100 % / 100 % | 100 % / 20 % | 70 % / 0 % |
| 9/s gut | 100 % / 100 % | 100 % / **60 %** | 92 % / 0 % |
| 10/s ordentlich | 100 % / 100 % | 100 % / 81 % | 97 % / 0 % |
| 10/s gut | 100 % / 100 % | 100 % / 98 % | 100 % / 15 % |
| 10/s nahezu perfekt | 100 % / 100 % | 100 % / 100 % | 100 % / **75 %** |

Ein Gesamtsieg mit geteiltem Platz 1 zählt als Sieg.

**Zielwerte erfüllt:**
- **LEICHT:** 6/s hat in jeder Disziplin ≥ 93 % Medaillen. 8/s gewinnt oft (Gold 56–100 %, Gesamtsieg 99 %).
- **NORMAL:** 8/s hat realistische Medaillenchancen (80–100 % je Disziplin, Ø 5,5 von 6 Medaillen). Gold ist selten (0–16 %).
  9/s mit gutem Timing gewinnt etwa jede zweite Disziplin und 60 % der Wettkämpfe.
- **SCHWER:** Selbst Bronze braucht ~9/s. Gold verlangt 10/s mit nahezu perfektem Timing (50–71 %). Mit
  ordentlichem Timing gibt es bei 10/s nur 1–15 % Gold und keinen Gesamtsieg.

Zufall schlägt Können nicht: In den Tipp-Disziplinen ist das Ergebnis fast nur Tempo, bei Turm und BMX
entscheidet vor allem das Timing.

## Menü, Anzeige und Speicherung

### Titel-Layout (640×360, jetzt 5 Zeilen)

Die Zeilen bekommen einen Abstand von 22 px statt 26 px, die Markierung wird 24 px hoch. Der Hilfekasten
rutscht 8 px nach unten. Das Logo bleibt unverändert.

```
y 30       RETRO (16 px) – unverändert
y 58–90    Streifen, SUMMER GAMES (32 px) bei y 62 – unverändert
y 106–226  PANEL (x100, w440, h120)
           ROW_Y = [116, 138, 160, 182, 204]  (MODUS, DISZIPLIN, GEGNER, NATION, ATHLET)
           Markierung: fillRect(PANEL.x + 4, rowY − 4, PANEL.w − 8, 24)
           Pfeil-Dreiecke wie bisher bei rowY + 8 (±6)
y 232–296  Hilfekasten: HELP_Y = 240 (Kasten HELP_Y − 8 … + 56), Zeilen bei 240/254/268/282
y 300      Bestleistung (8 px)
y 318      ENTER = START (16 px) – unverändert
y 350      Version – unverändert
```

Prüfung: Die letzte Markierung endet bei 224 < 226 (Panelende). Zwischen Panel und Hilfekasten liegen 6 px.
Die 16-px-Werte (y = rowY … rowY + 16) überlappen die Nachbarzeile nicht (Abstand 22). Die Bestleistung
endet bei 308, und ENTER beginnt bei 318.

### Menüzeile GEGNER

- Label `GEGNER`, Wert `LEICHT` / `NORMAL` / `SCHWER` (16 px, Farben wie die anderen Zeilen).
- PFEIL LINKS/RECHTS (A/D) wechselt zyklisch. `sfx.menu()` erklingt, die Wahl wird sofort mit
  `saveDifficulty()` gespeichert (wie MODUS).
- Die Zeile ist in **beiden** Modi aktiv. Im Wettkampf wird nur DISZIPLIN übersprungen, wie bisher.
- **Hilfekasten**, solange GEGNER markiert ist (statt der Steuerung der Disziplin). Taste ≤ 18 Zeichen, Text ≤ 30 Zeichen.
  Die gewählte Stufe hat eine gelbe Taste und einen weißen Text, die anderen sind grau (`#5d6278`).

| Taste | Text |
|---|---|
| `LEICHT` | `ZUM EINSTEIGEN, AB 6 TIPPS/S` |
| `NORMAL` | `MEDAILLEN AB CA. 8 TIPPS/S` |
| `SCHWER` | `WELTKLASSE: 10/S + TIMING` |
| `PFEIL LINKS/RECHTS` | `STUFE WÄHLEN (WIRD GEMERKT)` |

### Speicherung (`data/storage.ts`)

`loadDifficulty(): Difficulty` liest `rsg.difficulty`. Unbekannte oder fehlende Werte ergeben `'normal'`.
`saveDifficulty(d)` schreibt den Wert. Beide sind fehlertolerant wie die vorhandenen Helfer.

### Wettkampf

- `createCompetition(playerCode, pool, rng, playerLook, difficulty)` speichert `difficulty` in `CompetitionState`.
- Neuer Helfer `currentDifficulty()` in `data/session.ts`: `getCompetition()?.difficulty ?? loadDifficulty()`.
  Alle 6 Szenen holen ihre Gegner nur darüber.

### Anzeige der Stufe

| Ort | Text (8 px, grau wie bisher) |
|---|---|
| Ergebnis, Einzelmodus | `110 M HÜRDEN – GEGNER: LEICHT` |
| Ergebnis, Wettkampf | `100 M FREISTIL – DISZIPLIN 4 VON 6 – GEGNER: SCHWER` (max. 51 Zeichen = 408 px) |
| Medaillenspiegel Intro | `WETTKAMPF ÜBER 6 DISZIPLINEN – GEGNER: NORMAL` |
| Medaillenspiegel danach | `NACH 3 VON 6 DISZIPLINEN – GEGNER: NORMAL` |

Die Abschlussfeier bleibt unverändert, denn der Spiegel davor zeigt die Stufe schon.

### Bestleistungen

Es gibt keine Trennung je Stufe (D8) und keine Migration (D10). Hinweis für RSG-04: Die Top-5-Listen
bekommen einen eigenen Schlüssel und übernehmen die alten Werte von Hürden, Weitsprung und Stab **nicht**
(andere Tempo-Kurve).

## Umsetzungsschnittstelle

```ts
// src/sim/difficulty.ts – importiert keine Sims (keine Zyklen)
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const satisfies readonly Difficulty[];
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'LEICHT', normal: 'NORMAL', hard: 'SCHWER' };

/** Ein Gegner in zwei Zahlen: Tipps/s und Fehlerfaktor (1 = ordentlich, 0,33 ≈ nahezu perfekt) */
export interface CpuSkill { rate: number; error: number }

// Reihenfolge Rookie/Profi/Champion – wird in difficulty.test.ts geprüft
export const DIFFICULTY_SCALE = {
  easy:   [{ rate: 5.0, error: 1.6 }, { rate: 6.0, error: 1.3 },  { rate: 7.0,  error: 1.1 }],
  normal: [{ rate: 7.0, error: 1.2 }, { rate: 8.0, error: 0.95 }, { rate: 9.0,  error: 0.7 }],
  hard:   [{ rate: 8.5, error: 0.8 }, { rate: 9.3, error: 0.55 }, { rate: 10.0, error: 0.4 }],
} as const satisfies Record<Difficulty, readonly [CpuSkill, CpuSkill, CpuSkill]>;

export const CPU_NAMES = ['Rookie', 'Profi', 'Champion'] as const;
export function cpuJitter(error: number): number;    // clamp(0.02 + 0.18·e, 0.04, 0.3)
export function cpuReaction(error: number): number;  // clamp(0.135 + 0.165·e, 0.15, 0.4)
/** Tagesform: Tipprate × 0,95–1,05 */
export function withForm<P extends { tapRate: number }>(p: P, rng: () => number): P;
```

Jede Sim exportiert eine Fabrik mit genau 3 Profilen (Namen aus `CPU_NAMES`). Die bisherigen Konstanten
bleiben als NORMAL erhalten, sodass `competition.test.ts` (Namensreihenfolge) weiter gilt:

| Sim | Fabrik | Konstante |
|---|---|---|
| `cpu.ts` | `hurdleCpuProfiles(d)` | `CPU_PROFILES = hurdleCpuProfiles('normal')` |
| `longjump.ts` | `jumpCpuProfiles(d)` + `simulateCpuJump(p, rng)`; `cpuJump(p, rng)` rechnet über die Sim | `LJ_CPU_PROFILES` |
| `polevault.ts` | `vaultCpuProfiles(d)` (inkl. `opening` über `vaultOpening`) + `simulateCpuVault(p, rng)`; `cpuAttempt(p, bar, rng)` über die Sim | `VAULT_CPU_PROFILES` |
| `swim.ts` | `swimCpuProfiles(d)` | `SWIM_CPU_PROFILES` |
| `dive.ts` | `diveCpuProfiles(d)` mit `DIVE_CPU_DIVES[d][i]` | `DIVE_CPU_PROFILES` |
| `bmx.ts` | `bmxCpuProfiles(d)` | `BMX_CPU_PROFILES` |

`BmxCpu` wendet im Konstruktor die Tagesform an (wie `CpuController`/`SwimCpu`).

**Szenen** (je eine Stelle, die Struktur bleibt):
- `RaceScene`, `SwimScene`, `BmxScene`: `const list = xxxCpuProfiles(currentDifficulty())`. Diese Liste
  ersetzt `CPU_PROFILES` beim Mischen und `CPU_PROFILES[entry.profile]` im Wettkampf.
- `LongJumpScene`, `PoleVaultScene`, `DiveScene`: dasselbe. Weitsprung und Stab erzeugen je Teilnehmer einmal
  `withForm(profile, Math.random)`. Turm nutzt weiter `cpuDiveRate`.
- **Achtung SwimScene:** Der Pixel-Artist arbeitet gerade an `SwimScene.ts`/`gfx/swimmer.ts`. Die zwei Zeilen
  zum Gegnerfeld erst nach dessen Commit einbauen.
- `TitleScene`: Zeile GEGNER, Layout und Hilfe wie oben, Version `v0.10 SOLO`.
- `ResultScene`/`MedalsScene`: Unterzeile mit `DIFFICULTY_LABEL[currentDifficulty()]`.
- Die HUD-Tempobalken nutzen weiter `…maxSpeed`. Die neuen Höchstwerte gelten automatisch.

## Tests

**Neu: `src/sim/difficulty.test.ts`**

1. **Ordnung:** In jeder Stufe steigt `rate` und fällt `error` von Rookie zu Champion. Für jeden Index gilt
   über die Stufen hinweg easy < normal < hard bei `rate` und easy > normal > hard bei `error`.
2. **Fabriken:** Jede liefert 3 Profile mit den Namen Rookie/Profi/Champion. Die NORMAL-Ausgabe ist gleich der
   exportierten Konstante. Abgeleitete Fehlerwerte fallen mit der Stufe (z. B. `jumpError`, `turnError`, `mistakeChance`).
3. **`loadDifficulty`:** In Node fehlt localStorage, dann gibt es `'normal'`. Mit einem kleinen Stub für `globalThis.localStorage` prüfen: `'hard'` wird gelesen, und ein ungültiger Wert ergibt `'normal'`.
4. **Zielwerte (Simulation mit Toleranz):** Das Spieler-Modell ist **dieselbe Fabrik mit eigenem `CpuSkill`**,
   also z. B. `{rate: 8, error: 1}`. Je Zeile 80 Wettbewerbe mit festem Seed. Turm-Sprunglisten der
   Spieler-Modelle:
   - 6/s und 8/s: 15s2, 35h, 25p
   - 9/s gut: 35h, 45h, 15s2
   - 10/s nahezu perfekt: 45h, 35h, 25p

   | Stufe | Spieler | Kriterium je Disziplin (alle 6) | gemessen |
   |---|---|---|---|
   | LEICHT | 6/s · e 1 | Medaille ≥ 80 % | 93–100 % |
   | LEICHT | 8/s · e 1 | Gold ≥ 40 % | 56–100 % |
   | NORMAL | 8/s · e 1 | Medaille ≥ 65 %, Gold ≤ 30 % | 80–100 % / 0–16 % |
   | NORMAL | 9/s · e 0,67 | Gold 25–75 % | 46–55 % |
   | SCHWER | 8/s · e 1 | Medaille ≤ 50 % | 4–40 % |
   | SCHWER | 10/s · e 1 | Gold ≤ 30 % | 1–15 % |
   | SCHWER | 10/s · e 0,33 | Gold 30–85 % | 50–71 % |
   | alle | – | Ø Rookie < Profi < Champion | siehe Tabellen |

5. **Wettkampf** (Ränge je Disziplin aus Schritt 4 zufällig kombinieren, 2000 Wettkämpfe):

   | Stufe | Spieler | Kriterium | gemessen |
   |---|---|---|---|
   | LEICHT | 6/s | Podest ≥ 90 % | 100 % |
   | LEICHT | 8/s | Gesamtsieg ≥ 80 % | 99 % |
   | NORMAL | 8/s | Podest ≥ 80 %, Gesamtsieg ≤ 10 % | 94 % / 0 % |
   | NORMAL | 9/s gut | Gesamtsieg 35–85 % | 60 % |
   | SCHWER | 8/s | Podest ≤ 35 % | 15 % |
   | SCHWER | 10/s gut | Gesamtsieg ≤ 35 % | 15 % |
   | SCHWER | 10/s perfekt | Gesamtsieg ≥ 50 % | 75 % |

   Die Laufzeit soll unter ~20 s bleiben. Bei Bedarf kommt das in eine eigene Datei `difficulty.balance.test.ts` mit `{ timeout: 60_000 }`.

**Anzupassende Tests** (die Werte stammen aus der neuen Kurve):

| Datei | Anpassung |
|---|---|
| `hurdles.test.ts` | Höchstgeschwindigkeit 9,55. Rennzeiten NORMAL Ø 15,2 / 14,2 / 13,4, also Champion > 12 und Rookie < 18. |
| `longjump.test.ts` | Ein Test für „schneller = weiter“ bleibt. Gegner-Test über `jumpCpuProfiles`: Ø NORMAL 6,9 / 7,6 / 8,4 m, geordnet, Übertreten 8–25 %. |
| `polevault.test.ts` | 10/s perfekt ergibt Ø 5,9 m, also die Spanne 5,0–6,0 auf **5,5–6,2** setzen. Neu: Mit gleichem Timing hängt die Höhe nicht davon ab, wann zwischen zwei Tipps eingestochen wird (Spanne ≤ 0,1 m). Neu: `vaultOpening` NORMAL = 4,40 / 4,80 / 5,20. |
| `swim.test.ts` | Gegner NORMAL Ø 52,3 / 50,1 / 48,4, also Spannen 51–54 / 49–51,5 / 47,5–49,5. „10/s schneller als Hämmern 13/s“ bleibt. |
| `dive.test.ts` | Schwung: 8/s → 0,88–0,95, 11/s → ≥ 0,99. Gegner NORMAL Ø ~176 / 200 / 227. Die Spieler-Modell-Tests (8/s, 11/s, 14/s, Weltrekord) neu einmessen; Aussagen bleiben, Zahlen ändern sich. |
| `bmx.test.ts` | Gegner-Ordnung bleibt. „Gutes Tempo sturzfrei“ mit 8/s prüfen. |

## Spieltest-Bot (`scripts/e2e/smoke.cjs`)

- **Neuer Lauf `leicht`** (in `DISCIPLINES`, läuft bei `npm run e2e` mit):
  1. Titel laden, mit echten Tasten `ArrowDown` drücken, bis `title.selected === 2` (GEGNER), dann `ArrowLeft`
     (NORMAL → LEICHT).
  2. Prüfen: `title.difficulty === 'easy'` und `localStorage['rsg.difficulty'] === 'easy'`.
  3. `page.reload()`, dann prüfen, dass der Titel wieder LEICHT zeigt (gespeichert). Screenshot `leicht-0-title`.
  4. Mit dem Hürden-Bot spielen. Er startet über `scene.start('race', …)` wie bisher.
  5. Prüfen: Die Tipprate aller Gegner ist ≤ 7,35 (`sc.competitors.filter(c => c.cpu).map(c => c.cpu.profile.tapRate)`).
     Die Ergebnis-Szene zeigt in der Unterzeile `GEGNER: LEICHT`.
  6. Am Ende über die Tasten zurück auf NORMAL stellen (der Browser-Kontext teilt sich localStorage mit den
     anderen Läufen) und `rsg.difficulty === 'normal'` prüfen.
- **Wettkampf:** läuft auf NORMAL. Prüfen, dass `medals.state.difficulty === 'normal'` und die Intro-Unterzeile `GEGNER: NORMAL` enthält.
  Der Test „DISZIPLIN wird übersprungen“ (`selected === 2`) gilt unverändert, Zeile 2 ist jetzt GEGNER.
- **localStorage-Prüfung:** `rsg.difficulty` in die Liste der erlaubten Schlüssel aufnehmen.
- Die Bots tippen mit 9,5–11/s und funktionieren mit der neuen Kurve. Alle Grenzen (Schwimmen < 60 s,
  Turm-Summe > 120, Stab-Champion gültig) bleiben erfüllt (Champion NORMAL ohne gültige Höhe: 0 von 2000).
- Screenshots ansehen: Titel mit 5 Zeilen (GEGNER markiert, Hilfekasten zur Stufe), Ergebnis-Unterzeile, Medaillenspiegel-Unterzeile.

## Texte (alle GROSSBUCHSTABEN, ohne ←/→-Glyphen)

| Ort | Text |
|---|---|
| Menüzeile | `GEGNER` · `LEICHT` / `NORMAL` / `SCHWER` |
| Hilfekasten | siehe Tabelle „Menüzeile GEGNER“ |
| Ergebnis | `… – GEGNER: LEICHT` |
| Medaillenspiegel | `… – GEGNER: NORMAL` |
| README | Abschnitt „Gegner“: `LEICHT` (Einsteiger, ~6 Tipps/s), `NORMAL` (geübt, Medaillen ab ~8/s, Gold mit ~9/s und gutem Timing), `SCHWER` (Weltklasse, ~10/s und nahezu perfektes Timing). Wird gemerkt, gilt auch im Wettkampf. Dazu ein Satz zur neuen Tempo-Kurve. |
| CHANGELOG | Neue Tempo-Kurve (8/s ≈ 90 % Höchsttempo), Gegner in 3 Stufen, Stabhochsprung wertet geglättetes Tempo, Weitsprung-/Stab-Gegner springen über die echte Sim, alte Bestleistungen meist leichter zu schlagen. |

## Abnahmekriterien

1. Im Titel gibt es 5 Zeilen in der Reihenfolge MODUS, DISZIPLIN, GEGNER, NATION, ATHLET. Das Layout folgt den
   Koordinaten oben, nichts überlappt (Screenshot). GEGNER ist in beiden Modi wählbar, DISZIPLIN wird im
   Wettkampf übersprungen.
2. PFEIL LINKS/RECHTS auf GEGNER wechselt zyklisch LEICHT, NORMAL, SCHWER. Die Wahl steht nach einem Neuladen
   der Seite unverändert da (`rsg.difficulty`). Ohne gespeicherten oder bei kaputtem Wert gilt NORMAL.
3. Solange GEGNER markiert ist, zeigt der Hilfekasten die 4 Stufen-Zeilen, die gewählte Stufe hervorgehoben.
4. Alle 6 Disziplinen holen ihre Gegner über `currentDifficulty()`. Auf LEICHT tippt kein Gegner schneller als
   7,0/s × 1,05. Im Wettkampf gilt die beim Start gewählte Stufe für alle Disziplinen.
5. Ergebnis und Medaillenspiegel zeigen `GEGNER: <STUFE>` in der Unterzeile.
6. Die Tempo-Kurve ist umgesetzt (`tapSpeed`, Konstanten wie oben). Der Stabhochsprung rechnet beim Einstich mit `vAvg`.
   Weitsprung- und Stab-Gegner springen über die Sim. `cpuJump`/`cpuAttempt` behalten ihre Signatur.
7. `difficulty.test.ts` deckt Ordnung, Fabriken und alle Zielwerte aus „Tests“ ab (fester Seed, Toleranzen wie angegeben).
   Alle angepassten Tests sind grün.
8. Weltrekorde sind unverändert. Ein Test belegt: 8/s ordentlich bricht keinen Weltrekord (Hürden, Weit, Schwimmen,
   Turm, je 100 Läufe), und 10/s nahezu perfekt schafft Hürden oder Weit mindestens einmal in 100.
9. Hämmern lohnt beim Schwimmen weiter nicht: 12/s ist langsamer als 10/s. Ein Durchgang bleibt in 30–90 s.
10. `npm run typecheck`, `npm test`, `npm run build` und `npm run e2e` (inklusive `leicht` und `wettkampf`) sind grün.
    Die Screenshots sind angesehen.
11. README, CHANGELOG und ROADMAP sind aktualisiert (RSG-02 abgehakt mit v0.10.0). Version 0.10.0 steht in
    `package.json` und im Titel (`v0.10 SOLO`), danach `npm install --package-lock-only`.

## Aufgaben

**Game-Engineer**

1. Tempo-Kurve in den Sims: `tapSpeed` in `hurdles.ts`, `ljTap`, `vaultTap`, `stroke`, `swingTap`, `pedal`, Konstanten wie oben.
   Dazu `vAvg` im Stabhochsprung und die Kommentare zum Gleichgewichtstempo anpassen.
2. `src/sim/difficulty.ts` und die Fabriken je Sim. Weitsprung- und Stab-Gegner laufen über die Sim
   (`simulateCpuJump`, `simulateCpuVault`, `vaultOpening`). Die Turm-Sprunglisten kommen nach `DIVE_CPU_DIVES`.
   `BmxCpu` bekommt die Tagesform.
3. `storage.ts` (`loadDifficulty`/`saveDifficulty`), `session.ts` (`currentDifficulty`), `competition.ts` (`difficulty` im Zustand).
4. Szenen: Gegnerfeld aus der Stufe in allen 6 Szenen (SwimScene erst nach dem Commit des Pixel-Artists).
   Dazu `TitleScene` (Zeile, Layout, Hilfe, Version) sowie die Unterzeilen in `ResultScene` und `MedalsScene`.
5. Tests: neu `difficulty.test.ts`, vorhandene Tests wie in der Tabelle anpassen.
6. Bot: Lauf `leicht`, Wettkampf-Prüfung, erlaubte localStorage-Schlüssel.
7. README, CHANGELOG, ROADMAP, Version 0.10.0.

**Pixel-Artist**

- Keine neuen Grafiken nötig. Den Titel-Screenshot mit 5 Zeilen prüfen (Abstände, Markierung, Pfeile, Flagge in
  der Zeile NATION bei der neuen Zeilenhöhe) und den Hilfekasten mit der grauen bzw. gelben Hervorhebung.
- Optional: drei kleine Stärke-Balken (1/2/3, grün/gelb/rot, je 3×8 px) rechts neben dem Wert der GEGNER-Zeile
  als zusätzliches Retro-Signal. Das gehört nicht zur Abnahme.

## Folgeideen für die Roadmap

- **Eigenes Tempo anzeigen:** Im Ergebnis eine Zeile `DEIN TEMPO: 8.2 TIPPS/S` (Schwimmen misst das schon).
  So weiß man, welche Stufe passt (Prinzip 5 „Verständlich“).
