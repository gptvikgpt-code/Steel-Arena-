import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';

const rooms = new Map();
const send = (socket, message) => {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
};
const makeCode = () => {
  let value;
  do { value = String(Math.floor(100000 + Math.random() * 900000)); }
  while (rooms.has(value));
  return value;
};

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ name: 'Mushroom Duo', status: 'online', rooms: rooms.size }));
});
const wss = new WebSocketServer({ server, maxPayload: 1024 });

wss.on('connection', socket => {
  let roomCode = null;
  let playerId = null;

  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }

    if (message.type === 'create' || message.type === 'join') {
      if (roomCode) return send(socket, { type: 'error', message: 'Ты уже находишься в комнате' });
      const code = message.type === 'create' ? makeCode() : String(message.code || '');
      if (!/^\d{6}$/.test(code)) return send(socket, { type: 'error', message: 'Код должен состоять из 6 цифр' });

      if (!rooms.has(code)) {
        if (message.type === 'join') return send(socket, { type: 'error', message: 'Комната не найдена' });
        rooms.set(code, { clients: new Map(), states: new Map() });
      }
      const room = rooms.get(code);
      if (room.clients.size >= 2) return send(socket, { type: 'error', message: 'Комната заполнена' });

      playerId = room.clients.has(1) ? 2 : 1;
      roomCode = code;
      room.clients.set(playerId, socket);
      send(socket, { type: 'room', code, playerId, players: room.clients.size });

      for (const [otherId, peer] of room.clients) {
        if (otherId === playerId) continue;
        const state = room.states.get(otherId) || { x: 110, y: 420 };
        send(socket, { type: 'peer', playerId: otherId, x: state.x, y: state.y });
        send(peer, { type: 'peer', playerId });
      }
      return;
    }

    if (message.type === 'state' && roomCode && playerId) {
      const room = rooms.get(roomCode);
      if (!room || !room.clients.has(playerId)) return;
      const x = Number(message.x), y = Number(message.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const state = { x: Math.max(0, Math.min(926, Math.round(x))), y: Math.max(0, Math.min(492, Math.round(y))) };
      room.states.set(playerId, state);
      for (const [otherId, peer] of room.clients) {
        if (otherId !== playerId) send(peer, { type: 'state', playerId, ...state });
      }
    }
  });

  socket.on('close', () => {
    if (!roomCode || !playerId) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.clients.delete(playerId);
    room.states.delete(playerId);
    for (const peer of room.clients.values()) send(peer, { type: 'peer-left' });
    if (room.clients.size === 0) rooms.delete(roomCode);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log('Mushroom Duo server listening on ' + port));
