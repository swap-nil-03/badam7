const G = require('../server/game'); const assert = require('assert');
for (let n = 2; n <= 7; n++) for (let g = 0; g < 200; g++) {
  const rd = G.startRound(n);
  assert.equal(rd.hands.flat().length, 52); assert.equal(new Set(rd.hands.flat().map(c => c.s + c.r)).size, 52);
  assert(rd.hands[rd.turn].some(c => c.s === 'H' && c.r === 7));
  const first = rd.hands[rd.turn].find(c => c.s === 'H' && c.r === 7);
  const other = rd.hands[rd.turn].find(c => c.r === 7 && c.s !== 'H'); if (other) assert(G.play(rd, rd.turn, other)); // 7 of another suit rejected first
  assert(G.play(rd, (rd.turn + 1) % n, first) === 'Not your turn');
  let steps = 0;
  while (!rd.finished) { const s = rd.turn, m = G.legalMoves(rd, s);
    if (m.length) { assert(G.pass(rd, s)); assert.equal(G.play(rd, s, m[Math.floor(Math.random() * m.length)]), null); } else assert.equal(G.pass(rd, s), null);
    assert(++steps < 2000); }
  const p = G.penalties(rd); assert.equal(p[rd.winner], 0); assert(rd.hands[rd.winner].length === 0);
}
const rd = { hands: [[], [{ s: 'H', r: 2 }, { s: 'C', r: 5 }, { s: 'D', r: 13 }], [{ s: 'S', r: 1 }, { s: 'S', r: 8 }]], winner: 0 };
assert.deepEqual(G.penalties(rd), [0, 20, 9]); console.log('engine tests passed');
