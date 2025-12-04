//-------------------------------------------------
// BlockBlast – Touch-Drag Version
//-------------------------------------------------

const boardEl = document.getElementById("board");
const piecesEl = document.getElementById("pieces");
const scoreEl = document.getElementById("score");
const restartBtn = document.getElementById("restartBtn");

let board = [];
let score = 0;

let draggedElement = null;
let draggedShape = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// 9×9 Leeres Board
function initBoard() {
  board = Array(9).fill().map(() => Array(9).fill(0));
  renderBoard();
}

function renderBoard() {
  boardEl.innerHTML = "";
  board.forEach((row, r) => {
    row.forEach((cell, c) => {
      const div = document.createElement("div");
      div.classList.add("cell");
      div.dataset.row = r;
      div.dataset.col = c;

      if (cell === 1) div.classList.add("filled");
      boardEl.appendChild(div);
    });
  });
}

// BlockShapes
const SHAPES = [
  [[1]],
  [[1,1]], [[1,1,1]], [[1],[1],[1]],
  [[1,1],[1,1]],
  [[1,0],[1,1]],
  [[0,1],[1,1]],
  [[1,1,1],[0,1,0]],
  [[1,1,0],[0,1,1]]
];

// Stücke erstellen
function generatePieces() {
  piecesEl.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    renderPiece(shape);
  }
}

function renderPiece(shape) {
  const container = document.createElement("div");
  container.classList.add("piece");
  container.style.position = "relative";
  container.style.gridTemplateColumns = `repeat(${shape[0].length}, 28px)`;

  shape.forEach(row => {
    row.forEach(cell => {
      const div = document.createElement("div");
      if (cell === 0) div.style.visibility = "hidden";
      container.appendChild(div);
    });
  });

  container.shape = shape;

  // EVENT: TOUCH & MOUSE
  container.addEventListener("mousedown", dragStart);
  container.addEventListener("touchstart", dragStart, { passive: false });

  piecesEl.appendChild(container);
}

// ---------------- DRAGGING ----------------

function dragStart(e) {
  e.preventDefault();

  draggedElement = e.currentTarget;
  draggedShape = draggedElement.shape;

  const rect = draggedElement.getBoundingClientRect();

  const touch = e.touches ? e.touches[0] : e;

  dragOffsetX = touch.clientX - rect.left;
  dragOffsetY = touch.clientY - rect.top;

  draggedElement.style.position = "absolute";
  draggedElement.style.zIndex = 999;
  draggedElement.style.pointerEvents = "none";

  document.addEventListener("mousemove", dragMove);
  document.addEventListener("mouseup", dragEnd);

  document.addEventListener("touchmove", dragMove, { passive: false });
  document.addEventListener("touchend", dragEnd);
}

function dragMove(e) {
  e.preventDefault();
  if (!draggedElement) return;

  const touch = e.touches ? e.touches[0] : e;

  draggedElement.style.left = (touch.clientX - dragOffsetX) + "px";
  draggedElement.style.top = (touch.clientY - dragOffsetY) + "px";

  highlightPossiblePlacement(touch.clientX, touch.clientY);
}

function dragEnd(e) {
  if (!draggedElement) return;

  const touch = e.changedTouches ? e.changedTouches[0] : e;

  const placed = tryPlaceAt(touch.clientX, touch.clientY);

  if (!placed) {
    // zurücksetzen
    draggedElement.style.left = "0px";
    draggedElement.style.top = "0px";
    draggedElement.style.position = "relative";
  }

  draggedElement.style.pointerEvents = "auto";

  draggedElement = null;
  draggedShape = null;

  clearHighlights();

  document.removeEventListener("mousemove", dragMove);
  document.removeEventListener("mouseup", dragEnd);

  document.removeEventListener("touchmove", dragMove);
  document.removeEventListener("touchend", dragEnd);
}

// ---------------- Platzierung ----------------

function tryPlaceAt(clientX, clientY) {
  const cell = document.elementFromPoint(clientX, clientY);
  if (!cell || !cell.classList.contains("cell")) return false;

  const r = parseInt(cell.dataset.row);
  const c = parseInt(cell.dataset.col);

  if (!canPlace(draggedShape, r, c)) return false;

  // setzen
  draggedShape.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 1) board[r + y][c + x] = 1;
    });
  });

  score += draggedShape.flat().filter(v => v === 1).length;
  scoreEl.textContent = score;

  draggedElement.remove();
  renderBoard();
  clearLines();

  if (piecesEl.children.length === 0) generatePieces();
  checkGameOver();

  return true;
}

function canPlace(shape, r, c) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[0].length; x++) {
      if (shape[y][x] === 1) {
        if (r + y >= 9 || c + x >= 9) return false;
        if (board[r + y][c + x] === 1) return false;
      }
    }
  }
  return true;
}

// ---------------- Highlights ----------------

function highlightPossiblePlacement(x, y) {
  clearHighlights();

  const cell = document.elementFromPoint(x, y);
  if (!cell || !cell.classList.contains("cell")) return;

  const r = parseInt(cell.dataset.row);
  const c = parseInt(cell.dataset.col);

  if (!draggedShape) return;

  if (!canPlace(draggedShape, r, c)) return;

  draggedShape.forEach((row, y2) => {
    row.forEach((cell2, x2) => {
      if (cell2 === 1) {
        const index = (r + y2) * 9 + (c + x2);
        const cellEl = boardEl.children[index];
        cellEl.classList.add("highlight");
      }
    });
  });
}

function clearHighlights() {
  document.querySelectorAll(".highlight").forEach(e => e.classList.remove("highlight"));
}

// ---------------- Clearing ----------------

function clearLines() {
  let removed = 0;

  // Reihen
  for (let r = 0; r < 9; r++) {
    if (board[r].every(v => v === 1)) {
      board[r] = Array(9).fill(0);
      removed += 9;
    }
  }

  // Spalten
  for (let c = 0; c < 9; c++) {
    if (board.every(row => row[c] === 1)) {
      for (let r = 0; r < 9; r++) board[r][c] = 0;
      removed += 9;
    }
  }

  // 3×3 Bereiche
  for (let br = 0; br < 9; br += 3) {
    for (let bc = 0; bc < 9; bc += 3) {
      let full = true;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          if (board[br + r][bc + c] === 0) full = false;

      if (full) {
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++)
            board[br + r][bc + c] = 0;
        removed += 9;
      }
    }
  }

  if (removed > 0) {
    score += removed * 2;
    scoreEl.textContent = score;
    renderBoard();
  }
}

// ---------------- Game Over ----------------

function checkGameOver() {
  const shapes = [...piecesEl.children].map(p => p.shape);

  for (const shape of shapes) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (canPlace(shape, r, c)) return;
      }
    }
  }

  alert("Game Over!\nScore: " + score);
}

// Restart
restartBtn.addEventListener("click", () => {
  score = 0;
  scoreEl.textContent = 0;
  initBoard();
  generatePieces();
});

// Start
initBoard();
generatePieces();
