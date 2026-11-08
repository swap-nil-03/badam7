const express = require('express'), http = require('http'), path = require('path'), crypto = require('crypto'), os = require('os');
const { Server } = require('socket.io'); const Database = require('better-sqlite3'); const G = require('./game');
const PORT = process.env.PORT || 3000;
const DBP = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'badam7.db'); require('fs').mkdirSync(path.dirname(DBP), { recursive: true }); const db = new Database(DBP);
db.exec(`CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,nick TEXT,avatar TEXT,games INT DEFAULT 0,wins INT DEFAULT 0,rounds INT DEFAULT 0,points INT DEFAULT 0,best INT,created TEXT)`);
const app = express(), server = http.createServer(app), io = new Server(server, { pingInterval: 20000, pingTimeout: 60000 });
app.use(express.static(path.join(__dirname, '..', 'web')));
const rooms = new Map(), gRoom = new Map(), gSock = new Map(); let queue = [], qTimer = null;
app.get('/health', (q, r) => r.json({ ok: true, version: require('../package.json').version, rooms: rooms.size, players: gSock.size, queue: queue.length }));
const EMO = ['👍', '😂', '😮', '😡', '👏', '🔥', '😢', '🎉'];
const AV = ['🦁', '🐯', '🦊', '🐼', '🦉', '🐘', '🦄', '🐲', '🦅', '🐬'];
const SY = { S: '♠', H: '♥', D: '♦', C: '♣' }, RK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cs = c => RK[c.r] + SY[c.s];
const clean = s => String(s || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
const getP = id => db.prepare('SELECT * FROM players WHERE id=?').get(id);
const roomCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do c = Array.from({ length: 6 }, () => A[crypto.randomInt(A.length)]).join(''); while (rooms.has(c)); return c; };
const online = () => io.emit('online', gSock.size);

function view(room, id) {
  const seat = room.players.findIndex(p => p.id === id), rd = room.rd;
  return { code: room.code, host: room.host, rounds: room.rounds, round: room.round, phase: room.phase, me: id,
    players: room.players.map((p, i) => ({ id: p.id, nick: p.nick, avatar: p.avatar, online: p.online && !p.left, score: p.score, cards: rd ? rd.hands[i].length : 0 })),
    board: rd && rd.board, turn: rd ? room.players[rd.turn].id : null, last: room.last,
    hand: rd && seat >= 0 ? rd.hands[seat] : [], // ONLY the viewer's own hand
    legal: rd && !rd.finished && seat === rd.turn ? G.legalMoves(rd, seat) : [], res: room.res, hist: room.hist, turnSec: room.turnSec, voice: [...room.voice], timeLeft: (room.phase === 'playing' || room.phase === 'roundEnd') ? Math.max(0, room.dl - Date.now()) : 0 };
}
function push(room) { sched(room); room.players.forEach(p => { const sid = gSock.get(p.id); if (p.online && !p.left && sid) io.to(sid).emit('state', view(room, p.id)); }); }
const bc = (room, ev, d) => room.players.forEach(p => { const sid = gSock.get(p.id); if (p.online && !p.left && sid) io.to(sid).emit(ev, d); });
// 20s turn timer: on expiry play a random legal card (or pass). Offline players get 8s, players who left 1.2s.
function sched(room) {
  if (room.phase !== 'playing') { clearTimeout(room.t); room.key = null; return; }
  const rd = room.rd, seat = rd.turn, p = room.players[seat], key = room.round + ':' + room.n; if (room.key === key) return;
  clearTimeout(room.t); room.key = key; const ms = p.left ? 1200 : p.online ? room.turnSec * 1000 : Math.min(8000, room.turnSec * 1000); room.dl = Date.now() + ms;
  room.t = setTimeout(() => { try { if (room.key !== key || room.phase !== 'playing') return; const m = G.legalMoves(rd, seat); move(room, p.id, m.length ? m[crypto.randomInt(m.length)] : null, true); } catch (e) { console.error(e); } }, ms);
}
function abort(room, w) {
  clearTimeout(room.t); if (!w) { rooms.delete(room.code); return; }
  room.hist.push(room.players.map(() => 0)); room.res = { winner: w.id, pen: Object.fromEntries(room.players.map(p => [p.id, 0])) };
  room.phase = 'final'; room.last = { text: 'Other players left - match ended' }; push(room);
}
function startRound(room) {
  room.round++; room.n = 0; room.key = null; room.rd = G.startRound(room.players.length); room.phase = 'playing'; room.res = null;
  room.last = { text: `Round ${room.round}: ${room.players[room.rd.turn].nick} starts with 7♥` }; push(room);
}
function move(room, id, card, auto) {
  const rd = room.rd, seat = room.players.findIndex(p => p.id === id);
  if (room.phase !== 'playing' || seat < 0) throw new Error('Not in an active round');
  const nick = room.players[seat].nick, err = card ? G.play(rd, seat, card) : G.pass(rd, seat);
  if (err) throw new Error(err); room.n++;
  room.last = { text: `${nick} ${card ? 'played ' + cs(card) : 'passed'}${auto ? ' (auto)' : ''}`, card: card || null, by: id };
  if (rd.finished) endRound(room); else push(room);
}
function endRound(room) {
  const pen = G.penalties(room.rd); room.players.forEach((p, i) => p.score += pen[i]); room.hist.push(pen);
  room.res = { winner: room.players[room.rd.winner].id, pen: Object.fromEntries(room.players.map((p, i) => [p.id, pen[i]])) };
  room.phase = room.round >= room.rounds ? 'final' : 'roundEnd';
  if (room.phase === 'roundEnd') { const n = room.round; room.dl = Date.now() + 10000; clearTimeout(room.nt); room.nt = setTimeout(() => { if (room.phase === 'roundEnd' && room.round === n) startRound(room); }, 10000); } // auto-start next round after 10s
  if (room.phase === 'final') { const min = Math.min(...room.players.map(p => p.score));
    room.players.forEach(p => db.prepare('UPDATE players SET games=games+1,wins=wins+?,rounds=rounds+?,points=points+?,best=CASE WHEN best IS NULL OR ?<best THEN ? ELSE best END WHERE id=?').run(p.score === min ? 1 : 0, room.rounds, p.score, p.score, p.score, p.id)); }
  push(room);
}
function mkRoom(hostId, rounds) {
  const room = { code: roomCode(), host: hostId, rounds: [1, 2, 5, 7].includes(+rounds) ? +rounds : 5, players: [], phase: 'lobby', round: 0, rd: null, res: null, hist: [], last: null, voice: new Set(), chat: [], n: 0, turnSec: 30 };
  rooms.set(room.code, room); return room;
}
function addP(room, id) {
  if (room.players.some(p => p.id === id)) return;
  if (room.phase !== 'lobby') throw new Error('Game already started'); if (room.players.length >= 7) throw new Error('Room is full');
  const r = getP(id); room.players.push({ id, nick: r.nick, avatar: r.avatar, online: true, score: 0 }); gRoom.set(id, room.code);
}
function removeP(room, id) {
  room.players = room.players.filter(p => p.id !== id); gRoom.delete(id);
  if (!room.players.length) return rooms.delete(room.code);
  if (room.host === id) room.host = room.players[0].id; push(room);
}
function match() {
  clearTimeout(qTimer); qTimer = null; const grp = queue.splice(0, 7); if (grp.length < 2) { queue = grp.concat(queue); return; }
  const room = mkRoom(grp[0].id, grp[0].rounds); grp.forEach(g => addP(room, g.id)); push(room); bc(room, 'chatHistory', room.chat); qUpdate();
  if (queue.length >= 2) qTimer = setTimeout(match, 8000);
}
const qUpdate = () => queue.forEach(q => io.to(gSock.get(q.id)).emit('queue', queue.length));
setInterval(() => { for (const [c, r] of rooms) if (r.players.every(p => !p.online) && (r.empty = (r.empty || 0) + 1) > 10) rooms.delete(c), r.players.forEach(p => gRoom.delete(p.id)); }, 60000);

io.on('connection', socket => {
  let tokens = 80; const iv = setInterval(() => tokens = Math.min(80, tokens + 40), 5000);
  const h = (ev, fn, needReg = true) => socket.on(ev, (d, cb) => {
    try { if (--tokens < 0) throw new Error('Slow down'); if (needReg && !socket.data.gid) throw new Error('Not registered'); const r = fn(d || {}); cb && cb(r || { ok: true }); }
    catch (e) { cb && cb({ error: e.message }); } });
  const room = () => rooms.get(gRoom.get(socket.data.gid));
  const host = () => { const r = room(); if (!r || r.host !== socket.data.gid) throw new Error('Only the host can do that'); return r; };
  h('register', ({ gid, nick }) => {
    if (!/^[a-f0-9]{32}$/.test(gid || '')) throw new Error('Bad guest id'); nick = clean(nick); if (!nick) throw new Error('Enter a nickname');
    const old = gSock.get(gid); socket.data.gid = gid; gSock.set(gid, socket.id);
    if (old && old !== socket.id) io.sockets.sockets.get(old)?.disconnect(true);
    if (!getP(gid)) db.prepare('INSERT INTO players(id,nick,avatar,created) VALUES(?,?,?,?)').run(gid, nick, AV[parseInt(gid.slice(0, 4), 16) % AV.length], new Date().toISOString());
    else db.prepare('UPDATE players SET nick=? WHERE id=?').run(nick, gid);
    const rm = room(); if (rm) { const p = rm.players.find(p => p.id === gid); p.online = true; p.nick = nick; socket.join(rm.code); push(rm); socket.emit('chatHistory', rm.chat); }
    online(); return { player: getP(gid) };
  }, false);
  h('createRoom', ({ rounds }) => { if (room()) throw new Error('Leave your current room first'); const r = mkRoom(socket.data.gid, rounds); addP(r, socket.data.gid); push(r); });
  h('joinRoom', ({ code }) => { const r = rooms.get(String(code || '').toUpperCase().trim()); if (!r) throw new Error('Room not found'); if (room() && room() !== r) throw new Error('Leave your current room first'); addP(r, socket.data.gid); push(r); socket.emit('chatHistory', r.chat); });
  h('startGame', () => { const r = host(); if (r.phase !== 'lobby') throw new Error('Already started'); if (r.players.length < 2) throw new Error('Need at least 2 players'); startRound(r); });
  h('nextRound', () => { const r = host(); if (r.phase !== 'roundEnd') throw new Error('Round not finished'); clearTimeout(r.nt); startRound(r); });
  h('playAgain', () => { const r = host(); if (r.phase !== 'final') throw new Error('Match not finished'); Object.assign(r, { phase: 'lobby', round: 0, rd: null, res: null, hist: [], last: null }); r.players.forEach(p => p.score = 0); r.players = r.players.filter(p => p.online && !p.left); push(r); });
  h('play', c => { const r = room(); if (!r) throw new Error('Not in a room'); move(r, socket.data.gid, { s: c.s, r: c.r }); });
  h('pass', () => { const r = room(); if (!r) throw new Error('Not in a room'); move(r, socket.data.gid, null); });
  h('leave', () => { const r = room(); if (!r) return; const id = socket.data.gid; socket.leave(r.code);
    if (r.voice.delete(id)) bc(r, 'voiceLeft', id);
    if (r.phase === 'lobby') removeP(r, id);
    else { const p = r.players.find(p => p.id === id); p.left = true; p.online = false; gRoom.delete(id);
      if (r.host === id) { const n = r.players.find(q => !q.left && q.online); if (n) r.host = n.id; }
      const act = r.players.filter(q => !q.left); if (r.phase !== 'final' && act.length < 2) abort(r, act[0]); else push(r); }
    socket.emit('left'); });
  h('setTimer', ({ sec }) => { const r = host(); if (r.phase !== 'lobby') throw new Error('Change the timer before the game starts'); if (![15, 20, 30, 45, 60].includes(+sec)) throw new Error('Invalid timer'); r.turnSec = +sec; push(r); });
  h('react', ({ e }) => { const r = room(); if (!r) throw new Error('Not in a room'); if (!EMO.includes(e)) throw new Error('Invalid reaction'); const now = Date.now(); if (now - (socket.data.lr || 0) < 700) return; socket.data.lr = now; bc(r, 'react', { id: socket.data.gid, e }); });
  h('chat', ({ text }) => { const r = room(); if (!r) throw new Error('Not in a room');
    text = String(text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 200); if (!text) return;
    const me = r.players.find(p => p.id === socket.data.gid), low = text.toLowerCase();
    const m = { id: me.id, nick: me.nick, avatar: me.avatar, text, mentions: r.players.filter(p => p.id !== me.id && low.includes('@' + p.nick.toLowerCase())).map(p => p.id), t: Date.now() };
    r.chat.push(m); if (r.chat.length > 50) r.chat.shift(); bc(r, 'chat', m); });
  // WebRTC voice: server only relays signaling (offer/answer/ICE) between players in the same room.
  h('voiceJoin', () => { const r = room(); if (!r) throw new Error('Not in a room'); const peers = [...r.voice].filter(i => i !== socket.data.gid); r.voice.add(socket.data.gid); push(r); return { peers }; });
  h('voiceLeave', () => { const r = room(); if (!r) return; r.voice.delete(socket.data.gid); bc(r, 'voiceLeft', socket.data.gid); push(r); });
  h('rtc', ({ to, data }) => { const r = room(); if (!r || !r.voice.has(socket.data.gid) || !r.voice.has(to)) return; const sid = gSock.get(to); if (sid) io.to(sid).emit('rtc', { from: socket.data.gid, data }); });
  h('findPlayers', ({ rounds }) => { const id = socket.data.gid; if (room()) throw new Error('Leave your current room first'); if (queue.some(q => q.id === id)) return;
    queue.push({ id, rounds: [1, 2, 5, 7].includes(+rounds) ? +rounds : 5 }); if (queue.length >= 7) match(); else { if (queue.length >= 2 && !qTimer) qTimer = setTimeout(match, 8000); qUpdate(); } });
  h('cancelSearch', () => { queue = queue.filter(q => q.id !== socket.data.gid); qUpdate(); });
  h('stats', () => { const p = getP(socket.data.gid); return { p, winPct: p.games ? Math.round(100 * p.wins / p.games) : 0, avg: p.rounds ? +(p.points / p.rounds).toFixed(1) : 0 }; });
  h('leaderboard', () => ({ rows: db.prepare('SELECT nick,avatar,games,wins FROM players WHERE games>0 ORDER BY wins*1.0/games DESC,games DESC LIMIT 20').all() }));
  socket.on('disconnect', reason => { console.log('disconnect:', reason, (socket.data.gid || '').slice(0, 6));
    clearInterval(iv); const id = socket.data.gid; if (!id || gSock.get(id) !== socket.id) return; gSock.delete(id);
    queue = queue.filter(q => q.id !== id); qUpdate(); online(); const r = rooms.get(gRoom.get(id)); if (!r) return;
    const p = r.players.find(p => p.id === id); p.online = false; if (r.voice.delete(id)) bc(r, 'voiceLeft', id); push(r);
    if (r.phase === 'lobby') setTimeout(() => { if (!p.online && r.phase === 'lobby' && r.players.includes(p)) removeP(r, id); }, 30000);
  });
});
process.on('uncaughtException', e => console.error('ERR', e));
server.listen(PORT, '0.0.0.0', () => {
  console.log(`API/socket listening on ${PORT}\n\n  \u279c  Local:   http://localhost:${PORT}/`);
  for (const l of Object.values(os.networkInterfaces()).flat()) if (l.family === 'IPv4' && !l.internal) console.log(`  \u279c  Network: http://${l.address}:${PORT}/`);
});
