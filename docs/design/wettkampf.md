# RSG-01a Wettkampfmodus „Die Spiele“ – Ablauf und Medaillenspiegel

## Ziel und Spielgefühl

Ein Abend wie früher: Nation wählen, alle Disziplinen hintereinander, ein Versuch pro Disziplin, und
zwischendurch fiebert man mit dem Medaillenspiegel. Wie bei den Sommerspielen der 80er geht es um die
Nation, nicht nur um die eigene Bestzeit. Teil a liefert den Ablauf und einen schlichten Endstand; die
animierte Abschlussfeier folgt in RSG-01b.

## Entscheidungen (mit Begründung)

| # | Entscheidung | Begründung |
|---|---|---|
| E1 | **Reihenfolge: 110 M HÜRDEN, WEITSPRUNG, STABHOCHSPRUNG, BMX** | Steigende Komplexität: Hürden sind am kürzesten (nur Tippen und Sprung). Der Weitsprung nutzt denselben Anlauf und bringt das Brett dazu. Der Stabhochsprung hat das schwerste Timing. BMX ist als Finale am Strand das spektakulärste Bild, und erst hier wechselt die Kulisse. |
| E2 | **Kein „Nochmal“ im Wettkampf.** ENTER in der Siegerehrung führt zum Medaillenspiegel, R (Neustart im Lauf) ist abgeschaltet. | Die Computer-Gegner haben auch nur einen Versuch. Wer so lange wiederholt, bis es Gold gibt, macht den Medaillenspiegel wertlos. Für „schnelles Nochmal“ gibt es den Einzelmodus. Die Regeln der Disziplin selbst bleiben (Fehlstart, 3 Versuche im Weitsprung usw.). |
| E3 | **Ein festes Teilnehmerfeld pro Wettkampf:** 3 Gegner-Nationen werden beim Start einmal gezogen und behalten über alle Disziplinen ihr Profil (Rookie/Profi/Champion) und ihr Aussehen. | Bisher zieht jede Szene Nationen und Profile neu (`Shuffle(COUNTRIES…)`). Über 4 Disziplinen kämen so bis zu 12 Nationen mit je 1 Medaille zusammen, und der Spiegel wäre sinnlos. Mit festem Feld gibt es einen klaren Rivalen (den „Favoriten“), und Zufall bei der Zuteilung entscheidet nicht über den Gesamtsieg. |
| E4 | **Medaillen exakt wie auf dem Podest der ResultScene:** Platz 1–3 der sortierten `rows`, aber nur, wenn `valid`. Ungültige Leistungen (DNF, O.G.V.) bekommen keine Medaille, und es rückt niemand nach. | Was die Siegerehrung zeigt, steht auch im Spiegel. Die Sortierung liefern die Disziplinen schon heute so, dass gültige Leistungen zuerst kommen. Geteilte Plätze innerhalb einer Disziplin gibt es nicht (dort gelten die Tie-Breaks der Disziplin). |
| E5 | **Spiegel sortiert nach Gold, dann Silber, dann Bronze (absteigend).** Bei gleicher Medaillenzahl gilt der **gleiche Platz** („1, 2, 2, 4“). Innerhalb eines Gleichstands wird nach Ländercode A–Z angezeigt. Alle 4 Nationen stehen immer in der Tabelle, auch mit 0 Medaillen. | Das ist die übliche Regel bei Medaillenspiegeln. Der Ländercode ist neutral, eindeutig und in ASCII (kein Ä/Ö-Sortierproblem). Die Gesamtzahl wird nur angezeigt und nicht gewertet. |
| E6 | **Gesamtsieger = alle Nationen auf Platz 1.** Bei Gleichstand gewinnen sie gemeinsam. Hat niemand eine Medaille, lautet der Text „KEIN GESAMTSIEGER“. | Haben alle 4 Disziplinen gültige Leistungen, folgen aus gleichen G/S/B auch identische Platzierungen. Ein weiterer Tie-Break wäre also willkürlich. |
| E7 | **Medaillenspiegel als eigene Szene `medals`** mit drei Modi: `intro` (vor Disziplin 1, „DIE NATIONEN“), `between`, `final` (Endstand). | Die ResultScene ist bis y≈316 voll. Eine eigene Szene bietet Platz für die Steuerung der nächsten Disziplin (im Wettkampf sieht man das Menü dazu nicht). RSG-01b ersetzt dann nur den Modus `final`. |
| E8 | **Esc öffnet im Wettkampf überall eine Rückfrage** (Overlay-Szene `confirm`). In einer Disziplin wird diese dabei pausiert. Im Einzelmodus bleibt Esc wie bisher. | Ein versehentliches Esc soll nicht den ganzen Wettkampf kosten. Die Overlay-Szene wird später für das Pause-Menü (RSG-03) wiederverwendet. |
| E9 | **Spielstand nur im Speicher** (Modul `src/data/session.ts`), nie in localStorage. Die Menüwahl MODUS wird wie die Disziplin gespeichert (`rsg.mode`). | So verlangt es die Roadmap. Die Moduswahl ist eine Einstellung und kein Spielstand. |
| E10 | **Persönliche Bestleistungen zählen auch im Wettkampf.** | Die Leistung ist echt erbracht, und so lohnt es sich doppelt. |

## Steuerung

- **Menü:** PFEIL HOCH/RUNTER wählt die Zeile, PFEIL LINKS/RECHTS ändert den Wert, ENTER startet.
- **Disziplinen:** unverändert. Im Wettkampf hat R keine Wirkung.
- **ResultScene, `medals`:** ENTER (oder Leertaste) = WEITER, ESC = Rückfrage, M = Ton.
- **Rückfrage:** PFEIL LINKS/RECHTS (A/D) wählt JA/NEIN, ENTER/Leertaste bestätigt, J = JA,
  N oder ESC = NEIN. Vorauswahl ist **NEIN**. Auto-Repeat (`ev.repeat`) wird ignoriert.

## Ablauf

1. **Titel:** Die neue erste Zeile heißt `MODUS` mit den Werten `EINZELDISZIPLIN` und `WETTKAMPF`. Im Wettkampf zeigt
   die Zeile `DISZIPLIN` grau (`#5d6278`) den Wert `ALLE 4`. Der Cursor überspringt sie, und es gibt keine Pfeile.
   Der Hilfekasten zeigt den Wettkampf-Text (siehe Texte), die Bestleistungszeile bleibt leer. ENTER legt den
   Wettkampf in der Session an und startet `medals` im Modus `intro`.
2. **`medals`/intro:** Die Tabelle zeigt alle 4 Nationen mit 0 Medaillen, dazu den Favoriten (Champion-Profil) und
   die Steuerung der ersten Disziplin. ENTER startet die Disziplin.
3. **Disziplin:** Die Szene liest Nationen, Profile und Look-Seeds aus der Session statt sie zu ziehen.
   R ist aus, und Esc öffnet die Rückfrage. Ist der Spieler im Stabhochsprung ausgeschieden, steht auf der Tafel
   `ENTER: ZUM ERGEBNIS`. Dann werden die Computer-Gegner im Schnelldurchlauf fertig gesprungen, wie bei `finishRemaining()`.
4. **ResultScene:** Die Medaillen werden beim Erzeugen genau einmal je Disziplin eingetragen (idempotent).
   Unten steht `ENTER: WEITER   ESC: ABBRECHEN`, die Unterzeile lautet `110 M HÜRDEN – DISZIPLIN 1 VON 4`.
   ENTER führt zu `medals`: nach Disziplin 1–3 im Modus `between`, nach der letzten im Modus `final`.
5. **`medals`/between:** Die Medaillen der eben beendeten Disziplin blinken. Dazu kommen eine Feedbackzeile und die
   Steuerung der nächsten Disziplin. ENTER startet sie.
6. **`medals`/final:** Titel `ENDSTAND` und Zeile `GESAMTSIEGER`. Gewinnt der Spieler, spielt `sfx.fanfare()`, sonst Jubel.
   ENTER oder ESC (ohne Rückfrage, der Wettkampf ist ja vorbei) beendet die Session und führt ins Menü.
7. **Abbruch:** Mit JA wird die Session beendet, die laufende Szene gestoppt und `title` gestartet. Mit NEIN geht es
   weiter. Die Rennzeit zählt während des Dialogs **nicht**, d. h. Zeitanker wie `gunAt` werden um die Pausendauer
   verschoben. Tasten, die beim Öffnen gehalten wurden, gelten nach NEIN als losgelassen.

## Layout (640×360)

**Titel**: 4 Zeilen statt 3, die anderen Elemente rücken leicht nach unten.

```
y 30/62  RETRO / SUMMER GAMES (unverändert)
y106–218 Panel x100–540   Zeilen y 118 MODUS · 144 DISZIPLIN · 170 NATION · 196 ATHLET (Abstand 26)
y224–288 Hilfekasten (HELP_Y = 232, 4 Zeilen à 14 px)
y298     Bestleistung (8 px)        y318 ENTER = START        y350 Version
```

**Szene `medals`** (Hintergrund: Stadion abgedunkelt wie in der ResultScene):

```
y 10  MEDAILLENSPIEGEL | ENDSTAND | DIE NATIONEN          16 px gelb, zentriert
y 32  NACH 2 VON 4 DISZIPLINEN                             8 px grau
y 56  PL  [F] NATION              G   S   B     HÜR WEIT STAB BMX     (Kopf 8 px grau)
      x70 x100 x122             x290 x320 x350  x392 x436 x480 x524   Linie y68, x60–580
y 76/96/116/136  4 Nationszeilen (Flagge 14×10). Spielerzeile gelb hinterlegt mit „(DU)“.
      G/S/B-Köpfe als Medaillenkreise. Disziplinsspalten: Platz 1–3 auf Medaillenkreis,
      4 weiß, X rot (ungültig), - grau (noch offen).
y164  Feedbackzeile 1 (8 px)     y178 Feedbackzeile 2 (8 px grau)
y196–300 Kasten x110–530: NÄCHSTE: WEITSPRUNG (16 px) + bis zu 4 Steuerungszeilen
         (Taste gelb x126, Text x276, wie im Titel)
         final: GESAMTSIEGER (8 px) / Flagge 32×22 / Nationsname 16 px gold
y330  ENTER: WEITER   ESC: ABBRECHEN                       8 px gelb, blinkend
```

**Rückfrage `confirm`**: Vollbild-Abdunklung (0x10101c, Alpha 0,7) und ein Kasten x140–500, y130–230 mit gelbem Rahmen.

```
y146 WETTKAMPF ABBRECHEN?            16 px weiß
y172 DER SPIELSTAND GEHT VERLOREN.   8 px grau
y194 JA        NEIN                  16 px, Auswahl gelb mit Dreieck davor
y216 J = JA   N / ESC = NEIN         8 px grau
```

## Texte (vollständig)

| Ort | Text |
|---|---|
| Titel, Zeilen | `MODUS` · `EINZELDISZIPLIN` · `WETTKAMPF` · Disziplin im Wettkampf: `ALLE 4` |
| Titel, Hilfe (Wettkampf) | `REIHENFOLGE` / `HÜRDEN - WEIT - STAB - BMX` · `WERTUNG` / `MEDAILLENSPIEGEL DER NATIONEN` · `STEUERUNG` / `VOR JEDER DISZIPLIN ERKLÄRT` · `PFEIL HOCH/RUNTER` / `MENÜ: ZEILE WÄHLEN` |
| `medals`, Titel | `DIE NATIONEN` · `MEDAILLENSPIEGEL` · `ENDSTAND` |
| `medals`, Unterzeile | `WETTKAMPF ÜBER 4 DISZIPLINEN` · `NACH {n} VON 4 DISZIPLINEN` |
| intro, Feedback | `FAVORIT: {NATION}` / `JEDE DISZIPLIN NUR EIN DURCHGANG!` |
| between, Zeile 1 | `{DISZIPLIN}: GOLD FÜR DICH!` (SILBER/BRONZE) · `{DISZIPLIN}: KEINE MEDAILLE FÜR DICH` |
| between, Zeile 2 | `ZWISCHENSTAND: DU FÜHRST!` · `ZWISCHENSTAND: GLEICHAUF AN DER SPITZE` · `ZWISCHENSTAND: DU BIST {p}. VON 4` |
| Kasten | `NÄCHSTE: {DISZIPLIN}` |
| final | `GESAMTSIEGER` + Nationsname · Gleichstand: `{CODE} UND {CODE}` bzw. `{CODE}, {CODE} UND {CODE}` · `KEIN GESAMTSIEGER` |
| final, Feedback | `GLÜCKWUNSCH! DU HAST DIE SPIELE GEWONNEN!` · `GEMEINSAM AN DER SPITZE – STARK!` · `DU WIRST {p}. – AUF EIN NEUES!` |
| Prompts | `ENTER: WEITER   ESC: ABBRECHEN` · final: `ENTER: ZURÜCK ZUM MENÜ` |
| ResultScene | Unterzeile `{DISZIPLIN} – DISZIPLIN {n} VON 4` · Prompt `ENTER: WEITER   ESC: ABBRECHEN` |
| Weitsprung-Tafel | `ESC: MENÜ` wird im Wettkampf zu `ESC: ABBRECHEN` |
| Stabhochsprung-Tafel | `DU BIST AUSGESCHIEDEN – ENTER: ZUM ERGEBNIS` |

Die längste Zeile hat 41 Zeichen bei 8 px. Mit 16 px ist `WETTKAMPF ABBRECHEN?` die längste (20 Zeichen ≙ 320 px, passt in 360 px).

## Schnittstelle (Logik in `src/sim/competition.ts`, ohne Phaser)

```ts
export const COMPETITION_ORDER = ['110h', 'long', 'pole', 'bmx'] as const satisfies readonly EventKey[];
export type Medal = 'gold' | 'silver' | 'bronze';
export interface FieldEntry { code: string; isPlayer: boolean; profile: 0 | 1 | 2 | null; lookSeed: number }
export interface Placing { code: string; place: number; valid: boolean }       // place 1..4
export interface CompetitionState {
  field: FieldEntry[];                       // Spieler + 3 Gegner, fest für den ganzen Wettkampf
  index: number;                             // nächste/aktuelle Disziplin in COMPETITION_ORDER
  results: Partial<Record<EventKey, Placing[]>>;
}
export interface MedalRow { code: string; gold: number; silver: number; bronze: number; total: number; rank: number }

createCompetition(playerCode: string, pool: readonly string[], rng: () => number, playerLook: number): CompetitionState
currentEvent(s): EventKey | null            // null = fertig
recordEvent(s, event, rows: { code: string; valid: boolean }[]): CompetitionState  // idempotent, nur für currentEvent
medalsOf(rows): Map<code, Medal>           // E4
medalTable(s): MedalRow[]                   // E5, sortiert, rank mit Gleichstand
overallWinners(s): string[]                 // E6, [] = kein Sieger
```

`src/data/session.ts` hält nur `getCompetition()`, `setCompetition()` und `endCompetition()` (Modulvariable). Die
Disziplinszenen fragen `getCompetition()` ab: Ist ein Wettkampf aktiv, nehmen sie Gegner-Nationen (über den Code
in `COUNTRIES`), das Profil per Index im jeweiligen `*_CPU_PROFILES`-Array (Reihenfolge Rookie/Profi/Champion ist
überall gleich) und den Look-Seed aus `field`. Ist keiner aktiv, bleibt das Verhalten wie bisher. Im Einzelmodus
ruft das Menü beim Start `endCompetition()` auf.

**Startwerte:**

```ts
export const COMPETITION = {
  opponents: 3,                 // + Spieler = 4, wie in allen Disziplinen
  medalBlinkMs: 400,            // Blinken der neuen Medaillen in `medals`
  confirmDefault: 'no',
} as const;
```

## Spieltest-Bot

Neuer Lauf `wettkampf` in `scripts/e2e/smoke.cjs`. Er läuft im Standardaufruf mit und lässt sich einzeln mit
`npm run e2e -- wettkampf` starten.
- Der Bot startet **über echte Tasten im Menü**: Zeile MODUS auf WETTKAMPF stellen, dann ENTER.
- Er verteilt nach der aktiven Szene auf die bestehende Bot-Logik und setzt deren `mem` je Disziplin zurück.
  In `result` und `medals` drückt er ENTER. Die Stabhochsprung-Abkürzung (`sc.finish()`) ist erlaubt.
- Einmalig nach Disziplin 1 in `medals`: ESC, prüfen, dass `confirm` aktiv ist, dann N, prüfen, dass es weitergeht.
- Ende: `medals` steht auf `final`. Der Bot protokolliert die Tabelle (`scene.table`, `scene.mode` öffentlich
  lesbar) und den Gesamtsieger, drückt ENTER und prüft, dass `title` aktiv ist.
- Screenshots: intro, jedes `between`, `confirm`, `final`.

## Abnahmekriterien

1. Im Titel wechselt PFEIL LINKS/RECHTS auf Zeile MODUS zwischen EINZELDISZIPLIN und WETTKAMPF. Im Wettkampf ist
   DISZIPLIN grau mit `ALLE 4` und wird beim Navigieren übersprungen. Die Wahl bleibt nach einem Neuladen erhalten.
2. Der Einzelmodus verhält sich exakt wie in v0.5.1 (Nochmal, Esc ohne Rückfrage, zufällige Gegner).
3. Der Wettkampf spielt die Disziplinen in der Reihenfolge 110 M HÜRDEN, WEITSPRUNG, STABHOCHSPRUNG, BMX. Jede läuft
   genau einmal, und R hat keine Wirkung.
4. In allen 4 Disziplinen treten dieselben 3 Gegner-Nationen mit demselben Aussehen und Profil an.
5. Unit-Tests `competition.test.ts` decken ab:
   - Medaillen nur für gültige Plätze 1–3; ein ungültiger Platz 3 ergibt keine Bronze.
   - Sortierung Gold > Silber > Bronze.
   - Gleichstand ergibt den gleichen Rang („1, 2, 2, 4“) und die Anzeige A–Z nach Code.
   - Geteilter Gesamtsieg und `[]` ohne Medaillen.
   - `recordEvent` ist idempotent und lehnt eine falsche Disziplin ab.
   - `createCompetition` zieht nie die Spielernation als Gegner und vergibt jedes Profil genau einmal
     (deterministisch mit `createRng`).
6. Nach jeder Siegerehrung führt ENTER zum Medaillenspiegel. Dessen Zählung stimmt mit den Podesten aller bisherigen
   Siegerehrungen überein, die neuen Medaillen blinken, und die nächste Disziplin samt Steuerung wird angezeigt.
7. Esc in einer Disziplin, in der Siegerehrung und im Spiegel öffnet die Rückfrage mit Vorauswahl NEIN:
   - NEIN (oder N oder Esc) setzt fort, und zwar ohne Zeitsprung, Fehlstart oder gezählte Tipps während des Dialogs.
   - JA führt ins Menü. Ein neuer Wettkampf beginnt danach bei 0 Medaillen.
8. Nach der letzten Disziplin erscheint der `ENDSTAND` mit `GESAMTSIEGER: …` (Gleichstand-Text gemäß E6).
   ENTER führt ins Menü.
9. Nach einem Seiten-Neuladen mitten im Wettkampf startet das Menü normal, und es gibt keinen Rest-Spielstand
   (kein localStorage-Schlüssel außer `rsg.mode`).
10. `npm run e2e` ist grün, einschließlich `wettkampf`. Die Screenshots zeigen keine überlappenden oder abgeschnittenen
    Texte, und es gibt keine ←/→-Glyphen.
11. Version 0.6.0 sowie README (Modus, Ablauf), CHANGELOG und ROADMAP (RSG-01a abgehakt) sind aktualisiert.

## Aufgaben

- **Game-Engineer:**
  - `sim/competition.ts` mit Tests, `data/session.ts`, Szenen `medals` und `confirm` (in `main.ts` registrieren).
  - MODUS-Zeile im Titel.
  - Die 4 Disziplinszenen lesen das Feld aus der Session; R und Esc werden im Wettkampf umgeschaltet.
  - Die Stabhochsprung-Tafel bekommt `ENTER: ZUM ERGEBNIS`.
  - ResultScene: Medaillen eintragen, Prompt anpassen.
  - Bot erweitern.
- **Pixel-Artist:**
  - Medaillenkreise als Spaltenköpfe (G/S/B) und kleine Platz-Plaketten 12 px, dazu den Rückfrage-Kasten im HUD-Stil
    (Bausteine in `gfx/hud.ts`).
  - Keine neuen großen Grafiken; die kommen mit RSG-01b.
