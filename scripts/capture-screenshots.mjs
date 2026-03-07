/**
 * capture-screenshots.mjs — TH-003 prep
 *
 * Captures Play Store phone screenshots from the running game using Playwright.
 * Output: screenshots/ directory with 2 PNG files at 1080x1920 (portrait phone).
 *
 * Usage:
 *   1. In one terminal:  npm run build && npm run preview
 *   2. In another:       node scripts/capture-screenshots.mjs
 *
 * Or pass a custom URL:
 *   node scripts/capture-screenshots.mjs http://localhost:4173
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const OUT_DIR    = join(__dirname, '..', 'screenshots');
const BASE_URL   = process.argv[2] ?? 'http://localhost:4173';

// Screenshot size: 1024×500 (landscape)
const WIDTH  = 1024;
const HEIGHT = 500;

mkdirSync(OUT_DIR, { recursive: true });

console.log(`\nCapturing screenshots from ${BASE_URL}`);
console.log(`Output: ${OUT_DIR}\n`);

const browser = await chromium.launch({
  headless: true,
  args: [
    // Force software WebGL (SwiftShader) so Phaser's WebGL renderer
    // actually paints in headless mode instead of producing a black canvas.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-software-rasterizer',
  ],
});

async function shot(label, fn, baseWait = 2500) {
  const ctx  = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });

  // Inject styles AFTER navigation (before: they get wiped by the page load)
  await page.addStyleTag({ content: `
    html, body { overflow: hidden !important; background: #050510 !important; }
    ::-webkit-scrollbar { display: none !important; }
  ` });

  // Wait for Phaser canvas to exist
  await page.waitForSelector('canvas', { timeout: 15_000 });

  // Base wait: let the current scene fully paint before the callback runs
  await page.waitForTimeout(baseWait);

  await fn(page);

  const file = join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓  ${file}`);
  await ctx.close();
}

// --- Screenshot 1: Title screen — captured 1 second after game start ---
await shot('screenshot-01-title', async (_page) => {
  // baseWait of 1000 ms: canvas is up, BootScene title screen is fully painted.
  // The title auto-advances after 4 s so we're well within the window.
}, 1000);

// --- Screenshot 2: Active gameplay (enemies on screen, score ticking) ---
await shot('screenshot-02-gameplay', async (page) => {
  // By the time shot() finishes its 2500 ms base wait, PlayScene has started
  // (BootScene auto-advances after 4 s but the user can tap; we tap to advance).

  // Tap to advance past title screen into PlayScene immediately.
  await page.mouse.click(WIDTH / 2, HEIGHT / 2);

  // Wait for enemies to spawn and descend.
  await page.waitForTimeout(5000);
});

// --- Screenshot 3: Game-over / end screen ---
await shot('screenshot-03-gameover', async (page) => {
  // Tap to advance past title screen.
  await page.mouse.click(WIDTH / 2, HEIGHT / 2);

  // Wait for PlayScene to fully start.
  await page.waitForTimeout(1500);

  // Trigger GameOverScene directly via the exposed window.__game handle.
  await page.evaluate(() => {
    const g = window.__game;
    const e = window.__engine;
    if (!g || !e) return;

    // Set a plausible demo score so the game-over screen looks realistic.
    const state = e.getState();
    state.run.score = 2840;
    state.run.enemiesDestroyed = 37;
    state.run.phase = 'game-over';

    // Launch GameOverScene (GameOverScene reads state from the engine).
    g.scene.start('GameOverScene', { engine: e });
  });

  // Wait for GameOverScene to fully render.
  await page.waitForTimeout(2000);
});

// --- Screenshot 3 (bonus): Game-over screen ---
// Uncomment if you want a third shot of the game-over overlay:
// await shot('screenshot-03-gameover', async (page) => {
//   await page.mouse.click(WIDTH / 2, HEIGHT / 2); // start game
//   await page.waitForTimeout(1500);
//   // Let the game run until game-over (adjust timeout for your difficulty)
//   await page.waitForSelector('#game-over, .game-over', { timeout: 20_000 })
//     .catch(() => page.waitForTimeout(8000));
// });

await browser.close();

console.log(`\nDone! Upload files from: ${OUT_DIR}`);
console.log('Minimum required by Google Play: 2 phone screenshots');
