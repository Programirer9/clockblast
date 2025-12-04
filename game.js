/* BlockBlast — Enhanced
   Features:
   - Highscores (localStorage)
   - Coins + Shop + Joker
   - Daily Challenge (unique per date)
   - Mobile/touch support, animations
   - 9x9 board with 3 pieces / round
*/

// ---------- Config ----------
const ROWS = 9, COLS = 9;
const STORAGE_KEYS = {
  HIGHSCORES: 'bb_highscores_v1',
  COINS: 'bb_coins_v1',
  JOKERS: 'bb_jokers_v1',
  DAILY_CLAIMED: 'bb_daily_claim_v1'
};
const JOKER_COST = 50; // Münzen pro Joker
const DAILY_REWARD = 30; // Münzen bei Challenge-Erfolg

// ---------- DOM ----------
const boardEl = document.getElementById('board');
const piecesEl = document.getElementById('pieces');
const scoreSpan = document.getElementById('score');
const coinsSpan = document.getElementById('coins');
const restartBtn = document.getElementById('restartBtn');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModal');
const shopBtn = document.getElementById('shopBtn');
const challengeBtn = document.getElementById('challengeBtn');
const highscoreBtn = document.getElementById('highscoreBtn');
const useJokerBtn = document.getElementById('useJokerBtn');

let board = [];
let score = 0;
let coins = loadNumber(STORAGE_KEYS.COINS, 0);
let jokers = loadNumber(STORAGE_KEYS.JOKERS, 0);
let pieces = [];
let selectedPieceIdx = null;
let jokerMode = false;

// ---------- Shapes (extendable) ----------
const SHAPES = [
  [[1]], [[1,1]], [[1,1,1]], [[1],[1],[1]],
  [[1,1],[1,1]], [[1,0],[1,1]], [[0,1],[1,1]],
  [[1,1,1],[0,1,0]], [[1,1,0],[0,1,1]], [[1,1,1,1]],
  [[1,0,0],[1,1,1]], [[1,0],[1,0],[1,1]], [[1,1,0],[1,1,0]]
];

// ---------- Init ----------
function init() {
  initBoard();
  loadUI();
  generatePieces();
  render();
  attachHandlers();
  updateCoinsUI();
}
function initBoard() {
  board = Array.from({length: ROWS}, ()=> Array(COLS).fill(0));
}
function loadUI(){
  score = 0;
  updateScoreUI();
  updateCoinsUI();
}

// ---------- Rendering ----------
function render() {
  boardEl.innerHTML = '';
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (board[r][c] === 1) cell.classList.add('filled');
      cell.dataset.r = r; cell.dataset.c = c;
      cell.addEventListener('click', onCellClick);
      cell.addEventListener('touchstart', onCellTouchStart, {passive:true});
      boardEl.appendChild(cell);
    }
  }
  renderPieces();
}
function renderPieces(){
  piecesEl.innerHTML='';
  pieces.forEach((shape, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'piece';
    wrapper.style.gridTemplateColumns = `repeat(${shape[0].length}, 28px)`;
    shape.forEach(row=>{
      row.forEach(cell=>{
        const d = document.createElement('div');
        if (cell===0) d.style.visibility='hidden';
        wrapper.appendChild(d);
      });
    });
    wrapper.addEventListener('click', ()=>selectPiece(idx));
    // long press for drag (mobile hint) - small visual only
    wrapper.addEventListener('touchstart', ()=>selectPiece(idx), {passive:true});
    if (idx===selectedPieceIdx) wrapper.style.outline='3px solid #fff';
    piecesEl.appendChild(wrapper);
  });
}

// ---------- Input ----------
function attachHandlers(){
  restartBtn.addEventListener('click', ()=>{ if (confirm('Neustart?')) resetGame(); });
  shopBtn.addEventListener('click', openShop);
  closeModalBtn.addEventListener('click', closeModal);
  challengeBtn.addEventListener('click', openDailyChallenge);
  highscoreBtn.addEventListener('click', openHighscores);
  useJokerBtn.addEventListener('click', activateJokerMode);
  modal.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });
}

function onCellClick(e){
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  if (jokerMode){
    if (board[r][c] === 1){
      board[r][c] = 0;
      jokerMode = false;
      deductJokerUse();
      flashCell(r,c);
      saveState();
      render();
      return;
    } else {
      // invalid: must click a filled cell to use joker
      shakeElement(e.currentTarget);
      return;
    }
  }
  if (selectedPieceIdx == null) return; // no piece selected

  const shape = pieces[selectedPieceIdx];
  if (!canPlace(shape, r, c)){
    // invalid placement feedback
    const cellEl = e.currentTarget;
    shakeElement(cellEl);
    return;
  }
  placePieceAt(shape, r, c);
}

function onCellTouchStart(e){
  // placeholder for long-press drag extension
}

// ---------- Game Logic ----------
function generatePieces(){
  pieces = [];
  for (let i=0;i<3;i++){
    pieces.push(randomShape());
  }
  selectedPieceIdx = null;
  renderPieces();
}

function randomShape(){
  const s = JSON.parse(JSON.stringify(SHAPES[Math.floor(Math.random()*SHAPES.length)]));
  return s;
}

function selectPiece(idx){
  selectedPieceIdx = idx;
  renderPieces();
}

function canPlace(shape,r,c){
  for (let y=0;y<shape.length;y++)
    for (let x=0;x<shape[0].length;x++)
      if (shape[y][x]===1){
        if (r+y<0 || r+y>=ROWS || c+x<0 || c+x>=COLS) return false;
        if (board[r+y][c+x]===1) return false;
      }
  return true;
}

function placePieceAt(shape,r,c){
  // set cells
  for (let y=0;y<shape.length;y++)
    for (let x=0;x<shape[0].length;x++)
      if (shape[y][x]===1) board[r+y][c+x]=1;

  // score: 1 per block placed
  const placed = shape.flat().filter(v=>v===1).length;
  score += placed;
  updateScoreUI();

  // remove used piece and generate new set if all used
  pieces.splice(selectedPieceIdx,1);
  if (pieces.length===0) generatePieces();

  // clear lines/blocks
  const removed = clearLinesAndBlocks();
  if (removed>0){
    score += removed*2; // bonus
    playClearAnimation();
  }

  // small cell flash for recently placed cells
  flashPlaced(shape,r,c);

  selectedPieceIdx = null;
  render();
  saveState();

  // check game over
  if (isGameOver()){
    handleGameOver();
  }
}

// clears full rows, full columns and full 3x3 blocks; returns total removed cells
function clearLinesAndBlocks(){
  let removed = 0;
  // rows
  for (let r=0;r<ROWS;r++){
    if (board[r].every(v=>v===1)){
      board[r] = Array(COLS).fill(0);
      removed += COLS;
    }
  }
  // cols
  for (let c=0;c<COLS;c++){
    let full=true;
    for (let r=0;r<ROWS;r++) if (board[r][c]===0) full=false;
    if (full){
      for (let r=0;r<ROWS;r++) board[r][c]=0;
      removed += ROWS;
    }
  }
  // 3x3 blocks
  for (let br=0;br<ROWS;br+=3){
    for (let bc=0;bc<COLS;bc+=3){
      let full=true;
      for (let r=0;r<3;r++) for (let c=0;c<3;c++) if (board[br+r][bc+c]===0) full=false;
      if (full){
        for (let r=0;r<3;r++) for (let c=0;c<3;c++) board[br+r][bc+c]=0;
        removed += 9;
      }
    }
  }
  return removed;
}

// is there at least one placement among current pieces?
function isGameOver(){
  for (const shape of pieces){
    for (let r=0;r<ROWS;r++){
      for (let c=0;c<COLS;c++){
        if (canPlace(shape,r,c)) return false;
      }
    }
  }
  return true;
}

function handleGameOver(){
  // try to add to highscores
  const highs = loadHighscores();
  const lowestTop = highs.length<10 ? 0 : highs[highs.length-1].score;
  if (highs.length<10 || score>lowestTop){
    // prompt name input in modal
    openModal(`<h3>Highscore!</h3>
      <p>Dein Score: <strong>${score}</strong></p>
      <label>Dein Name: <input id="hsName" maxlength="12" /></label>
      <button id="saveHS" class="primary">Speichern</button>`);
    document.getElementById('saveHS').addEventListener('click', ()=>{
      const name = document.getElementById('hsName').value || 'Spieler';
      addHighscore({name,score,date:(new Date()).toISOString()});
      closeModal();
      openHighscores();
      resetGame();
    });
  } else {
    openModal(`<h3>Game Over</h3><p>Dein Score: <strong>${score}</strong></p><button id="okbtn" class="primary">OK</button>`);
    document.getElementById('okbtn').addEventListener('click', ()=>{ closeModal(); resetGame(); });
  }
}

// ---------- UI helpers ----------
function updateScoreUI(){ scoreSpan.textContent = score; }
function updateCoinsUI(){
  coinsSpan.textContent = coins;
  // show jokers count on button
  useJokerBtn.textContent = `Joker benutzen (${jokers})`;
}

function selectPieceByIndex(i){
  selectedPieceIdx = i;
  renderPieces();
}
function flashPlaced(shape, r, c){
  // flash cells where piece was placed
  setTimeout(()=> {
    for (let y=0;y<shape.length;y++){
      for (let x=0;x<shape[0].length;x++){
        if (shape[y][x]===1) flashCell(r+y, c+x);
      }
    }
  }, 40);
}
function flashCell(r,c){
  const idx = r*COLS + c;
  const el = boardEl.children[idx];
  if (!el) return;
  el.classList.add('flash');
  setTimeout(()=>el.classList.remove('flash'), 420);
}
function shakeElement(el){
  el.style.transition='transform 100ms';
  el.style.transform='translateX(-6px)';
  setTimeout(()=>el.style.transform='translateX(6px)',100);
  setTimeout(()=>{ el.style.transform=''; el.style.transition=''; },220);
}
function playClearAnimation(){
  // simple particle-like small animation: flash whole board container
  boardEl.parentElement.style.transition='box-shadow 260ms';
  boardEl.parentElement.style.boxShadow='0 8px 30px rgba(96,165,250,0.12)';
  setTimeout(()=>boardEl.parentElement.style.boxShadow='',260);
}

// ---------- Persistence ----------
function saveState(){
  localStorage.setItem(STORAGE_KEYS.COINS, String(coins));
  localStorage.setItem(STORAGE_KEYS.JOKERS, String(jokers));
  // highscores saved separately
}
function loadNumber(key, fallback){
  const v = localStorage.getItem(key);
  return v? Number(v) : fallback;
}

// ---------- Highscores ----------
function loadHighscores(){ 
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HIGHSCORES);
    return raw ? JSON.parse(raw) : [];
  } catch(e){ return []; }
}
function saveHighscores(list){ localStorage.setItem(STORAGE_KEYS.HIGHSCORES, JSON.stringify(list)); }
function addHighscore(entry){
  const hs = loadHighscores();
  hs.push(entry);
  hs.sort((a,b)=>b.score - a.score);
  if (hs.length>10) hs.length = 10;
  saveHighscores(hs);
}

// ---------- Shop / Joker ----------
function openShop(){
  openModal(`<h3>Shop</h3>
    <p>Joker entfernen eine belegte Zelle (nützlich wenn du festsitzt).</p>
    <p>Preis: <strong>${JOKER_COST} Münzen</strong></p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
      <button id="buyJoker" class="primary">Kaufen</button>
      <button id="closeShop">Schließen</button>
    </div>`);
  document.getElementById('buyJoker').addEventListener('click', ()=>{
    if (coins >= JOKER_COST){
      coins -= JOKER_COST; jokers += 1; saveState(); updateCoinsUI();
      alert('Joker gekauft!');
      closeModal();
    } else {
      alert('Nicht genug Münzen.');
    }
  });
  document.getElementById('closeShop').addEventListener('click', closeModal);
}

function activateJokerMode(){
  if (jokers <= 0){
    if (confirm('Keine Joker vorhanden. Direkt einen kaufen?')) {
      openShop();
    }
    return;
  }
  jokerMode = true;
  openModal('<h3>Joker aktiv</h3><p>Tippe eine belegte Zelle an, um sie zu entfernen.</p><button id="okJ" class="primary">OK</button>');
  document.getElementById('okJ').addEventListener('click', closeModal);
}

function deductJokerUse(){
  if (jokers>0) jokers -=1;
  saveState(); updateCoinsUI();
}

// ---------- Daily Challenge ----------
function openDailyChallenge(){
  // generate a deterministic challenge based on date
  const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  const seed = hashString(today);
  // simple challenge: clear at least N lines (rows/cols/blocks) OR reach X score
  const target = 3 + (seed % 4); // 3..6
  const desc = `Heute: Schaffe mindestens ${target} vollständige Reihen/Spalten/3×3-Blöcke.\nBelohnung: ${DAILY_REWARD} Münzen.`;
  const claimedList = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_CLAIMED)||'{}');
  const claimed = !!claimedList[today];
  const body = `<h3>Tägliche Challenge (${today})</h3><p>${desc}</p>
    <p>Status: <strong>${claimed ? 'Bereits eingelöst' : 'Nicht eingelöst'}</strong></p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
      <button id="startCh" class="primary">${claimed? 'OK':'Annehmen'}</button>
    </div>`;
  openModal(body);
  document.getElementById('startCh').addEventListener('click', ()=>{
    closeModal();
    if (claimed){ return; }
    // start challenge: set special board seeded by date for reproducibility
    startDailyChallenge(seed, target);
  });
}

let challengeActive = false;
let challengeTarget = 0;
let challengeCounter = 0;
let challengeDate = null;

function startDailyChallenge(seed, target){
  // deterministic board fill: use seed to place some prefilled cells
  initBoard();
  // Place some cells deterministically to provide a challenge
  for (let i=0;i<Math.min(28, (seed % 28) + 6); i++){
    const r = pseudoRand(seed, i) % ROWS;
    const c = pseudoRand(seed, i+7) % COLS;
    board[r][c] = 1;
  }
  generatePieces(); render();
  challengeActive = true;
  challengeTarget = target;
  challengeCounter = 0;
  challengeDate = new Date().toISOString().slice(0,10);
  openModal(`<h3>Challenge gestartet</h3><p>Versuche die Aufgabe: ${target} vollständige Linien/Blöcke löschen.</p><button id="okch" class="primary">OK</button>`);
  document.getElementById('okch').addEventListener('click', closeModal);
  // hook into clear function by wrapping clearLinesAndBlocks? we update in place: after each clear, check progress
}

// When lines/blocks are removed, caller adds bonus already. Track progress here:
// We'll patch clearLinesAndBlocks above like: after removal >0 then call updateChallenge(removedGroups)
// But to avoid refactor, we detect removed by comparing previous board snapshot before placement/clear — simpler: after every placePieceAt() call we compute how many full lines exist and count how many were removed this turn by comparing snapshot saved in placePieceAt. To keep concise, we will compute total clears so far by storing cumulative cleared count in localStorage for challenge. Implement helper:

function updateChallengeProgress(removedGroups){
  if (!challengeActive) return;
  challengeCounter += removedGroups;
  if (challengeCounter >= challengeTarget){
    // award coins once
    const today = challengeDate;
    const claimedList = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_CLAIMED)||'{}');
    if (!claimedList[today]){
      coins += DAILY_REWARD;
      saveState();
      claimedList[today] = { date: today, reward: DAILY_REWARD, score: score };
      localStorage.setItem(STORAGE_KEYS.DAILY_CLAIMED, JSON.stringify(claimedList));
      openModal(`<h3>Challenge geschafft!</h3><p>Du erhältst ${DAILY_REWARD} Münzen.</p><button id="okc" class="primary">OK</button>`);
      document.getElementById('okc').addEventListener('click', ()=>{ closeModal(); });
      updateCoinsUI();
    }
    challengeActive = false;
  }
}

// ---------- Utilities ----------
function resetGame(){
  initBoard();
  generatePieces();
  score = 0; updateScoreUI();
  selectedPieceIdx = null; jokerMode=false;
  render();
}

function openModal(html){
  modalBody.innerHTML = html;
  modal.classList.remove('hidden');
}
function closeModal(){ modal.classList.add('hidden'); modalBody.innerHTML=''; }

function openHighscores(){
  const hs = loadHighscores();
  const rows = hs.map((h,i)=>`<tr><td>${i+1}</td><td>${h.name}</td><td>${h.score}</td><td>${(new Date(h.date)).toLocaleDateString()}</td></tr>`).join('');
  const table = `<h3>Highscores</h3>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th>#</th><th>Name</th><th>Score</th><th>Datum</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Noch keine</td></tr>'}</tbody>
    </table>
    <div style="text-align:center;margin-top:10px"><button id="closeHS" class="primary">Schließen</button></div>`;
  openModal(table);
  document.getElementById('closeHS').addEventListener('click', closeModal);
}

// hash helpers
function hashString(s){
  let h=0;
  for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))>>>0;
  return h;
}
function pseudoRand(seed, i){
  // small deterministic pseudo RNG
  let x = (seed ^ (i*2654435761)) >>> 0;
  x = (x ^ (x<<13))>>>0;
  x = (x ^ (x>>>17))>>>0;
  return x;
}

// ---------- small patch: detect clears/groups removed by counting completed lines before and after ----------
function countCompleteGroups(boardState){
  let groups=0;
  // rows
  for (let r=0;r<ROWS;r++) if (boardState[r].every(v=>v===1)) groups++;
  for (let c=0;c<COLS;c++){
    let full=true; for (let r=0;r<ROWS;r++) if (boardState[r][c]===0) full=false;
    if (full) groups++;
  }
  for (let br=0;br<ROWS;br+=3) for (let bc=0;bc<COLS;bc+=3){
    let full=true; for (let r=0;r<3;r++) for (let c=0;c<3;c++) if (boardState[br+r][bc+c]===0) full=false;
    if (full) groups++;
  }
  return groups;
}

// We'll wrap placePieceAt to compute removed groups accurately
// To keep code organized, modify placePieceAt: compute groups before placement, after clear, compute removedGroups = (before + newPlacedPossibly) difference

// Replace original placePieceAt with a wrapper that uses existing functions:
(function patchPlaceFunction(){
  const origPlace = placePieceAt;
  // but placePieceAt defined earlier. Instead, we'll define a new function and overwrite
})();

// Because we structured code without hoisting for that refactor, easiest: create a new function that does same as earlier but includes group count tracking.
// For clarity, replace previous placePieceAt definition with the following implementation:

// remove previous definition if exists - in this single-file scenario we now redefine:

function placePieceAt(shape,r,c){
  // snapshot groups before
  const beforeGroups = countCompleteGroups(board);

  // set cells
  for (let y=0;y<shape.length;y++)
    for (let x=0;x<shape[0].length;x++)
      if (shape[y][x]===1) board[r+y][c+x]=1;

  // score: 1 per block placed
  const placed = shape.flat().filter(v=>v===1).length;
  score += placed;
  updateScoreUI();

  // remove used piece and generate new set if all used
  pieces.splice(selectedPieceIdx,1);
  if (pieces.length===0) generatePieces();

  // clear lines/blocks and count how many groups were removed
  // We'll perform clear in a loop to count groups removed sequentially
  let removedGroups = 0;
  let anyRemoved = false;
  do {
    const groupsBefore = countCompleteGroups(board);
    if (groupsBefore===0) break;
    // remove once (rows, cols, blocks) but only remove those that are currently full
    // rows
    for (let rr=0;rr<ROWS;rr++){
      if (board[rr].every(v=>v===1)){ board[rr] = Array(COLS).fill(0); anyRemoved=true; }
    }
    // cols
    for (let cc=0;cc<COLS;cc++){
      let full=true; for (let rr=0;rr<ROWS;rr++) if (board[rr][cc]===0) full=false;
      if (full){ for (let rr=0;rr<ROWS;rr++) board[rr][cc]=0; anyRemoved=true; }
    }
    // 3x3 blocks
    for (let br=0;br<ROWS;br+=3) for (let bc=0;bc<COLS;bc+=3){
      let full=true; for (let rr=0;rr<3;rr++) for (let cc=0;cc<3;cc++) if (board[br+rr][bc+cc]===0) full=false;
      if (full){ for (let rr=0;rr<3;rr++) for (let cc=0;cc<3;cc++) board[br+rr][bc+cc]=0; anyRemoved=true; }
    }
    const groupsAfter = countCompleteGroups(board);
    // groups removed this iteration = groupsBefore - groupsAfter (but simpler: increment removedGroups by number of clears we performed)
    // We'll approximate removedGroups++ for each iteration where anyRemoved is true, but since multiple groups can be removed simultaneously we compute difference:
    // Instead compute removed = groupsBefore (since after removal groups got reset) — so:
    removedGroups += groupsBefore;
    // loop again in case new groups formed
  } while (false);

  if (removedGroups>0){
    // award points for removed groups
    score += removedGroups * 9; // each group equals 9 cells cleared roughly (rows/cols/blocks) — approx scoring
    updateScoreUI();
    playClearAnimation();
    // update challenge progress with number of groups removed
    updateChallengeProgress(removedGroups);
  }

  // small cell flash for recently placed cells
  flashPlaced(shape,r,c);

  selectedPieceIdx = null;
  render();
  saveState();

  // check game over
  if (isGameOver()){
    handleGameOver();
  }
}

// ---------- boot ----------
init();
