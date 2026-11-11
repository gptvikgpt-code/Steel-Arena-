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
    let bytes = await readFile(path);
    // Read-only snapshots only in the local test server, never in deployed game code.
    if (path.endsWith('/game.js')) bytes = Buffer.concat([bytes, Buffer.from('\nwindow.__arenaSmoke = () => ({role, mode, arena, phase:match?.phase, delay:match?.delay, worldTime, fighters:players.map(p => ({x:p.x,y:p.y,z:p.z,hp:p.hp,grounded:p.grounded,dir:p.dir,attack:p.attack?.kind})), local:copyState(), remote:remoteInput, connectionOpen:!!connection?.open});\nwindow.__arenaSmokeDropOnPlatform = () => { const p = players[0]; p.x=-5.2; p.z=0; p.y=2.5; p.vy=-1; p.grounded=false; };\n')]);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  } catch (err) {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const liveUrl = process.env.ARENA_TEST_URL;
const url = liveUrl ? new URL(liveUrl).href : `http://127.0.0.1:${server.address().port}/`;
let android, iphone;
const errors = [];
try {
  android = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  iphone = await webkit.launch({ headless: true });
  const a = await android.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  const i = await iphone.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  // Render certification is separate from multiplayer timing: keep the real
  // Three.js renderer active and prove it creates a WebGL2 frame with geometry
  // on both browser engines before the network simulation swaps in its adapter.
  for (const [label, context] of [['Chromium', a], ['WebKit', i]]) {
    const renderPage = await context.newPage();
    renderPage.on('pageerror', err => errors.push(`${label} renderer: ${err.message}`));
    await renderPage.route('**/game.js*', async route => {
      const response = await route.fetch();
      assert.ok(response.ok(), `${label} game.js must be available for renderer certification`);
      const source = await response.text();
      const probe = `
window.__arenaRenderProbe = () => {
  const renderer = gfx.renderer;
  const gl = renderer.getContext();
  return {
    frame: renderer.info.render.frame,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    glVersion: gl.getParameter(gl.VERSION)
  };
};
`;
      await route.fulfill({ response, body: source + probe });
    });
    await renderPage.goto(url, { waitUntil: 'domcontentloaded' });
    await renderPage.waitForFunction(() => {
      const probe = window.__arenaRenderProbe?.();
      return probe?.frame > 0 && probe.calls > 0 && probe.triangles > 0;
    }, null, { timeout: 45000 });
    const probe = await renderPage.evaluate(() => window.__arenaRenderProbe());
    assert.ok(probe.glVersion.includes('WebGL 2.0'), `${label} must create a WebGL 2 context`);
    assert.ok(probe.triangles > 0, `${label} must render actual 3D geometry`);
    console.log(`${label} real renderer PASS: frame ${probe.frame}, ${probe.triangles} triangles, ${probe.glVersion}`);
    await renderPage.close();
  }
  const mockGraphics = `export function createGraphics(canvas) {
    canvas.width = innerWidth; canvas.height = innerHeight;
    return {setStage(){},sync(){},impact(){},resize(){},setCameraTilt(){},
      setFirstPerson(){},setAim(){},renderer:{domElement:canvas}};
  }`;
  const host = await a.newPage(), guest = await i.newPage();
  for (const page of [host, guest]) {
    await page.route('**/graphics.js*', route => route.fulfill({
      status: 200, contentType: 'text/javascript', body: mockGraphics
    }));
    if (liveUrl) {
      // The live site must serve its real game.js; append a read-only test
      // snapshot only inside the isolated Playwright browser session.
      await page.route('**/game.js*', async route => {
        const response = await route.fetch();
        assert.ok(response.ok(), 'Published game.js must be available');
        const source = await response.body();
        const snapshot = '\nwindow.__arenaSmoke = () => ({role, mode, arena, phase:match?.phase, delay:match?.delay, worldTime, fighters:players.map(p => ({x:p.x,y:p.y,z:p.z,hp:p.hp,grounded:p.grounded,dir:p.dir,attack:p.attack?.kind})), local:copyState(), remote:remoteInput, connectionOpen:!!connection?.open});\nwindow.__arenaSmokeDropOnPlatform = () => { const p = players[0]; p.x=-5.2; p.z=0; p.y=2.5; p.vy=-1; p.grounded=false; };\n';
        await route.fulfill({ response, body: Buffer.concat([source, Buffer.from(snapshot)]) });
      });
    }
  }
  for (const [name, page] of [['Android/Chromium', host], ['iPhone/WebKit', guest]]) {
    page.on('pageerror', err => errors.push(`${name}: ${err.message}`));
    page.on('console', msg => { if (msg.type() === 'error' && /uncaught|peerjs|failed to fetch dynamically imported|module script/i.test(msg.text())) errors.push(`${name}: ${msg.text()}`); });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#scene')?.width > 400 && typeof window.Peer === 'function', null, { timeout: 45000 });
    const sanitizedNick = await page.locator('#player-nick').evaluate(el => {
      el.value = 'ALEX_123<test>\\u0001';
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value;
    });
    assert.equal(sanitizedNick, 'ALEX_123test', 'Nickname sanitization must preserve ASCII letters/digits and remove markup/control chars');
    assert.equal(await page.locator('#fighter-list .pick').count(), 6);
    assert.equal(await page.locator('#mobile-controls [data-key]').count(), 8, 'All 8 touch action buttons must be present');
    assert.equal(await page.locator('#move-joystick').count(), 1, 'Movement joystick must be present');
    assert.equal(await page.locator('#turn-urls').count(), 1, 'Optional TURN URL input must be present');
    assert.equal(await page.locator('#turn-username').count(), 1, 'Optional TURN username input must be present');
    assert.equal(await page.locator('#turn-credential').count(), 1, 'Optional TURN credential input must be present');
    assert.equal(await page.locator('#turn-force-relay').count(), 1, 'TURN-only diagnostic toggle must be present');
  }
  for (const mode of ['duel', 'platform']) {
    await host.locator(`[data-pick="mode"][data-value="${mode}"]`).click();
    await host.locator('#create-room').click();
    await host.waitForFunction(() => /^\d{6}$/.test(document.querySelector('#room-code')?.textContent || ''));
    const code = await host.locator('#room-code').innerText();
    await host.waitForFunction(() => document.querySelector('#net-status')?.textContent?.includes('Комната создана'), null, { timeout: 30000 });
    await guest.locator('#join-code').fill(code);
    await guest.locator('#join-room').click();
    await Promise.all([host.locator('body.fight').waitFor({ timeout: 40000 }), guest.locator('body.fight').waitFor({ timeout: 40000 })]);
    // A third client must receive a durable, actionable room-busy message.
    // The host must keep the original guest's data channel open.
    const contender = await i.newPage();
    contender.on('pageerror', err => errors.push(`Busy contender: ${err.message}`));
    await contender.route('**/graphics.js*', route => route.fulfill({
      status: 200, contentType: 'text/javascript', body: mockGraphics
    }));
    if (liveUrl) {
      await contender.route('**/game.js*', async route => {
        const response = await route.fetch();
        assert.ok(response.ok(), 'Published game.js must be available for busy-room check');
        const source = await response.text();
        const snapshot = "\nwindow.__arenaSmoke = () => ({role, mode, arena, phase:match?.phase, delay:match?.delay, worldTime, fighters:players.map(p => ({x:p.x,y:p.y,z:p.z,hp:p.hp,grounded:p.grounded,dir:p.dir,attack:p.attack?.kind})), local:copyState(), remote:remoteInput, connectionOpen:!!connection?.open});\n";
        await route.fulfill({ response, body: source + snapshot });
      });
    }
    await contender.goto(url, { waitUntil: 'domcontentloaded' });
    await contender.waitForFunction(() => typeof window.Peer === 'function', null, { timeout: 45000 });
    await contender.locator('#join-code').fill(code);
    await contender.locator('#join-room').click();
    await contender.waitForFunction(() => document.querySelector('#net-status')?.textContent?.includes('Комната уже занята'), null, { timeout: 20000 });
    await contender.waitForTimeout(400);
    assert.match(await contender.locator('#net-status').innerText(), /Комната уже занята/, 'Busy message must remain visible after disconnect');
    assert.equal(await contender.evaluate(() => window.__arenaSmoke?.()?.connectionOpen), false, 'Rejected contender must close its connection');
    assert.equal(await host.evaluate(() => window.__arenaSmoke?.()?.connectionOpen), true, 'The original guest connection must remain open');
    await contender.close();
    await host.waitForFunction(() => window.__arenaSmoke?.()?.phase === 'fight', null, { timeout: 30000 });
    const hostStage = await host.evaluate(() => window.__arenaSmoke?.());
    const guestStage = await guest.evaluate(() => window.__arenaSmoke?.());
    assert.equal(hostStage?.mode, mode, 'Host must use the selected battle mode');
    assert.equal(guestStage?.mode, mode, 'Guest must receive the selected battle mode');
    assert.equal(hostStage?.arena, 'garden', 'Host must use the visible garden map');
    assert.equal(guestStage?.arena, 'garden', 'Guest must use the same map as host');
    assert.match(await guest.locator('#name1').innerText(), /•/);
    assert.notEqual(await guest.locator('#time').innerText(), '∞');
    assert.ok(await host.locator('#mobile-controls').isVisible());
    assert.ok(await guest.locator('#mobile-controls').isVisible());
    // Test the ACTUAL mobile controls: movement uses a virtual joystick,
    // not nonexistent data-key="left"/"right" buttons.
    // Both fighters start seven units apart, so both must move to land a hit.
    const steer = (page, direction) => page.locator('#move-joystick').evaluate((el, dir) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2 + (dir === 'right' ? 0.32 : -0.32) * r.width;
      const y = r.top + r.height / 2;
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, pointerId: 23, isPrimary: true, clientX: x, clientY: y
      }));
    }, direction);
    const stopSteering = page => page.locator('#move-joystick').evaluate(el =>
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 23 })));
    const press = (page, key) => page.locator(`#mobile-controls [data-key="${key}"]`).evaluate(el =>
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11 })));
    const release = (page, key) => page.locator(`#mobile-controls [data-key="${key}"]`).evaluate(el =>
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11 })));
    await Promise.all([steer(host, 'right'), steer(guest, 'left')]);
    // WebRTC input packets and requestAnimationFrame are asynchronous. A fixed
    // 200 ms sleep intermittently fails on loaded CI runners even when the
    // guest's joystick state arrives correctly a moment later.
    await host.waitForFunction(() => {
      const state = window.__arenaSmoke?.();
      return state?.local?.axisX > 0.7 && state?.remote?.axisX < -0.7;
    }, null, { timeout: 10000 });
    const analog = await host.evaluate(() => window.__arenaSmoke?.());
    assert.ok(analog?.local?.axisX > 0.7, 'Host touch joystick must send analog movement');
    assert.ok(analog?.remote?.axisX < -0.7, 'Guest analog joystick axis must reach host via WebRTC');
    // Wait for the fighters to reach striking range, rather than relying on
    // wall-clock milliseconds that vary with browser scheduling and CI load.
    await host.waitForFunction(() => {
      const fighters = window.__arenaSmoke?.()?.fighters;
      return fighters?.length === 2 && Math.abs(fighters[1].x - fighters[0].x) < 1.85;
    }, null, { timeout: 12000 });
    await Promise.all([stopSteering(host), stopSteering(guest)]);
    await host.waitForTimeout(250);
    console.log('Before attack:', JSON.stringify(await host.evaluate(() => window.__arenaSmoke?.())), JSON.stringify(await guest.evaluate(() => window.__arenaSmoke?.())), 'errors:', errors);
    await press(host, 'light');
    try {
      await host.waitForFunction(() => parseFloat(document.querySelector('#hp2')?.style.width || '100') < 100, null, { timeout: 5000 });
      await guest.waitForFunction(() => parseFloat(document.querySelector('#hp2')?.style.width || '100') < 100, null, { timeout: 5000 });
    } finally {
      await release(host, 'light');
    }
    const hostHp = Number.parseFloat(await host.locator('#hp2').evaluate(el => el.style.width));
    const guestHp = Number.parseFloat(await guest.locator('#hp2').evaluate(el => el.style.width));
    assert.ok(hostHp < 100 && guestHp < 100, 'Both players must observe host-to-guest damage');
    assert.ok(Math.abs(hostHp - guestHp) <= 15, 'Guest health must follow authoritative host health');

    // Verify the reverse direction too: the guest must be able to move into
    // range, attack, and have the host replicate the resulting host damage.
    await host.waitForTimeout(350);
    await steer(guest, 'left');
    await host.waitForFunction(() => {
      const state = window.__arenaSmoke?.();
      return state?.remote?.axisX < -0.7
        && state?.fighters?.length === 2
        && Math.abs(state.fighters[1].x - state.fighters[0].x) < 1.85;
    }, null, { timeout: 12000 });
    await stopSteering(guest);
    await host.waitForTimeout(250);
    await press(guest, 'light');
    try {
      await host.waitForFunction(() => parseFloat(document.querySelector('#hp1')?.style.width || '100') < 100, null, { timeout: 7000 });
      await guest.waitForFunction(() => parseFloat(document.querySelector('#hp1')?.style.width || '100') < 100, null, { timeout: 7000 });
    } finally {
      await release(guest, 'light');
    }
    const hostOwnHp = Number.parseFloat(await host.locator('#hp1').evaluate(el => el.style.width));
    const guestOwnHp = Number.parseFloat(await guest.locator('#hp1').evaluate(el => el.style.width));
    assert.ok(hostOwnHp < 100 && guestOwnHp < 100, 'Both clients must observe guest-to-host damage');
    assert.ok(Math.abs(hostOwnHp - guestOwnHp) <= 15, 'Guest damage must follow authoritative host state');
    if (errors.length) throw new Error('Browser errors during active match:\\n' + errors.join('\\n'));
    if (mode === 'platform') {
      await host.evaluate(() => window.__arenaSmokeDropOnPlatform());
      await host.waitForFunction(() => {
        const p = window.__arenaSmoke?.()?.fighters?.[0];
        return p?.grounded === true && Math.abs(p.y - 2.05) < 0.08;
      }, null, { timeout: 7000 });
      console.log('platform: fighter landed on the rendered left platform');
    }
    console.log(`${mode}: two clients connected, mobile input and synchronized damage verified`);
    // A guest disconnecting while holding a direction must not leave a
    // permanently pressed remote joystick on the host.
    await steer(guest, 'right');
    await host.waitForFunction(() => window.__arenaSmoke?.()?.remote?.axisX > 0.7, null, { timeout: 10000 });
    await guest.locator('#back-menu').click();
    await guest.waitForFunction(() => window.__arenaSmoke?.()?.local?.axisX === 0, null, { timeout: 5000 });
    // Let the guest PeerJS teardown settle before reusing the same browser context
    // for the next room/mode in this sequential smoke run.
    await guest.waitForTimeout(350);
    await host.waitForFunction(() => Object.keys(window.__arenaSmoke?.()?.remote || {}).length === 0, null, { timeout: 12000 });
    await host.locator('#back-menu').click();
    await host.waitForFunction(() => window.__arenaSmoke?.()?.local?.axisX === 0, null, { timeout: 5000 });
    // PeerJS may emit a harmless buffered-send warning while closing RTCDataChannel.
    await host.waitForTimeout(350);
    const teardownErrors = errors.filter(msg => !msg.includes('Error sending binary data through RTCDataChannel.'));
    if (teardownErrors.length) throw new Error('Unexpected disconnect errors:\\n' + teardownErrors.join('\\n'));
    errors.length = 0;
  }
  if (errors.length) throw new Error('Browser console errors:\n' + errors.join('\n'));
  console.log('Same-runner online browser smoke test passed (NOT a cross-network device certification).');
} finally {
  await android?.close();
  await iphone?.close();
  await new Promise(ok => server.close(ok));
}
