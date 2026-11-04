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
  wettkampf: { competition: true },
};
const BOT_OF_SCENE = { race: 'hurdles', polevault: 'pole', longjump: 'long', bmx: 'bmx' };

// ---------------------------------------------------------------- Bot im Browser
// Läuft per page.evaluate im Spiel. Liest den Zustand der Szene in jedem Takt
// und schickt echte Tastatur-Ereignisse – ohne Verzögerung durch Playwright.
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
  const mem = { done: false, attempts: 0, holding: false, extended: false, planted: false, released: false, jumpCount: 0, inAir: false };

  return new Promise((resolve) => {
    const started = performance.now();
    const timer = setInterval(() => {
      if (active('confirm')) return;
      if (active('result')) {
        clearInterval(timer);
        resolve({ ok: true, log });
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
      } else if (kind === 'pole') {
        const sc = game.scene.getScene('polevault');
        if (sc.mode === 'board') {
          if (!sc.waitingForPlayer) return;
          // Zwei Sprünge reichen für den Test, danach wird der Wettkampf beendet
          if (mem.attempts >= 2) {
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
          if (!mem.planted && v.phase === 'runup' && -v.x <= 4.05) {
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

  // Während der Bot spielt, regelmäßig Screenshots machen
  let shot = 1;
  const shooter = setInterval(() => {
    page.screenshot({ path: path.join(OUT, `${kind}-${shot++}.png`) }).catch(() => {});
  }, 4000);
  const started = Date.now();
  let result;
  try {
    result = await Promise.race([
      page.evaluate(botInPage, kind),
      new Promise((r) => setTimeout(() => r({ ok: false, log: ['Zeitlimit (Node) erreicht'] }), TIMEOUT_MS)),
    ]);
  } finally {
    clearInterval(shooter);
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

  let ok = true;
  try {
    await page.goto(URL);
    await waitActive('title');
    // MODUS steht oben; PFEIL RECHTS schaltet auf WETTKAMPF
    await page.keyboard.press('ArrowRight');
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
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => ['race', 'polevault', 'longjump', 'bmx'].some((k) => window.__game.scene.isActive(k)),
        null,
        { timeout: 15_000 },
      );
      st = await sceneState();
      const scene = st.active.find((k) => k in BOT_OF_SCENE);
      order.push(scene);
      const bot = BOT_OF_SCENE[scene];
      const r = await Promise.race([
        page.evaluate(botInPage, bot),
        new Promise((res) => setTimeout(() => res({ ok: false, log: ['Zeitlimit (Node) erreicht'] }), TIMEOUT_MS)),
      ]);
      for (const line of r.log) log.push(`${bot}: ${line}`);
      check(r.ok, `Bot ${bot} hat die Siegerehrung nicht erreicht`);
      await page.waitForTimeout(800);
      await shot(`${2 + i}-${bot}-result`);
      await page.keyboard.press('Enter');
      const mode = i < 3 ? 'between' : 'final';
      await waitMedals(mode);
      await page.waitForTimeout(600);
      await shot(`${2 + i}-${bot}-${mode}`);

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
        log.push('Rückfrage: ESC öffnet sie, N setzt fort');
      }
    }
    check(order.join(',') === 'race,longjump,polevault,bmx', `Falsche Reihenfolge: ${order.join(',')}`);
    log.push(`Reihenfolge: ${order.join(' → ')}`);

    const final = await page.evaluate(() => {
      const m = window.__game.scene.getScene('medals');
      return { table: m.table, winners: m.winners };
    });
    for (const r of final.table) log.push(`${r.rank}. ${r.code}  G${r.gold} S${r.silver} B${r.bronze}`);
    log.push(`Gesamtsieger: ${final.winners.length ? final.winners.join(', ') : 'keiner'}`);
    const medals = final.table.reduce((n, r) => n + r.total, 0);
    check(medals > 0 && medals <= 12, `Unplausible Medaillenzahl ${medals}`);

    await page.keyboard.press('Enter');
    await waitActive('title');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    check(
      keys.every((k) => ['rsg.mode', 'rsg.country', 'rsg.look', 'rsg.event'].includes(k) || k.startsWith('rsg.best.')),
      `Unerwartete localStorage-Schlüssel: ${keys.join(', ')}`,
    );
    log.push('Zurück im Menü');
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

  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
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
    server.kill();
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
