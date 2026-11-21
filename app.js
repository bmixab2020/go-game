"use strict";

const $ = (sel) => document.querySelector(sel);
const REJECT = {
  occupied: "That point already has a stone.",
  suicide: "Illegal (suicide): that stone would have no liberties and capture nothing.",
  ko: "Illegal (ko): you can't immediately recapture. Play elsewhere first, then come back.",
};
const colorName = (c) => (c === BLACK ? "Black" : "White");

/* ---------- tabs ---------- */
document.querySelectorAll("#tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b === btn));
    for (const v of ["home", "learn", "play", "scores", "glossary"]) {
      $("#view-" + v).classList.toggle("hidden", v !== btn.dataset.view);
    }
  });
});
const showTab = (name) => document.querySelector(`#tabs button[data-view="${name}"]`).click();
document.querySelectorAll("[data-goto]").forEach((el) => {
  el.addEventListener("click", () => showTab(el.dataset.goto));
});

/* ---------- lessons ---------- */
const learnView = new BoardView($("#learnBoard"));
let progress = {};
try { progress = JSON.parse(localStorage.getItem("go-progress") || "{}"); } catch (e) { progress = {}; }
const saveProgress = () => { try { localStorage.setItem("go-progress", JSON.stringify(progress)); } catch (e) { /* ignore */ } };

let li = 0, lb = null, ls = null, hintOn = false;

function setLessonMsg(html, kind = "info") {
  const el = $("#lessonMsg");
  el.className = html ? "msg " + kind : "msg";
  el.innerHTML = html || "";
}

function renderLessonList() {
  const ol = $("#lessonList");
  ol.innerHTML = "";
  LESSONS.forEach((L, i) => {
    const li_ = document.createElement("li");
    li_.textContent = L.title;
    if (i === li) li_.classList.add("current");
    if (progress[i]) li_.classList.add("done");
    li_.addEventListener("click", () => loadLesson(i));
    ol.appendChild(li_);
  });
}

function drawLearn() {
  const L = LESSONS[li];
  const marks = [...(L.highlight || []), ...(hintOn ? L.hint || [] : [])].map(([x, y]) => lb.idx(x, y));
  const interactive = !L.quiz && !L.cta;
  learnView.render(lb, {
    ghost: interactive ? lessonColor(L, lb) : 0,
    showLiberties: L.showLiberties,
    highlights: marks,
    territory: L.revealTerritory && ls.done ? lb.score().owner : null,
  });
}

function markSolved(L) {
  ls.done = true;
  progress[li] = true;
  saveProgress();
  renderLessonList();
  $("#btnNext").classList.add("glow");
  setLessonMsg(L.success, "ok");
}

function loadLesson(i) {
  li = i;
  hintOn = false;
  const L = LESSONS[i];
  ({ board: lb, state: ls } = lessonStart(L));
  $("#lessonStep").textContent = `Lesson ${i + 1} of ${LESSONS.length}`;
  $("#lessonTitle").textContent = L.title;
  $("#lessonText").innerHTML = L.text;
  $("#quizBox").classList.toggle("hidden", !L.quiz);
  if (L.quiz) { $("#quizQ").textContent = L.quiz.question; $("#quizInput").value = ""; }
  $("#btnHint").classList.toggle("hidden", !L.hint);
  $("#btnReset").classList.toggle("hidden", !!L.quiz || !!L.cta);
  $("#btnPrev").disabled = i === 0;
  $("#btnNext").innerHTML = i === LESSONS.length - 1 ? "Play a game &rarr;" : "Next &rarr;";
  $("#btnNext").classList.remove("glow");
  setLessonMsg("");
  if (L.auto) markSolved(L);
  renderLessonList();
  drawLearn();
}

learnView.onClick = (idx) => {
  const L = LESSONS[li];
  if (L.quiz || L.cta) return;
  const r = lessonMove(L, lb, ls, idx);
  hintOn = false;
  if (r.solved) {
    markSolved(L);
  } else if (!r.ok) {
    setLessonMsg(REJECT[r.reason] || "Can't play there.", "err");
  } else if (r.feedback) {
    setLessonMsg(r.feedback, "info");
  } else if (r.captured.length) {
    setLessonMsg(`Captured ${r.captured.length} stone${r.captured.length > 1 ? "s" : ""}.`, "info");
  } else {
    setLessonMsg("");
  }
  drawLearn();
};

function checkQuiz() {
  const L = LESSONS[li];
  if (!L.quiz) return;
  const v = parseInt($("#quizInput").value, 10);
  if (Number.isNaN(v)) { setLessonMsg("Enter a number first.", "err"); return; }
  if (v === L.quiz.answer(lb)) { markSolved(L); drawLearn(); }
  else setLessonMsg(L.quiz.wrong, "err");
}
$("#btnQuiz").addEventListener("click", checkQuiz);
$("#quizInput").addEventListener("keydown", (e) => { if (e.key === "Enter") checkQuiz(); });

$("#btnHint").addEventListener("click", () => {
  const L = LESSONS[li];
  hintOn = true;
  setLessonMsg(L.hintText || "Look at the highlighted points.", "info");
  drawLearn();
});
$("#btnReset").addEventListener("click", () => loadLesson(li));
$("#btnPrev").addEventListener("click", () => li > 0 && loadLesson(li - 1));
$("#btnNext").addEventListener("click", () => {
  if (li < LESSONS.length - 1) loadLesson(li + 1);
  else showTab("play");
});
$("#btnResetProgress").addEventListener("click", () => {
  progress = {};
  saveProgress();
  loadLesson(0);
});

/* ---------- glossary ---------- */
$("#glossaryList").innerHTML = GLOSSARY.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("");

/* ---------- scores ---------- */
let scores = [];
try { scores = JSON.parse(localStorage.getItem("go-scores") || "[]"); } catch (e) { scores = []; }
if (!Array.isArray(scores)) scores = [];
const saveScores = () => { try { localStorage.setItem("go-scores", JSON.stringify(scores)); } catch (e) { /* ignore */ } };

function renderScores() {
  const wins = scores.filter((r) => r.won).length;
  const total = scores.length;
  let streak = 0, streakWon = null;
  for (let i = total - 1; i >= 0; i--) {
    if (streakWon === null) streakWon = scores[i].won;
    if (scores[i].won !== streakWon) break;
    streak++;
  }
  const tile = (value, label) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
  $("#scoreStats").innerHTML =
    tile(total, "Games") + tile(wins, "Wins") + tile(total - wins, "Losses") +
    tile(total ? Math.round((wins / total) * 100) + "%" : "-", "Win rate") +
    tile(total ? `${streak}${streakWon ? "W" : "L"}` : "-", "Streak");

  if (!total) {
    $("#scoreHistory").innerHTML = `<p class="empty">No finished games yet. Play a game and it will show up here.</p>`;
  } else {
    const rows = scores.slice().reverse().slice(0, 50).map((r) => {
      const when = new Date(r.t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      return `<tr><td>${when}</td><td>${r.size}×${r.size}</td><td>${colorName(r.human)}</td>` +
        `<td>${r.black} – ${r.white}</td><td class="${r.won ? "win" : "loss"}">${r.won ? "Win" : "Loss"}</td></tr>`;
    }).join("");
    $("#scoreHistory").innerHTML =
      `<table class="history"><thead><tr><th>When</th><th>Board</th><th>You</th><th>Black – White</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  $("#gRecord").textContent = total ? `Your record: ${wins} win${wins === 1 ? "" : "s"}, ${total - wins} loss${total - wins === 1 ? "" : "es"}` : "";
}

// Saves the finished game; calling again (after dead stones change) updates the same entry.
function recordResult() {
  const g = game, sc = g.board.score(g.dead);
  if (sc.blackStones + sc.whiteStones === 0) return;
  const white = sc.white + g.komi;
  const entry = {
    size: g.size, human: g.human, black: sc.black, white,
    won: (sc.black > white ? BLACK : WHITE) === g.human,
  };
  if (g.record) Object.assign(g.record, entry);
  else {
    g.record = { t: new Date().toISOString(), ...entry };
    scores.push(g.record);
    if (scores.length > 200) scores.shift();
  }
  saveScores();
  renderScores();
}

function discardRecord() {
  if (!game.record) return;
  const k = scores.indexOf(game.record);
  if (k >= 0) scores.splice(k, 1);
  game.record = null;
  saveScores();
  renderScores();
}

$("#btnClearScores").addEventListener("click", () => {
  scores = [];
  if (game) game.record = null;
  saveScores();
  renderScores();
});

/* ---------- play ---------- */
const playView = new BoardView($("#playBoard"));
const KOMI = { 7: 9, 9: 7, 13: 7.5 };
let game = null;
let msgs = [];

function say(text, kind = "") {
  msgs.unshift({ text, kind });
  msgs = msgs.slice(0, 8);
}

function groupsOf(board, color) {
  const seen = new Set(), out = [];
  for (let i = 0; i < board.grid.length; i++) {
    if (board.grid[i] !== color || seen.has(i)) continue;
    const g = board.groupAt(i);
    g.stones.forEach((s) => seen.add(s));
    out.push(g);
  }
  return out;
}

function coach(includeOpponent) {
  const b = game.board, n = b.size;
  const mine = groupsOf(b, game.human).filter((g) => g.liberties.length === 1);
  for (const g of mine.slice(0, 2)) {
    say(`Careful: your group at ${coordName(g.stones[0], n)} is in atari (1 liberty). Extend it or capture a neighbor.`, "warn");
  }
  if (includeOpponent) {
    const theirs = groupsOf(b, game.ai).filter((g) => g.liberties.length === 1);
    for (const g of theirs.slice(0, 2)) {
      say(`Chance: the ${colorName(game.ai)} group at ${coordName(g.stones[0], n)} is in atari. You can capture it at ${coordName(g.liberties[0], n)}.`, "good");
    }
  }
}

const CAPTURE_FLASH_MS = 1000;

function newGame() {
  const size = parseInt($("#gSize").value, 10);
  const human = $("#gColor").value === "white" ? WHITE : BLACK;
  game = {
    board: new Board(size), human, ai: opp(human), size, komi: KOMI[size],
    over: false, passes: 0, undo: [], dead: new Set(), thinking: false, hint: null,
  };
  msgs = [];
  say(`New ${size}×${size} game. You are ${colorName(human)}. Komi is ${game.komi}.`);
  if (game.ai === BLACK) scheduleAI();
  else autoSuggest();
  drawGame();
}

function drawGame() {
  const g = game, b = g.board;
  playView.render(b, {
    ghost: !g.over && !g.thinking && b.turn === g.human ? g.human : 0,
    showLiberties: $("#gLibs").checked,
    highlights: g.hint !== null && g.hint >= 0 ? [g.hint] : [],
    territory: g.over ? b.score(g.dead).owner : null,
    dead: g.over ? g.dead : null,
  });

  let status;
  if (g.over) {
    const sc = b.score(g.dead);
    const white = sc.white + g.komi;
    const diff = Math.abs(sc.black - white);
    status = sc.black > white
      ? `Black wins by ${diff}`
      : `White wins by ${diff}`;
    $("#gCaptures").innerHTML =
      `Black: ${sc.blackStones} stones + ${sc.blackTerritory} territory = <b>${sc.black}</b><br>` +
      `White: ${sc.whiteStones} stones + ${sc.whiteTerritory} territory + ${g.komi} komi = <b>${white}</b><br>` +
      `<i>Click any dead stones to remove them from the count.</i>`;
  } else {
    status = g.thinking ? `${colorName(g.ai)} is thinking...` : `Your turn (${colorName(g.human)})`;
    $("#gCaptures").textContent = `Captured: Black ${b.captures[BLACK]}, White ${b.captures[WHITE]}`;
  }
  $("#gStatus").textContent = status;
  $("#btnPass").disabled = g.over || g.thinking;
  $("#btnSuggest").disabled = g.over || g.thinking;
  $("#btnEnd").disabled = g.over || g.thinking;
  $("#btnUndo").disabled = g.thinking || g.undo.length === 0;
  $("#gMsgs").innerHTML = msgs.map((m) => `<li class="${m.kind}">${m.text}</li>`).join("");
}

function scoreSummary() {
  const g = game, sc = g.board.score(g.dead);
  const white = sc.white + g.komi;
  const winner = sc.black > white ? "Black" : "White";
  return `Final score: Black ${sc.black} (${sc.blackStones} stones + ${sc.blackTerritory} territory), ` +
    `White ${white} (${sc.whiteStones} stones + ${sc.whiteTerritory} territory + ${g.komi} komi). ` +
    `${winner} wins by ${Math.abs(sc.black - white)}.`;
}

function endGame(reason = "Both players passed, so the game is over.") {
  game.over = true;
  game.thinking = false;
  say(`${reason} Click any dead stones (stones that would be captured) to remove them, and the score updates.`, "good");
  say(scoreSummary(), "good");
  recordResult();
  drawGame();
}

function scheduleAI() {
  if (game.over) return;
  game.thinking = true;
  drawGame();
  setTimeout(aiTurn, 450);
}

function aiTurn() {
  const g = game, b = g.board;
  if (g.over || b.turn !== g.ai) { g.thinking = false; drawGame(); return; }
  const mv = aiChoose(b, g.ai, g.komi);
  let capturedNow = [];
  if (mv < 0) {
    b.pass(g.ai);
    g.passes++;
    say(`${colorName(g.ai)} passes.`);
    if (g.passes >= 2) { endGame(); return; }
  } else {
    const r = b.play(mv, g.ai);
    capturedNow = r.captured;
    g.passes = 0;
    let text = `${colorName(g.ai)} plays ${coordName(mv, b.size)}.`;
    if (r.captured.length) text += ` It captured ${r.captured.length} of your stone${r.captured.length > 1 ? "s" : ""}.`;
    say(text);
    coach(true);
  }
  g.thinking = false;
  autoSuggest();
  drawGame();
  if (capturedNow.length) playView.flashCaptured(capturedNow, g.human, CAPTURE_FLASH_MS);
}

playView.onClick = (idx) => {
  const g = game, b = g.board;
  if (g.over) {
    if (b.grid[idx] === EMPTY) return;
    const grp = b.groupAt(idx);
    const isDead = g.dead.has(idx);
    for (const s of grp.stones) isDead ? g.dead.delete(s) : g.dead.add(s);
    recordResult();
    drawGame();
    return;
  }
  if (g.thinking || b.turn !== g.human) return;
  const snap = { board: b.clone(), passes: g.passes };
  const r = b.play(idx, g.human);
  if (!r.ok) { say(REJECT[r.reason] || "Can't play there.", "err"); drawGame(); return; }
  g.undo.push(snap);
  g.passes = 0;
  g.hint = null;
  if (r.captured.length) say(`You captured ${r.captured.length} stone${r.captured.length > 1 ? "s" : ""}.`, "good");
  coach(false);
  scheduleAI();
  if (r.captured.length) playView.flashCaptured(r.captured, g.ai, CAPTURE_FLASH_MS);
};

$("#btnPass").addEventListener("click", () => {
  const g = game;
  if (g.over || g.thinking || g.board.turn !== g.human) return;
  g.undo.push({ board: g.board.clone(), passes: g.passes });
  g.board.pass(g.human);
  g.passes++;
  g.hint = null;
  say("You pass.");
  if (g.passes >= 2) endGame();
  else scheduleAI();
});

$("#btnUndo").addEventListener("click", () => {
  const g = game;
  const snap = g.undo.pop();
  if (!snap || g.thinking) return;
  g.board = snap.board;
  g.passes = snap.passes;
  g.over = false;
  g.dead.clear();
  g.hint = null;
  discardRecord();
  say("Move undone.");
  autoSuggest();
  drawGame();
});

function suggestMove() {
  const g = game;
  if (g.over || g.thinking || g.board.turn !== g.human) return;
  const mv = aiChoose(g.board, g.human, g.komi);
  if (mv < 0) { say("Suggestion: pass. Nothing useful is left to play.", "good"); g.hint = null; }
  else {
    g.hint = mv;
    say(`Suggestion: try ${coordName(mv, g.board.size)} (highlighted). ${explainMove(g.board, g.human, mv)}`, "good");
  }
}

function autoSuggest() {
  if ($("#gAutoSuggest").checked) suggestMove();
}

$("#btnSuggest").addEventListener("click", () => {
  suggestMove();
  drawGame();
});

$("#gAutoSuggest").addEventListener("change", () => {
  autoSuggest();
  drawGame();
});

$("#btnEnd").addEventListener("click", () => {
  if (game.over || game.thinking) return;
  endGame("You ended the game.");
});

$("#btnNew").addEventListener("click", newGame);
$("#gLibs").addEventListener("change", drawGame);

/* ---------- start ---------- */
loadLesson(0);
newGame();
renderScores();
