# Changelog

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
