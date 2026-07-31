(() => {
  "use strict";

  const DOMAIN = { width: 10, height: 6 };
  const COLORS = {
    grid: "rgba(157, 205, 214, 0.10)",
    arrow: "rgba(147, 197, 205, 0.40)",
    cyan: "#11d4d6",
    orange: "#ff7449",
    pale: "rgba(213, 239, 241, 0.16)",
    background: "#0c2b38"
  };

  const streamCanvas = document.querySelector("#streamline-canvas");
  const pathCanvas = document.querySelector("#pathline-canvas");
  const streamCtx = streamCanvas.getContext("2d");
  const pathCtx = pathCanvas.getContext("2d");
  const timeOutput = document.querySelector("#time-output");
  const speedRange = document.querySelector("#speed-range");
  const speedOutput = document.querySelector("#speed-output");
  const playButton = document.querySelector("#play-button");
  const resetButton = document.querySelector("#reset-button");
  const replayButton = document.querySelector("#replay-button");
  const insightBanner = document.querySelector("#insight-banner");
  const particleCallout = document.querySelector("#particle-callout");
  const modeButtons = [...document.querySelectorAll(".mode-button")];
  const canvasTimes = [...document.querySelectorAll(".canvas-time")];

  const state = {
    time: 0,
    speed: 1,
    running: true,
    mode: "unsteady",
    lastFrame: performance.now(),
    particle: { x: 0.9, y: 3.05 },
    trail: [],
    lastTrailTime: -1,
    resizePending: true
  };

  function velocity(x, y, t) {
    const phase = state.mode === "unsteady" ? t : 0;
    const wallFactor = Math.sin(Math.PI * Math.max(0, Math.min(DOMAIN.height, y)) / DOMAIN.height);
    return {
      x: 0.83 + 0.20 * Math.sin(1.08 * y + 0.72 * phase),
      y: (0.40 * Math.sin(0.74 * x - 1.08 * phase) + 0.08 * Math.cos(1.5 * y + 0.45 * phase)) * wallFactor
    };
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height, dpr };
  }

  function coordinates(canvas, x, y) {
    return {
      x: (x / DOMAIN.width) * canvas.width,
      y: (1 - y / DOMAIN.height) * canvas.height
    };
  }

  function drawBackdrop(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createRadialGradient(
      canvas.width * 0.45, canvas.height * 0.48, 0,
      canvas.width * 0.45, canvas.height * 0.48, canvas.width * 0.65
    );
    gradient.addColorStop(0, "rgba(21, 77, 89, 0.42)");
    gradient.addColorStop(1, "rgba(7, 30, 41, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = Math.max(1, canvas.width / 900);
    ctx.beginPath();
    for (let x = 0; x <= DOMAIN.width; x += 1) {
      const p = coordinates(canvas, x, 0);
      ctx.moveTo(p.x, 0);
      ctx.lineTo(p.x, canvas.height);
    }
    for (let y = 0; y <= DOMAIN.height; y += 1) {
      const p = coordinates(canvas, 0, y);
      ctx.moveTo(0, p.y);
      ctx.lineTo(canvas.width, p.y);
    }
    ctx.stroke();
  }

  function drawArrow(ctx, canvas, x, y, t, opacity = 1) {
    const v = velocity(x, y, t);
    const magnitude = Math.hypot(v.x, v.y) || 1;
    const base = Math.min(canvas.width / 20, canvas.height / 11);
    const length = base * (0.52 + magnitude * 0.28);
    const p = coordinates(canvas, x, y);
    const dx = (v.x / magnitude) * length;
    const dy = -(v.y / magnitude) * length;
    const tipX = p.x + dx;
    const tipY = p.y + dy;
    const angle = Math.atan2(dy, dx);
    const head = Math.max(3.5, canvas.width / 190);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = COLORS.arrow;
    ctx.lineWidth = Math.max(1, canvas.width / 700);
    ctx.beginPath();
    ctx.moveTo(p.x - dx * 0.33, p.y - dy * 0.33);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - head * Math.cos(angle - Math.PI / 5), tipY - head * Math.sin(angle - Math.PI / 5));
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - head * Math.cos(angle + Math.PI / 5), tipY - head * Math.sin(angle + Math.PI / 5));
    ctx.stroke();
    ctx.restore();
  }

  function drawVectorField(ctx, canvas, t, opacity = 1) {
    for (let y = 0.65; y < DOMAIN.height; y += 0.85) {
      for (let x = 0.55; x < DOMAIN.width; x += 1.05) {
        drawArrow(ctx, canvas, x, y, t, opacity);
      }
    }
  }

  function streamlineStep(point, t, step) {
    const direction = (x, y) => {
      const v = velocity(x, y, t);
      const length = Math.hypot(v.x, v.y) || 1;
      return { x: v.x / length, y: v.y / length };
    };
    const k1 = direction(point.x, point.y);
    const k2 = direction(point.x + k1.x * step / 2, point.y + k1.y * step / 2);
    const k3 = direction(point.x + k2.x * step / 2, point.y + k2.y * step / 2);
    const k4 = direction(point.x + k3.x * step, point.y + k3.y * step);
    return {
      x: point.x + step * (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6,
      y: point.y + step * (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6
    };
  }

  function integrateStreamline(seed, t, direction) {
    const points = [seed];
    let current = seed;
    const step = 0.055 * direction;
    for (let i = 0; i < 270; i += 1) {
      current = streamlineStep(current, t, step);
      if (current.x < -0.1 || current.x > DOMAIN.width + 0.1 || current.y < 0 || current.y > DOMAIN.height) break;
      points.push(current);
    }
    return direction < 0 ? points.reverse() : points;
  }

  function drawStreamline(ctx, canvas, seed, t, index) {
    const backward = integrateStreamline(seed, t, -1);
    const forward = integrateStreamline(seed, t, 1);
    const points = backward.concat(forward.slice(1));
    if (points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = index % 2 ? "rgba(0, 213, 215, 0.70)" : "rgba(59, 225, 218, 0.88)";
    ctx.lineWidth = Math.max(1.2, canvas.width / 540);
    ctx.shadowColor = "rgba(0, 221, 217, 0.36)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    points.forEach((point, i) => {
      const p = coordinates(canvas, point.x, point.y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();

    const marker = points[Math.floor(points.length * (0.36 + (index % 3) * 0.1))];
    const markerNext = points[Math.min(points.length - 1, Math.floor(points.length * (0.36 + (index % 3) * 0.1)) + 2)];
    if (marker && markerNext) drawLineArrow(ctx, canvas, marker, markerNext, COLORS.cyan);
  }

  function drawLineArrow(ctx, canvas, from, to, color) {
    const a = coordinates(canvas, from.x, from.y);
    const b = coordinates(canvas, to.x, to.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const size = Math.max(4, canvas.width / 130);
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(a.x, a.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.65, -size * 0.55);
    ctx.lineTo(-size * 0.65, size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawStreamCanvas() {
    resizeCanvas(streamCanvas);
    drawBackdrop(streamCtx, streamCanvas);
    drawVectorField(streamCtx, streamCanvas, state.time, 0.9);
    const seeds = [0.52, 1.15, 1.85, 2.55, 3.25, 3.95, 4.65, 5.35];
    seeds.forEach((y, index) => drawStreamline(streamCtx, streamCanvas, { x: 5, y }, state.time, index));
  }

  function drawParticleStreamline(ctx, canvas) {
    const seed = { x: state.particle.x, y: state.particle.y };
    const backward = integrateStreamline(seed, state.time, -1);
    const forward = integrateStreamline(seed, state.time, 1);
    const points = backward.concat(forward.slice(1));

    ctx.save();
    ctx.strokeStyle = "rgba(17, 212, 214, 0.70)";
    ctx.lineWidth = Math.max(1.2, canvas.width / 640);
    ctx.setLineDash([Math.max(5, canvas.width / 90), Math.max(4, canvas.width / 120)]);
    ctx.beginPath();
    points.forEach((point, index) => {
      const p = coordinates(canvas, point.x, point.y);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function particleDerivative(point, t) {
    return velocity(point.x, point.y, t);
  }

  function advanceParticle(dt) {
    const p = state.particle;
    const t = state.time;
    const k1 = particleDerivative(p, t);
    const p2 = { x: p.x + k1.x * dt / 2, y: p.y + k1.y * dt / 2 };
    const k2 = particleDerivative(p2, t + dt / 2);
    const p3 = { x: p.x + k2.x * dt / 2, y: p.y + k2.y * dt / 2 };
    const k3 = particleDerivative(p3, t + dt / 2);
    const p4 = { x: p.x + k3.x * dt, y: p.y + k3.y * dt };
    const k4 = particleDerivative(p4, t + dt);
    p.x += dt * (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6;
    p.y += dt * (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6;
    p.y = Math.max(0.12, Math.min(DOMAIN.height - 0.12, p.y));

    if (p.x > DOMAIN.width + 0.12) resetSimulation(false);
    else if (state.time - state.lastTrailTime >= 0.025) {
      state.trail.push({ x: p.x, y: p.y, t: state.time });
      state.lastTrailTime = state.time;
    }
  }

  function drawTrail(ctx, canvas) {
    if (state.trail.length < 2) return;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "rgba(255, 116, 73, 0.18)");
    gradient.addColorStop(0.5, "rgba(255, 116, 73, 0.72)");
    gradient.addColorStop(1, "#ff8a62");
    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(2, canvas.width / 260);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(255, 105, 67, 0.55)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    state.trail.forEach((point, index) => {
      const p = coordinates(canvas, point.x, point.y);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();

    const seconds = new Set();
    state.trail.forEach((point) => {
      const second = Math.floor(point.t);
      if (second > 0 && !seconds.has(second) && Math.abs(point.t - second) < 0.04) {
        seconds.add(second);
        const p = coordinates(canvas, point.x, point.y);
        ctx.fillStyle = "rgba(255, 196, 174, 0.85)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, canvas.width / 260), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(239, 219, 211, 0.65)";
        ctx.font = `${Math.max(8, canvas.width / 70)}px ui-monospace, monospace`;
        ctx.fillText(`${second}s`, p.x + 5, p.y + 14);
      }
    });
  }

  function drawParticle(ctx, canvas) {
    const p = coordinates(canvas, state.particle.x, state.particle.y);
    const radius = Math.max(4.5, canvas.width / 110);
    ctx.save();
    ctx.fillStyle = "rgba(255, 116, 73, 0.16)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 151, 115, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 1.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.orange;
    ctx.shadowColor = COLORS.orange;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.shadowBlur = 0;
    ctx.font = `700 ${Math.max(7, canvas.width / 86)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", p.x, p.y + .5);
    ctx.restore();

    const rect = pathCanvas.getBoundingClientRect();
    particleCallout.style.display = "block";
    particleCallout.style.left = `${(p.x / pathCanvas.width) * rect.width}px`;
    particleCallout.style.top = `${(p.y / pathCanvas.height) * rect.height}px`;
  }

  function drawPathCanvas() {
    resizeCanvas(pathCanvas);
    drawBackdrop(pathCtx, pathCanvas);
    drawVectorField(pathCtx, pathCanvas, state.time, 0.44);
    drawParticleStreamline(pathCtx, pathCanvas);
    drawTrail(pathCtx, pathCanvas);
    drawParticle(pathCtx, pathCanvas);
  }

  function resetSimulation(resetClock = true) {
    if (resetClock) state.time = 0;
    state.particle = { x: 0.9, y: 3.05 };
    state.trail = [{ x: state.particle.x, y: state.particle.y, t: state.time }];
    state.lastTrailTime = state.time;
    updateLabels();
  }

  function updateLabels() {
    const text = state.time.toFixed(2);
    timeOutput.value = text;
    canvasTimes.forEach((element) => { element.textContent = `t = ${text} s`; });
  }

  function setRunning(running) {
    state.running = running;
    playButton.classList.toggle("paused", !running);
    playButton.querySelector("span").textContent = running ? "暂停" : "继续";
    playButton.setAttribute("aria-label", running ? "暂停动画" : "继续动画");
  }

  function setMode(mode) {
    state.mode = mode;
    modeButtons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (mode === "steady") {
      insightBanner.classList.add("steady");
      insightBanner.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m6.4-.4-2.1 2.1M21 12h-3M5.6 5.6l2.1 2.1M3 12h3m6-3a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9Z" /></svg><p><strong>现在是定常流：</strong>每个位置的速度不随时间改变，质点会始终沿同一族流线前进，因此流线与迹线重合。</p>`;
    } else {
      insightBanner.classList.remove("steady");
      insightBanner.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m6.4-.4-2.1 2.1M21 12h-3M5.6 5.6l2.1 2.1M3 12h3m6-3a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9Z" /></svg><p><strong>现在是非定常流：</strong>同一位置的速度会随时间改变，因此质点走过的历史路径通常不贴合此刻的流线。</p>`;
    }
    resetSimulation(true);
  }

  function frame(now) {
    const elapsed = Math.min((now - state.lastFrame) / 1000, 0.05);
    state.lastFrame = now;
    if (state.running) {
      const dt = elapsed * state.speed;
      state.time += dt;
      advanceParticle(dt);
      updateLabels();
    }
    drawStreamCanvas();
    drawPathCanvas();
    requestAnimationFrame(frame);
  }

  modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  playButton.addEventListener("click", () => setRunning(!state.running));
  resetButton.addEventListener("click", () => resetSimulation(true));
  speedRange.addEventListener("input", () => {
    state.speed = Number(speedRange.value);
    speedOutput.value = `${state.speed.toFixed(1)}×`;
  });
  replayButton.addEventListener("click", () => {
    document.querySelector("#experiment").scrollIntoView({ behavior: "smooth", block: "start" });
    resetSimulation(true);
    setRunning(true);
  });
  window.addEventListener("resize", () => { state.resizePending = true; });
  document.addEventListener("visibilitychange", () => {
    state.lastFrame = performance.now();
  });

  resetSimulation(true);
  requestAnimationFrame(frame);
})();
