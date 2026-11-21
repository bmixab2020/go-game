"use strict";

const CELL = 40, PAD = 30, STONE_R = CELL * 0.47;

function starPoints(n) {
  if (n === 9) return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]];
  if (n === 7) return [[3, 3]];
  if (n >= 13) {
    const lo = 3, hi = n - 4, mid = (n - 1) / 2;
    const out = [];
    for (const y of [lo, mid, hi]) for (const x of [lo, mid, hi]) out.push([x, y]);
    return out;
  }
  return [];
}

class BoardView {
  constructor(el) {
    this.svg = el;
    this.board = null;
    this.opts = {};
    this.hover = null;
    this.flash = new Map();
    this.flashTimer = null;
    this.onClick = null;
    el.addEventListener("click", (e) => {
      const i = this.pointFromEvent(e);
      if (i !== null && this.onClick) this.onClick(i);
    });
    el.addEventListener("mousemove", (e) => {
      const i = this.pointFromEvent(e);
      if (i !== this.hover) { this.hover = i; this.draw(); }
    });
    el.addEventListener("mouseleave", () => {
      if (this.hover !== null) { this.hover = null; this.draw(); }
    });
  }

  pointFromEvent(e) {
    const n = this.board.size;
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    const x = Math.round((p.x - PAD) / CELL), y = Math.round((p.y - PAD) / CELL);
    if (x < 0 || y < 0 || x >= n || y >= n) return null;
    return y * n + x;
  }

  flashCaptured(points, color, ms) {
    clearTimeout(this.flashTimer);
    this.flash = new Map(points.map((i) => [i, color]));
    this.draw();
    this.flashTimer = setTimeout(() => { this.flash.clear(); this.draw(); }, ms);
  }

  render(board, opts = {}) {
    this.board = board;
    this.opts = opts;
    this.draw();
  }

  draw() {
    const b = this.board;
    if (!b) return;
    const o = this.opts, n = b.size;
    const W = PAD * 2 + CELL * (n - 1);
    const px = (i) => PAD + (i % n) * CELL;
    const py = (i) => PAD + Math.floor(i / n) * CELL;
    this.svg.setAttribute("viewBox", `0 0 ${W} ${W}`);

    let s = `
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8bf6b"/><stop offset="1" stop-color="#d4a24c"/></linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="${W}" rx="10" fill="url(#wood)"/>`;

    for (let k = 0; k < n; k++) {
      const p = PAD + k * CELL;
      s += `<line x1="${PAD}" y1="${p}" x2="${W - PAD}" y2="${p}" stroke="#5a4320" stroke-width="1.2"/>`;
      s += `<line x1="${p}" y1="${PAD}" x2="${p}" y2="${W - PAD}" stroke="#5a4320" stroke-width="1.2"/>`;
      const label = COLS[k], row = n - k;
      s += `<text x="${p}" y="${PAD - 14}" class="coord">${label}</text>`;
      s += `<text x="${p}" y="${W - PAD + 22}" class="coord">${label}</text>`;
      s += `<text x="${PAD - 18}" y="${p + 4}" class="coord">${row}</text>`;
      s += `<text x="${W - PAD + 18}" y="${p + 4}" class="coord">${row}</text>`;
    }
    for (const [x, y] of starPoints(n)) {
      s += `<circle cx="${PAD + x * CELL}" cy="${PAD + y * CELL}" r="3.5" fill="#5a4320"/>`;
    }

    const dead = o.dead || new Set();

    if (o.territory) {
      for (let i = 0; i < b.grid.length; i++) {
        const own = o.territory[i];
        if (!own || (b.grid[i] !== EMPTY && !dead.has(i))) continue;
        s += own === BLACK
          ? `<rect x="${px(i) - 6}" y="${py(i) - 6}" width="12" height="12" fill="#111" opacity=".85"/>`
          : `<rect x="${px(i) - 6}" y="${py(i) - 6}" width="12" height="12" fill="#fff" stroke="#555" stroke-width="1"/>`;
      }
    }

    for (const i of o.highlights || []) {
      s += `<circle class="hint" cx="${px(i)}" cy="${py(i)}" r="11"/>`;
    }

    // hovered group
    let hoverGroup = null;
    if (this.hover !== null && b.grid[this.hover] !== EMPTY) hoverGroup = b.groupAt(this.hover);

    const counts = o.showLiberties ? new Map() : null;
    if (counts) {
      const seen = new Set();
      for (let i = 0; i < b.grid.length; i++) {
        if (b.grid[i] === EMPTY || seen.has(i)) continue;
        const g = b.groupAt(i);
        for (const st of g.stones) { seen.add(st); counts.set(st, g.liberties.length); }
      }
    }

    for (let i = 0; i < b.grid.length; i++) {
      const c = b.grid[i];
      if (c === EMPTY) continue;
      const op = dead.has(i) ? 0.35 : 1;
      s += `<circle cx="${px(i)}" cy="${py(i)}" r="${STONE_R}" fill="${c === BLACK ? "#000" : "#fff"}" stroke="#000" stroke-width="1" opacity="${op}"/>`;
      if (counts) {
        const libs = counts.get(i);
        const col = libs === 1 ? "#ff5a4d" : c === BLACK ? "#fff" : "#222";
        s += `<text x="${px(i)}" y="${py(i) + 5}" class="libnum" fill="${col}">${libs}</text>`;
      }
    }

    if (hoverGroup) {
      for (const st of hoverGroup.stones) {
        s += `<circle cx="${px(st)}" cy="${py(st)}" r="${STONE_R - 2}" fill="none" stroke="#2f9e44" stroke-width="2.5"/>`;
      }
      const isBlack = hoverGroup.color === BLACK;
      for (const l of hoverGroup.liberties) {
        s += `<circle cx="${px(l)}" cy="${py(l)}" r="7" fill="${isBlack ? "#000" : "#fff"}" stroke="${isBlack ? "#fff" : "#000"}" stroke-width="1.5"/>`;
      }
    }

    if (b.lastMove !== null && b.lastMove >= 0 && b.grid[b.lastMove] !== EMPTY && !o.hideLast) {
      const c = b.grid[b.lastMove];
      s += `<text x="${px(b.lastMove)}" y="${py(b.lastMove) + 3.5}" text-anchor="middle" font-size="11" font-weight="700" fill="${c === BLACK ? "#fff" : "#000"}" pointer-events="none">@</text>`;
    }

    for (const i of dead) {
      s += `<text x="${px(i)}" y="${py(i) + 6}" class="deadx">×</text>`;
    }

    for (const [i, c] of this.flash) {
      s += `<circle cx="${px(i)}" cy="${py(i)}" r="${STONE_R}" fill="${c === BLACK ? "#000" : "#fff"}" stroke="#000" stroke-width="1"/>`;
      s += `<text x="${px(i)}" y="${py(i) + 6}" class="deadx">×</text>`;
    }

    if (o.ghost && this.hover !== null && b.grid[this.hover] === EMPTY) {
      s += `<circle cx="${px(this.hover)}" cy="${py(this.hover)}" r="${STONE_R}" fill="${o.ghost === BLACK ? "#000" : "#fff"}" opacity=".45" stroke="#333" stroke-width=".8"/>`;
    }

    this.svg.innerHTML = s;
  }
}
