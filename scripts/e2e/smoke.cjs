// Automatischer Spieltest: startet den Vite-Dev-Server, spielt jede Disziplin
// im Headless-Browser mit einem Bot durch und prüft, dass keine Fehler auftreten
// und die Ergebnis-Szene erreicht wird. Screenshots landen in e2e-output/.
//
// Aufruf:  npm run e2e               (alle Disziplinen und der Wettkampf)
//          npm run e2e -- bmx long   (nur ausgewählte)
//          npm run e2e -- wettkampf  (ganzer Wettkampf über alle Disziplinen)
//
// Nutzt das global installierte Playwright (siehe CLAUDE.md).

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.E2E_OUT || path.join(ROOT, 'e2e-output');
const PORT = Number(process.env.E2E_PORT || 5199);
const URL = `http://localhost:${PORT}/`;
const TIMEOUT_MS = 150_000;

const DISCIPLINES = {
  hurdles: { scene: 'race' },
  pole: { scene: 'polevault' },
  long: { scene: 'longjump' },
  bmx: { scene: 'bmx' },
  swim: { scene: 'swim' },
  dive: { scene: 'dive' },
  wettkampf: { competition: true },
};
const BOT_OF_SCENE = { race: 'hurdles', polevault: 'pole', longjump: 'long', bmx: 'bmx', swim: 'swim', dive: 'dive' };

// ---------------------------------------------------------------- Bot im Browser
// Läuft per page.evaluate im Spiel. Liest den Zustand der Szene in jedem Takt
// und schickt echte Tastatur-Ereignisse – ohne Verzögerung durch Playwright.
// 'pole-out' = Stabhochsprung im Wettkampf: ein Sprung, dann absichtlich ausscheiden
// und an der Tafel mit ENTER die Gegner zu Ende springen lassen.
function botInPage(kind) {
  const game = window.__game;
  const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  const press = (code) => {
    send('keydown', code);
    send('keyup', code);
  };
  const active = (key) => game.scene.isActive(key);
  const log = [];
  let side = 0;
  let lastTap = 0;
  const tap = (rate) => {
    const now = performance.now();
    if (now - lastTap < 1000 / rate) return;
    lastTap = now;
    press(side ? 'ArrowRight' : 'ArrowLeft');
    side ^= 1;
  };
  const HURDLES = Array.from({ length: 10 }, (_, i) => 13.72 + i * 9.14);
  const LOGS = [38, 110, 176];
  const mem = {
    done: false,
    attempts: 0,
    holding: false,
    extended: false,
    planted: false,
    released: false,
    jumpCount: 0,
    inAir: false,
    turned: false,
    failed: null,
    nextTap: 0,
  };
  // Gleichmäßiger Takt nach Fahrplan – der Intervall-Timer allein würde die Rate drücken
  const steadyTap = (rate) => {
    const now = performance.now();
    if (now < mem.nextTap) return;
    const gap = 1000 / rate;
    // Nach einem Ruckler nicht aufholen – zwei Tipps kurz hintereinander wären Hämmern
    mem.nextTap = Math.max(mem.nextTap + gap, now + gap * 0.85);
    press(side ? 'ArrowRight' : 'ArrowLeft');
    side ^= 1;
  };

  // Bildschirmfotos an bestimmten Stellen: Node holt die Namen ab und fotografiert sofort
  window.__shots = [];
  const shotOnce = (name) => {
    if (mem.shots.has(name)) return;
    mem.shots.add(name);
    window.__shots.push(name);
  };
  mem.shots = new Set();

  // Node setzt das Flag, wenn sein Zeitlimit greift – dann keine Tasten mehr schicken
  window.__botStop = false;
  window.__botPause = false;
  return new Promise((resolve) => {
    const started = performance.now();
    const timer = setInterval(() => {
      if (window.__botStop) {
        clearInterval(timer);
        resolve({ ok: false, log: [...log, 'abgebrochen'] });
        return;
      }
      // Während einer Rückfrage – oder wenn Node den Bot für eine Prüfung anhält – keine Tasten
      if (active('confirm') || window.__botPause) return;
      if (active('result')) {
        clearInterval(timer);
        resolve(mem.failed ? { ok: false, log: [...log, `✗ ${mem.failed}`] } : { ok: true, log });
        return;
      }
      if (performance.now() - started > 140_000) {
        clearInterval(timer);
        resolve({ ok: false, log: [...log, 'Zeitlimit erreicht'] });
        return;
      }
      if (kind === 'hurdles') {
        const sc = game.scene.getScene('race');
        if (sc.phase === 'ready') press('Enter');
        if (sc.phase !== 'race') return;
        const p = sc.player.state;
        if (p.finishTime !== null) {
          if (!mem.done) log.push(`Zeit: ${p.finishTime.toFixed(2)} s, Hürden gerissen: ${p.hurdles.filter((h) => h === 'hit').length}`);
          mem.done = true;
          // Nach dem Umschalten zur Siegerehrung kein Enter mehr nachschieben
          if (!sc.resultsShown) press('Enter');
          return;
        }
        tap(11);
        const next = HURDLES[p.nextHurdle];
        if (next !== undefined && p.air < 0 && next - p.x <= p.v * 0.22) press('Space');
      } else if (kind === 'pole' || kind === 'pole-out') {
        const sc = game.scene.getScene('polevault');
        const giveUp = kind === 'pole-out' && mem.attempts >= 2;
        if (sc.mode === 'board') {
          if (kind === 'pole-out' && sc.player.vaulter.out) {
            if (!mem.done) log.push('Ausgeschieden – ENTER: ZUM ERGEBNIS');
            mem.done = true;
            if (!sc.finished) press('Enter');
            return;
          }
          if (!sc.waitingForPlayer) return;
          // Zwei Sprünge reichen für den Test, danach wird der Wettkampf beendet
          if (kind === 'pole' && mem.attempts >= 2) {
            if (!mem.done) log.push('Wettkampf nach 2 Sprüngen beendet');
            mem.done = true;
            sc.finish();
            return;
          }
          mem.attempts++;
          mem.planted = mem.released = false;
          press('Enter');
          return;
        }
        const v = sc.vault;
        if (!v) return;
        if (sc.attemptDone) {
          log.push(`Sprung ${mem.attempts}: ${v.outcome} (${v.peak.toFixed(2)} m)`);
          press('Enter');
          return;
        }
        if (v.phase === 'ready' || v.phase === 'runup') {
          tap(11);
          // Zum Ausscheiden einfach nicht einstechen – durchgelaufen zählt als Fehlversuch
          if (!giveUp && !mem.planted && v.phase === 'runup' && -v.x <= 4.05) {
            mem.planted = true;
            press('Space');
          }
        } else if (v.phase === 'vault' && !mem.released && v.p >= 0.96) {
          mem.released = true;
          press('Space');
        }
      } else if (kind === 'long') {
        const sc = game.scene.getScene('longjump');
        if (sc.mode === 'board') {
          if (sc.waitingForPlayer) {
            mem.holding = mem.extended = false;
            press('Enter');
          }
          return;
        }
        const j = sc.jump;
        if (!j) return;
        if (sc.verdictAt !== null) {
          if (mem.extended === 'logged') return;
          mem.extended = 'logged';
          log.push(`Versuch: ${j.distance === null ? 'ungültig' : j.distance.toFixed(2) + ' m'}`);
          press('Enter');
          return;
        }
        if (j.phase === 'ready' || j.phase === 'runup') {
          if (!mem.holding && j.phase === 'runup' && j.x >= -0.25) {
            mem.holding = true;
            send('keydown', 'Space');
            return;
          }
          tap(11);
        } else if (j.phase === 'takeoff' && j.angle >= 28) {
          send('keyup', 'Space');
        } else if (j.phase === 'flight' && !mem.extended) {
          const total = (j.vy + Math.sqrt(j.vy * j.vy + 2 * 9.81 * 0.45)) / 9.81;
          if (total - j.flightTime < 0.2) {
            mem.extended = true;
            press('Space');
          }
        }
      } else if (kind === 'swim') {
        const sc = game.scene.getScene('swim');
        if (sc.phase === 'ready') press('Enter');
        if (sc.phase !== 'race') return;
        const s = sc.player.state;
        if (s.finishTime !== null) {
          if (!mem.done) {
            log.push(
              `Zeit: ${s.finishTime.toFixed(2)} s, Wende: ${s.turnRating}, verschluckt: ${s.chokes}, ` +
                `Luft geschnappt: ${s.gasps}, Atemzüge: ${s.breaths}, Takt: ${Math.round((s.inTakt / Math.max(1, s.strokes)) * 100)}%`,
            );
            if (s.finishTime >= 60) mem.failed = `Zeit ${s.finishTime.toFixed(2)} s nicht unter 60 s`;
            else if (s.turnRating === 'open') mem.failed = 'Wende verpasst (angeschlagen)';
            else if (s.gasps > 0) mem.failed = `${s.gasps}x nach Luft geschnappt`;
          }
          mem.done = true;
          if (!sc.resultsShown) press('Enter');
          return;
        }
        if (s.phase === 'block') {
          press('Space');
          return;
        }
        if (s.phase !== 'swim') return;
        steadyTap(9.5);
        if (s.air < 0.3 && s.breathing <= 0) press('ArrowUp');
        // Rollwende am Idealabstand
        if (!s.turned && !mem.turned && 50 - s.d <= s.v * 0.45) {
          mem.turned = true;
          press('Space');
        }
      } else if (kind === 'dive') {
        const sc = game.scene.getScene('dive');
        // Sprünge je Durchgang; Reihenfolge der Liste wie DIVES in sim/dive.ts
        const WANT = ['25h', '15s2', '15p'];
        const ORDER = ['kopf', '15h', '15p', '25h', '25p', '15s2', '35h', '45h'];
        const SPIN = { tuck: 2.9, pike: 2.25, straight: 1.5 };
        if (!mem.dive) mem.dive = { key: '', results: [], started: performance.now(), holding: false, twists: 0 };
        const m = mem.dive;
        // Jede Taste nur einmal je Zustand – die Szene verarbeitet sie erst im nächsten Bild
        const once = (key, fn) => {
          if (m.key === key) return;
          m.key = key;
          fn();
        };
        if (sc.finished) {
          once('finished', () => {
            const total = m.results.reduce((a, j) => a + j.points, 0);
            const seconds = (performance.now() - m.started) / 1000;
            log.push(`Gesamt: ${total.toFixed(2)} P nach ${seconds.toFixed(0)} s`);
            if (m.results.length !== 3) mem.failed = `${m.results.length} statt 3 Sprünge gewertet`;
            else if (m.results.some((j) => j.fail)) mem.failed = 'Fehlsprung in der Serie';
            else if (total <= 120) mem.failed = `Summe ${total.toFixed(2)} nicht über 120`;
            else if (seconds < 30 || seconds > 90) mem.failed = `Dauer ${seconds.toFixed(0)} s außerhalb 30–90 s`;
          });
          return;
        }
        const r = sc.round + 1;
        if (sc.phase === 'board') {
          m.selectAt = 0;
          if (sc.waitingForPlayer) once(`board${r}`, () => press('Enter'));
          return;
        }
        if (sc.phase === 'select') {
          m.holding = false;
          m.reheld = false;
          m.twists = 0;
          shotOnce(`${r}-1-select`);
          // Kurz warten, damit das Panel fotografiert werden kann
          const now = performance.now();
          if (!m.selectAt) m.selectAt = now;
          if (now - m.selectAt < 600) return;
          // Je Tastendruck abwarten, bis die Szene die neue Zeile zeigt (sonst springt die Wahl zu weit);
          // ENTER erst, wenn die gewünschte Zeile eine Weile stehen bleibt
          const want = ORDER.indexOf(WANT[sc.round]);
          if (sc.selection !== m.seenSel) {
            m.seenSel = sc.selection;
            m.seenAt = now;
          }
          if (sc.selection !== want) {
            if (!m.pressAt || m.pressSel !== sc.selection || now - m.pressAt > 400) {
              m.pressAt = now;
              m.pressSel = sc.selection;
              press('ArrowDown');
            }
          } else if (now - m.seenAt > 150) {
            once(`go${r}`, () => press('Enter'));
          }
          return;
        }
        const s = sc.diver;
        if (!s) return;
        if (s.def.id !== WANT[sc.round] && !mem.failed) mem.failed = `Sprung ${r}: ${s.def.id} statt ${WANT[sc.round]} gewählt`;
        if (sc.verdictReady) {
          once(`done${r}`, () => {
            const j = sc.judgement;
            m.results.push(j);
            log.push(
              `Sprung ${r} ${j.dive}: ${j.rating}, Noten ${j.notes.map((n) => n.toFixed(1)).join(' ')} → ` +
                `${j.sum.toFixed(1)} × ${j.dd} = ${j.points.toFixed(2)} P (Absprung ${Math.round(j.quality * 100)}%, ` +
                `Schwung ${Math.round(j.swing * 100)}%, ${Math.round(j.delta)}°, Tipp ${j.tip})`,
            );
            // Erst die hochgezählte Wertung fotografieren, dann weiter
            setTimeout(() => {
              shotOnce(`${r}-5-verdict`);
              setTimeout(() => press('Enter'), 1500);
            }, 700);
          });
          return;
        }
        const t = sc.simTime;
        if (s.phase === 'ready' || s.phase === 'swing') {
          steadyTap(10);
          if (s.phase === 'swing' && t - s.t0 >= 1.5) shotOnce(`${r}-2-swing`);
          if (s.phase === 'swing' && !m.holding && t - s.t0 >= 2.5) {
            const k = Math.max(0, Math.round((t - s.t0 - 0.25) / 1.0));
            const toPeak = s.t0 + 0.25 + k - t;
            if (Math.abs(toPeak) < 0.02) {
              m.holding = true;
              send('keydown', 'Space');
            }
          }
        } else if (s.phase === 'air') {
          const air = t - s.takeoffAt;
          if (air > 0.5) shotOnce(`${r}-3-air`);
          const target = s.def.somersaults * 360;
          // Nach einer Rückfrage gilt die Leertaste als losgelassen – neu drücken, der Salto dreht weiter
          if (m.holding && !s.held && !m.reheld) {
            m.reheld = true;
            send('keydown', 'Space');
          }
          if (m.holding && s.held) {
            // Drehung bis jetzt vorausrechnen – der Zustand ist bis zu einem Bild alt
            const rot = s.rot + s.power * SPIN[s.def.position] * 360 * Math.max(0, t - s.time);
            if (rot >= target - 20) {
              m.holding = false;
              send('keyup', 'Space');
            }
          }
          if (s.def.twists > 0) {
            if (m.twists === 0 && air >= 0.12) {
              m.twists = 1;
              press('ArrowUp');
            } else if (m.twists === 1 && s.twistsDone >= 1 && s.twistStart === null) {
              m.twists = 2;
              press('ArrowUp');
            }
          }
        } else if (s.phase === 'water') {
          shotOnce(`${r}-4-entry`);
        }
      } else if (kind === 'bmx') {
        const sc = game.scene.getScene('bmx');
        if (sc.phase === 'ready') press('Enter');
        if (sc.phase !== 'race') return;
        const s = sc.player.state;
        if (sc.playerDoneAt !== null) {
          if (!mem.done) log.push(`${s.finishTime !== null ? `Ziel nach ${s.finishTime.toFixed(2)} s` : 'ausgeschieden'}, Trickpunkte ${s.points}, Stürze ${s.crashes}`);
          mem.done = true;
          if (!sc.resultsShown) press('Enter');
          return;
        }
        if (s.phase === 'ground') {
          if (mem.inAir) {
            mem.inAir = false;
            if (mem.holding) send('keyup', 'Space');
            mem.holding = false;
          }
          tap(11);
          const log2 = LOGS.find((l) => l > s.x);
          if (log2 !== undefined && log2 - s.x <= s.vx * 0.28) press('ArrowUp');
        } else if (s.phase === 'air') {
          if (!mem.inAir) {
            mem.inAir = true;
            mem.jumpCount++;
          }
          // Jeder zweite Sprung mit kurzem Superman
          if (mem.jumpCount % 2 === 0 && s.airTime < 0.35 && !mem.holding) {
            mem.holding = true;
            send('keydown', 'Space');
          }
          if (mem.holding && s.airTime >= 0.35) {
            mem.holding = false;
            send('keyup', 'Space');
          }
        }
      }
    }, 8);
  });
}

// ------------------------------------------------------------------ Ablauf

/** Bot im Browser mit Zeitlimit; danach wird er dort angehalten */
async function runBot(page, kind) {
  let timer;
  const limit = new Promise((r) => {
    timer = setTimeout(() => r({ ok: false, log: ['Zeitlimit (Node) erreicht'] }), TIMEOUT_MS);
  });
  const result = await Promise.race([page.evaluate(botInPage, kind), limit]);
  clearTimeout(timer);
  if (!result.ok) await page.evaluate(() => (window.__botStop = true)).catch(() => {});
  return result;
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Dev-Server unter ${URL} nicht erreichbar`);
}

async function runDiscipline(browser, kind) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(URL);
  await page.waitForFunction(() => window.__game && window.__game.scene.isActive('title'), null, { timeout: 15_000 });
  await page.screenshot({ path: path.join(OUT, `${kind}-0-title.png`) });
  await page.evaluate((scene) => {
    window.__game.scene.getScene('title').scene.start(scene, { countryIndex: 0 });
  }, DISCIPLINES[kind].scene);

  // Während der Bot spielt, regelmäßig Screenshots machen – und sofort, wenn der Bot einen anfordert
  let shot = 1;
  const shooter = setInterval(() => {
    page.screenshot({ path: path.join(OUT, `${kind}-${shot++}.png`) }).catch(() => {});
  }, 4000);
  let busy = false;
  const requested = setInterval(async () => {
    if (busy) return;
    busy = true;
    const names = await page.evaluate(() => (window.__shots || []).splice(0)).catch(() => []);
    for (const name of names) await page.screenshot({ path: path.join(OUT, `${kind}-${name}.png`) }).catch(() => {});
    busy = false;
  }, 40);
  const started = Date.now();
  let result;
  try {
    result = await runBot(page, kind);
  } finally {
    clearInterval(shooter);
    clearInterval(requested);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `${kind}-result.png`) });
  await page.close();
  return { kind, ok: result.ok && errors.length === 0, seconds: Math.round((Date.now() - started) / 1000), log: result.log, errors };
}

// Ganzer Wettkampf: Start über echte Tasten im Menü, dann alle Disziplinen
// mit den Bots oben, dazwischen Medaillenspiegel und einmal die Rückfrage.
async function runCompetition(browser) {
  const kind = 'wettkampf';
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const log = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  const started = Date.now();
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${kind}-${name}.png`) });
  const sceneState = () =>
    page.evaluate(() => {
      const g = window.__game;
      const active = g.scene.getScenes(true).map((s) => s.scene.key);
      const m = g.scene.getScene('medals');
      return { active, mode: m.mode, selected: g.scene.getScene('title').selected };
    });
  const waitActive = (key, timeout = 15_000) =>
    page.waitForFunction((k) => window.__game.scene.isActive(k), key, { timeout });
  const waitMedals = (mode) =>
    page.waitForFunction((m) => {
      const g = window.__game;
      return g.scene.isActive('medals') && g.scene.getScene('medals').mode === m;
    }, mode, { timeout: 15_000 });
  const check = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  // Laufende und pausierte Szenen, z. B. „medals:paused,confirm:running“
  const scenes = () =>
    page.evaluate(() =>
      window.__game.scene.scenes
        .filter((sc) => sc.sys.isActive() || sc.sys.isPaused())
        .map((sc) => `${sc.scene.key}:${sc.sys.isPaused() ? 'paused' : 'running'}`)
        .join(','),
    );
  // Zwei Tasten im selben Bild (beide landen in derselben Eingabe-Warteschlange)
  const pressTogether = (a, b) =>
    page.evaluate(([x, y]) => {
      const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
      for (const code of [x, y]) {
        send('keydown', code);
        send('keyup', code);
      }
    }, [a, b]);

  // Turmspringen: Rückfrage im Schwung (1. Sprung) und in der Luft mit gehaltener Leertaste (3. Sprung).
  // Der Bot ruht währenddessen, damit er die Zustände nach NEIN nicht sofort verändert.
  const diveState = () =>
    page.evaluate(() => {
      const sc = window.__game.scene.getScene('dive');
      const s = sc.diver;
      return {
        time: s.time,
        t0: s.t0,
        phase: s.phase,
        held: s.held,
        openAt: s.openAt,
        rot: s.rot,
        sim: sc.simTime,
        paused: window.__game.scene.isPaused('dive'),
      };
    });
  const diveConfirm = async () => {
    await page.evaluate(() => (window.__botPause = true));
    await page.keyboard.press('Escape');
    await waitActive('confirm');
    const before = await diveState();
    await page.waitForTimeout(1000);
    const mid = await diveState();
    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => !window.__game.scene.isPaused('dive') && !window.__game.scene.isActive('confirm'), null, {
      timeout: 5_000,
    });
    await page.waitForTimeout(60);
    const after = await diveState();
    check(mid.paused && mid.time === before.time, `Turmspringen läuft während der Rückfrage weiter: ${JSON.stringify(mid)}`);
    check(after.time - before.time < 0.25 && after.sim - after.time < 0.1, `Zeitsprung nach NEIN: ${JSON.stringify({ before, after })}`);
    return { before, after };
  };
  const checkDiveConfirm = async (i) => {
    await page.waitForFunction(
      () => {
        const sc = window.__game.scene.getScene('dive');
        const s = sc.diver;
        return sc.round === 0 && s && s.phase === 'swing' && s.time - s.t0 > 1;
      },
      null,
      { timeout: 60_000, polling: 16 },
    );
    let { before, after } = await diveConfirm();
    check(after.phase === 'swing' && after.t0 === before.t0, `Takt nach NEIN verschoben: ${JSON.stringify({ before, after })}`);
    log.push(`Rückfrage im Schwung: Sim-Zeit ${before.time.toFixed(2)} → ${after.time.toFixed(2)} s, Takt unverändert`);
    await page.evaluate(() => (window.__botPause = false));

    await page.waitForFunction(
      () => {
        const sc = window.__game.scene.getScene('dive');
        const s = sc.diver;
        return sc.round === 2 && s && s.phase === 'air' && s.held && s.time - s.takeoffAt > 0.15;
      },
      null,
      { timeout: 90_000, polling: 16 },
    );
    ({ before, after } = await diveConfirm());
    check(before.held && !after.held && after.phase === 'air', `Gehaltene Leertaste nach NEIN: ${JSON.stringify({ before, after })}`);
    check(Math.abs(after.openAt - before.time) < 0.02, `Öffnen nicht zum Zeitpunkt der Rückfrage: ${JSON.stringify({ before, after })}`);
    await shot(`${2 + i}-dive-air`);
    log.push(`Rückfrage in der Luft: losgelassen bei ${before.time.toFixed(2)} s (${Math.round(before.rot)}°), danach ${after.time.toFixed(2)} s`);
    await page.evaluate(() => (window.__botPause = false));
  };

  let ok = true;
  try {
    await page.goto(URL);
    await waitActive('title');
    // MODUS steht oben; PFEIL RECHTS schaltet auf WETTKAMPF
    if ((await page.evaluate(() => window.__game.scene.getScene('title').mode)) !== 'competition') {
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('ArrowDown');
    let st = await sceneState();
    check(st.selected === 2, `DISZIPLIN wurde nicht übersprungen (Zeile ${st.selected})`);
    await page.keyboard.press('ArrowUp');
    st = await sceneState();
    check(st.selected === 0, `Zurück nach oben landet auf Zeile ${st.selected}`);
    log.push('Menü: MODUS = WETTKAMPF, DISZIPLIN wird übersprungen');
    await shot('0-title');
    await page.keyboard.press('Enter');
    await waitMedals('intro');
    await page.waitForTimeout(600);
    await shot('1-intro');

    const order = [];
    const room = () => page.evaluate(async () => (await import('/src/audio/sfx.ts')).sfx.currentRoom);
    // Reihenfolge zur Laufzeit aus COMPETITION_ORDER (Szenennamen über das Register der Disziplinen)
    const expectedOrder = await page.evaluate(async () => {
      const { COMPETITION_ORDER } = await import('/src/sim/competition.ts');
      const { eventByKey } = await import('/src/data/events.ts');
      return COMPETITION_ORDER.map((key) => eventByKey(key).scene);
    });
    const EVENT_COUNT = expectedOrder.length;
    for (let i = 0; i < EVENT_COUNT; i++) {
      if (i === 1) {
        // Fall A: ENTER und ESC im selben Bild – es geht weiter, ohne Rückfrage und ohne Restszene
        await pressTogether('Enter', 'Escape');
        await page.waitForFunction(() => window.__game.scene.isActive('longjump'), null, { timeout: 15_000 });
        await page.waitForTimeout(500);
        const s = await scenes();
        check(s === 'longjump:running', `ENTER+ESC im Medaillenspiegel: ${s}`);
        log.push('ENTER+ESC im selben Bild (Spiegel): nur die Disziplin läuft');
      } else {
        await page.keyboard.press('Enter');
      }
      await page.waitForFunction(
        () => ['race', 'polevault', 'longjump', 'swim', 'dive', 'bmx'].some((k) => window.__game.scene.isActive(k)),
        null,
        { timeout: 15_000 },
      );
      st = await sceneState();
      const scene = st.active.find((k) => k in BOT_OF_SCENE);
      order.push(scene);
      // Im Wettkampf scheidet der Bot im Stabhochsprung echt aus (ENTER: ZUM ERGEBNIS)
      const bot = scene === 'polevault' ? 'pole-out' : BOT_OF_SCENE[scene];
      if (scene === 'race') {
        // Rückfrage in der Startphase „FERTIG“: Die Zeit steht, es gibt keinen Startschuss und keinen Fehlstart
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => window.__game.scene.getScene('race').phase === 'set', null, { timeout: 5_000 });
        await page.keyboard.press('Escape');
        await waitActive('confirm');
        const before = await page.evaluate(() => window.__game.scene.getScene('race').phaseTimer);
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(2500);
        const during = await page.evaluate(() => {
          const sc = window.__game.scene.getScene('race');
          return { phase: sc.phase, timer: sc.phaseTimer, falseStarts: sc.falseStarts, paused: window.__game.scene.isPaused('race') };
        });
        check(
          during.paused && during.phase === 'set' && during.timer === before && during.falseStarts === 0,
          `Hürden laufen während der Rückfrage weiter: ${JSON.stringify(during)}`,
        );
        await page.keyboard.press('KeyN');
        await page.waitForFunction(() => !window.__game.scene.isPaused('race'), null, { timeout: 5_000 });
        log.push('Rückfrage in „FERTIG“: Start angehalten, kein Fehlstart');
      }
      const botRun = runBot(page, bot);
      if (scene === 'race') {
        // Rückfrage mitten im Rennen: Rennzeit steht, kein Zeitsprung nach NEIN, kein Fehlstart
        await page.waitForFunction(() => {
          const sc = window.__game.scene.getScene('race');
          return sc.phase === 'race' && sc.simTime > 2;
        }, null, { timeout: 15_000 });
        await page.keyboard.press('Escape');
        await waitActive('confirm');
        const t0 = await page.evaluate(() => window.__game.scene.getScene('race').simTime);
        await page.waitForTimeout(1000);
        const mid = await page.evaluate(() => {
          const sc = window.__game.scene.getScene('race');
          return { t: sc.simTime, paused: window.__game.scene.isPaused('race'), falseStarts: sc.falseStarts };
        });
        await page.keyboard.press('KeyN');
        await page.waitForFunction(() => !window.__game.scene.isPaused('race') && !window.__game.scene.isActive('confirm'), null, {
          timeout: 5_000,
        });
        const t1 = await page.evaluate(() => window.__game.scene.getScene('race').simTime);
        check(mid.paused && mid.t === t0 && mid.falseStarts === 0, `Rennen läuft während der Rückfrage weiter: ${JSON.stringify(mid)}`);
        check(t1 - t0 < 0.25, `Zeitsprung nach NEIN: ${t0.toFixed(3)} → ${t1.toFixed(3)} s`);
        log.push(`Rückfrage im Rennen: Zeit stand bei ${t0.toFixed(2)} s, danach ${t1.toFixed(2)} s`);
      }
      if (scene === 'swim') {
        // Rückfrage mitten im Schwimmrennen: Zeit steht, kein Zeitsprung nach NEIN, kein Fehlstart
        await page.waitForFunction(() => {
          const sc = window.__game.scene.getScene('swim');
          return sc.phase === 'race' && sc.simTime > 6;
        }, null, { timeout: 20_000 });
        check((await room()) === 'hall', `Kein Hallenklang beim Schwimmen: ${await room()}`);
        await page.keyboard.press('Escape');
        await waitActive('confirm');
        const t0 = await page.evaluate(() => window.__game.scene.getScene('swim').simTime);
        await page.waitForTimeout(1000);
        const mid = await page.evaluate(() => {
          const sc = window.__game.scene.getScene('swim');
          return { t: sc.simTime, paused: window.__game.scene.isPaused('swim'), falseStarts: sc.falseStarts };
        });
        await page.keyboard.press('KeyN');
        await page.waitForFunction(() => !window.__game.scene.isPaused('swim') && !window.__game.scene.isActive('confirm'), null, {
          timeout: 5_000,
        });
        const t1 = await page.evaluate(() => window.__game.scene.getScene('swim').simTime);
        check(mid.paused && mid.t === t0 && mid.falseStarts === 0, `Schwimmen läuft während der Rückfrage weiter: ${JSON.stringify(mid)}`);
        check(t1 - t0 < 0.25, `Zeitsprung nach NEIN (Schwimmen): ${t0.toFixed(3)} → ${t1.toFixed(3)} s`);
        log.push(`Rückfrage beim Schwimmen: Zeit stand bei ${t0.toFixed(2)} s, danach ${t1.toFixed(2)} s`);
        // Screenshots im Rennen und an der Wende
        await page.waitForFunction(() => window.__game.scene.getScene('swim').simTime > 14, null, { timeout: 30_000 });
        await shot(`${2 + i}-swim-race`);
        await page.waitForFunction(
          () => {
            const p = window.__game.scene.getScene('swim').player.state;
            return p.phase === 'flip' || p.phase === 'wall' || p.phase === 'open' || p.turned;
          },
          null,
          { timeout: 60_000, polling: 16 },
        );
        await shot(`${2 + i}-swim-turn`);
      }
      if (scene === 'dive') await checkDiveConfirm(i);
      const r = await botRun;
      for (const line of r.log) log.push(`${bot}: ${line}`);
      check(r.ok, `Bot ${bot} hat die Siegerehrung nicht erreicht`);
      await page.waitForTimeout(800);
      await shot(`${2 + i}-${bot}-result`);
      if (scene === 'polevault') {
        // Nach dem Schnelldurchlauf hat der Champion eine gültige Höhe
        const pv = await page.evaluate(() => {
          const champ = window.__game.scene.getScene('medals').state.field.find((f) => f.profile === 2).code;
          const rows = window.__game.scene.getScene('result').result.rows;
          return { champ, rows: rows.map((row) => ({ code: row.country.code, valid: row.valid, text: row.cells[0].text })) };
        });
        log.push(`pole: ${pv.rows.map((row) => `${row.code} ${row.text}`).join(', ')}`);
        const champ = pv.rows.find((row) => row.code === pv.champ);
        check(champ && champ.valid, `Champion ${pv.champ} ohne gültige Höhe`);
      }
      if (scene === 'swim' || scene === 'dive') check((await room()) === 'hall', `Siegerehrung ${scene} ohne Hallenklang`);
      const mode = i < EVENT_COUNT - 1 ? 'between' : 'final';
      if (i === 0) {
        // Fall B: ENTER und ESC im selben Bild in der Siegerehrung
        await pressTogether('Enter', 'Escape');
        await waitMedals(mode);
        await page.waitForTimeout(500);
        const s = await scenes();
        check(s === 'medals:running', `ENTER+ESC in der Siegerehrung: ${s}`);
        log.push('ENTER+ESC im selben Bild (Siegerehrung): nur der Spiegel läuft');
      } else {
        await page.keyboard.press('Enter');
        await waitMedals(mode);
      }
      await page.waitForTimeout(600);
      await shot(`${2 + i}-${bot}-${mode}`);
      check((await room()) === 'open', `Hallenklang im Medaillenspiegel nach ${scene}: ${await room()}`);

      if (i === 0) {
        // Einmal abbrechen wollen und mit N weitermachen
        await page.keyboard.press('Escape');
        await waitActive('confirm');
        await page.waitForTimeout(200);
        await shot('2-confirm');
        st = await sceneState();
        check(!st.active.includes('medals'), 'Medaillenspiegel läuft trotz Rückfrage weiter');
        await page.keyboard.press('KeyN');
        await page.waitForFunction(
          () => !window.__game.scene.isActive('confirm') && window.__game.scene.isActive('medals'),
          null,
          { timeout: 5_000 },
        );
        // Umgekehrt ESC und ENTER im selben Bild: Rückfrage offen, ENTER wirkt nicht mehr auf den Spiegel
        await pressTogether('Escape', 'Enter');
        await waitActive('confirm');
        await page.waitForTimeout(300);
        let s = await scenes();
        check(s === 'medals:paused,confirm:running', `ESC+ENTER im Spiegel: ${s}`);
        await page.keyboard.press('KeyN');
        await page.waitForFunction(() => !window.__game.scene.isActive('confirm'), null, { timeout: 5_000 });
        await page.waitForTimeout(200);
        s = await scenes();
        check(s === 'medals:running', `Nach N: ${s}`);
        log.push('Rückfrage: ESC öffnet sie, N setzt fort (auch bei ESC+ENTER im selben Bild)');
      }
    }
    check(order.join(',') === expectedOrder.join(','), `Falsche Reihenfolge: ${order.join(',')} statt ${expectedOrder.join(',')}`);
    check(order.join(',') === 'race,longjump,polevault,swim,dive,bmx', `Reihenfolge weicht von der Spec ab: ${order.join(',')}`);
    log.push(`Reihenfolge: ${order.join(' → ')}`);

    const final = await page.evaluate(() => {
      const m = window.__game.scene.getScene('medals');
      return { table: m.table, winners: m.winners };
    });
    for (const r of final.table) log.push(`${r.rank}. ${r.code}  G${r.gold} S${r.silver} B${r.bronze}`);
    log.push(`Gesamtsieger: ${final.winners.length ? final.winners.join(', ') : 'keiner'}`);
    const medals = final.table.reduce((n, r) => n + r.total, 0);
    check(medals > 0 && medals <= 3 * EVENT_COUNT, `Unplausible Medaillenzahl ${medals}`);

    // Endstand → Abschlussfeier: Podest wie im Spiegel, keine wachsende Objektzahl, ENTER führt ins Menü.
    // Doppeltes ENTER (20 ms Abstand) darf die Feier nicht überspringen (Eingabesperre zu Beginn).
    await page.keyboard.press('Enter');
    await page.waitForTimeout(20);
    await page.keyboard.press('Enter');
    await waitActive('ceremony');
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.__game.scene.isActive('ceremony')), 'Doppeltes ENTER überspringt die Abschlussfeier');
    const ceremony = () =>
      page.evaluate(() => {
        const sc = window.__game.scene.getScene('ceremony');
        return { podium: sc.podium, children: sc.children.length, elapsed: sc.elapsed };
      });
    // Gehaltenes ENTER (Auto-Repeat) darf die Feier nicht überspringen
    await page.evaluate(() =>
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: true, bubbles: true })),
    );
    await page.waitForTimeout(1000);
    check(await page.evaluate(() => window.__game.scene.isActive('ceremony')), 'Auto-Repeat-ENTER überspringt die Abschlussfeier');
    const texts = await page.evaluate(() =>
      window.__game.scene.getScene('ceremony').children.list.filter((o) => o.type === 'Text').map((t) => t.text),
    );
    check(!texts.some((t) => /[←→]/.test(t)), `Pfeil-Glyphen in der Feier: ${texts.join(' | ')}`);
    check(
      final.winners.length === 0 ? texts.includes('DIE SPIELE SIND BEENDET') : texts.some((t) => t.startsWith('GESAMTSIEGER: ')),
      `Gesamtsieger-Zeile fehlt: ${texts.join(' | ')}`,
    );
    const c1 = await ceremony();
    const expected = [];
    for (const r of final.table) {
      if (r.rank > 3 || r.total === 0) continue;
      const grp = expected.find((p) => p.rank === r.rank);
      if (grp) grp.codes.push(r.code);
      else expected.push({ rank: r.rank, codes: [r.code] });
    }
    check(JSON.stringify(c1.podium) === JSON.stringify(expected), `Podest ${JSON.stringify(c1.podium)} ≠ Spiegel ${JSON.stringify(expected)}`);
    log.push(`Abschlussfeier: Podest ${c1.podium.map((p) => `${p.rank}. ${p.codes.join('/')}`).join(', ') || 'leer'}`);
    await page.waitForTimeout(2000);
    await shot(`${2 + EVENT_COUNT}-ceremony`);
    const c2 = await ceremony();
    check(c2.children === c1.children, `Objektzahl wächst in der Feier: ${c1.children} → ${c2.children}`);
    check(c2.elapsed > c1.elapsed, 'Abschlussfeier läuft nicht');
    await page.keyboard.press('Enter');
    await waitActive('title');
    check(!(await page.evaluate(() => window.__game.scene.isActive('ceremony'))), 'Abschlussfeier läuft nach ENTER weiter');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    check(
      keys.every((k) => ['rsg.mode', 'rsg.country', 'rsg.look', 'rsg.event'].includes(k) || k.startsWith('rsg.best.')),
      `Unerwartete localStorage-Schlüssel: ${keys.join(', ')}`,
    );
    log.push('Zurück im Menü (Wettkampf beendet)');
  } catch (e) {
    ok = false;
    log.push(`✗ ${e.message}`);
    await shot('error').catch(() => {});
  }
  await page.close();
  return { kind, ok: ok && errors.length === 0, seconds: Math.round((Date.now() - started) / 1000), log, errors };
}

async function main() {
  const wanted = process.argv.slice(2).filter((a) => a in DISCIPLINES);
  const kinds = wanted.length ? wanted : Object.keys(DISCIPLINES);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // Eigene Prozessgruppe, damit am Ende auch der Vite-Kindprozess von npx beendet wird
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  let browser;
  const results = [];
  try {
    await waitForServer();
    browser = await chromium.launch();
    for (const kind of kinds) {
      process.stdout.write(`▶ ${kind} … `);
      const r = DISCIPLINES[kind].competition ? await runCompetition(browser) : await runDiscipline(browser, kind);
      results.push(r);
      console.log(`${r.ok ? 'OK' : 'FEHLER'} (${r.seconds}s)`);
      for (const line of r.log) console.log(`    ${line}`);
      for (const e of r.errors) console.log(`    ✗ ${e}`);
    }
  } finally {
    if (browser) await browser.close();
    try {
      process.kill(-server.pid);
    } catch {
      server.kill();
    }
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} Disziplin(en) fehlgeschlagen.` : '\nAlle Disziplinen bestanden.');
  console.log(`Screenshots: ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
