#!/usr/bin/env node
/**
 * iPhone 13 Pro visual test for VAULT Poker.
 * Launches Playwright/WebKit with iPhone 13 Pro emulation, captures
 * screenshots at the interesting UI states, and writes them to
 * /tmp/poker-iphone13/.
 *
 * Usage:
 *   node .claude/scripts/test-iphone13.mjs [url] [--lobby-only] [--offline]
 *
 * Defaults:
 *   url           https://vault-poker-production.up.railway.app
 *   --lobby-only  stops after capturing the lobby screen
 *   --offline     starts an offline-vs-bots game (best signal for showdown
 *                 layout). On by default.
 */

import { webkit, devices } from 'playwright';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--')) || 'https://vault-poker-production.up.railway.app';
const lobbyOnly = args.includes('--lobby-only');
const includeOffline = !lobbyOnly; // offline run is default

const OUT_DIR = '/tmp/poker-iphone13';
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const iPhone = devices['iPhone 13 Pro'];
const shots = [];

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${String(shots.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(file);
  console.log(`📸 ${file}`);
}

async function waitMs(ms) { await new Promise(r => setTimeout(r, ms)); }

async function newPage(browser) {
  // Fresh context each run — sessionStorage from previous runs would
  // otherwise reroute the lobby into the "rejoin" flow.
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();
  page.on('pageerror', e => console.error('💥 pageerror:', e.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('⚠️  console.error:', msg.text());
  });
  return { context, page };
}

async function captureLobby(browser) {
  const { context, page } = await newPage(browser);
  console.log(`▶ lobby: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitMs(1200);
  await shot(page, 'lobby-default');
  // Switch to online tab and capture
  const onlineTab = page.locator('button, div', { hasText: /^אונליין$/ }).first();
  if (await onlineTab.count() > 0) {
    try { await onlineTab.click({ timeout: 1500 }); await waitMs(500); await shot(page, 'lobby-online-tab'); } catch {}
  }
  await context.close();
}

async function captureOfflineGame(browser) {
  const { context, page } = await newPage(browser);
  console.log(`▶ offline game: ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitMs(1200);

  // The "offline" tab is selected by default in the lobby. Confirm it's active.
  const offlineTab = page.locator('button, div', { hasText: /^אופליין$/ }).first();
  if (await offlineTab.count() > 0) {
    try { await offlineTab.click({ timeout: 1500 }); await waitMs(400); } catch {}
  }

  // The button at the bottom of the offline form is "צור שולחן 🚀" (create
  // sub-tab) or "הצטרף 🚀" (join sub-tab). Either starts an offline hand
  // versus bots.
  const startBtn = page.locator('button', { hasText: /(צור שולחן|הצטרף)\s*🚀/ }).first();
  if (await startBtn.count() === 0) {
    console.log('⚠ no start button found; capturing lobby state');
    await shot(page, 'lobby-no-start');
    await context.close();
    return;
  }
  await startBtn.scrollIntoViewIfNeeded();
  await startBtn.click({ timeout: 3000 });
  await waitMs(2500);
  await shot(page, 'offline-preflop');

  // Auto-play: prefer CHECK, fall back to CALL. Capture each phase.
  const phases = ['flop', 'turn', 'river', 'showdown'];
  for (const phase of phases) {
    let lastPhase = '';
    for (let i = 0; i < 8; i++) {
      // Read the current phase pill text
      const pill = page.locator('text=/PRE-FLOP|FLOP|TURN|RIVER|SHOWDOWN/').first();
      lastPhase = (await pill.textContent().catch(() => '')) || '';
      if (lastPhase.toLowerCase().includes(phase)) break;

      // Try to act
      const checkBtn = page.locator('button:has-text("CHECK"):not([disabled])').first();
      const callBtn  = page.locator('button:has-text("CALL"):not([disabled])').first();
      if (await checkBtn.count() > 0) {
        try { await checkBtn.click({ timeout: 700 }); } catch {}
      } else if (await callBtn.count() > 0) {
        try { await callBtn.click({ timeout: 700 }); } catch {}
      }
      await waitMs(1200);
    }
    // Cards do a 3D flip animation on phase change. Wait so it finishes
    // before the screenshot (especially important at showdown).
    if (phase === 'showdown') await waitMs(2000);
    else await waitMs(600);
    await shot(page, `offline-${phase}`);
    if (phase === 'showdown') break;
  }

  await context.close();
}

async function run() {
  const browser = await webkit.launch({ headless: true });
  try {
    await captureLobby(browser);
    if (includeOffline) await captureOfflineGame(browser);
  } finally {
    await browser.close();
  }
  console.log('\n✅ done — open these in order to review:');
  shots.forEach(s => console.log(`  ${s}`));
}

run().catch(err => {
  console.error('❌ test failed:', err);
  process.exit(1);
});
