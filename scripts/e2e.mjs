/**
 * End-to-end smoke test: builds nothing itself — run `npm run build` first.
 * Serves dist/ with `vite preview`, drives the game in headless Chromium and saves
 * screenshots to e2e-screens/. Fails on console errors or broken game flow.
 *
 *   npm run build && npm run test:e2e
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
}

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const OUT = "e2e-screens";
mkdirSync(OUT, { recursive: true });

const { preview } = await import("vite");
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: "silent" });

const launchOpts = { args: ["--autoplay-policy=no-user-gesture-required"] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launchOpts);
const errors = [];
const failures = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? "✔" : "✘"} ${msg}`);
};

async function newPage(options) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  // External fonts may be unreachable in CI; the game must still work.
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#loading.done", { timeout: 10000 });
  await page.waitForTimeout(600);
  return page;
}

const state = (page) => page.evaluate(() => window.__game.state);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

// ───────────── Desktop ─────────────
{
  const page = await newPage({ viewport: { width: 1366, height: 820 } });
  check((await state(page)) === "MAIN_MENU", "boots into MAIN_MENU");
  check((await page.getAttribute("html", "dir")) === "rtl", "document is RTL");
  check((await page.textContent(".game-title")).includes("ئالەم جەڭچىسى"), "Uyghur title rendered");
  await shot(page, "01-main-menu");

  await page.click(".main-menu .btn:nth-child(3)"); // Controls
  await page.waitForTimeout(500);
  await shot(page, "02-controls");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.click(".main-menu .btn:nth-child(4)"); // Settings
  await page.waitForTimeout(500);
  await shot(page, "03-settings");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.click(".main-menu .btn.primary");
  await page.waitForTimeout(700);
  check((await state(page)) === "WAVE_TRANSITION", "Play → WAVE_TRANSITION");
  await shot(page, "04-wave-banner");
  await page.waitForTimeout(2000);
  check((await state(page)) === "PLAYING", "banner → PLAYING");

  // Keyboard movement
  const px0 = await page.evaluate(() => window.__game.player.x);
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowLeft");
  const px1 = await page.evaluate(() => window.__game.player.x);
  check(px1 < px0 - 50, `arrow keys move the ship (${px0.toFixed(0)} → ${px1.toFixed(0)})`);

  // Line up under an enemy and fire
  await page.waitForFunction(() => window.__game.enemies.count > 0 && window.__game.enemies.items[0].y > 40);
  await page.evaluate(() => {
    const g = window.__game;
    g.player.x = g.enemies.items[0].x;
    g.player.multiShot = 2; // 5-shot fan covers the fighters' sway
    g.player.invulnerable = 60; // this step checks shooting, not dodging
  });
  await page.keyboard.down("Space");
  await page.waitForTimeout(2500);
  const run = await page.evaluate(() => {
    const g = window.__game;
    return { score: g.score.score, kills: g.score.kills };
  });
  check(run.kills > 0 && run.score > 0, `shooting kills enemies (kills=${run.kills}, score=${run.score})`);
  // Give the player every power-up for the screenshot
  await page.evaluate(() => {
    const g = window.__game;
    g.player.multiShot = 2;
    g.player.shieldHp = 3;
    g.player.speedTimer = 6;
  });
  await page.waitForTimeout(400);
  await shot(page, "05-gameplay");
  await page.keyboard.up("Space");

  // Pause freezes the simulation
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check((await state(page)) === "PAUSED", "Escape → PAUSED");
  const pausedFrom = await page.evaluate(() => window.__game.sm.resumeTo);
  const before = await page.evaluate(() => window.__game.enemies.items.slice(0, window.__game.enemies.count).map((e) => e.y));
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.__game.enemies.items.slice(0, window.__game.enemies.count).map((e) => e.y));
  check(JSON.stringify(before) === JSON.stringify(after), "enemies frozen while paused");
  await shot(page, "06-pause");
  await page.keyboard.press("p");
  await page.waitForTimeout(200);
  check((await state(page)) === pausedFrom, `P resumes to ${pausedFrom}`);

  // Frame-rate sample (headless software rendering — informative only)
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0;
    const t0 = performance.now();
    const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : res(n / 2); };
    requestAnimationFrame(f);
  }));
  console.log(`  ~${fps} fps (headless)`);

  // Boss wave
  await page.evaluate(() => {
    const g = window.__game;
    g.enemies.clear();
    g.projectiles.clearEnemy();
    g.beginWave(5);
  });
  await page.waitForTimeout(3600);
  const boss = await page.evaluate(() => !!window.__game.boss);
  check(boss, "boss spawns on wave 5");
  await page.keyboard.down("Space");
  await page.waitForTimeout(1500);
  await shot(page, "07-boss");
  await page.keyboard.up("Space");

  // Lose all lives → GAME_OVER → name entry → leaderboard
  await page.evaluate(() => {
    const g = window.__game;
    g.player.shieldHp = 0;
    g.player.invulnerable = 0;
    g.lives = 1;
    g.hitPlayer(g.player.x, g.player.y);
  });
  await page.waitForTimeout(600);
  check((await state(page)) === "PLAYER_DEATH", "hit → PLAYER_DEATH");
  await page.waitForTimeout(1500);
  check((await state(page)) === "GAME_OVER", "no lives → GAME_OVER");
  await page.waitForTimeout(1600);
  check((await state(page)) === "HIGH_SCORE", "top-10 score → HIGH_SCORE name entry");
  await page.fill(".name-input", "ۋارىس");
  await shot(page, "08-game-over");
  await page.click(".name-entry .btn.primary");
  await page.waitForTimeout(600);
  const rows = await page.$$eval(".board tbody tr", (trs) => trs.map((tr) => tr.textContent));
  check(rows.length === 1 && rows[0].includes("ۋارىس"), "score saved to leaderboard");
  await shot(page, "09-leaderboard");
  const persisted = await page.evaluate(() => localStorage.getItem("alem-jengchisi.leaderboard.v1"));
  check(!!persisted && persisted.includes("ۋارىس"), "leaderboard persisted to localStorage");

  // Back to menu and switch language
  await page.click(".btn-row .btn:nth-child(2)");
  await page.waitForTimeout(400);
  check((await state(page)) === "MAIN_MENU", "leaderboard → MAIN_MENU");
  await page.evaluate(() => window.__game.settings.set("locale", "en"));
  await page.waitForTimeout(400);
  check((await page.getAttribute("html", "dir")) === "ltr", "English switches to LTR");
  await shot(page, "10-main-menu-en");
  await page.evaluate(() => window.__game.settings.set("locale", "ug"));
}

// ───────────── Soak: fast-forward many waves with an auto-pilot ─────────────
{
  const page = await newPage({ viewport: { width: 1000, height: 800 } });
  await page.click(".main-menu .btn.primary");
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.settings.set("sfxVolume", 0);
    const steps = 60 * 60 * 12; // 12 simulated minutes
    let bossesKilled = 0;
    let hadBoss = false;
    let maxEnemies = 0, maxBullets = 0, maxParticles = 0;
    for (let i = 0; i < steps; i++) {
      // Auto-pilot: god mode, track the nearest enemy horizontally, always fire.
      g.player.invulnerable = 5;
      g.player.multiShot = 2;
      g.autoFire = true;
      let target = g.viewport.width / 2;
      let best = Infinity;
      for (let k = 0; k < g.enemies.count; k++) {
        const e = g.enemies.items[k];
        if (e.y > 0 && e.y < g.player.y && Math.abs(e.x - g.player.x) < best) {
          best = Math.abs(e.x - g.player.x);
          target = e.x;
        }
      }
      g.player.x += Math.max(-8, Math.min(8, target - g.player.x));
      g.update(1 / 60);
      if (g.boss) hadBoss = true;
      if (hadBoss && !g.boss) { bossesKilled++; hadBoss = false; }
      maxEnemies = Math.max(maxEnemies, g.enemies.count);
      maxBullets = Math.max(maxBullets, g.projectiles.enemy.count);
      maxParticles = Math.max(maxParticles, g.particles.pool.count);
      if (!Number.isFinite(g.player.x) || !Number.isFinite(g.score.score)) return { error: "NaN detected", i };
    }
    return { wave: g.wave, score: g.score.score, kills: g.score.kills, bossesKilled, state: g.state,
      maxEnemies, maxBullets, maxParticles };
  });
  console.log("  soak:", JSON.stringify(result));
  check(!result.error, "soak: no NaN in simulation");
  check(result.wave >= 10, `soak: progressed through waves (reached ${result.wave})`);
  check(result.bossesKilled >= 1, `soak: boss defeated (${result.bossesKilled})`);
  check(result.maxEnemies < 120 && result.maxBullets < 700, "soak: pools stayed within capacity");
}

// ───────────── Mobile ─────────────
{
  const page = await newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await shot(page, "11-mobile-menu");
  await page.tap(".main-menu .btn.primary");
  await page.waitForTimeout(2600);
  check((await state(page)) === "PLAYING", "mobile: tap Play → PLAYING");
  const autoFire = await page.evaluate(() => window.__game.autoFire);
  check(autoFire, "mobile: auto-fire enabled by default");
  // Relative drag moves the ship
  const x0 = await page.evaluate(() => window.__game.player.x);
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", 200, 700);
  for (let i = 1; i <= 10; i++) {
    await touch("touchMove", 200 - i * 10, 700);
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", 100, 700);
  await page.waitForTimeout(300);
  const x1 = await page.evaluate(() => window.__game.player.x);
  check(x1 < x0 - 40, `mobile: drag moves ship (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
  await page.waitForTimeout(1500);
  await shot(page, "12-mobile-gameplay");
  await page.tap(".hud .icon-btn");
  await page.waitForTimeout(400);
  check((await state(page)) === "PAUSED", "mobile: pause button works");
  await shot(page, "13-mobile-pause");
}

await browser.close();
await server.close();

const relevant = errors.filter((e) => !/fonts\.(googleapis|gstatic)|onlinewebfonts|ERR_|net::|Failed to load resource/i.test(e));
check(relevant.length === 0, `no console errors${relevant.length ? `: ${relevant.join(" | ")}` : ""}`);
if (errors.length !== relevant.length) console.log(`  (ignored ${errors.length - relevant.length} network/font errors)`);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll checks passed. Screenshots in ${OUT}/`);
