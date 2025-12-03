// Block Blast Neo — Deluxe
/* Features:
 - Touch-Play (pointer events)
 - Savegame + Highscore
 - Daily Challenge (deterministic per date)
 - Themes/Skins (persistiert)
 - Particles on clear
 - WebAudio sound effects + optional background music
*/

// ====== Config ======
const GRID = 10;
const SAVE_PREFIX = "bbv2_"; // key prefix

// ====== State ======
let grid = [];
let score = 0;
let highscore = 0;
let pieces = [];
let selectedPiece = 0;
let dragPiece = null;
let ghostCells = [];
let particlesEnabled = true;
let soundEnabled = true;
let musicEnabled = false;
let currentTheme = localStorage.getItem(SAVE_PREFIX + "theme") || "neon";

// ====== DOM ======
const boardEl = document.getElementById("board");
const piecesEl = document.getElementById("pieces");
const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const overlay = document.getElementById("overlay");
const finalScoreEl = document.getElementById("finalScore");
const hintEl = document.getElementById("hint");
const particlesCanvas = document.getElementById("particles");
const challengeInfo = document.getElementById("challengeInfo");
const claimChallengeBtn = document.getElementById("claimChallenge");
const challengeStatus = document.getElementById("challengeStatus");

const themeSelect = document.getElementById("themeSelect");
const toggleParticles = document.getElementById("toggleParticles");
const toggleSound = document.getElementById("toggleSound");
const toggleMusic = document.getElementById("toggleMusic");

// ====== Audio (WebAudio simple synth) ======
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let musicOsc = null;
function playTone(freq=440, time=0.06, type='sine', gain=0.12){
  if(!soundEnabled) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + time);
}
function playPlace(){ playTone(880, 0.06, 'sine', 0.08); }
function playClear(){ playTone(520, 0.14, 'triangle', 0.14); playTone(760, 0.08, 'sine', 0.06); }
function playGameOver(){ playTone(200, 0.4, 'sawtooth', 0.2); }
function startMusic(){ if(!musicEnabled) return; if(musicOsc) return;
  musicOsc = audioCtx.createOscillator(); musicOsc.type='sine'; musicOsc.frequency.value = 220;
  const g = audioCtx.createGain(); g.gain.value = 0.02;
  musicOsc.connect(g); g.connect(audioCtx.destination);
  musicOsc.start();
}
function stopMusic(){ if(musicOsc){ musicOsc.stop(); musicOsc.disconnect(); musicOsc=null; } }

// ====== Shapes (original-like) ======
const SHAPES = [
  [[0,0]],
  [[0,0],[1,0]],
  [[0,0],[0,1]],
  [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[1,0],[0,1],[1,1]],
  [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],
  [[0,0],[0,1],[0,2],[1,2]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[1,0],[1,1],[1,2]],
  [[0,2],[1,2],[2,2],[2,1]],
  [[0,0],[1,0],[2,0],[1,1]],
  [[1,0],[0,1],[1,1],[2,1]],
  [[0,0],[1,0],[1,1],[2,1]],
  [[1,0],[0,1],[1,1],[0,2]],
  [[1,0],[0,1],[1,1],[2,1],[1,2]],
  [[0,0],[0,1],[0,2],[0,3],[1,3]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]]
];

const COLORS = ["#4fd1c5","#90cdf4","#f6ad55","#fc8181","#b794f4","#fbd38d","#9ae6b4"];

// ====== Utilities ======
function randPiece(){
  return { cells: SHAPES[Math.floor(Math.random()*SHAPES.length)], color: COLORS[Math.floor(Math.random()*COLORS.length)] };
}
function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function saveState(){
  localStorage.setItem(SAVE_PREFIX + "grid", JSON.stringify(grid));
  localStorage.setItem(SAVE_PREFIX + "score", score);
  localStorage.setItem(SAVE_PREFIX + "pieces", JSON.stringify(pieces));
  localStorage.setItem(SAVE_PREFIX + "highscore", highscore);
  localStorage.setItem(SAVE_PREFIX + "theme", currentTheme);
  localStorage.setItem(SAVE_PREFIX + "particles", particlesEnabled ? "1":"0");
  localStorage.setItem(SAVE_PREFIX + "sound", soundEnabled ? "1":"0");
  localStorage.setItem(SAVE_PREFIX + "music", musicEnabled ? "1":"0");
}
function loadState(){
  const g = localStorage.getItem(SAVE_PREFIX + "grid");
  if(g){
    grid = JSON.parse(g);
    score = parseInt(localStorage.getItem(SAVE_PREFIX + "score")||"0");
    pieces = JSON.parse(localStorage.getItem(SAVE_PREFIX + "pieces")||"[]");
    highscore = parseInt(localStorage.getItem(SAVE_PREFIX + "highscore")||"0");
    currentTheme = localStorage.getItem(SAVE_PREFIX + "theme")||currentTheme;
    particlesEnabled = localStorage.getItem(SAVE_PREFIX + "particles") !== "0";
    soundEnabled = localStorage.getItem(SAVE_PREFIX + "sound") !== "0";
    musicEnabled = localStorage.getItem(SAVE_PREFIX + "music") === "1";
    return true;
  }
  return false;
}
function clearSave(){ localStorage.removeItem(SAVE_PREFIX + "grid"); localStorage.removeItem(SAVE_PREFIX + "pieces"); localStorage.removeItem(SAVE_PREFIX + "score"); }

// ====== Init ======
function init(){
  applyTheme(currentTheme);
  themeSelect.value = currentTheme;
  toggleParticles.checked = particlesEnabled;
  toggleSound.checked = soundEnabled;
  toggleMusic.checked = musicEnabled;

  if(!loadState()){
    grid = Array.from({length:GRID},()=>Array(GRID).fill(0));
    score = 0;
    pieces = [randPiece(), randPiece(), randPiece()];
    highscore = parseInt(localStorage.getItem(SAVE_PREFIX + "highscore")||"0");
  }

  renderBoard();
  renderPieces();
  updateScore();
  setupCanvas();
  showDailyChallenge();

  // hide loading screen smoothly
  setTimeout(()=>{
    const L = document.getElementById("loadingScreen");
    L.style.opacity = "0";
    setTimeout(()=>L.style.display = "none", 400);
  }, 700);
  if(musicEnabled) startMusic();
}

// ====== Board Render ======
function renderBoard(){
  boardEl.innerHTML = "";
  for(let r=0;r<GRID;r++){
    for(let c=0;c<GRID;c++){
      const cell = document.createElement("div");
      cell.className = "cell";
      if(grid[r][c]){ cell.style.background = grid[r][c]; cell.classList.add("occupied"); }
      cell.dataset.r = r; cell.dataset.c = c;
      cell.onpointerup = onCellPointerUp;
      boardEl.appendChild(cell);
    }
  }
}

// ====== Pieces ======
function renderPieces(){
  piecesEl.innerHTML = "";
  pieces.forEach((p,idx)=>{
    const wrap = document.createElement("div");
    wrap.className = "piece";
    wrap.dataset.index = idx;

    const mini = document.createElement("div"); mini.className = "mini";
    for(let i=0;i<18;i++){ const mc=document.createElement("div"); mc.className="mini-cell"; mini.appendChild(mc); }
    // place shape in mini
    const xs = p.cells.map(s=>s[0]), ys = p.cells.map(s=>s[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    p.cells.forEach(([x,y])=>{
      const nx = x - minX, ny = y - minY;
      const idxMini = ny*6 + nx;
      if(mini.children[idxMini]) mini.children[idxMini].style.background = p.color;
    });

    // pointer handlers for drag
    wrap.style.touchAction = "none";
    wrap.onpointerdown = startDrag;
    wrap.appendChild(mini);

    const useBtn = document.createElement("button");
    useBtn.textContent = (idx===selectedPiece) ? "Ausgewählt": "Wählen";
    useBtn.onclick = (e)=>{
      selectedPiece = idx; renderPieces();
    };
    wrap.appendChild(useBtn);

    piecesEl.appendChild(wrap);
  });
}

// ====== Drag & Drop / Touch ======
function startDrag(ev){
  ev.preventDefault();
  const index = parseInt(ev.currentTarget.dataset.index);
  dragPiece = pieces[index];
  selectedPiece = index;
  // capture pointer
  ev.currentTarget.setPointerCapture(ev.pointerId);
  ev.currentTarget.onpointermove = dragMove;
  ev.currentTarget.onpointerup = ev.currentTarget.onpointercancel = endDrag;
}
function dragMove(ev){
  ev.preventDefault();
  const hover = document.elementFromPoint(ev.clientX, ev.clientY);
  clearGhost();
  if(!hover) return;
  const r = parseInt(hover.dataset.r), c = parseInt(hover.dataset.c);
  if(Number.isFinite(r) && Number.isFinite(c)){
    const ok = canPlace(dragPiece, r, c);
    showGhost(dragPiece, r, c, ok);
  }
}
function endDrag(ev){
  ev.preventDefault();
  const hover = document.elementFromPoint(ev.clientX, ev.clientY);
  clearGhost();
  if(!hover) { dragPiece = null; return; }
  const r = parseInt(hover.dataset.r), c = parseInt(hover.dataset.c);
  if(Number.isFinite(r) && Number.isFinite(c) && dragPiece){
    if(canPlace(dragPiece, r, c)){
      place(dragPiece, r, c);
    } else {
      showHint("Kann hier nicht platziert werden.");
    }
  }
  dragPiece = null;
}

// also support click-to-place
function onCellPointerUp(ev){
  const r = parseInt(ev.currentTarget.dataset.r), c = parseInt(ev.currentTarget.dataset.c);
  if(pieces[selectedPiece]){
    if(canPlace(pieces[selectedPiece], r, c)){
      place(pieces[selectedPiece], r, c);
    } else showHint("Kann hier nicht platziert werden.");
  }
}

function showGhost(piece, r0, c0, fits){
  ghostCells = [];
  piece.cells.forEach(([dx,dy])=>{
    const rr = r0 + dy, cc = c0 + dx;
    if(rr>=0 && cc>=0 && rr<GRID && cc<GRID){
      const idx = rr*GRID + cc;
      const cell = boardEl.children[idx];
      if(cell){
        cell.classList.add(fits ? "ghost-ok" : "ghost-bad");
        ghostCells.push(cell);
      }
    }
  });
}
function clearGhost(){ ghostCells.forEach(c=>{ c.classList.remove("ghost-ok"); c.classList.remove("ghost-bad"); }); ghostCells = []; }

// ====== Placement / Clearing ======
function canPlace(piece, r0, c0){
  for(const [dx,dy] of piece.cells){
    const r = r0 + dy, c = c0 + dx;
    if(r<0||c<0||r>=GRID||c>=GRID) return false;
    if(grid[r][c] !== 0) return false;
  }
  return true;
}
function place(piece, r0, c0){
  piece.cells.forEach(([dx,dy])=>{
    grid[r0+dy][c0+dx] = piece.color;
  });
  pieces[selectedPiece] = randPiece();
  score += piece.cells.length;
  playPlace();
  const cleared = clearLines();
  if(cleared>0){
    playClear();
    if(particlesEnabled) spawnParticles(cleared);
  }
  updateScore();
  renderBoard();
  renderPieces();
  saveState();
  if(!movePossible()) gameOver();
}

function clearLines(){
  let cleared = 0;
  // rows
  for(let r=0;r<GRID;r++){
    if(grid[r].every(v=>v!==0)){
      grid[r].fill(0);
      cleared++;
    }
  }
  // cols
  for(let c=0;c<GRID;c++){
    let full = true;
    for(let r=0;r<GRID;r++){
      if(grid[r][c]===0){ full=false; break; }
    }
    if(full){
      for(let r=0;r<GRID;r++) grid[r][c]=0;
      cleared++;
    }
  }
  score += cleared*10;
  return cleared;
}
function updateScore(){
  scoreEl.textContent = score;
  if(score > highscore){
    highscore = score;
    localStorage.setItem(SAVE_PREFIX + "highscore", highscore);
  }
  highscoreEl.textContent = highscore;
}

// ====== Move possible check ======
function movePossible(){
  for(const p of pieces){
    for(let r=0;r<GRID;r++){
      for(let c=0;c<GRID;c++){
        if(canPlace(p,r,c)) return true;
      }
    }
  }
  return false;
}

// ====== Game Over ======
function gameOver(){
  finalScoreEl.textContent = "Dein Score: " + score;
  overlay.classList.remove("hidden");
  playGameOver();
  clearSave();
  stopMusic();
}

// ====== Buttons and controls ======
document.getElementById("swapBtn").onclick = ()=>{
  pieces = [randPiece(), randPiece(), randPiece()];
  selectedPiece = 0;
  renderPieces();
  showHint("Neue Bausteine!");
  saveState();
};

document.getElementById("restartBtn").onclick = ()=>{
  clearSave();
  location.reload();
};
document.getElementById("tryAgain").onclick = ()=>{
  overlay.classList.add("hidden");
  clearSave();
  init();
};

// Theme toggle
themeSelect.onchange = (e)=>{
  currentTheme = e.target.value;
  applyTheme(currentTheme);
  localStorage.setItem(SAVE_PREFIX + "theme", currentTheme);
};
toggleParticles.onchange = (e)=>{
  particlesEnabled = e.target.checked;
  localStorage.setItem(SAVE_PREFIX + "particles", particlesEnabled ? "1":"0");
};
toggleSound.onchange = (e)=>{
  soundEnabled = e.target.checked;
  localStorage.setItem(SAVE_PREFIX + "sound", soundEnabled ? "1":"0");
};
toggleMusic.onchange = (e)=>{
  musicEnabled = e.target.checked;
  if(musicEnabled) startMusic(); else stopMusic();
  localStorage.setItem(SAVE_PREFIX + "music", musicEnabled ? "1":"0");
};

// Hint helper
function showHint(msg, ms=900){ hintEl.textContent = msg; setTimeout(()=>{ if(hintEl.textContent === msg) hintEl.textContent = ""; }, ms); }

// ====== Theme application ======
function applyTheme(name){
  document.body.classList.remove("theme-dark","theme-retro","theme-pastel");
  if(name === "dark") document.body.classList.add("theme-dark");
  if(name === "retro") document.body.classList.add("theme-retro");
  if(name === "pastel") document.body.classList.add("theme-pastel");
}

// ====== PARTICLES (Canvas) ======
let ctx = null, parts = [];
function setupCanvas(){
  particlesCanvas.width = boardEl.clientWidth;
  particlesCanvas.height = boardEl.clientHeight;
  particlesCanvas.style.width = boardEl.clientWidth + "px";
  particlesCanvas.style.height = boardEl.clientHeight + "px";
  ctx = particlesCanvas.getContext("2d");
  requestAnimationFrame(particleLoop);
  window.addEventListener("resize", ()=> {
    particlesCanvas.width = boardEl.clientWidth;
    particlesCanvas.height = boardEl.clientHeight;
  });
}
function spawnParticles(mult=1){
  if(!ctx || !particlesEnabled) return;
  const count = 18 * mult;
  for(let i=0;i<count;i++){
    parts.push({
      x: Math.random()*particlesCanvas.width,
      y: Math.random()*particlesCanvas.height,
      vx: (Math.random()-0.5)*6,
      vy: (Math.random()-1.5)*8,
      life: 40 + Math.random()*40,
      color: COLORS[Math.floor(Math.random()*COLORS.length)],
      size: 3 + Math.random()*5
    });
  }
}
function particleLoop(){
  if(!ctx){ requestAnimationFrame(particleLoop); return; }
  ctx.clearRect(0,0,particlesCanvas.width,particlesCanvas.height);
  for(let i=parts.length-1;i>=0;i--){
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    ctx.globalAlpha = Math.max(0, p.life/80);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size,0,Math.PI*2); ctx.fill();
    if(p.life<=0) parts.splice(i,1);
  }
  requestAnimationFrame(particleLoop);
}

// ====== DAILY CHALLENGES ======
/*
 Deterministic daily challenge based on date string YYYY-MM-DD.
 Types: score, clearLines, placePieces, start-with-filled-tiles
*/
function getDateKey(d=new Date()){
  const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function hashString(s){
  // simple hash
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); }
  return Math.abs(h);
}
function getDailyChallenge(d=new Date()){
  const key = getDateKey(d);
  const h = hashString(key);
  const typeIdx = h % 4;
  if(typeIdx === 0){
    return { id: key, type: "score", target: 200 + (h % 201), desc: `Erreiche mindestens ${200 + (h % 201)} Punkte.` };
  } else if(typeIdx === 1){
    return { id: key, type: "clear", target: 2 + (h % 4), desc: `Lösche mindestens ${2 + (h % 4)} Reihen/Spalten.` };
  } else if(typeIdx === 2){
    return { id: key, type: "place", target: 15 + (h % 11), desc: `Platziere ${15 + (h % 11)} Bausteine (in einer Sitzung).` };
  } else {
    // start-with-filled: prefill some tiles
    const fill = (h % 8) + 4;
    return { id: key, type: "prefill", target: fill, desc: `Starte mit ${fill} zufälligen Feldern belegt.` , prefillCount: fill };
  }
}
function showDailyChallenge(){
  const chal = getDailyChallenge();
  challengeInfo.textContent = chal.desc;
  const completed = localStorage.getItem(SAVE_PREFIX + "challenge_" + chal.id) === "1";
  challengeStatus.textContent = completed ? "Bereits abgeschlossen ✅" : "Noch offen";
}
// Check challenge completion (some types need tracking)
let placedSinceLoad = 0, clearedSinceLoad = 0;
function checkDailyChallenge(){
  const chal = getDailyChallenge();
  let done = false;
  if(chal.type === "score"){
    done = score >= chal.target;
  } else if(chal.type === "clear"){
    // count total clears since last save; we'll check board emptiness? simpler: if total cleared lines stored >= target
    const clearedTotal = parseInt(localStorage.getItem(SAVE_PREFIX + "cleared_total") || "0");
    done = clearedTotal >= chal.target;
  } else if(chal.type === "place"){
    done = placedSinceLoad >= chal.target;
  } else if(chal.type === "prefill"){
    // win condition: finish a game (game over) with more than X empty? We'll mark completed when user achieves a certain score
    done = score >= 50 + chal.prefillCount*5;
  }
  if(done){
    const id = chal.id;
    localStorage.setItem(SAVE_PREFIX + "challenge_" + id, "1");
    challengeStatus.textContent = "Abgeschlossen ✅";
    showHint("Challenge abgeschlossen! 🎉");
  } else {
    showHint("Challenge noch nicht erfüllt.");
  }
}
claimChallengeBtn.onclick = checkDailyChallenge;

// ====== Save tracking for cleared lines and placed pieces ======
function recordCleared(n){ const prev = parseInt(localStorage.getItem(SAVE_PREFIX + "cleared_total")||"0"); localStorage.setItem(SAVE_PREFIX + "cleared_total", prev + n); clearedSinceLoad += n; }
function recordPlaced(){ placedSinceLoad++; const prev = parseInt(localStorage.getItem(SAVE_PREFIX + "placed_total")||"0"); localStorage.setItem(SAVE_PREFIX + "placed_total", prev + 1); }

// modify clearLines & place to call record*
const orig_clearLines = clearLinesFuncPlaceholder;
function clearLinesFuncPlaceholder(){ return 0; } // placeholder so linter won't complain

// We'll override clearLines function below (after declaring helper) — simpler: define real clearLines now:

function clearLines(){
  let cleared = 0;
  for(let r=0;r<GRID;r++){
    if(grid[r].every(v=>v!==0)){
      grid[r].fill(0);
      cleared++;
    }
  }
  for(let c=0;c<GRID;c++){
    let full = true;
    for(let r=0;r<GRID;r++){
      if(grid[r][c]===0){ full=false; break; }
    }
    if(full){
      for(let r=0;r<GRID;r++) grid[r][c]=0;
      cleared++;
    }
  }
  if(cleared>0){ recordCleared(cleared); }
  score += cleared*10;
  return cleared;
}

// Replace place function as well (define again)
function place(piece, r0, c0){
  piece.cells.forEach(([dx,dy])=>{
    grid[r0+dy][c0+dx] = piece.color;
  });
  pieces[selectedPiece] = randPiece();
  score += piece.cells.length;
  recordPlaced();
  playPlace();
  const cleared = clearLines();
  if(cleared>0){
    playClear();
    if(particlesEnabled) spawnParticles(cleared);
  }
  updateScore();
  renderBoard();
  renderPieces();
  saveState();
  if(!movePossible()) gameOver();
}

// ====== Random helpers ======
function randPiece(){ return { cells: SHAPES[Math.floor(Math.random()*SHAPES.length)], color: COLORS[Math.floor(Math.random()*COLORS.length)] }; }

// ====== Particles added earlier (redefine here for cohesion) ======
let ctx=null, parts=[];
function setupCanvas(){
  if(!particlesCanvas) return;
  particlesCanvas.width = boardEl.clientWidth;
  particlesCanvas.height = boardEl.clientHeight;
  ctx = particlesCanvas.getContext("2d");
  requestAnimationFrame(particleLoop);
  window.addEventListener("resize", ()=>{ particlesCanvas.width = boardEl.clientWidth; particlesCanvas.height = boardEl.clientHeight; });
}
function spawnParticles(mult=1){
  if(!ctx || !particlesEnabled) return;
  const count = 14 * Math.max(1,mult);
  for(let i=0;i<count;i++){
    parts.push({
      x: Math.random()*particlesCanvas.width,
      y: Math.random()*particlesCanvas.height,
      vx: (Math.random()-0.5)*6,
      vy: (Math.random()-1.5)*8,
      life: 40 + Math.random()*40,
      color: COLORS[Math.floor(Math.random()*COLORS.length)],
      size: 2 + Math.random()*4
    });
  }
}
function particleLoop(){
  if(!ctx){ requestAnimationFrame(particleLoop); return; }
  ctx.clearRect(0,0,particlesCanvas.width,particlesCanvas.height);
  for(let i=parts.length-1;i>=0;i--){
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life--;
    ctx.globalAlpha = Math.max(0, p.life/80);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size,0,Math.PI*2); ctx.fill();
    if(p.life <= 0) parts.splice(i,1);
  }
  requestAnimationFrame(particleLoop);
}

// ====== Audio playback wrappers used earlier (redefine for cohesion) ======
function playTone(freq=440, time=0.06, type='sine', gain=0.09){
  if(!soundEnabled) return;
  try{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + time);
  }catch(e){}
}
function playPlace(){ playTone(880, 0.06, 'sine', 0.06); }
function playClear(){ playTone(520, 0.12, 'triangle', 0.12); playTone(760, 0.08, 'sine', 0.05); }
function playGameOver(){ playTone(220, 0.5, 'sawtooth', 0.2); }
function startMusic(){ if(!musicEnabled) return; if(audioCtx.state === 'suspended') audioCtx.resume(); if(musicOsc) return; musicOsc = audioCtx.createOscillator(); musicOsc.type='sine'; musicOsc.frequency.value=220;
  const g = audioCtx.createGain(); g.gain.value = 0.02; musicOsc.connect(g); g.connect(audioCtx.destination); musicOsc.start(); }
function stopMusic(){ if(musicOsc){ try{ musicOsc.stop(); }catch(e){} musicOsc=null; } }

// ====== Daily Challenge: prefill handling (if today's is prefill) ======
function applyPrefillIfNeeded(){
  const chal = getDailyChallenge();
  if(chal.type === "prefill"){
    // if grid is empty, prefill N random empty cells with random colors
    const totalEmpty = grid.flat().filter(v=>v===0).length;
    if(totalEmpty === GRID*GRID){
      let n = chal.prefillCount;
      while(n>0){
        const r = Math.floor(Math.random()*GRID);
        const c = Math.floor(Math.random()*GRID);
        if(grid[r][c]===0){ grid[r][c] = COLORS[Math.floor(Math.random()*COLORS.length)]; n--; }
      }
    }
  }
}

// ====== Init final glue ======
init();

// call applyPrefillIfNeeded after init to modify grid if needed, then rerender
applyPrefillIfNeeded();
renderBoard();
saveState();
showDailyChallenge();
