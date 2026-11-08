# Changelog

## v1.4.0
- **Welcome page upgraded** (`docs/index.html`, GitHub Pages): "Welcome to Badam 7", animated fanned cards, spinner, "Connecting to game server...", checks `/health` every 3s, wakes the server, redirects automatically when ready (keeps ?room= links), shows a Retry button after 25s, handles being offline. Shows instantly because GitHub Pages never sleeps.
- Game code unchanged.

## v1.3.2
- **New `docs/index.html` launcher:** a branded Badam 7 "waking the server" screen, hosted free on GitHub Pages. It pings `/health` every 3s and opens the game automatically when the Render server is awake, so players never see Render's black wake-up page.
- `/health` now sends a CORS header so the launcher can read it.

## v1.3.1
- Pass is now a small red PASS button inside the status strip (next to the seconds pill) instead of a big separate button, and only appears when you have no playable card.
- Status strip made slimmer; table cards slightly tighter. More of the table and your hand fit on screen.

## v1.3.0
- **Turn timer:** default is now 30s; the host picks 15/20/30/45/60s in the lobby before the game starts (shown to all players).
- **Compact timer:** the timer is now a small seconds pill plus a thin bar inside a slim status strip (turn + last action), much less screen space.
- **Smaller hand cards:** 48x68 overlapping cards with the rank/suit in the corner so more cards fit on a phone screen; the hand wraps and the page padding adjusts automatically.
- **Table cards show suits:** e.g. 5♠ 6♠ 7♠ in each suit column.
- **Emoji reactions:** 😀 button opens a tray (👍😂😮😡👏🔥😢🎉); the emoji floats down from the sender's player card for everyone (server-validated, 1 per 0.7s).

## v1.2.0 — bug-fix release
- **Fixed:** Copy Code did nothing on http LAN addresses (browser clipboard API needs HTTPS). Added a fallback that works everywhere.
- **Fixed:** suit colours. Hearts/Diamonds are red, Spades/Clubs black, in the hand and on the table (a CSS override and emoji-style glyphs were hiding the red). Suit symbols now use text presentation so phones don't recolour them.
- **Fixed:** repeated "Server Disconnected". Socket.IO now auto-reconnects forever; ping timeout raised to 60s (phones in background/lock screen no longer get dropped quickly); popup shows only after 2.5s offline; duplicate-login race fixed; disconnect reason is logged on the server and shown in the popup.
- **New:** next round starts automatically after 10s (countdown shown; host can press "Start now").
- **New:** choose 1, 2, 5 or 7 rounds.
- **Changed:** project reorganised into `server/` and `web/` (css, js) folders; `/health` reports version; version shown on the home screen.

## v1.1.0
- 7♥ always starts and must be played first; Pass button only when no legal card.
- Larger UI for mobile. Startup prints Local/Network URLs.
- Table chat with @mentions (sliding panel). WebRTC voice chat (Socket.IO signaling).
- Connection popup with 15s retry countdown and manual retry.
- Leave button during game; 20s turn timer with random legal auto-play.

## v1.0.0
- First MVP: guest registration, private rooms, matchmaking, server-side rules and scoring, reconnect, SQLite stats and leaderboard, Render deployment files.
