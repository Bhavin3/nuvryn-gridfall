const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const levelEl = document.getElementById("level");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const soundBtn = document.getElementById("soundBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");

let running = false;
let paused = false;
let soundOn = true;
let animationId = null;
let lastTime = 0;
let spawnTimer = 0;
let score = 0;
let best = Number(localStorage.getItem("nuvryn-gridfall-best") || 0);
let level = 1;
let shake = 0;

bestEl.textContent = best;

const keys = {
  left: false,
  right: false
};

const player = {
  x: canvas.width / 2,
  y: canvas.height - 72,
  w: 34,
  h: 34,
  speed: 430
};

let obstacles = [];
let particles = [];
let stars = [];

for (let i = 0; i < 85; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    s: Math.random() * 1.8 + 0.4,
    a: Math.random() * 0.75 + 0.15
  });
}

function resetGame() {
  score = 0;
  level = 1;
  spawnTimer = 0;
  obstacles = [];
  particles = [];
  player.x = canvas.width / 2;
  shake = 0;
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = Math.floor(score);
  levelEl.textContent = level;
  bestEl.textContent = best;
}

function startGame() {
  resetGame();
  running = true;
  paused = false;
  overlay.classList.add("hidden");
  pauseBtn.textContent = "Pause";
  lastTime = performance.now();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function gameOver() {
  running = false;
  paused = false;
  cancelAnimationFrame(animationId);

  if (Math.floor(score) > best) {
    best = Math.floor(score);
    localStorage.setItem("nuvryn-gridfall-best", best);
  }

  updateHUD();
  overlayTitle.textContent = "Run terminated.";
  overlayText.textContent = `Score: ${Math.floor(score)} • Best: ${best}. The grid gets faster every 15 points.`;
  startBtn.textContent = "Run Again";
  overlay.classList.remove("hidden");
  beep(95, 0.18, "sawtooth");
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";

  if (!paused) {
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }
}

function beep(freq = 300, duration = 0.06, type = "sine") {
  if (!soundOn) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.045, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch (e) {}
}

function spawnObstacle() {
  const difficulty = 1 + (level - 1) * 0.11;
  const w = 32 + Math.random() * 80;
  const h = 18 + Math.random() * 42;
  const x = 18 + Math.random() * (canvas.width - w - 36);
  const speed = (165 + Math.random() * 120) * difficulty;

  obstacles.push({
    x,
    y: -h - 12,
    w,
    h,
    speed,
    drift: (Math.random() - 0.5) * 30,
    phase: Math.random() * Math.PI * 2
  });
}

function createBurst(x, y, count = 16) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.5) * 260,
      life: 0.6 + Math.random() * 0.4,
      age: 0,
      size: 2 + Math.random() * 3
    });
  }
}

function collide(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w &&
    a.x + a.w / 2 > b.x &&
    a.y - a.h / 2 < b.y + b.h &&
    a.y + a.h / 2 > b.y
  );
}

function update(dt) {
  const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  player.x += direction * player.speed * dt;
  player.x = Math.max(player.w / 2 + 10, Math.min(canvas.width - player.w / 2 - 10, player.x));

  score += dt * 5.5;
  level = 1 + Math.floor(score / 15);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    const base = Math.max(0.25, 0.72 - (level - 1) * 0.035);
    spawnTimer = base + Math.random() * 0.18;
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.phase += dt * 2.2;
    o.x += Math.sin(o.phase) * o.drift * dt;
    o.y += o.speed * dt;

    if (collide(player, o)) {
      createBurst(player.x, player.y, 34);
      shake = 12;
      gameOver();
      return;
    }

    if (o.y > canvas.height + 80) {
      obstacles.splice(i, 1);
      beep(520, 0.025, "triangle");
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;

    if (p.age >= p.life) particles.splice(i, 1);
  }

  shake *= 0.86;
  updateHUD();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(72, 109, 210, 0.12)";
  ctx.lineWidth = 1;

  const spacing = 44;
  const offset = (performance.now() * 0.02) % spacing;

  for (let x = -spacing; x < canvas.width + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x + offset, canvas.height);
    ctx.stroke();
  }

  for (let y = -spacing; y < canvas.height + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y + offset);
    ctx.lineTo(canvas.width, y + offset);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStars() {
  ctx.save();
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#9fd9ff";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.shadowColor = "#58f7e8";
  ctx.shadowBlur = 22;

  const grad = ctx.createLinearGradient(-20, -20, 20, 20);
  grad.addColorStop(0, "#5c8cff");
  grad.addColorStop(1, "#58f7e8");
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(22, 0);
  ctx.lineTo(0, 22);
  ctx.lineTo(-22, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#07101d";
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  ctx.translate(o.x, o.y);

  const grad = ctx.createLinearGradient(0, 0, o.w, o.h);
  grad.addColorStop(0, "rgba(255, 95, 134, 0.95)");
  grad.addColorStop(1, "rgba(118, 45, 255, 0.9)");

  ctx.fillStyle = grad;
  ctx.shadowColor = "#ff5f86";
  ctx.shadowBlur = 18;

  ctx.beginPath();
  ctx.moveTo(o.w * 0.12, 0);
  ctx.lineTo(o.w, o.h * 0.18);
  ctx.lineTo(o.w * 0.82, o.h);
  ctx.lineTo(0, o.h * 0.78);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#58f7e8";
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.restore();
}

function draw() {
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#071022");
  bg.addColorStop(1, "#030711");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();
  drawGrid();

  for (const o of obstacles) drawObstacle(o);
  drawPlayer();
  drawParticles();

  ctx.restore();
}

function loop(now) {
  if (!running || paused) return;

  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  update(dt);
  draw();

  if (running && !paused) {
    animationId = requestAnimationFrame(loop);
  }
}

function setKey(code, value) {
  if (code === "ArrowLeft" || code === "KeyA") keys.left = value;
  if (code === "ArrowRight" || code === "KeyD") keys.right = value;
}

window.addEventListener("keydown", (e) => {
  setKey(e.code, true);

  if (e.code === "Space") {
    e.preventDefault();
    togglePause();
  }

  if (e.code === "Enter" && !running) {
    startGame();
  }
});

window.addEventListener("keyup", (e) => setKey(e.code, false));

function bindHold(btn, side) {
  const on = (e) => {
    e.preventDefault();
    keys[side] = true;
  };

  const off = (e) => {
    e.preventDefault();
    keys[side] = false;
  };

  ["pointerdown", "touchstart"].forEach(evt => btn.addEventListener(evt, on, { passive: false }));
  ["pointerup", "pointercancel", "pointerleave", "touchend"].forEach(evt => btn.addEventListener(evt, off, { passive: false }));
}

bindHold(leftBtn, "left");
bindHold(rightBtn, "right");

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = `Sound: ${soundOn ? "On" : "Off"}`;
});

draw();
