# Changelog

Was sich für Spieler ändert – neueste Version oben. Hier lässt sich auch ohne Rückfragen nachlesen,
was das Agenten-Team umgesetzt und welche Entscheidungen es getroffen hat.

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
