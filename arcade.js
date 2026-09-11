// Mini-juego "salta el obstáculo" para las páginas de Gaming mientras aún
// no hay stock que mostrar (nintendo.json/playstation.json/xbox.json
// vacíos hasta que el bot correspondiente esté conectado). Autocontenido,
// sin dependencias — solo se carga en esas 3 páginas.
(function () {
  const canvas = document.getElementById("arcade-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("arcade-score");
  const bestEl = document.getElementById("arcade-best");
  const hint = document.getElementById("arcade-hint");
  const STORAGE_KEY = "wts-arcade-best";

  const W = canvas.width, H = canvas.height;
  const GROUND_Y = H - 28;
  const GRAVITY = 0.55;
  const JUMP_VELOCITY = -10.5;

  let best = 0;
  try {
    best = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch (e) {
    best = 0;
  }
  if (bestEl) bestEl.textContent = best;

  function theme(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  let player, obstacles, speed, score, running, started, frame, spawnTimer;

  function reset() {
    player = { x: 34, y: GROUND_Y - 22, w: 22, h: 22, vy: 0, onGround: true };
    obstacles = [];
    speed = 4.4;
    score = 0;
    frame = 0;
    spawnTimer = 60;
    running = true;
    if (scoreEl) scoreEl.textContent = 0;
    if (hint) hint.textContent = "Espacio / toca para saltar";
  }

  function jump() {
    if (!started || !running) {
      reset();
      started = true;
      loop();
      return;
    }
    if (player.onGround) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
    }
  }

  function spawnObstacle() {
    const h = 16 + Math.random() * 20;
    obstacles.push({ x: W + 10, y: GROUND_Y - h, w: 12 + Math.random() * 10, h });
  }

  function update() {
    frame++;
    player.vy += GRAVITY;
    player.y += player.vy;
    if (player.y >= GROUND_Y - player.h) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    spawnTimer--;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(38, 75 - Math.floor(speed * 4));
    }

    for (const o of obstacles) o.x -= speed;
    obstacles = obstacles.filter(o => o.x + o.w > -5);

    for (const o of obstacles) {
      const hit = player.x < o.x + o.w && player.x + player.w > o.x &&
        player.y < o.y + o.h && player.y + player.h > o.y;
      if (hit) {
        running = false;
        if (score > best) {
          best = score;
          try { localStorage.setItem(STORAGE_KEY, String(best)); } catch (e) {}
          if (bestEl) bestEl.textContent = best;
        }
      }
    }

    if (frame % 6 === 0) score++;
    speed += 0.0025;
    if (scoreEl) scoreEl.textContent = score;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = theme("--muted") || "#888";
    ctx.fillRect(0, GROUND_Y, W, 2);

    ctx.fillStyle = theme("--navy") || "#2b5a8c";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    ctx.fillStyle = theme("--accent") || "#ffcb05";
    for (const o of obstacles) ctx.fillRect(o.x, o.y, o.w, o.h);

    if (!running) {
      ctx.fillStyle = theme("--fg") || "#111";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("¡Choque! Toca para volver a intentarlo", W / 2, H / 2);
    }
  }

  function loop() {
    if (!running) {
      draw();
      return;
    }
    update();
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", jump);
  window.addEventListener("keydown", e => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      jump();
    }
  });

  reset();
  draw();
  if (hint) hint.textContent = "Espacio / toca para empezar";
})();
