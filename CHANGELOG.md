# Changelog

Was sich für Spieler ändert – neueste Version oben. Hier lässt sich auch ohne Rückfragen nachlesen,
was das Agenten-Team umgesetzt und welche Entscheidungen es getroffen hat.

## 0.9.0 – Turmspringen

- Neue Disziplin Turmspringen vom 10-m-Turm in der Sprunghalle: Schwung holen durch Tippen, Absprung im Takt
  der Arme, Leertaste halten zum Drehen und loslassen zum Öffnen, ↑ für Schrauben.
- Acht Sprünge vom Kopfsprung bis zu 4½ Salti gehockt, drei Durchgänge, jeder Sprung nur einmal.
- Fünf Kampfrichter mit Tafeln, Streichwertung × Schwierigkeitsgrad; nach jedem Sprung Urteil
  (WELTKLASSE! … KLATSCHER!), Rechnung und ein Tipp. Am Turm erklärt ein Hinweis Absprung und Öffnen.
- Der Wettkampf hat jetzt sechs Disziplinen (Turmspringen nach dem Schwimmen, BMX bleibt das Finale).
- Fix: Nach einem Tab-Wechsel springt die Zeit beim Schwimmen und Turmspringen nicht mehr nach vorne.
- Entscheidungen des Teams:
  - Gegner springen nur auf der Anzeigetafel – so bleibt ein Durchgang bei unter einer Minute.
  - Über 11 Tipps/s bringt schnelleres Tippen kaum mehr Schwung; entscheidend sind Absprung und Öffnen.
  - Ein nicht geöffneter gehockter Sprung heißt „ARSCHBOMBE!“ (Ersatz „BOMBE!“ liegt bereit, falls das zu derb ist).

## 0.8.0 – 100 m Freistil

- Neue Disziplin 100 m Freistil in einer eigenen Schwimmhalle: Startsprung mit Fehlstart-Regel, Kraulen im Takt
  (←/→), Atmen mit ↑, Rollwende per Leertaste an der 50-m-Wand, Anschlag im Ziel, Weltrekord-Linie im Becken.
- Rhythmus statt Hämmern: gleichmäßige ~10 Tipps/s sind am schnellsten; wer hektisch tippt, verschluckt sich.
  Nach dem Rennen sagt das Spiel, wo Zeit verloren ging (Wende, Takt, Atmen, Reaktion).
- Siegerehrung in der Halle mit Hall-Klang; der Wettkampf hat jetzt fünf Disziplinen (Schwimmen vor dem BMX-Finale),
  der Medaillenspiegel fünf Spalten.
- Hürden: Wer vor dem Startschuss drückt, macht einen Fehlstart – auch wenn das Bild erst kurz danach kommt
  (vorher konnte das als Reaktion 0.00 durchgehen).
- Fix: Bei Grafik ohne WebGL hatten die Athleten feine Nahtlinien an Armen und Beinen.
- Entscheidungen des Teams:
  - Die Wende ist schon in der ersten Version dabei – sie ist der Timing-Moment des Schwimmens.
  - Hektisches Tippen kostet Tempo und Luft, aber jeder Durchgang bleibt unter 90 Sekunden, auch wenn man nie atmet.
  - Fehlstarts werden gezählt, aber nicht disqualifiziert; ohne Startsprung springt der Schwimmer nach 3 s von selbst.

## 0.7.0 – Große Abschlussfeier

- Nach dem Endstand des Wettkampfs geht es mit Enter zur Abschlussfeier: Nachtstadion mit Flutlicht und
  Suchscheinwerfern, Podest der drei besten Nationen, Flaggen werden während einer eigenen Siegermelodie
  gehisst, der Gesamtsieger stemmt den Pokal, Feuerwerk in fünf Formen, Konfettikanonen und Blitzlichter im Publikum.
- Gleichstand im Medaillenspiegel = geteilte Stufe auf dem Podest; ohne jede Medaille gibt es nur Feuerwerk
  („DIE SPIELE SIND BEENDET“) und keine Siegermelodie.
- Entscheidungen des Teams:
  - Der Endstand bleibt als Übersicht stehen, die Feier folgt danach (Esc im Endstand überspringt sie).
  - Die Feier lässt sich erst nach 0,8 s beenden, damit man sie nicht versehentlich wegdrückt.
  - Das Feuerwerk läuft mit festem Zeitschritt – gleich schön bei 60 Hz und 144 Hz.
- Fix: Nach dem Wettkampf läuft kein Publikumsrauschen mehr im Menü weiter; Fanfare und Siegermelodie überlagern sich nicht.

## 0.6.0 – Wettkampf „Die Spiele“

- Neue Menüzeile **MODUS: EINZELDISZIPLIN / WETTKAMPF**. Im Wettkampf spielst du alle vier Disziplinen
  nacheinander – 110 m Hürden, Weitsprung, Stabhochsprung, BMX – gegen dieselben drei Nationen.
- Medaillenspiegel nach jeder Siegerehrung: neue Medaillen blinken (mit Glitzer-Ton), dazu eine
  Rückmeldung zum Zwischenstand und die Steuerung der nächsten Disziplin. Am Ende der Endstand mit Gesamtsieger.
- Esc fragt im Wettkampf nach, bevor abgebrochen wird, und pausiert dabei das Spiel – ohne Zeitsprung oder Fehlstart.
- Stabhochsprung: Wer ausgeschieden ist, kann mit Enter direkt zum Ergebnis; die Gegner springen im Schnelldurchlauf zu Ende.
- Entscheidungen des Teams:
  - Ein Durchgang pro Disziplin, kein „Nochmal“ – sonst ließe sich so lange wiederholen, bis es Gold gibt.
  - Feste Gegner-Nationen mit festem Profil (Rookie/Profi/Champion) über den ganzen Wettkampf, damit
    der Spiegel aussagekräftig ist und es einen erkennbaren Favoriten gibt.
  - Gleiche Medaillenzahl = gleicher Platz; bei Gleichstand an der Spitze gibt es mehrere Gesamtsieger.
  - Der Spielstand wird nicht gespeichert (bewusst einfach); die Moduswahl wird gemerkt.
  - Die eigene Nation ist im Spiegel mit einem „DU“-Wimpel markiert.
- Spieltest: Der Bot spielt jetzt auch einen kompletten Wettkampf inkl. Rückfrage und Pause mitten im Rennen.
  Die große animierte Abschlussfeier folgt in einer späteren Version (RSG-01b).

## 0.5.1 – Agenten-Team

- Entwicklung läuft jetzt mit einem Agenten-Team (Game-Designer, Game-Engineer, Pixel-Artist,
  QA-Tester, Code-Reviewer) und dem Ablauf `/sprint` – siehe `CLAUDE.md` und `docs/ROADMAP.md`.
- Automatischer Spieltest (`npm run e2e`): ein Bot spielt alle Disziplinen im Browser durch.

## 0.5.0 – Weitsprung

- Neue Disziplin Weitsprung: Anlauf, Absprung am Brett mit Winkelwahl, Beinestrecken vor der Landung.
- Drei Durchgänge mit Anzeigetafel, Übertreten mit roter Fahne, Maßband und Weltrekordlinie.

## 0.4.0 – BMX am Strand

- Neue Disziplin BMX mit Tricks (Salto, Superman, Big Air), Wertung aus Trickpunkten und Zeitbonus.
- Strandkulisse mit Meer, Palmen und Zuschauern.
- Fix: Gegner, die beim Ende noch unterwegs sind, werden zu Ende simuliert statt als DNF gewertet.

## 0.3.0 – Stabhochsprung

- Neue Disziplin Stabhochsprung mit Wettkampfregeln (Lattenhöhen, drei Versuche, Auslassen).
- Startbildschirm als Menü mit Disziplin-, Nation- und Athletenwahl.

## 0.2.0 – Liebevollere Athleten

- Größere, detailreiche Figuren mit Frisuren, Mimik, Startnummern und neuen Posen; Podest mit Medaillen.

## 0.1.0 – Solo-Prototyp

- 110 m Hürden gegen drei Computer-Gegner, Startsequenz mit Fehlstart, Siegerehrung und Bestzeit.
