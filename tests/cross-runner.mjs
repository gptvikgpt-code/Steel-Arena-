/**
 * Experimental CROSS-RUNNER WebRTC smoke test.
 * Host and guest run on separate Ubuntu 24.04 GitHub-hosted machines
 * (Chromium vs WebKit). This is still NOT physical Android/iPhone certification.
 */
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const role = process.env.ARENA_TEST_ROLE;
const mode = process.env.ARENA_TEST_MODE;
assert.ok(['host', 'guest'].includes(role), 'ARENA_TEST_ROLE must be host or guest');
assert.ok(['duel', 'platform'].includes(mode), 'ARENA_TEST_MODE must be duel or platform');
const alphabet = '0123456789';
const seed = `${process.env.GITHUB_RUN_ID || 'local'}:${process.env.GITHUB_RUN_ATTEMPT || '1'}:${mode}`;
const code = [...createHash('sha256').update(seed).digest().subarray(0, 6)]
  .map(b => alphabet[b % 10]).join('');
const url = 'https://gptvikgpt-code.github.io/Steel-Arena-/';
const engine = role === 'host' ? chromium : webkit;
const browser = await engine.launch({ headless: true, ...(role === 'host' ? { args: ['--use-gl=angle', '--use-angle=swiftshader'] } : {}) });
let page;
try {
  const context = await browser.newContext({
    viewport: role === 'host' ? { width: 915, height: 412 } : { width: 844, height: 390 },
    isMobile: true, hasTouch: true
  });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.route('**/graphics.js*', route => route.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `export function createGraphics(canvas) {
      canvas.width=innerWidth;canvas.height=innerHeight;
      return {setStage(){},sync(){},impact(){},resize(){},setCameraTilt(){},
        setFirstPerson(){},setAim(){},renderer:{domElement:canvas}};
    }`
  }));
  await page.route('**/game.js*', async route => {
    const response = await route.fetch();
    assert.ok(response.ok(), 'Published game.js must be available');
    let source = await response.text();
    if (role === 'host') {
      const match = source.match(/function makeCode\(\)\{[\s\S]*?\n\}/);
      assert.ok(match, 'Cannot find the six-digit room code generator');
      source = source.replace(match[0], `function makeCode(){return '${code}';}`);
    }
    source += '\nwindow.__arenaCross = () => ({role, mode, arena, phase:match?.phase, fighters:players.map(p=>({x:p.x,y:p.y,z:p.z,hp:p.hp,grounded:p.grounded})), local:copyState(), remote:remoteInput, peerOpen:!!peer?.open, peerDisconnected:!!peer?.disconnected, dataChannelOpen:!!connection?.open, remotePeer:connection?.peer||null, ice:connection?.peerConnection?{state:connection.peerConnection.connectionState, ice:connection.peerConnection.iceConnectionState, gathering:connection.peerConnection.iceGatheringState, signaling:connection.peerConnection.signalingState}:null});\nwindow.__arenaCrossDropOnPlatform = () => { const p=players[0]; p.x=-5.2; p.z=0; p.y=2.5; p.vy=-1; p.grounded=false; };\nwindow.__arenaCrossAckReceived = false;\nwindow.__arenaCrossAck = () => send({t:\'cross-ack\'});\nlet __arenaCrossAckConnection = null;\nconst __arenaCrossWatchAck = () => { if(connection && connection !== __arenaCrossAckConnection){ __arenaCrossAckConnection = connection; connection.on(\'data\', msg => { if(msg?.t === \'cross-ack\') window.__arenaCrossAckReceived = true; }); } if(!window.__arenaCrossAckReceived) setTimeout(__arenaCrossWatchAck,50); };\n__arenaCrossWatchAck();\n';
    await route.fulfill({ response, body: source, contentType: 'text/javascript' });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => typeof window.Peer === 'function' && typeof window.__arenaCross === 'function', null, { timeout: 45000 });
  if (role === 'host') {
    await page.locator(`[data-pick="mode"][data-value="${mode}"]`).click();
    await page.locator('#create-room').click();
    await page.waitForFunction(() => document.querySelector('#net-status')?.textContent?.includes('Комната создана'), null, { timeout: 35000 });
    assert.equal(await page.locator('#room-code').innerText(), code);
    console.log(`HOST ready for ${mode}, room ${code}`);
  } else {
    // Allow the independently provisioned host runner to finish setup.
    await page.waitForTimeout(12000);
    let joined = false;
    for (let attempt = 1; attempt <= 4 && !joined; attempt++) {
      if (attempt > 1) {
        await page.locator('#back-menu').click().catch(() => {});
        await page.waitForTimeout(1500);
      }
      await page.locator('#join-code').fill(code);
      await page.locator('#join-room').click();
      try {
        await page.locator('body.fight').waitFor({ timeout: 25000 });
        joined = true;
      } catch {
        console.log(`GUEST retry ${attempt} for room ${code}: ${await page.locator('#net-status').innerText()}`);
      }
    }
    assert.ok(joined, 'Guest could not connect to the remote host');
  }
  await page.locator('body.fight').waitFor({ timeout: 140000 });
  await page.waitForFunction(() => window.__arenaCross?.()?.phase === 'fight', null, { timeout: 40000 });
  const state = await page.evaluate(() => window.__arenaCross());
  if (role === 'host') {
    // A second client must be rejected while the first guest owns the room.
    // This guards against a pending data channel being replaced during setup.
    const admission = await page.evaluate(async roomCode => {
      const contender = new window.Peer(undefined, { debug: 0 });
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Second peer could not open signaling')), 15000);
          contender.on('open', () => { clearTimeout(timer); resolve(); });
          contender.on('error', error => { clearTimeout(timer); reject(error); });
        });
        const incoming = contender.connect('steel-arena-' + roomCode, { reliable: true, serialization: 'json' });
        const admission = await new Promise(resolve => {
          let receivedBusy = false;
          let closed = false;
          let settled = false;
          const finish = () => {
            if (receivedBusy && closed && !settled) {
              settled = true;
              clearTimeout(timer);
              resolve({ receivedBusy, closed });
            }
          };
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve({ receivedBusy, closed });
            }
          }, 10000);
          incoming.on('data', msg => {
            if (msg?.t === 'busy') {
              receivedBusy = true;
              finish();
            }
          });
          incoming.on('close', () => {
            closed = true;
            finish();
          });
          incoming.on('error', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({ receivedBusy, closed, error: true });
            }
          });
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        const current = window.__arenaCross();
        return { ...admission, remotePeer: current?.remotePeer, dataChannelOpen: current?.dataChannelOpen };
      } finally {
        contender.destroy();
      }
    }, code);
    assert.equal(admission.receivedBusy, true, 'A second guest must receive an explicit room-busy message');
    assert.equal(admission.closed, true, 'The second guest connection must be closed after rejection');
    assert.equal(admission.remotePeer, state.remotePeer, 'The original guest connection must remain assigned');
    assert.equal(admission.dataChannelOpen, true, 'The original guest data channel must remain open');
  }
  assert.equal(state.mode, mode);
  assert.equal(state.arena, 'garden');
  assert.equal(state.role, role);
  assert.ok(await page.locator('#mobile-controls').isVisible());
  const pad = page.locator('#move-joystick');
  await pad.evaluate((el, dir) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 39, isPrimary: true,
      clientX: r.left + r.width / 2 + (dir === 'right' ? .32 : -.32) * r.width,
      clientY: r.top + r.height / 2
    }));
  }, role === 'host' ? 'right' : 'left');
  await page.waitForFunction(expected => {
    const s = window.__arenaCross?.();
    return expected === 'host' ? s?.local?.axisX > .7 : s?.local?.axisX < -.7;
  }, role, { timeout: 8000 });
  if (role === 'host') {
    await page.waitForFunction(() => window.__arenaCross?.()?.remote?.axisX < -.7, null, { timeout: 30000 });
  }
  await page.waitForFunction(() => {
    const f = window.__arenaCross?.()?.fighters;
    return f?.length === 2 && f[1].x - f[0].x < 1.85;
  }, null, { timeout: 45000 });
  await pad.evaluate(el => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 39 })));
  await page.waitForTimeout(350);
  if (role === 'host') {
    const attack = page.locator('#mobile-controls [data-key="light"]');
    await attack.evaluate(el => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 40 })));
    await page.waitForFunction(() => parseFloat(document.querySelector('#hp2')?.style.width || '100') < 100, null, { timeout: 12000 });
    await attack.evaluate(el => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 40 })));
    // Keep the host alive until the guest has received the authoritative damage update.
    await page.waitForFunction(() => window.__arenaCrossAckReceived === true, null, { timeout: 20000 });
  } else {
    await page.waitForFunction(() => parseFloat(document.querySelector('#hp2')?.style.width || '100') < 100, null, { timeout: 45000 });
    await page.evaluate(() => window.__arenaCrossAck());
    await page.waitForTimeout(350);
  }
  if (mode === 'platform' && role === 'host') {
    // Deterministically drop the authoritative fighter onto the left platform.
    await page.evaluate(() => window.__arenaCrossDropOnPlatform());
    await page.waitForFunction(() => {
      const p = window.__arenaCross?.()?.fighters?.[0];
      return p?.grounded === true && Math.abs(p.y - 2.05) < 0.08;
    }, null, { timeout: 7000 });
    console.log('PLATFORM PHYSICS PASS: fighter lands on the rendered left platform.');
  }
  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
  console.log(`CROSS-RUNNER ${mode} ${role} PASS: room ${code}, mobile controls, shared damage. NOT physical device certification.`);
} catch (error) {
  console.error('CROSS-RUNNER FAILED', role, mode, code, error);
  if (page) {
    console.error('status:', await page.locator('#net-status').innerText().catch(() => '<unavailable>'));
    console.error('state:', JSON.stringify(await page.evaluate(() => window.__arenaCross?.()).catch(() => null)));
  }
  throw error;
} finally {
  await browser.close();
}
