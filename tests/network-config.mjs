import assert from 'node:assert/strict';
import { buildIceConfiguration, DEFAULT_ICE_SERVERS } from '../network-config.js';

const defaults = buildIceConfiguration();
assert.deepEqual(defaults.iceServers, DEFAULT_ICE_SERVERS);
assert.equal('iceTransportPolicy' in defaults, false);

const oneTurn = buildIceConfiguration({
  urls: 'turn:relay.example.net:3478?transport=udp',
  username: 'temporary-user',
  credential: 'temporary-secret'
});
assert.deepEqual(oneTurn.iceServers.at(-1), {
  urls: 'turn:relay.example.net:3478?transport=udp',
  username: 'temporary-user',
  credential: 'temporary-secret'
});
assert.equal('iceTransportPolicy' in oneTurn, false);

const multipleTurn = buildIceConfiguration({
  urls: 'turn:relay.example.net:3478?transport=udp, turns:relay.example.net:5349?transport=tcp\nturn:relay.example.net:3478?transport=udp',
  username: 'u',
  credential: 'p',
  forceRelay: true
});
assert.deepEqual(multipleTurn.iceServers.at(-1).urls, [
  'turn:relay.example.net:3478?transport=udp',
  'turns:relay.example.net:5349?transport=tcp'
]);
assert.equal(multipleTurn.iceTransportPolicy, 'relay');

assert.throws(() => buildIceConfiguration({ urls: 'turn:relay.example.net:3478' }), /логин, и временный credential/);
assert.throws(() => buildIceConfiguration({ urls: 'turn:relay.example.net:3478', username: 'u' }), /логин, и временный credential/);
assert.throws(() => buildIceConfiguration({ urls: 'stun:stun.example.net:3478', username: 'u', credential: 'p' }), /turn: или turns:/);
assert.throws(() => buildIceConfiguration({ username: 'u', credential: 'p' }), /адрес, логин и временный credential/);
assert.throws(() => buildIceConfiguration({ forceRelay: true }), /адрес, логин и временный credential/);

console.log('TURN ICE configuration tests: PASS');
