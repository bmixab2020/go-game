"use strict";

// A deliberately gentle, rule-of-thumb opponent: captures, escapes atari,
// threatens, prefers sensible points, avoids filling its own eyes.

function isOwnEye(board, i, color) {
  for (const nb of board.neighbors(i)) if (board.grid[nb] !== color) return false;
  const n = board.size, x = i % n, y = (i / n) | 0;
  let bad = 0, edge = false;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) { edge = true; continue; }
    if (board.grid[ny * n + nx] !== color) bad++;
  }
  return edge ? bad === 0 : bad <= 1;
}

// One-sentence reason for playing `i` as `color`, for the "Suggest" button.
function explainMove(board, color, i) {
  const n = board.size, other = opp(color);
  const name = (c) => (c === BLACK ? "Black" : "White");
  const plural = (k) => `${k} stone${k > 1 ? "s" : ""}`;
  const sim = board.simulate(i, color);
  if (!sim.ok) return "";

  if (sim.captured.length) {
    return `It captures ${plural(sim.captured.length)} by taking away their last liberty.`;
  }

  const after = board.clone();
  after.grid = sim.grid;
  const own = after.groupAt(i);
  const seen = new Set();
  let saved = null, atari = null, pressure = null;

  for (const nb of board.neighbors(i)) {
    const v = board.grid[nb];
    if (v === EMPTY) continue;
    const g = board.groupAt(nb);
    if (seen.has(g.stones[0])) continue;
    seen.add(g.stones[0]);
    if (v === color) {
      if (g.liberties.length === 1 && own.liberties.length >= 2) saved = g;
    } else {
      const ag = after.groupAt(nb);
      if (ag.liberties.length === 1) atari = ag;
      else if (!pressure || ag.liberties.length < pressure.liberties.length) pressure = ag;
    }
  }

  if (saved) {
    return `Your group at ${coordName(saved.stones[0], n)} is in atari. This extends it to ${own.liberties.length} liberties so it can't be captured next move.`;
  }
  if (atari) {
    return `It puts the ${name(other)} group at ${coordName(atari.stones[0], n)} in atari (one liberty left), threatening to capture it next move.`;
  }
  if (pressure) {
    return `It takes a liberty from the ${name(other)} group at ${coordName(pressure.stones[0], n)} (${pressure.liberties.length} left), putting it under pressure.`;
  }

  const x = i % n, y = (i / n) | 0;
  const line = Math.min(x, y, n - 1 - x, n - 1 - y);
  const touchesOwn = board.neighbors(i).some((nb) => board.grid[nb] === color);
  if (touchesOwn) {
    return `It adds to your group, giving it ${own.liberties.length} liberties and making it harder to attack.`;
  }
  if (board.moveCount < n * 1.5) {
    if (line === 2) return "Early in the game, the third line from the edge claims territory while staying safe.";
    if (line >= 3) return "A central point early on influences every side of the board.";
    return "It stakes out space near the edge early in the game.";
  }
  return "It claims open space and keeps your stones flexible.";
}

// Returns a point index, or -1 to pass.
function aiChoose(board, color, komi = 0) {
  const n = board.size, other = opp(color);

  if (board.lastMove === -1) {
    const sc = board.score();
    const lead = color === BLACK ? sc.black - sc.white - komi : sc.white + komi - sc.black;
    if (lead > 0) return -1;
  }

  const sc = board.score();
  const terr = new Array(n * n).fill(0);
  const maxRegion = Math.max(10, n * n * 0.2);
  for (const r of sc.regions) {
    if (r.owner && r.points.length <= maxRegion) for (const p of r.points) terr[p] = r.owner;
  }

  const early = board.moveCount < n * 1.5;
  let best = -1, bestScore = -Infinity;

  for (let i = 0; i < board.grid.length; i++) {
    if (board.grid[i] !== EMPTY) continue;
    if (isOwnEye(board, i, color)) continue;
    const sim = board.simulate(i, color);
    if (!sim.ok) continue;

    const after = board.clone();
    after.grid = sim.grid;
    const own = after.groupAt(i);
    let s = Math.random() * 1.5;

    s += sim.captured.length * 14;
    if (own.liberties.length === 1 && sim.captured.length === 0) s -= 18 + own.stones.length * 2;
    else if (own.liberties.length === 2) s -= 1;

    const seen = new Set();
    for (const nb of board.neighbors(i)) {
      const v = board.grid[nb];
      if (v === EMPTY) continue;
      const g = board.groupAt(nb);
      const gk = g.stones[0];
      if (seen.has(gk)) continue;
      seen.add(gk);
      if (v === color) {
        if (g.liberties.length === 1 && own.liberties.length >= 2) s += 8 + g.stones.length * 3;
      } else {
        const ag = after.groupAt(nb);
        if (ag && ag.liberties.length === 1) s += 6 + ag.stones.length * 2;
        else if (ag) s += Math.max(0, 4 - ag.liberties.length) * 0.5;
      }
    }

    const x = i % n, y = (i / n) | 0;
    const line = Math.min(x, y, n - 1 - x, n - 1 - y);
    if (line === 0) s -= early ? 5 : 1.5;
    else if (line === 1) s += early ? 2.5 : 0.5;
    else if (line === 2) s += early ? 3 : 0.5;
    else s += early ? 1 : 0.5;

    let near = 0;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(n - 1, y + 2); yy++) {
      for (let xx = Math.max(0, x - 2); xx <= Math.min(n - 1, x + 2); xx++) {
        if (board.grid[yy * n + xx] !== EMPTY) near++;
      }
    }
    s += Math.min(near, 3) * 0.4;

    if (terr[i] === color) s -= 7;
    else if (terr[i] === other) s -= 2.5;

    if (s > bestScore) { bestScore = s; best = i; }
  }

  if (best < 0 || bestScore < -2) return -1;
  return best;
}
