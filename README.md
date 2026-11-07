# Badam 7 – real-time multiplayer Sevens
Node.js + Express + Socket.IO + SQLite (better-sqlite3). Server-authoritative engine (`game.js`).

## Windows
1. Install Node 18+ LTS from nodejs.org (better-sqlite3 ships prebuilt binaries for LTS versions).
2. In this folder: `npm install` then `npm test` (engine tests) then `npm start`.
3. Open http://localhost:3000.

## Phones on the same Wi-Fi
Run `ipconfig`, find your IPv4 (e.g. 192.168.1.20), allow Node through Windows Firewall (private network), open `http://192.168.1.20:3000` on each phone.

## Render
Push to GitHub → New Web Service → Build `npm install`, Start `npm start`. Free tier sleeps and restarts; its disk is ephemeral, so
the SQLite file (set `DB_PATH`) is wiped on deploy unless you attach a paid persistent disk. Rooms live in memory and are lost on restart.
Health check: `/health`.

## Rules/scoring
52 cards dealt round-robin (extras to the first seats). 7♥ holder starts every round. Must play if able; pass only if no legal card.
Round winner 0, others sum of remaining ranks (A=1…K=13); lowest total after 5/7 rounds wins (ties share the win). Edit `penalties` in `game.js` to change scoring.

## Pending / not implemented
Voice chat (WebRTC), admin dashboard, PostgreSQL, bots, automated multi-socket tests, host transfer during a match.

## v2 additions
- Startup prints `Local:` and `Network:` URLs (default port 3000; set `PORT` to change). Open the Network URL on phones on the same Wi-Fi.
- 20s turn timer (server-side): random legal card is played, or an automatic pass if none. Offline players get 8s.
- Table chat with @mentions (slide-in panel, swipe right to close). Voice: WebRTC mesh via Socket.IO signaling + free Google STUN.
  Browsers only allow the microphone on **HTTPS or localhost**, so voice will NOT work on a plain `http://192.168.x.x` LAN address
  (it works on your own PC at localhost and on the HTTPS Render URL). Mesh voice suits ~4-5 players; no TURN server, so some strict networks may fail to connect.
- Leave button during a game: seat is auto-played; if fewer than 2 players remain the match ends.

## Folder structure (v1.2.0)
```
badam7/
  server/   index.js (Express + Socket.IO + rooms + DB), game.js (rules & scoring)
  web/      index.html, css/style.css, js/app.js
  tests/    engine.test.js
  data/     SQLite file (created at runtime, git-ignored)
  CHANGELOG.md  render.yaml  package.json
```
