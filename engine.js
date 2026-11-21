"use strict";

const EMPTY = 0, BLACK = 1, WHITE = 2;
const opp = (c) => 3 - c;
const COLS = "ABCDEFGHJKLMNOPQRST";

class Board {
  constructor(size = 9) {
    this.size = size;
    this.grid = new Array(size * size).fill(EMPTY);
    this.captures = { 1: 0, 2: 0 };
    this.turn = BLACK;
    this.lastMove = null; // index, -1 for pass, null at start
    this.prevKey = null; // position before the last move (simple ko)
    this.moveCount = 0;
  }

  clone() {
    const b = new Board(this.size);
    b.grid = this.grid.slice();
    b.captures = { ...this.captures };
    b.turn = this.turn;
    b.lastMove = this.lastMove;
    b.prevKey = this.prevKey;
    b.moveCount = this.moveCount;
    return b;
  }

  idx(x, y) { return y * this.size + x; }

  setup(blacks = [], whites = []) {
    for (const [x, y] of blacks) this.grid[this.idx(x, y)] = BLACK;
    for (const [x, y] of whites) this.grid[this.idx(x, y)] = WHITE;
    return this;
  }

  neighbors(i) {
    const n = this.size, x = i % n, y = (i / n) | 0, r = [];
    if (x > 0) r.push(i - 1);
    if (x < n - 1) r.push(i + 1);
    if (y > 0) r.push(i - n);
    if (y < n - 1) r.push(i + n);
    return r;
  }

  key(grid = this.grid) { return grid.join(""); }

  groupAt(i, grid = this.grid) {
    const color = grid[i];
    if (!color) return null;
    const stones = [i], seen = new Set([i]), libs = new Set();
    for (let k = 0; k < stones.length; k++) {
      for (const nb of this.neighbors(stones[k])) {
        const v = grid[nb];
        if (v === EMPTY) libs.add(nb);
        else if (v === color && !seen.has(nb)) { seen.add(nb); stones.push(nb); }
      }
    }
    return { color, stones, liberties: [...libs] };
  }

  // Try a move without changing the board.
  simulate(i, color) {
    if (i < 0 || i >= this.grid.length) return { ok: false, reason: "off" };
    if (this.grid[i] !== EMPTY) return { ok: false, reason: "occupied" };
    const grid = this.grid.slice();
    grid[i] = color;
    const captured = [];
    for (const nb of this.neighbors(i)) {
      if (grid[nb] === opp(color)) {
        const g = this.groupAt(nb, grid);
        if (g.liberties.length === 0) {
          for (const s of g.stones) { grid[s] = EMPTY; captured.push(s); }
        }
      }
    }
    if (this.groupAt(i, grid).liberties.length === 0) return { ok: false, reason: "suicide" };
    if (this.prevKey !== null && this.key(grid) === this.prevKey) return { ok: false, reason: "ko" };
    return { ok: true, grid, captured };
  }

  play(i, color = this.turn) {
    const r = this.simulate(i, color);
    if (!r.ok) return r;
    this.prevKey = this.key();
    this.grid = r.grid;
    this.captures[color] += r.captured.length;
    this.turn = opp(color);
    this.lastMove = i;
    this.moveCount++;
    return r;
  }

  pass(color = this.turn) {
    this.prevKey = null;
    this.turn = opp(color);
    this.lastMove = -1;
    this.moveCount++;
  }

  // Area scoring (stones + surrounded empty points). `dead` = indices to treat as removed.
  score(dead = new Set()) {
    const g = this.grid.slice();
    for (const i of dead) g[i] = EMPTY;
    const owner = new Array(g.length).fill(0);
    const seen = new Array(g.length).fill(false);
    const regions = [];
    let bs = 0, ws = 0, bt = 0, wt = 0;
    for (let i = 0; i < g.length; i++) {
      if (g[i] === BLACK) bs++;
      else if (g[i] === WHITE) ws++;
      else if (!seen[i]) {
        const pts = [i];
        seen[i] = true;
        let touches = 0;
        for (let k = 0; k < pts.length; k++) {
          for (const nb of this.neighbors(pts[k])) {
            if (g[nb] === EMPTY) {
              if (!seen[nb]) { seen[nb] = true; pts.push(nb); }
            } else touches |= g[nb];
          }
        }
        const o = touches === BLACK ? BLACK : touches === WHITE ? WHITE : 0;
        if (o) for (const p of pts) owner[p] = o;
        if (o === BLACK) bt += pts.length;
        else if (o === WHITE) wt += pts.length;
        regions.push({ points: pts, owner: o });
      }
    }
    return {
      owner, regions,
      blackStones: bs, whiteStones: ws,
      blackTerritory: bt, whiteTerritory: wt,
      black: bs + bt, white: ws + wt,
    };
  }
}

function coordName(i, n) {
  return COLS[i % n] + (n - Math.floor(i / n));
}
