"use strict";

// Coordinates are [x, y] with (0,0) at the top-left.
// goal(ctx): ctx = { board, state: {moves, captured, rejected}, }
const atGroup = (b, x, y) => b.groupAt(b.idx(x, y));

// The ko / two-eyes shapes are drawn compactly then shifted into place.
const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);

const EYE_SPACE = {
  size: 7,
  white: [[0, 1], [1, 1], [2, 1], [3, 1], [3, 0]],
};

const SCORING_POSITION = {
  size: 7,
  black: [0, 1, 2, 3, 4, 5, 6].map((y) => [2, y]).concat([[3, 0]]),
  white: [0, 1, 2, 3, 4, 5, 6].map((y) => [4, y]),
};

const LESSONS = [
  {
    title: "The board and the stones",
    size: 9,
    player: "both",
    text: `
      <p>Go is played by two players, <b class="b">Black</b> and <b class="w">White</b>, who take turns placing one stone at a time. Black moves first.</p>
      <p>Stones go on the <b>intersections</b> of the lines, not inside the squares. Once placed, a stone never moves (it can only be captured and removed).</p>
      <p>The goal of the game is to <b>surround more of the board</b> than your opponent.</p>
      <p class="task">Try it: click on the board to place 4 stones. Colors alternate automatically.</p>`,
    goal: ({ state }) => state.moves >= 4,
    success: "Nice. That is the whole mechanic of placing stones. Now let's see how stones live and die.",
  },
  {
    title: "Liberties",
    size: 7,
    black: [[3, 3], [0, 3], [0, 0]],
    player: "both",
    showLiberties: true,
    text: `
      <p>A stone's <b>liberties</b> are the empty points directly next to it (up, down, left, right, never diagonal).</p>
      <p>The number on each stone shows how many liberties it has. A stone in the center has <b>4</b>, on an edge <b>3</b>, in a corner only <b>2</b>.</p>
      <p>Stones of the same color that touch form a <b>group</b> and share their liberties.</p>
      <p class="task">Try it: place a few stones next to the existing ones and watch the numbers change. Hover a stone to see exactly where its liberties are.</p>`,
    goal: ({ state }) => state.moves >= 3,
    success: "Right: enemy stones and your own stones both take away liberties.",
  },
  {
    title: "Counting liberties",
    size: 7,
    black: [[2, 2], [3, 2], [3, 3]],
    white: [[4, 2]],
    player: "both",
    quiz: {
      question: "How many liberties does the Black group have?",
      answer: (b) => atGroup(b, 3, 3).liberties.length,
      wrong: "Not quite. Count the empty points touching <i>any</i> stone of the group, counting shared points only once. Hover the group to see them.",
    },
    text: `
      <p>Count the liberties of the three-stone Black group. Remember: empty points only, and a point shared by two stones counts once.</p>
      <p class="task">Type your answer below. Hovering over the group highlights its liberties if you need help.</p>`,
    success: "Correct. Counting liberties is the most important skill in Go: it tells you who is winning every fight.",
  },
  {
    title: "Capturing a stone",
    size: 7,
    black: [[2, 3], [4, 3], [3, 2]],
    white: [[3, 3]],
    player: "black",
    text: `
      <p>When a stone (or group) has <b>no liberties left</b>, it is <b>captured</b>: you remove it from the board. Captured stones count in your favor at the end.</p>
      <p>The White stone here has just one liberty left.</p>
      <p class="task">You are Black. Capture the White stone.</p>`,
    hint: [[3, 4]],
    hintText: "Play on the last empty point next to the White stone.",
    goal: ({ state }) => state.captured >= 1,
    success: "Captured! When a group is down to one liberty it is in <b>atari</b>, which is the next lesson.",
  },
  {
    title: "Capturing on the edge",
    size: 7,
    white: [[3, 0], [0, 6]],
    player: "black",
    text: `
      <p>Stones on the edge have fewer liberties, so they are easier to capture. A stone on the edge has 3 liberties, and a stone in the corner has only 2.</p>
      <p class="task">You are Black. Capture <b>both</b> White stones. You can place as many Black stones in a row as you need.</p>`,
    hint: [[2, 0], [4, 0], [3, 1], [0, 5], [1, 6]],
    hintText: "Surround each stone on all of its open sides: three points for the edge stone, two for the corner stone.",
    goal: ({ state }) => state.captured >= 2,
    success: "Both captured. Edges and corners are weak places to be, which is why strong players avoid them early on.",
  },
  {
    title: "Capturing a group",
    size: 7,
    black: [[2, 3], [4, 3], [2, 4], [4, 4], [3, 2]],
    white: [[3, 3], [3, 4]],
    player: "black",
    text: `
      <p>Connected stones live and die together. To capture a group you must fill <b>all</b> of its liberties.</p>
      <p class="task">You are Black. The White pair has just one liberty left. Capture both stones with one move.</p>`,
    hint: [[3, 5]],
    hintText: "Look for the one empty point touching the White pair.",
    goal: ({ state }) => state.captured >= 2,
    success: "Two stones in one move.",
  },
  {
    title: "Atari",
    size: 7,
    black: [[2, 3], [3, 2]],
    white: [[3, 3]],
    player: "black",
    text: `
      <p>When a group has exactly <b>one liberty</b>, it is in <b>atari</b> (a Japanese term roughly meaning "about to be captured"). It is polite, and often smart, to notice atari before it happens.</p>
      <p>Right now the White stone has two liberties.</p>
      <p class="task">You are Black. Put the White stone in atari by reducing it to a single liberty.</p>`,
    hint: [[4, 3], [3, 4]],
    hintText: "Either of these two points leaves the White stone with a single liberty.",
    goal: ({ board }) => {
      const g = atGroup(board, 3, 3);
      return g && g.liberties.length === 1;
    },
    success: "That's atari. If White ignores it, you capture next move. Notice you did not capture yet, you only threatened to.",
  },
  {
    title: "Escaping from atari",
    size: 7,
    black: [[3, 3]],
    white: [[2, 3], [4, 3], [3, 2]],
    player: "black",
    text: `
      <p>Your stone is in atari! If you do nothing, White captures it. The usual defense is to <b>extend</b>: add a stone to the group so it gains new liberties.</p>
      <p class="task">You are Black. Save your stone by giving the group at least 2 liberties.</p>`,
    hint: [[3, 4]],
    hintText: "Extend toward the only open side.",
    goal: ({ board }) => {
      const g = atGroup(board, 3, 3);
      return g && g.liberties.length >= 2;
    },
    success: "Saved. (Sometimes running just delays the capture, but that is a topic for later: look up \"ladders\" when you're ready.)",
  },
  {
    title: "The suicide rule",
    size: 7,
    white: [[1, 0], [0, 1], [1, 1]],
    player: "black",
    text: `
      <p>You may not play a stone that would have <b>no liberties</b> afterward, unless that move captures something. This is the <b>suicide rule</b>.</p>
      <p class="task">You are Black. Try to play in the corner (the top-left point). The game will refuse.</p>`,
    hint: [[0, 0]],
    hintText: "Click the corner point.",
    goal: ({ state }) => !!state.rejected.suicide,
    success: "Illegal, because that stone would have been captured the instant it was placed. But there is an exception, coming next.",
  },
  {
    title: "Capturing beats suicide",
    size: 7,
    black: [[2, 0], [1, 1], [0, 2]],
    white: [[1, 0], [0, 1]],
    player: "black",
    text: `
      <p>The corner point has no liberties for Black, <b>but</b> playing there removes the last liberty of both White stones. Captures are resolved first, so Black's stone ends up with liberties and the move is legal.</p>
      <p class="task">You are Black. Capture both White stones.</p>`,
    hint: [[0, 0]],
    hintText: "The corner again, but this time it captures.",
    goal: ({ state }) => state.captured >= 2,
    success: "Right. A move that captures is always legal, even if the stone would otherwise have no liberties.",
  },
  {
    title: "The ko rule",
    size: 7,
    black: shift([[1, 0], [0, 1], [1, 2]], 2, 2),
    white: shift([[1, 1], [2, 0], [3, 1], [2, 2]], 2, 2),
    player: "both",
    text: `
      <p>Look at the empty point in the middle of the shape. If Black plays there, White's stone is captured. But then White could capture Black's stone right back, then Black captures again, forever.</p>
      <p>The <b>ko rule</b> forbids this: you may not make a move that returns the board to the position it was in just before your opponent's last move. You must play somewhere else first, and ideally make a threat the opponent has to answer.</p>
      <p class="task">Black captures first. Then try to recapture as White immediately. The game will refuse.</p>`,
    hint: [[4, 3], [3, 3]],
    hintText: "Black plays the empty point inside the shape; White then tries the point just captured.",
    goal: ({ state }) => !!state.rejected.ko,
    success: "That is ko. The fights over a ko, with threats on both sides, are one of the most exciting parts of Go.",
  },
  {
    title: "Territory",
    ...SCORING_POSITION,
    black: [0, 1, 2, 3, 4, 5, 6].map((y) => [2, y]),
    player: "both",
    revealTerritory: true,
    quiz: {
      question: "How many empty points does Black surround (Black's territory)?",
      answer: (b) => b.score().blackTerritory,
      wrong: "Not quite. Only count empty points that touch <i>only</i> Black stones. The middle column touches both colors, so it belongs to nobody.",
    },
    text: `
      <p>At the end of the game, the winner is the player with more <b>territory</b>: empty points completely surrounded by their stones (plus, depending on the scoring rules, stones on the board or prisoners captured).</p>
      <p>Empty points that touch both colors belong to nobody (they are <b>neutral points</b>, or <i>dame</i>).</p>
      <p class="task">Count the empty points that only Black's wall touches. Left of the black wall, the points touch only Black.</p>`,
    success: "Correct! The shaded squares show the territory each side owns. The middle column is neutral.",
  },
  {
    title: "Counting the score",
    ...SCORING_POSITION,
    player: "both",
    revealTerritory: true,
    quiz: {
      question: "Using area scoring (stones + territory), what is Black's total?",
      answer: (b) => b.score().black,
      wrong: "Add Black's stones on the board to Black's territory. (Count carefully: there is one stone more than a straight wall.)",
    },
    text: `
      <p>This tutorial uses <b>area scoring</b> (the Chinese method): each player's score is the number of their stones on the board <b>plus</b> the empty points they surround. It's easy to count and gives nearly the same result as the Japanese method.</p>
      <p>Since Black moves first, White gets <b>komi</b>, bonus points added to White's score (usually 6.5 or 7.5), so ties are impossible.</p>
      <p class="task">Black has stones and territory. What is Black's total?</p>`,
    success: "Correct: Black has 22. White has 21 (7 stones + 14 territory). Without komi Black would win by 1, but with 6.5 komi White wins!",
  },
  {
    title: "Life: making two eyes",
    ...EYE_SPACE,
    player: "both",
    first: "white",
    text: `
      <p>Here's the big secret of Go. An <b>eye</b> is an empty point surrounded by one group. A group with <b>two separate eyes</b> can <b>never</b> be captured: to capture it you would have to fill both eyes, but filling either one is suicide!</p>
      <p>A group with two eyes is <b>alive</b>. A group that can't make two eyes will eventually die.</p>
      <p>White has a row of three empty points on the edge. You are White to play.</p>
      <p class="task">Play the vital point that splits this space into two eyes. Then, as Black, try to capture by playing inside an eye.</p>`,
    hint: [[1, 0]],
    hintText: "The middle point of the three. After it, the corner and the far point are both separate eyes.",
    goal: ({ board, state }) => board.grid[board.idx(1, 0)] === WHITE && !!state.rejected.suicide,
    feedback: ({ board, state, color }) => {
      if (color === WHITE && board.grid[board.idx(1, 0)] === WHITE && !state.rejected.suicide)
        return "Two eyes! Now it is Black's turn. Try to play inside either eye (the corner A7 or C7).";
      return null;
    },
    success: "Black can't play in either eye (that would be suicide), so White is alive for good.",
  },
  {
    title: "Death: the vital point",
    ...EYE_SPACE,
    player: "black",
    text: `
      <p>The same shape from Black's point of view. If it's Black's move, the same vital point is the way to kill the group.</p>
      <p>By taking the middle, Black stops White from making two eyes. White can capture that one stone but ends up with a single eye, which is not enough to live.</p>
      <p class="task">You are Black. Play the vital point that prevents White from making two eyes.</p>`,
    hint: [[1, 0]],
    hintText: "The middle of the three-point eye space.",
    goal: ({ board }) => board.grid[board.idx(1, 0)] === BLACK,
    success: "Killed. Whoever plays the vital point first wins the life-and-death fight. This is called <b>life and death</b>, the heart of Go strategy.",
  },
  {
    title: "Where to play first",
    size: 9,
    player: "both",
    highlight: [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]],
    text: `
      <p>With so many choices, where do you start? A good rule of thumb for the opening is <b>corners first, then sides, then center</b>. Corners are where you can make territory with the fewest stones, because the edges do half the work of walling you in.</p>
      <p>The marked points are common first moves on a 9×9 board. The center point is strong too.</p>
      <p>Other beginner tips:</p>
      <ul>
        <li>Keep your stones connected, or able to connect.</li>
        <li>Don't play on the very edge early on (the first line).</li>
        <li>Before every move, check your groups' liberties and your opponent's.</li>
      </ul>
      <p class="task">Place 4 stones, alternating colors, starting with the marked points.</p>`,
    goal: ({ state }) => state.moves >= 4,
    success: "You've got the basics. Time to play a real game against the computer.",
  },
  {
    title: "You're ready to play!",
    size: 9,
    player: "both",
    auto: true,
    cta: true,
    text: `
      <p>You now know the whole rule set of Go: stones, liberties, capture, atari, suicide, ko, territory, and two eyes.</p>
      <p>Everything else in Go grows from these few ideas. The best way to learn now is to play. The Play tab has a beginner-level computer opponent on small boards, a "Suggest a move" button and a coach that warns you when you're in atari.</p>
      <p>Don't worry about losing early games. Everyone does. Lose lots of games quickly and you'll improve fast!</p>`,
    success: "Good luck, have fun!",
  },
];

const GLOSSARY = [
  ["Atari", "A group with exactly one liberty left. It will be captured next move unless it escapes."],
  ["Capture", "Removing a group from the board when it has no liberties."],
  ["Dame", "A neutral point that neither player owns, usually on the boundary."],
  ["Eye", "An empty point surrounded by a single group. Two eyes make a group unconditionally alive."],
  ["Extend", "Adding a stone next to a group to give it more liberties."],
  ["Group", "Same-colored stones connected horizontally or vertically."],
  ["Handicap", "Extra stones given to the weaker player at the start to even the game."],
  ["Komi", "Points added to White's score to compensate for Black's first move."],
  ["Ko", "A shape where two players could recapture one stone back and forth forever. The ko rule forbids immediate recapture."],
  ["Liberty", "An empty point adjacent (up, down, left or right) to a stone or group."],
  ["Seki", "A standoff where neither side can capture the other, so both groups live without two eyes."],
  ["Star point", "The small dots on the board, handy for orientation and the usual first-move spots."],
  ["Suicide", "Playing a stone with no liberties without capturing anything. Illegal."],
  ["Territory", "Empty points surrounded by one player's stones."],
  ["Ladder", "A chase where one side keeps putting the other in atari, and the runner stays in atari every move."],
  ["Life and death", "Whether a group can make two eyes (alive) or not (dead)."],
];

function lessonStart(L) {
  const board = new Board(L.size).setup(L.black || [], L.white || []);
  board.turn = L.first === "white" ? WHITE : BLACK;
  const state = { moves: 0, captured: 0, rejected: {}, done: false };
  return { board, state };
}

function lessonColor(L, board) {
  return L.player === "black" ? BLACK : L.player === "white" ? WHITE : board.turn;
}

// Applies a click to a lesson. Returns { ok, reason?, captured?, color, feedback, solved }.
function lessonMove(L, board, state, idx) {
  const color = lessonColor(L, board);
  const r = board.play(idx, color);
  if (!r.ok) {
    state.rejected[r.reason] = true;
  } else {
    if (L.player !== "both") board.turn = color;
    state.moves++;
    state.captured += r.captured.length;
  }
  const ctx = { board, state, color };
  const solved = !state.done && !!L.goal && L.goal(ctx);
  if (solved) state.done = true;
  const feedback = L.feedback ? L.feedback(ctx) : null;
  return { ...r, color, feedback, solved };
}
