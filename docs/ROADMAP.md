# Roadmap – Meilenstein „Einzelspieler 1.0“

Ziel: ein rundes, fertiges Einzelspieler-Spiel mit mehreren Disziplinen, einem Wettkampfmodus über
alle Disziplinen und viel Liebe zum Detail. **Nicht** Teil dieses Meilensteins: Online-Multiplayer
und Docker-Betrieb (Meilenstein 2).

Der `/sprint`-Ablauf nimmt immer den **obersten offenen** Punkt (`[ ]`), setzt ihn um und hakt ihn ab
(`[x]` mit Version). Neue Ideen und gefundene Fehler kommen an die passende Stelle der Liste.

## Design-Prinzipien

1. **Retro-Seele:** Spielprinzipien der Sommerspiele der 80er, aber eigene Grafik, Musik und Namen.
2. **Tippen + Timing:** Jede Disziplin lebt von abwechselndem Tippen (←/→) und einem Timing-Moment
   (Leertaste). Einheitliche Steuerung über alle Disziplinen (siehe CLAUDE.md).
3. **Kurz und knackig:** 30–90 Sekunden pro Durchgang, schnelles „Nochmal“.
4. **Fair:** Können schlägt Zufall; Eingaben werden zeitgenau gewertet.
5. **Verständlich:** Nach jedem Versuch sagt das Spiel, was gut war und was man besser machen kann.
6. **Liebevoll:** Lebendige Athleten mit Mimik, jubelndes Publikum, kleine Überraschungen.

## Backlog

> **Owner-Wunsch (04.11.2026):** erst RSG-01b (Abschlussfeier), dann die neuen Disziplinen RSG-06
> (Schwimmen) und RSG-09 (Turmspringen) vorziehen – danach wieder von oben. Neue Disziplinen kommen
> jeweils auch in den Wettkampf (`COMPETITION_ORDER`).

### Priorität 1 – Spiel abrunden

- [ ] **RSG-01 Wettkampfmodus „Die Spiele“**
  Im Menü neue Zeile **MODUS: EINZELDISZIPLIN / WETTKAMPF**. Im Wettkampf werden alle Disziplinen
  nacheinander gespielt; nach jeder Siegerehrung geht es mit ENTER zur nächsten. Medaillenspiegel
  nach Nationen (Gold vor Silber vor Bronze) zwischen den Disziplinen und am Ende eine große
  Abschlussfeier mit Gesamtsieger. Abbrechen mit Esc (mit Rückfrage).
  *Abnahme:* alle Disziplinen in fester Reihenfolge spielbar; Medaillenspiegel korrekt (Unit-Test der
  Zählung inkl. Gleichstand); Spielstand überlebt keinen Neustart der Seite (bewusst einfach);
  Spieltest-Bot spielt einen kompletten Wettkampf.
  Aufgeteilt in zwei Sprints:
  - [x] **RSG-01a Ablauf und Medaillenspiegel** (v0.6.0) – Menüzeile MODUS, feste Reihenfolge, Medaillenspiegel
    nach jeder Siegerehrung, Esc mit Rückfrage, schlichter Endstand mit Gesamtsieger, Bot spielt den
    ganzen Wettkampf, Unit-Test der Zählung.
  - [ ] **RSG-01b Große Abschlussfeier** – animierte Feier für den Gesamtsieger (Podest der Nationen,
    Flaggen, Feuerwerk, jubelndes Publikum) statt des schlichten Endstands.

- [ ] **RSG-02 Schwierigkeitsgrad**
  Menüzeile **GEGNER: LEICHT / NORMAL / SCHWER**, gespeichert in localStorage. Skaliert die Profile
  der Computer-Gegner aller Disziplinen. *Abnahme:* per Simulation belegt, dass ein ~8-Tipps/s-Spieler
  auf LEICHT Medaillenchancen hat und SCHWER Weltklasse verlangt.

- [ ] **RSG-03 Pause-Menü**
  Esc während einer Disziplin pausiert (Simulation und Timer stehen) mit **WEITER / NEU STARTEN / MENÜ**.
  Bisher springt Esc sofort ins Menü. *Abnahme:* nach WEITER keine Zeitsprünge oder Fehlstarts;
  Rennzeit zählt während der Pause nicht.

- [ ] **RSG-04 Bestenlisten**
  Top 5 je Disziplin lokal gespeichert, Eingabe von drei Initialen im Arcade-Stil bei neuem
  Eintrag, Anzeige im Menü (Zeile oder eigener Bildschirm). *Abnahme:* Sortierung je Disziplin richtig
  (Zeit aufsteigend, sonst absteigend), Unit-Tests für Einfügen/Kürzen.

- [ ] **RSG-05 Titelmusik und Jingles**
  Kurze Chiptune-Titelmelodie (Web-Audio-Sequenzer, Schleife), eigene Jingles für Siegerehrung und
  Medaillenspiegel. Ton aus (M) gilt für alles. *Abnahme:* keine Knackser, startet erst nach der
  ersten Taste (Autoplay-Regeln), stoppt beim Szenenwechsel.

### Priorität 2 – Mehr Spiel

- [ ] **RSG-06 Disziplin 100 m Freistil (Schwimmen)**
  Rhythmus statt Hämmern: Armzüge im Takt tippen, zu schnell = Verschlucken, Atmen mit ↑.
  Vier Bahnen, Startsprung mit Leertaste, Wende entfällt (50-m-Becken ×2 mit Wende-Timing als Option).
  Neue Kulisse: Schwimmhalle.

- [ ] **RSG-07 Eröffnungsfeier**
  Vor dem Wettkampfmodus: Fackelläufer läuft durchs Stadion, Flamme wird entzündet, Flaggen der
  Nationen, Feuerwerk. Mit Enter überspringbar.

- [ ] **RSG-08 Erste Schritte**
  Beim ersten Start einer Disziplin kurze, animierte Erklärung der Steuerung (überspringbar,
  danach nur noch per Menü). Ersetzt die langen Textblöcke vor dem Start.

- [ ] **RSG-09 Turmspringen**
  Anlauf entfällt: Absprung-Timing, in der Luft Salti/Schrauben per Tasten, gerades Eintauchen.
  Punktrichter-Wertung (Kampfrichter zeigen Tafeln). Nutzt die Drehungen aus Stabhochsprung/BMX.

- [ ] **RSG-10 Touch-Steuerung**
  Bildschirm-Tasten für Handy/Tablet (links/rechts/Aktion), automatisch bei Touch-Geräten; Querformat-Hinweis.

### Priorität 3 – Feinschliff und Technik

- [ ] **RSG-11 Gemeinsame Szenen-Bausteine**
  Doppelte Logik (Tastatur-Verwaltung, Fade, Ergebnis-Übergabe, Kamera, Board-Ablauf) in gemeinsame
  Helfer überführen – ohne Verhaltensänderung, Spieltest bleibt grün.
  Aus dem Review von RSG-01a: Zuordnung Wettkampf-Feld → Gegner steht viermal in den Disziplinszenen
  (Helfer `competitionOpponents(profiles)`); Esc/Rückfrage-Verdrahtung je Szene vereinheitlichen;
  Dialog-Bausteine (`drawConfirmBox`, `drawChoiceMarker`, `drawInfoBox`) von `gfx/medalHud.ts` nach
  `gfx/hud.ts` verschieben (für das Pause-Menü RSG-03). Publikumsgeräusch während der Rückfrage pausieren.

- [ ] **RSG-15 Hilfekasten im Titel**
  Tasten- und Textspalte stehen fest (x126/x276): „LEERTASTE AM BRETT“ hat nur 6 px Luft, der
  längste Steuerungstext (33 Zeichen) ragt über den Kasten. Spaltenberechnung wie im NÄCHSTE-Kasten
  des Medaillenspiegels (`MedalsScene`) übernehmen.

- [ ] **RSG-12 Lesbare Umlaute**
  In „Press Start 2P“ wirken Ä/Ö/Ü wie Kleinbuchstaben. Eigene Großbuchstaben-Umlaute zeichnen
  (z. B. Bitmap-Schrift aus der vorhandenen erzeugen) oder gleichwertige Lösung.

- [ ] **RSG-13 Einstellungen**
  Lautstärke (Effekte/Musik getrennt), alternative Tastenbelegung, „Blinkeffekte reduzieren“.

- [ ] **RSG-14 Performance und Ladezeit**
  Phaser in eigenen Chunk auslagern, Ladeanzeige, 60 FPS auf schwächeren Geräten prüfen
  (Graphics-Neuzeichnung pro Frame reduzieren, wo es viel kostet).

## Erledigt

- [x] 110 m Hürden (v0.1) · Liebevollere Athleten (v0.2) · Stabhochsprung + Menü (v0.3) ·
  BMX am Strand (v0.4) · Weitsprung (v0.5) · Agenten-Team und automatischer Spieltest (v0.5.1) ·
  Wettkampf mit Medaillenspiegel – RSG-01a (v0.6.0)

## Offene Fragen an den Owner

_(Hier trägt das Team Fragen ein, die es nicht selbst entscheiden kann. Bis zur Antwort geht es mit
dem nächsten Punkt weiter.)_
