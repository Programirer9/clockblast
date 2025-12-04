// BlockBlast — Vanilla JS Canvas Game
// Author: ChatGPT (provided as a ready-to-host example)
// Drop into index.html in the same folder.

(() => {
  // --- Canvas setup ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // HUD
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');

  // Controls
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const volume = document.getElementById('volume');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const overlayBtn = document.getElementById('overlayBtn');

  // Responsive canvas scaling (keeps logical resolution)
  const LOGICAL_WIDTH = 800;
  const LOGICAL_HEIGHT = 600;

  function resizeCanvas() {
    const ratio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    // Make canvas width fit container width
    const maxWidth = canvas.parentElement.clientWidth;
    let w = Math.min(LOGICAL_WIDTH, maxWidth);
    let h = Math.round(w / ratio);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    // keep actual canvas internal size fixed for consistent physics
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Game state ---
  let score = 0;
  let lives = 3;
  let level = 1;
  let running = false;
  let paused = false;

  // Paddle
  const paddle = {
    w: 120,
    h: 16,
    x: (LOGICAL_WIDTH - 120) / 2,
    y: LOGICAL_HEIGHT - 60,
    speed: 10,
    dx: 0
  };

  // Ball
  const ball = {
    r: 8,
    x: LOGICAL_WIDTH / 2,
    y: paddle.y - 10,
    speed: 6,
    dx: 0,
    dy: 0,
    stuck: true
  };

  // Bricks
  const brick = {
    rows: 5,
    cols: 10,
    w: 64,
    h: 22,
    padding: 8,
    offsetTop: 80,
    offsetLeft: 46
  };
  let bricks = [];

  // Audio (simple beep using WebAudio)
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function beep(freq = 440, time = 0.05, vol = 0.05) {
    if (volume.value == 0) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol * Number(volume.value);
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + time);
  }

  // Helpers
  function randColor(i, j) {
    // produce varied block colors by location
    const hue = Math.round(200 + (i * 20) + (j * 8)) % 360;
    const sat = 70;
    const light = 50 - i * 5;
    return `hsl(${hue}deg ${sat}% ${light}%)`;
  }

  function createBricks(rows = brick.rows) {
    bricks = [];
    for (let r = 0; r < rows; r++) {
      bricks[r] = [];
      for (let c = 0; c < brick.cols; c++) {
        const x = brick.offsetLeft + c * (brick.w + brick.padding);
        const y = brick.offsetTop + r * (brick.h + brick.padding);
        bricks[r][c] = {
          x, y,
          w: brick.w, h: brick.h,
          destroyed: false,
          color: randColor(r, c),
          hp: r < 1 ? 2 : 1 // top row tougher
        };
      }
    }
  }

  function resetBallAndPaddle() {
    paddle.x = (LOGICAL_WIDTH - paddle.w) / 2;
    paddle.y = LOGICAL_HEIGHT - 60;
    ball.x = LOGICAL_WIDTH / 2;
    ball.y = paddle.y - ball.r - 2;
    ball.dx = 0;
    ball.dy = 0;
    ball.stuck = true;
  }

  function startLevel(lv = 1) {
    level = lv;
    createBricks(Math.min(7, brick.rows + Math.floor((lv-1)/1))); // more rows each level up to a limit
    resetBallAndPaddle();
    score = score; // keep score
    updateHUD();
    showOverlay(`Level ${level}`, `Viel Erfolg!`, true);
  }

  // HUD update
  function updateHUD() {
    scoreEl.textContent = `Score: ${score}`;
    livesEl.textContent = `Lives: ${lives}`;
    levelEl.textContent = `Level: ${level}`;
  }

  // Draw functions
  function clear() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  function drawRoundedRect(x, y, w, h, r = 6) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawBackground() {
    // subtle gradient + grid
    const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    g.addColorStop(0, 'rgba(255,255,255,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,LOGICAL_WIDTH,LOGICAL_HEIGHT);
  }

  function drawPaddle() {
    ctx.fillStyle = '#f4f7fb';
    ctx.globalAlpha = 0.95;
    drawRoundedRect(paddle.x, paddle.y, paddle.w, paddle.h, 8);
    ctx.globalAlpha = 1;
  }

  function drawBall() {
    const gradient = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 2, ball.x, ball.y, ball.r);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#a6d5ff');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
    ctx.fill();
  }

  function drawBricks() {
    for (let r = 0; r < bricks.length; r++) {
      for (let c = 0; c < bricks[r].length; c++) {
        const b = bricks[r][c];
        if (!b || b.destroyed) continue;
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.95;
        drawRoundedRect(b.x, b.y, b.w, b.h, 6);

        // inner highlight
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = 'white';
        ctx.fillRect(b.x + 6, b.y + 4, b.w - 12, b.h - 8);
        ctx.globalAlpha = 1;

        // HP indicator
        if (b.hp > 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.hp, b.x + b.w/2, b.y + b.h/2);
        }
      }
    }
  }

  // Collision helpers
  function rectCircleColliding(cx, cy, r, rx, ry, rw, rh) {
    // Find closest point to circle within rectangle
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx*dx + dy*dy) <= r*r;
  }

  // Game loop
  function update() {
    if (!running || paused) return;

    // move paddle
    paddle.x += paddle.dx;
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.w > LOGICAL_WIDTH) paddle.x = LOGICAL_WIDTH - paddle.w;

    // ball stuck to paddle
    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 2;
    } else {
      ball.x += ball.dx;
      ball.y += ball.dy;
    }

    // wall collisions
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.dx *= -1; beep(800, 0.02); }
    if (ball.x + ball.r > LOGICAL_WIDTH) { ball.x = LOGICAL_WIDTH - ball.r; ball.dx *= -1; beep(800, 0.02); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.dy *= -1; beep(1000, 0.02); }

    // paddle collision
    if (rectCircleColliding(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, paddle.h) && ball.dy > 0) {
      // compute hit position - give angle based on where it hits the paddle
      const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1 .. 1
      const maxAngle = Math.PI / 3; // 60 degrees
      const angle = hitPos * maxAngle;
      const speed = Math.hypot(ball.dx, ball.dy) || ball.speed;
      ball.dx = speed * Math.sin(angle);
      ball.dy = -Math.abs(speed * Math.cos(angle));
      beep(1200, 0.02);
      // small nudge to avoid sticking
      ball.y = paddle.y - ball.r - 1;
    }

    // bricks collision
    outer: for (let r = 0; r < bricks.length; r++) {
      for (let c = 0; c < bricks[r].length; c++) {
        const b = bricks[r][c];
        if (!b || b.destroyed) continue;
        if (rectCircleColliding(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h)) {
          // basic collision response: reflect depending on side
          // Determine overlap on both axes
          const prevX = ball.x - ball.dx;
          const prevY = ball.y - ball.dy;
          let collidedHoriz = !(prevX + ball.r < b.x || prevX - ball.r > b.x + b.w);
          let collidedVert = !(prevY + ball.r < b.y || prevY - ball.r > b.y + b.h);

          // fallback: invert vertical if ambiguous
          if (collidedHoriz && !collidedVert) ball.dx *= -1;
          else if (!collidedHoriz && collidedVert) ball.dy *= -1;
          else ball.dy *= -1;

          b.hp--;
          if (b.hp <= 0) {
            b.destroyed = true;
            score += 100;
            // small chance for extra points/powerups in future
          } else {
            score += 40;
          }
          beep(600 + r*30, 0.03);
          break outer;
        }
      }
    }

    // bottom - lose life
    if (ball.y - ball.r > LOGICAL_HEIGHT) {
      lives--;
      beep(200, 0.08);
      if (lives <= 0) {
        running = false;
        showOverlay('Game Over', `Dein Score: ${score}`, false, true);
      } else {
        resetBallAndPaddle();
        showOverlay('Verloren', 'Drücke Weiter zum Weiterspielen', true);
      }
    }

    // check win
    const remaining = bricks.flat().filter(b => b && !b.destroyed).length;
    if (remaining === 0) {
      // next level
      level++;
      // increase ball speed a bit
      ball.speed = Math.min(12, ball.speed + 0.6);
      // preserve score and lives
      createBricks(Math.min(7, brick.rows + Math.floor((level-1)/1)));
      resetBallAndPaddle();
      showOverlay(`Level ${level}`, `Bereit für Level ${level}?`, true);
    }

    updateHUD();
  }

  function render() {
    clear();
    drawBackground();
    drawBricks();
    drawPaddle();
    drawBall();
  }

  // Loop with fixed timestep idea (simple)
  let last = 0;
  function loop(ts) {
    const delta = ts - last;
    last = ts;
    if (running && !paused) {
      update();
      render();
    } else {
      // even if not running, we still render so overlay shows correct background
      render();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Input
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') { paddle.dx = -paddle.speed; keys.ArrowLeft = true; }
    if (e.code === 'ArrowRight') { paddle.dx = paddle.speed; keys.ArrowRight = true; }
    if (e.code === 'Space') {
      if (ball.stuck) {
        // launch ball
        ball.stuck = false;
        const angle = (Math.random() * Math.PI/3) - Math.PI/6; // small variation
        ball.dx = ball.speed * Math.sin(angle);
        ball.dy = -ball.speed * Math.cos(angle);
        running = true;
        hideOverlay();
      } else {
        // smart nudge: give a little upward boost
        ball.dy = Math.max(ball.dy - 1.2, -ball.speed*1.2);
      }
      e.preventDefault();
    }
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.code === 'Enter') {
      if (!running) startGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') { keys.ArrowLeft = false; if (!keys.ArrowRight) paddle.dx = 0; else paddle.dx = paddle.speed; }
    if (e.code === 'ArrowRight') { keys.ArrowRight = false; if (!keys.ArrowLeft) paddle.dx = 0; else paddle.dx = -paddle.speed; }
  });

  // Buttons
  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', togglePause);
  overlayBtn.addEventListener('click', () => {
    hideOverlay();
    // if overlay displayed because of start/level, ensure game plays
    if (!running) {
      running = true;
    }
    if (ball.stuck) {
      // do not auto-launch; wait for space
    }
  });

  function startGame() {
    // init
    score = 0;
    lives = 3;
    level = 1;
    ball.speed = 6;
    createBricks(brick.rows);
    resetBallAndPaddle();
    running = true;
    paused = false;
    hideOverlay();
    updateHUD();
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Fortsetzen' : 'Pause';
    if (paused) showOverlay('Pause', 'Spiel pausiert', true);
    else hideOverlay();
  }

  function showOverlay(title = 'BlockBlast', msg = '', showBtn = true, gameOver=false) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    overlayBtn.style.display = showBtn ? 'inline-block' : 'none';
    overlay.classList.remove('hidden');
    if (gameOver) {
      overlayBtn.textContent = 'Neustart';
      overlayBtn.onclick = () => { overlayBtn.textContent = 'Weiter'; startGame(); hideOverlay(); };
    } else {
      overlayBtn.textContent = 'Weiter';
      overlayBtn.onclick = () => { hideOverlay(); if (!running) running = true; };
    }
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // initialize UI
  updateHUD();
  createBricks(brick.rows);
  resetBallAndPaddle();
  showOverlay('BlockBlast', 'Drücke Start oder Leertaste, um zu starten', true);

  // unlock audio on first user gesture
  function unlockAudio() {
    if (audioCtx.state !== 'running') {
      audioCtx.resume();
    }
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // expose for debugging in console (optional)
  window.BlockBlast = {
    startGame, togglePause, scoreState: () => ({score,lives,level})
  };

})();
