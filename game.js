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
let elapsed = 0;
let lastScoreInt = -1;
let lastLevelInt = -1;
let lastBestInt = best;

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
let trails = [];
let pulses = [];

for (let i = 0; i < 110; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    s: Math.random() * 1.8 + 0.5,
    a: Math.random() * 0.8 + 0.15,
    hue: 180 + Math.random() * 120
  });
}

function triggerPop(el) {
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}

function resetGame() {
  score = 0;
  level = 1;
  spawnTimer = 0;
  elapsed = 0;
  obstacles = [];
  particles = [];
  trails = [];
  pulses = [];
  player.x = canvas.width / 2;
  shake = 0;
  lastScoreInt = -1;
  lastLevelInt = -1;
  lastBestInt = best;
  updateHUD();
}

function updateHUD() {
  const scoreInt = Math.floor(score);
  if (scoreInt !== lastScoreInt) {
    scoreEl.textContent = scoreInt;
    if (lastScoreInt !== -1) triggerPop(scoreEl);
    lastScoreInt = scoreInt;
  }

  if (level !== lastLevelInt) {
    levelEl.textContent = level;
    if (lastLevelInt !== -1) triggerPop(levelEl);
    lastLevelInt = level;
  }

  if (best !== lastBestInt) {
    bestEl.textContent = best;
    triggerPop(bestEl);
    lastBestInt = best;
  } else {
    bestEl.textContent = best;
  }
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
  beep(360, 0.07, "triangle");
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
  if (paused) {
    beep(240, 0.05, "square");
  } else {
    beep(360, 0.05, "triangle");
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
    gain.gain.setValueAtTime(0.04, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch (e) {}
}

function spawnObstacle() {
  const difficulty = 1 + (level - 1) * 0.12;
  const w = 28 + Math.random() * 78;
  const h = 18 + Math.random() * 42;
  const x = 18 + Math.random() * (canvas.width - w - 36);
  const speed = (165 + Math.random() * 130) * difficulty;

  obstacles.push({
    x,
    y: -h - 12,
    w,
    h,
    speed,
    drift: (Math.random() - 0.5) * 34,
    phase: Math.random() * Math.PI * 2,
    rot: (Math.random() - 0.5) * 0.5,
    angle: Math.random() * Math.PI,
    glow: 240 + Math.random() * 90,
    dodged: false
  });
}

function createBurst(x, y, count = 16, hue = 185, speedScale = 1) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 300 * speedScale,
      vy: (Math.random() - 0.5) * 300 * speedScale,
      life: 0.45 + Math.random() * 0.45,
      age: 0,
      size: 2 + Math.random() * 4,
      hue: hue + (Math.random() * 40 - 20)
    });
  }
}

function createPulse(x, y, color = "rgba(88,247,232,0.65)") {
  pulses.push({ x, y, r: 12, alpha: 0.65, color });
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
  elapsed += dt;

  const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  player.x += direction * player.speed * dt;
  player.x = Math.max(player.w / 2 + 10, Math.min(canvas.width - player.w / 2 - 10, player.x));

  trails.push({ x: player.x, y: player.y + 2, life: 0.38, age: 0, r: 26 + Math.random() * 10 });
  if (trails.length > 34) trails.shift();

  score += dt * 5.5;
  level = 1 + Math.floor(score / 15);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    const base = Math.max(0.22, 0.7 - (level - 1) * 0.036);
    spawnTimer = base + Math.random() * 0.16;
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.phase += dt * 2.2;
    o.angle += o.rot * dt;
    o.x += Math.sin(o.phase) * o.drift * dt;
    o.y += o.speed * dt;

    if (!o.dodged && o.y > player.y - 18) {
      o.dodged = true;
      createBurst(o.x + o.w / 2, o.y + o.h / 2, 8, 190 + Math.random() * 60, 0.55);
      createPulse(o.x + o.w / 2, o.y + o.h / 2, "rgba(88,247,232,0.22)");
    }

    if (collide(player, o)) {
      createBurst(player.x, player.y, 40, 315, 1.15);
      createPulse(player.x, player.y, "rgba(255,99,182,0.65)");
      shake = 14;
      gameOver();
      return;
    }

    if (o.y > canvas.height + 80) {
      obstacles.splice(i, 1);
      createBurst(o.x + o.w / 2, canvas.height - 18, 10, 45, 0.7);
      createPulse(o.x + o.w / 2, canvas.height - 20, "rgba(255,209,102,0.38)");
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

  for (let i = trails.length - 1; i >= 0; i--) {
    trails[i].age += dt;
    if (trails[i].age >= trails[i].life) trails.splice(i, 1);
  }

  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.r += 180 * dt;
    p.alpha -= 0.9 * dt;
    if (p.alpha <= 0) pulses.splice(i, 1);
  }

  shake *= 0.86;
  updateHUD();
}

function drawNebula() {
  const t = elapsed * 0.25;

  const orb1 = ctx.createRadialGradient(
    canvas.width * (0.22 + Math.sin(t) * 0.06),
    canvas.height * 0.18,
    10,
    canvas.width * (0.22 + Math.sin(t) * 0.06),
    canvas.height * 0.18,
    220
  );
  orb1.addColorStop(0, "rgba(96, 131, 255, 0.30)");
  orb1.addColorStop(1, "rgba(96, 131, 255, 0)");

  const orb2 = ctx.createRadialGradient(
    canvas.width * (0.78 + Math.cos(t * 1.2) * 0.05),
    canvas.height * 0.22,
    10,
    canvas.width * (0.78 + Math.cos(t * 1.2) * 0.05),
    canvas.height * 0.22,
    200
  );
  orb2.addColorStop(0, "rgba(255, 99, 182, 0.22)");
  orb2.addColorStop(1, "rgba(255, 99, 182, 0)");

  const orb3 = ctx.createRadialGradient(
    canvas.width * 0.52,
    canvas.height * (0.78 + Math.sin(t * 1.8) * 0.02),
    10,
    canvas.width * 0.52,
    canvas.height * 0.78,
    260
  );
  orb3.addColorStop(0, "rgba(88, 247, 232, 0.18)");
  orb3.addColorStop(1, "rgba(88, 247, 232, 0)");

  ctx.fillStyle = orb1;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = orb2;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = orb3;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGrid() {
  ctx.save();
  const spacing = 44;
  const offset = (performance.now() * 0.02) % spacing;

  ctx.strokeStyle = "rgba(95, 132, 255, 0.10)";
  ctx.lineWidth = 1;
  for (let x = -spacing; x < canvas.width + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x + offset, canvas.height);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(88, 247, 232, 0.07)";
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
    const blink = 0.55 + Math.sin(elapsed * 2 + s.x * 0.02 + s.y * 0.015) * 0.25;
    ctx.globalAlpha = s.a * blink;
    ctx.fillStyle = `hsla(${s.hue}, 100%, 78%, 1)`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.restore();
}

function drawTrails() {
  ctx.save();
  for (const t of trails) {
    const alpha = Math.max(0, 1 - t.age / t.life);
    ctx.globalAlpha = alpha * 0.7;
    const outer = ctx.createRadialGradient(t.x, t.y, 2, t.x, t.y, t.r);
    outer.addColorStop(0, "rgba(255,99,182,0.18)");
    outer.addColorStop(0.45, "rgba(88,247,232,0.34)");
    outer.addColorStop(1, "rgba(88,247,232,0)");
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(Math.sin(elapsed * 5) * 0.05);
  ctx.shadowColor = "#58f7e8";
  ctx.shadowBlur = 28;

  const grad = ctx.createLinearGradient(-20, -20, 20, 20);
  grad.addColorStop(0, "#ff63b6");
  grad.addColorStop(0.45, "#5c8cff");
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
  ctx.fillStyle = "#08111c";
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();
}

function drawObstacle(o) {
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  ctx.rotate(o.angle);

  const grad = ctx.createLinearGradient(-o.w / 2, -o.h / 2, o.w / 2, o.h / 2);
  grad.addColorStop(0, "rgba(255, 99, 182, 1)");
  grad.addColorStop(0.45, "rgba(168, 85, 247, 0.98)");
  grad.addColorStop(1, "rgba(255, 209, 102, 1)");

  ctx.fillStyle = grad;
  ctx.shadowColor = `hsla(${o.glow}, 100%, 68%, 1)`;
  ctx.shadowBlur = 26;

  ctx.beginPath();
  ctx.moveTo(-o.w * 0.4, -o.h * 0.5);
  ctx.lineTo(o.w * 0.5, -o.h * 0.2);
  ctx.lineTo(o.w * 0.3, o.h * 0.5);
  ctx.lineTo(-o.w * 0.5, o.h * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath();
  ctx.moveTo(-o.w * 0.18, -o.h * 0.22);
  ctx.lineTo(o.w * 0.12, -o.h * 0.08);
  ctx.lineTo(-o.w * 0.05, o.h * 0.16);
  ctx.lineTo(-o.w * 0.28, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawPulses() {
  ctx.save();
  for (const p of pulses) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsla(${p.hue}, 100%, 68%, 1)`;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.restore();
}

function drawScanlines() {
  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
    ctx.fillRect(0, y, canvas.width, 1);
  }
  ctx.restore();
}

function drawEdgeGlow() {
  ctx.save();
  const edge = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edge.addColorStop(0, "rgba(95,132,255,0.35)");
  edge.addColorStop(0.5, "rgba(88,247,232,0.10)");
  edge.addColorStop(1, "rgba(255,99,182,0.35)");
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
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

  drawNebula();
  drawStars();
  drawGrid();
  drawTrails();
  drawPulses();

  for (const o of obstacles) drawObstacle(o);
  drawPlayer();
  drawParticles();
  drawScanlines();
  drawEdgeGlow();

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
  beep(440, 0.04, "triangle");
});

draw();
