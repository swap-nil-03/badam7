// Pure game engine: no I/O. Suits S,H,D,C; rank 1(A)..13(K).
const crypto = require('crypto');
const SUITS = ['S', 'H', 'D', 'C'];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// Deal round-robin; when 52 % n != 0 the first (52 % n) seats get one extra card.
function deal(n) {
  const d = []; for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ s, r });
  shuffle(d); const h = Array.from({ length: n }, () => []); d.forEach((c, i) => h[i % n].push(c)); return h;
}
function startRound(n) {
  const hands = deal(n);
  return { hands, board: { S: null, H: null, D: null, C: null }, turn: hands.findIndex(h => h.some(c => c.s === 'H' && c.r === 7)), finished: false, winner: null };
}
function isLegal(board, c) {
  const b = board[c.s];
  if (!b) return c.r === 7 && (c.s === 'H' || SUITS.some(s => board[s])); // 7♥ must open the round
  return c.r === b.lo - 1 || c.r === b.hi + 1;
}
const legalMoves = (rd, seat) => rd.hands[seat].filter(c => isLegal(rd.board, c));
function play(rd, seat, c) {
  if (rd.finished) return 'Round is over';
  if (seat !== rd.turn) return 'Not your turn';
  if (!c || !SUITS.includes(c.s) || !Number.isInteger(c.r)) return 'Invalid card';
  const i = rd.hands[seat].findIndex(x => x.s === c.s && x.r === c.r);
  if (i < 0) return 'You do not hold that card';
  if (!isLegal(rd.board, c)) return 'That card cannot be played now';
  rd.hands[seat].splice(i, 1);
  const b = rd.board[c.s]; if (!b) rd.board[c.s] = { lo: 7, hi: 7 }; else if (c.r < b.lo) b.lo = c.r; else b.hi = c.r;
  if (!rd.hands[seat].length) { rd.finished = true; rd.winner = seat; } else rd.turn = (seat + 1) % rd.hands.length;
  return null;
}
function pass(rd, seat) {
  if (rd.finished) return 'Round is over';
  if (seat !== rd.turn) return 'Not your turn';
  if (legalMoves(rd, seat).length) return 'You have a playable card - you cannot pass';
  rd.turn = (seat + 1) % rd.hands.length; return null;
}
// Scoring module (swap this out to change rules): winner 0, others sum of remaining ranks.
const penalties = rd => rd.hands.map((h, i) => i === rd.winner ? 0 : h.reduce((a, c) => a + c.r, 0));
module.exports = { SUITS, deal, startRound, isLegal, legalMoves, play, pass, penalties };
