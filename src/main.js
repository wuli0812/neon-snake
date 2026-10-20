(function startNeonSnake() {
  "use strict";

  const { SnakeGame } = window.SnakeCore;

  const SPEEDS = {
    relaxed: { ms: 170, label: "悠闲节奏" },
    classic: { ms: 120, label: "经典节奏" },
    intense: { ms: 75, label: "极速节奏" },
  };

  const storageKeys = {
    best: "neon-snake.best-scores.v1",
    speed: "neon-snake.speed.v1",
    sound: "neon-snake.sound.v1",
  };

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const boardShell = document.querySelector("#boardShell");
  const overlay = document.querySelector("#gameOverlay");
  const overlayKicker = document.querySelector("#overlayKicker");
  const overlayTitle = document.querySelector("#overlayTitle");
  const overlayCopy = document.querySelector("#overlayCopy");
  const primaryAction = document.querySelector("#primaryAction");
  const primaryActionText = document.querySelector("#primaryActionText");
  const scoreValue = document.querySelector("#scoreValue");
  const bestValue = document.querySelector("#bestValue");
  const lengthValue = document.querySelector("#lengthValue");
  const levelLabel = document.querySelector("#levelLabel");
  const soundButton = document.querySelector("#soundButton");
  const liveRegion = document.querySelector("#liveRegion");
  const speedButtons = [...document.querySelectorAll(".speed-option")];
  const directionButtons = [...document.querySelectorAll("[data-direction]")];

  const game = new SnakeGame({ cols: 24, rows: 24 });
  let speedKey = readStorage(storageKeys.speed, "classic");
  let soundEnabled = readStorage(storageKeys.sound, "on") !== "off";
  let bestScores = readBestScores();
  let lastFrameTime = performance.now();
  let accumulator = 0;
  let particles = [];
  let scoreFlashUntil = 0;
  let audioContext = null;
  let swipeStart = null;

  if (!SPEEDS[speedKey]) {
    speedKey = "classic";
  }

  function readStorage(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // The game remains playable when storage is blocked.
    }
  }

  function readBestScores() {
    const fallback = { relaxed: 0, classic: 0, intense: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.best) || "{}");
      return {
        relaxed: Number(saved.relaxed) || 0,
        classic: Number(saved.classic) || 0,
        intense: Number(saved.intense) || 0,
      };
    } catch {
      return fallback;
    }
  }

  function padScore(value) {
    return String(value).padStart(3, "0");
  }

  function updateStats() {
    scoreValue.textContent = padScore(game.score);
    bestValue.textContent = padScore(bestScores[speedKey]);
    lengthValue.textContent = String(game.snake.length).padStart(2, "0");
    levelLabel.textContent = SPEEDS[speedKey].label;
  }

  function showOverlay(kicker, title, copy, actionText) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    primaryActionText.textContent = actionText;
    overlay.classList.add("is-visible");
  }

  function hideOverlay() {
    overlay.classList.remove("is-visible");
  }

  function announce(message) {
    liveRegion.textContent = "";
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 20);
  }

  function beginGame() {
    game.reset();
    game.start();
    accumulator = 0;
    particles = [];
    updateStats();
    hideOverlay();
    canvas.focus({ preventScroll: true });
    playTone("start");
    announce("游戏开始");
  }

  function togglePause() {
    if (game.state === "ready") {
      beginGame();
      return;
    }

    if (game.state === "running") {
      game.pause();
      showOverlay("已暂停", "喘口气", "方向键、空格或下方按钮都可以继续。", "继续游戏");
      playTone("pause");
      announce("游戏已暂停");
      return;
    }

    if (game.state === "paused") {
      game.resume();
      accumulator = 0;
      lastFrameTime = performance.now();
      hideOverlay();
      canvas.focus({ preventScroll: true });
      playTone("start");
      announce("继续游戏");
    }
  }

  function restartGame() {
    beginGame();
  }

  function triggerGameOver(reason) {
    const finalScore = game.score;
    const isNewBest = finalScore > bestScores[speedKey];

    if (isNewBest) {
      bestScores[speedKey] = finalScore;
      writeStorage(storageKeys.best, JSON.stringify(bestScores));
    }

    updateStats();
    boardShell.classList.remove("is-shaking");
    void boardShell.offsetWidth;
    boardShell.classList.add("is-shaking");
    playTone("over");

    const title = isNewBest ? "新的最高纪录！" : "游戏结束";
    const reasonText = reason === "wall" ? "你撞上了边界。" : "你咬到了自己的身体。";
    const scoreText = finalScore > 0 ? `本局得分 ${finalScore}。` : "这次还没吃到能量球。";
    showOverlay("GAME OVER", title, `${reasonText}${scoreText}`, "再来一局");
    announce(`${title}，本局得分 ${finalScore}`);
  }

  function handleStepResult(result) {
    if (result.type === "eat") {
      scoreFlashUntil = performance.now() + 420;
      spawnParticles(result.food);
      playTone("eat");
      updateStats();
    } else if (result.type === "gameover") {
      triggerGameOver(result.reason);
    } else if (result.type === "won") {
      bestScores[speedKey] = game.score;
      writeStorage(storageKeys.best, JSON.stringify(bestScores));
      updateStats();
      showOverlay("PERFECT", "棋盘已被你填满", `最终得分 ${game.score}，这局无可挑剔。`, "再玩一次");
      playTone("win");
      announce("恭喜，棋盘已被填满");
    }
  }

  function handleDirection(name) {
    if (game.state === "over" || game.state === "won") {
      return;
    }
    if (game.state === "ready") {
      beginGame();
    }
    if (game.state === "paused") {
      game.resume();
      accumulator = 0;
      lastFrameTime = performance.now();
      hideOverlay();
    }
    if (game.setDirectionByName(name)) {
      canvas.focus({ preventScroll: true });
    }
  }

  function setSpeed(nextSpeed) {
    if (!SPEEDS[nextSpeed]) {
      return;
    }
    speedKey = nextSpeed;
    writeStorage(storageKeys.speed, speedKey);
    speedButtons.forEach((button) => {
      const active = button.dataset.speed === speedKey;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    updateStats();
  }

  function setSound(enabled) {
    soundEnabled = enabled;
    writeStorage(storageKeys.sound, enabled ? "on" : "off");
    soundButton.classList.toggle("is-muted", !enabled);
    soundButton.setAttribute("aria-pressed", String(enabled));
    soundButton.setAttribute("aria-label", enabled ? "关闭音效" : "开启音效");
  }

  function getAudioContext() {
    if (!soundEnabled) {
      return null;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    return audioContext;
  }

  function playTone(type) {
    const audio = getAudioContext();
    if (!audio) {
      return;
    }

    const now = audio.currentTime;
    const toneMap = {
      start: [{ frequency: 330, duration: 0.08 }, { frequency: 494, duration: 0.11, delay: 0.07 }],
      eat: [{ frequency: 620, duration: 0.045 }, { frequency: 830, duration: 0.07, delay: 0.035 }],
      pause: [{ frequency: 280, duration: 0.08 }],
      over: [
        { frequency: 220, duration: 0.1 },
        { frequency: 165, duration: 0.17, delay: 0.09 },
      ],
      win: [
        { frequency: 523, duration: 0.1 },
        { frequency: 659, duration: 0.1, delay: 0.1 },
        { frequency: 784, duration: 0.2, delay: 0.2 },
      ],
    };

    (toneMap[type] || toneMap.eat).forEach(({ frequency, duration, delay = 0 }) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type === "over" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now + delay);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.055, now + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + 0.01);
    });
  }

  function spawnParticles(food) {
    for (let index = 0; index < 14; index += 1) {
      const angle = (Math.PI * 2 * index) / 14 + Math.random() * 0.25;
      const speed = 0.7 + Math.random() * 2.4;
      particles.push({
        x: food.x + 0.5,
        y: food.y + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.025 + Math.random() * 0.025,
        size: 0.07 + Math.random() * 0.1,
      });
    }
  }

  function updateParticles(deltaSeconds) {
    particles = particles.filter((particle) => {
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.life -= particle.decay;
      return particle.life > 0;
    });
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawBoard(now) {
    const size = canvas.width;
    const cell = size / game.cols;

    ctx.clearRect(0, 0, size, size);

    const background = ctx.createRadialGradient(
      size * 0.5,
      size * 0.42,
      0,
      size * 0.5,
      size * 0.5,
      size * 0.75,
    );
    background.addColorStop(0, "#0c1d17");
    background.addColorStop(1, "#06120e");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "rgba(184, 255, 205, 0.045)";
    ctx.lineWidth = 1;
    for (let index = 1; index < game.cols; index += 1) {
      const position = Math.round(index * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(size, position);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(184, 255, 205, 0.1)";
    for (let y = 1; y < game.rows; y += 2) {
      for (let x = 1; x < game.cols; x += 2) {
        ctx.beginPath();
        ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (game.food) {
      drawFood(game.food, cell, now);
    }
    drawSnake(cell, now);
    drawParticles(cell);
  }

  function drawFood(food, cell, now) {
    const centerX = (food.x + 0.5) * cell;
    const centerY = (food.y + 0.5) * cell;
    const pulse = 1 + Math.sin(now / 180) * 0.1;
    const radius = cell * 0.24 * pulse;

    const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, cell * 1.1);
    halo.addColorStop(0, "rgba(255, 121, 109, 0.46)");
    halo.addColorStop(0.38, "rgba(255, 121, 109, 0.14)");
    halo.addColorStop(1, "rgba(255, 121, 109, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(centerX, centerY, cell * 1.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "rgba(255, 121, 109, 0.9)";
    ctx.shadowBlur = cell * 0.7;
    ctx.fillStyle = "#ff8a7e";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#fff5cf";
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.28, centerY - radius * 0.3, radius * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake(cell, now) {
    const snake = game.snake;
    const gap = Math.max(2, cell * 0.075);

    for (let index = snake.length - 1; index >= 0; index -= 1) {
      const segment = snake[index];
      const progress = index / Math.max(1, snake.length - 1);
      const x = segment.x * cell + gap;
      const y = segment.y * cell + gap;
      const width = cell - gap * 2;
      const radius = index === 0 ? cell * 0.31 : cell * 0.26;

      ctx.save();
      if (index === 0) {
        ctx.shadowColor = "rgba(200, 255, 84, 0.58)";
        ctx.shadowBlur = cell * 0.52;
        ctx.fillStyle = "#dcff89";
      } else {
        const lightness = 68 - progress * 21;
        const hue = 77 + progress * 80;
        ctx.fillStyle = `hsl(${hue} 88% ${lightness}%)`;
      }

      roundedRect(ctx, x, y, width, width, radius);
      ctx.fill();
      ctx.restore();

      if (index > 0 && index % 3 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath();
        ctx.arc(x + width * 0.35, y + width * 0.32, Math.max(1.2, cell * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawSnakeEyes(snake[0], cell, now);
  }

  function drawSnakeEyes(head, cell, now) {
    const direction = game.direction;
    const centerX = (head.x + 0.5) * cell;
    const centerY = (head.y + 0.5) * cell;
    const perpendicularX = direction.y;
    const perpendicularY = -direction.x;
    const forward = cell * 0.16;
    const spread = cell * 0.16;
    const blink = Math.sin(now / 2100) > 0.985 ? 0.16 : 1;
    const eyeRadius = Math.max(1.6, cell * 0.095);

    [-1, 1].forEach((side) => {
      const eyeX = centerX + direction.x * forward + perpendicularX * spread * side;
      const eyeY = centerY + direction.y * forward + perpendicularY * spread * side;
      ctx.fillStyle = "#0a1b13";
      ctx.beginPath();
      ctx.ellipse(
        eyeX,
        eyeY,
        eyeRadius,
        eyeRadius * blink,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      if (blink === 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
        ctx.beginPath();
        ctx.arc(
          eyeX - direction.y * cell * 0.022,
          eyeY - direction.x * cell * 0.022,
          eyeRadius * 0.34,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    });
  }

  function drawParticles(cell) {
    particles.forEach((particle) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.life > 0.55 ? "#ffe9b1" : "#ff796d";
      ctx.beginPath();
      ctx.arc(
        particle.x * cell,
        particle.y * cell,
        particle.size * cell * particle.life,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    });
  }

  function animationLoop(timestamp) {
    const delta = Math.min(100, timestamp - lastFrameTime);
    lastFrameTime = timestamp;
    const deltaSeconds = delta / 1000;

    if (game.state === "running") {
      accumulator += delta;
      const speed = SPEEDS[speedKey].ms;
      while (accumulator >= speed) {
        accumulator -= speed;
        const result = game.step();
        handleStepResult(result);
        if (result.type === "gameover" || result.type === "won") {
          accumulator = 0;
          break;
        }
      }
    }

    updateParticles(deltaSeconds);
    drawBoard(timestamp);

    if (performance.now() < scoreFlashUntil) {
      scoreValue.style.color = "#ffffff";
    } else {
      scoreValue.style.color = "";
    }

    requestAnimationFrame(animationLoop);
  }

  primaryAction.addEventListener("click", () => {
    if (game.state === "paused") {
      togglePause();
    } else {
      beginGame();
    }
  });

  speedButtons.forEach((button) => {
    button.addEventListener("click", () => setSpeed(button.dataset.speed));
  });

  soundButton.addEventListener("click", () => {
    setSound(!soundEnabled);
    if (soundEnabled) {
      playTone("start");
    }
  });

  directionButtons.forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handleDirection(button.dataset.direction);
    });
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const directionMap = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };

    if (directionMap[key]) {
      event.preventDefault();
      handleDirection(directionMap[key]);
      return;
    }

    if (key === " " || key === "spacebar") {
      event.preventDefault();
      if (!event.repeat) {
        togglePause();
      }
      return;
    }

    if (key === "r") {
      event.preventDefault();
      restartGame();
      return;
    }

    if (key === "m") {
      setSound(!soundEnabled);
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    swipeStart = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!swipeStart) {
      return;
    }
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) {
      if (game.state === "paused") {
        togglePause();
      }
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      handleDirection(dx > 0 ? "right" : "left");
    } else {
      handleDirection(dy > 0 ? "down" : "up");
    }
  });

  canvas.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "running") {
      game.pause();
      showOverlay("已暂停", "等你回来", "切回页面后，按空格继续游戏。", "继续游戏");
    }
  });

  setSpeed(speedKey);
  setSound(soundEnabled);
  updateStats();
  showOverlay("准备好了吗？", "吞噬霓虹能量", "避开墙壁和自己的身体，看看你能长到多长。", "开始游戏");
  requestAnimationFrame(animationLoop);
})();
