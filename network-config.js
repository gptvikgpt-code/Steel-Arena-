export const DEFAULT_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: 'stun:stun.l.google.com:19302' }),
  Object.freeze({ urls: 'stun:stun1.l.google.com:19302' }),
  Object.freeze({ urls: 'stun:stun.cloudflare.com:3478' })
]);

/**
 * Build the RTCPeerConnection configuration used by PeerJS.
 * TURN credentials are supplied per device and are never persisted by this module.
 */
export function buildIceConfiguration({
  urls = '',
  username = '',
  credential = '',
  forceRelay = false
} = {}) {
  const iceServers = DEFAULT_ICE_SERVERS.map(server => ({ ...server }));
  const turnUrls = [...new Set(String(urls).split(/[\n,;]/).map(value => value.trim()).filter(Boolean))];
  const turnUsername = String(username).trim();
  const turnCredential = String(credential);

  if (turnUrls.length === 0) {
    if (turnUsername || turnCredential || forceRelay) {
      throw new Error('Для TURN укажи адрес, логин и временный credential.');
    }
  } else {
    if (turnUrls.some(url => !/^turns?:[^\s]+$/i.test(url))) {
      throw new Error('TURN-адрес должен начинаться с turn: или turns:. Разделяй адреса запятыми.');
    }
    if (!turnUsername || !turnCredential) {
      throw new Error('Для TURN нужны и логин, и временный credential.');
    }
    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username: turnUsername,
      credential: turnCredential
    });
  }

  return {
    iceServers,
    ...(forceRelay ? { iceTransportPolicy: 'relay' } : {})
  };
}
