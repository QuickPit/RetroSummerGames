---
name: sprint
description: Arbeitet den nächsten offenen Punkt aus docs/ROADMAP.md mit dem Agenten-Team ab – Design, Umsetzung, Test, Review, Release auf GitHub Pages. Verwenden, wenn der Nutzer /sprint aufruft oder „mach weiter“, „nächster Sprint“, „arbeite die Roadmap ab“ o. Ä. sagt. Optionales Argument – eine Anzahl (z. B. „3“) für mehrere Sprints hintereinander oder eine Roadmap-ID (z. B. „RSG-04“).
argument-hint: "[Anzahl | RSG-ID]"
---

# Sprint: ein Roadmap-Punkt von der Idee bis zum Release

Du bist in diesem Ablauf **Producer**: Du delegierst an die Agenten in `.claude/agents/`, prüfst ihre
Ergebnisse und veröffentlichst. Der Owner gibt kaum Feedback – entscheide selbst nach `CLAUDE.md` und
den Design-Prinzipien in `docs/ROADMAP.md`. Sprints bleiben klein: **ein Roadmap-Punkt pro Sprint**.

## 0. Vorbereitung

1. `git status` (muss sauber sein, sonst erst klären) und `git pull origin main`.
2. `docs/ROADMAP.md`, `CHANGELOG.md` und `CLAUDE.md` lesen.
3. Punkt wählen: die angegebene RSG-ID, sonst den **obersten offenen** Punkt. Ist er zu groß für einen
   Sprint (mehr als ~1 Tag Arbeit für einen Menschen), teile ihn in der Roadmap in Teilpunkte und nimm
   den ersten.
4. Kurz ankündigen, welcher Punkt bearbeitet wird (eine Zeile).

## 1. Design (nur bei neuen Disziplinen, Modi oder größeren Mechaniken)

Agent **game-designer**: Spec `docs/design/<kurzname>.md` mit Abnahmekriterien schreiben lassen. Gib
den Roadmap-Text mit. Lies die Spec und prüfe sie gegen die Design-Prinzipien. Bei kleinen Punkten
(z. B. Bugfix, Einstellung) reicht es, die Abnahmekriterien aus der Roadmap zu nehmen.

## 2. Umsetzung

- Agent **game-engineer** mit Spec-Pfad bzw. Aufgabe und Abnahmekriterien.
- Agent **pixel-artist** für Grafik/Sound-Anteile. Wenn die Arbeit unabhängig ist (z. B. neue Kulisse
  und Spiellogik), beide **parallel** starten und die Dateien klar aufteilen; sonst nacheinander
  (erst Engineer, dann Artist für den Feinschliff).
- Lies die Rückmeldungen und sieh dir `git diff --stat` an.

## 3. Test

Agent **qa-tester** mit der Spec und einer Zusammenfassung der Änderung. Bei „nicht freigegeben“:
Fehler mit Schweregrad blockierend/wichtig an **game-engineer** (bzw. **pixel-artist**) zurückgeben,
danach erneut testen. Höchstens drei Runden – danach Restfehler als neue Roadmap-Punkte eintragen und
nur veröffentlichen, wenn nichts Blockierendes offen ist.

## 4. Review

Agent **code-reviewer** auf den Diff. „Muss behoben werden“-Befunde vom **game-engineer** beheben
lassen, danach Typecheck, Unit-Tests und Spieltest selbst noch einmal ausführen.
„Sollte“-Befunde beheben, wenn sie klein sind; sonst als Roadmap-Punkt notieren.

## 5. Release

1. Selbst prüfen: `npm run typecheck`, `npm test`, `npm run build`,
   `NODE_PATH=$(npm root -g) npm run e2e` – alles grün, sonst zurück zu Schritt 3.
2. Version anheben (Minor für Funktionen, Patch für Fehlerbehebungen) in `package.json` **und** im
   Titel (`TitleScene`, „vX.Y SOLO“), dann `npm install --package-lock-only`.
3. `README.md` (Steuerung/Regeln), `CHANGELOG.md` (für Spieler verständlich, wichtige Entscheidungen
   nennen) und `docs/ROADMAP.md` (Punkt abhaken mit Version, neue Erkenntnisse eintragen) aktualisieren.
4. Committen (deutsche Nachricht: kurze erste Zeile, dann Stichpunkte) und `git push origin main`.
5. Deployment prüfen: GitHub-Actions-Lauf „Deploy to GitHub Pages“ für den neuen Commit muss
   erfolgreich sein (GitHub-MCP-Tools, sonst `gh run list`). Schlägt er fehl: Ursache beheben und
   erneut pushen.

## 6. Bericht

Kurz an den Owner: was jetzt neu spielbar ist, Link https://quickpit.github.io/RetroSummerGames/,
getroffene Entscheidungen, offene Punkte. Bei mehreren angeforderten Sprints direkt mit dem nächsten
Punkt bei Schritt 0 weitermachen.

## Regeln

- Niemals Tests überspringen, deaktivieren oder abschwächen, um grün zu werden.
- Kein Release mit blockierenden Fehlern oder rotem Spieltest.
- Fragen, die nur der Owner beantworten kann, in „Offene Fragen an den Owner“ (ROADMAP) eintragen und
  mit dem nächsten Punkt weitermachen, statt zu warten.
- Temporäre Dateien (Galerie-Seiten, Tuning-Tests, Skripte) vor dem Commit entfernen.
