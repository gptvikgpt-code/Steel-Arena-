/**
 * Automated same-runner browser smoke test. NOT proof of cross-carrier Android/iPhone play.
 * Chromium uses Android-style touch, WebKit uses iPhone-style touch.
 * Both connect through the app's actual PeerJS signaling/WebRTC path.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const root = resolve(process.cwd());
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html')));
    if (path !== root && !path.startsWith(root + sep)) throw new Error('bad path');
    const bytes = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch (err) {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/`;
let android, iphone;
const errors = [];
try {
  android = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  iphone = await webkit.launch({ headless: true });
  const a = await android.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  const i = await iphone.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const host = await a.newPage(), guest = await i.newPage();
  for (const [name, page] of [['Android/Chromium', host], ['iPhone/WebKit', guest]]) {
    page.on('pageerror', err => errors.push(`${name}: ${err.message}`));
    page.on('console', msg => { if (msg.type() === 'error' && /uncaught|peerjs|failed to fetch dynamically imported|module script/i.test(msg.text())) errors.push(`${name}: ${msg.text()}`); });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#scene')?.width > 400 && typeof window.Peer === 'function', null, { timeout: 45000 });
    assert.equal(await page.locator('#fighter-list .pick').count(), 6);
    assert.equal(await page.locator('#mobile-controls [data-key]').count(), 9);
  }
  for (const mode of ['duel', 'platform']) {
    await host.locator(`[data-pick="mode"][data-value="${mode}"]`).click();
    await host.locator('#create-room').click();
    await host.waitForFunction(() => /^[A-HJ-NP-Z2-9]{6}$/.test(document.querySelector('#room-code')?.textContent || ''));
    const code = await host.locator('#room-code').innerText();
    await host.waitForFunction(() => document.querySelector('#net-status')?.textContent?.includes('Комната создана'), null, { timeout: 30000 });
    await guest.locator('#join-code').fill(code);
    await guest.locator('#join-room').click();
    await Promise.all([host.locator('body.fight').waitFor({ timeout: 40000 }), guest.locator('body.fight').waitFor({ timeout: 40000 })]);
    await host.waitForTimeout(2500);
    assert.match(await guest.locator('#name1').innerText(), /•/);
    assert.notEqual(await guest.locator('#time').innerText(), '∞');
    assert.ok(await host.locator('#mobile-controls').isVisible());
    assert.ok(await guest.locator('#mobile-controls').isVisible());
    console.log(`${mode}: two clients connected; HUD and mobile controls visible`);
    await host.locator('#back-menu').click();
    await guest.locator('#back-menu').click();
  }
  if (errors.length) throw new Error('Browser console errors:\n' + errors.join('\n'));
  console.log('Same-runner online browser smoke test passed (NOT a cross-network device certification).');
} finally {
  await android?.close();
  await iphone?.close();
  await new Promise(ok => server.close(ok));
}
