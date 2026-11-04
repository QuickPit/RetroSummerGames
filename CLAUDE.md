# Retro Summer Games – Leitfaden für Claude und das Agenten-Team

Browser-Remake im Stil der Sommerspiele der 80er (Hürden, Stabhochsprung, Weitsprung, BMX …) mit
16-Bit-Pixelgrafik, Chiptune-Sound und Tipp-Steuerung. Läuft live auf GitHub Pages:
https://quickpit.github.io/RetroSummerGames/

## Arbeitsweise (wichtig)

- Der Owner gibt **wenig Feedback** – es ist ein Seitenprojekt. Triff Entscheidungen selbst anhand von
  `docs/ROADMAP.md` (Backlog, Design-Prinzipien) und dokumentiere sie im `CHANGELOG.md`.
- Nachfragen nur bei grundlegenden Richtungswechseln, Kosten oder rechtlichen Fragen. Offene Fragen
  kommen in den Abschnitt „Offene Fragen an den Owner“ der Roadmap – dann mit dem nächsten Punkt weitermachen.
- Entwicklung im Team: siehe `.claude/agents/` (Game-Designer, Game-Engineer, Pixel-Artist, QA-Tester,
  Code-Reviewer) und den Ablauf `/sprint` (`.claude/skills/sprint/SKILL.md`).
- Aktuelles Ziel: **Meilenstein „Einzelspieler 1.0“**. Multiplayer und Docker kommen erst danach.

## Befehle

```bash
npm run dev         # Entwicklungsserver (http://localhost:5173), window.__game ist nur hier verfügbar
npm test            # Vitest – Unit-Tests der Spiellogik (src/sim/*.test.ts)
npm run typecheck   # tsc --noEmit
npm run build       # Typecheck + Produktions-Build nach dist/
NODE_PATH=$(npm root -g) npm run e2e            # Bot spielt alle Disziplinen im Headless-Browser
NODE_PATH=$(npm root -g) npm run e2e -- bmx     # nur eine Disziplin
```

- Playwright ist **global** installiert (nicht ins Projekt installieren, kein `playwright install`).
  Screenshots des Spieltests liegen danach in `e2e-output/` (nicht versioniert) – ansehen mit dem Read-Tool.
- Jeder Push auf `main` wird per GitHub Actions getestet, gebaut und auf Pages veröffentlicht
  (`.github/workflows/deploy.yml`).

## Architektur

```
src/sim/      Reine Spiellogik ohne Phaser: Physik, Wettkampfregeln, Computer-Gegner. Immer mit Vitest-Tests.
src/gfx/      Prozedurale Grafik (keine Bilddateien!): Athleten (runner.ts), BMX-Rad (bike.ts), Stadion,
              Strand, Flaggen, HUDs und Anzeigetafeln. Gemeinsame HUD-Bausteine in hud.ts.
src/audio/    sfx.ts – alle Sounds per Web Audio synthetisiert.
src/scenes/   Phaser-Szenen: Boot, Title (Menü), je Disziplin eine Szene, Result (gemeinsame Siegerehrung).
src/data/     events.ts (Register aller Disziplinen), countries.ts, storage.ts (localStorage, fehlertolerant).
scripts/e2e/  smoke.cjs – automatischer Spieltest mit Bot je Disziplin.
```

Muster einer Disziplin: `sim/<name>.ts` (Zustand + `step`-Funktion mit festem Zeitschritt 1/120 s,
liefert Events) → Szene liest Eingaben, ruft die Sim auf, reagiert auf Events mit Sound/Grafik →
am Ende `ResultSceneData` an die Szene `result` übergeben.

**Neue Disziplin – Checkliste:** Sim + Tests · Szene · HUD (Bausteine aus `gfx/hud.ts`) · Eintrag in
`data/events.ts` · Szene in `main.ts` registrieren · ggf. Menü-Vorschau in `TitleScene` · Bot in
`scripts/e2e/smoke.cjs` · README · CHANGELOG · Version.

## Konventionen

- **Sprache:** UI-Texte Deutsch in GROSSBUCHSTABEN, Code-Kommentare Deutsch und sparsam, Bezeichner Englisch.
- **Schrift:** „Press Start 2P“ (8/16/24/32 px). Sie hat **keine** Glyphen für ← und → (schreibe
  „PFEIL LINKS/RECHTS“); ↑ ↓ ° Ä Ö Ü ß sind vorhanden.
- **Auflösung:** 640×360, pixelgenau hochskaliert. Welt-Maßstab `PX_PER_M = 26`, schräge Projektion über
  `skewAt()`. Farben aus `COLORS` in `config.ts`, Konturfarbe `COLORS.outline`.
- **Steuerung, einheitlich:** ←/→ (oder A/D) abwechselnd tippen = Tempo · Leertaste = Hauptaktion ·
  ↑ = Zusatzaktion · Enter = bestätigen/weiter · Esc = Menü · M = Ton · R = Neustart.
- **Fairness:** Tastendrücke nach `ev.timeStamp` werten (nicht erst im nächsten Bild), Tempo für
  Absprünge glätten, auto-repeat (`ev.repeat`) ignorieren, Sim mit festem Zeitschritt.
- **Rechtliches:** Keine Original-Namen, -Grafiken oder -Musik von Epyx/Atari und keine echten Marken.
  Alles selbst erzeugt.
- **Versionen:** Neue Funktion = Minor (0.x.0), Fehlerbehebung = Patch. Version in `package.json`
  **und** im Titel (`TitleScene`, Text „vX.Y SOLO“) anheben, danach `npm install --package-lock-only`.
- **Commits:** Deutsche Nachricht – erste Zeile kurz, dann Stichpunkte. Direkt auf `main`.

## Definition of Done

1. `npm run typecheck`, `npm test`, `npm run build` grün.
2. `npm run e2e` grün – keine Konsolenfehler, Ergebnis-Szene wird erreicht – und die Screenshots wurden
   angesehen (keine Grafikfehler, Texte lesbar, nichts überlappt).
3. Neue Spiellogik hat Unit-Tests; Balancing mit Simulation belegt.
4. README (Steuerung/Regeln), CHANGELOG und ROADMAP aktualisiert, Version angehoben.

## Bekannte Stolperfallen

- `pkill -f vite` beendet auch die eigene Shell (das Muster steht in deren Kommandozeile).
  Stattdessen: `pgrep -f "[v]ite --port 5173" | xargs -r kill`.
- Konstanten-Objekte sind `as const` → `let x = LJ.hipHeight` hat einen Literal-Typ; schreibe `let x: number = …`.
- Texte und Canvas-Texturen erst nach dem Laden der Schrift erzeugen (macht `main.ts`).
- Gedrehte Figuren: `drawRunner(..., { rotation })` bzw. `g.save()/translateCanvas()/rotateCanvas()/restore()`.
- Wenn das Spielerende vor den Gegnern kommt: restliche Computer-Gegner im Schnelldurchlauf zu Ende
  simulieren (siehe `finishRemaining()`), sonst werden sie fälschlich als DNF gewertet.
- Für Grafik-Detailprüfungen: temporäre Galerie-Seite (`gallery.html` + `src/gallery.ts`) bauen,
  Screenshot mit `deviceScaleFactor: 3`, danach wieder löschen.
