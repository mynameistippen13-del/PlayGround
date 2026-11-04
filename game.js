/* =========================================================================
   WHEELIE RIDER — 2D dirt bike wheelie game
   Canvas-only art, arcade balance physics, four swappable dirt bikes.
   ========================================================================= */
(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (n, m) => ((n % m) + m) % m;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------------
     DATA
     --------------------------------------------------------------------- */
  const BIKES = [
    {
      id: "mud",
      name: "MudMuncher",
      model: "250",
      num: "01",
      klass: "MX · ALL-ROUNDER",
      tag: "Honest torque and forgiving manners. The bike that gets everyone started.",
      stats: { power: 3, lift: 3, balance: 3 },
      accel: 262,
      maxSpeed: 435,
      lift: 1.0,
      balance: 1.0,
      style: "mx",
      palette: {
        body: "#f04a2c", body2: "#ff9a3d", accent: "#ffe9c4",
        frame: "#241d26", engine: "#4a424c", rim: "#f0cf9e",
        seat: "#231b23", rider: "#2a303a", pants: "#222b34",
        helmet: "#ffd166", visor: "#17131c", glow: "#ff7a3d",
      },
    },
    {
      id: "skyhawk",
      name: "Skyhawk",
      model: "300",
      num: "07",
      klass: "MX · FLICKABLE",
      tag: "Light, loud, and eager to point skyward. Rewards fast hands, punishes panic.",
      stats: { power: 4, lift: 5, balance: 2 },
      accel: 302,
      maxSpeed: 482,
      lift: 1.12,
      balance: 0.84,
      style: "sport",
      palette: {
        body: "#21b6e8", body2: "#8ce6ff", accent: "#f4fbff",
        frame: "#172630", engine: "#33434c", rim: "#d7f6ff",
        seat: "#16252d", rider: "#13313d", pants: "#1b3a44",
        helmet: "#ff4f7a", visor: "#121019", glow: "#6fe3ff",
      },
    },
    {
      id: "titan",
      name: "Torque Titan",
      model: "450",
      num: "44",
      klass: "MX · HEAVYWEIGHT",
      tag: "A big lazy thumper with a low centre of gravity. Hard to flip, hard to hurry.",
      stats: { power: 2, lift: 2, balance: 5 },
      accel: 232,
      maxSpeed: 398,
      lift: 0.89,
      balance: 1.28,
      style: "titan",
      palette: {
        body: "#f2b32e", body2: "#ffe08a", accent: "#211d20",
        frame: "#1b1a1d", engine: "#37343a", rim: "#d9c48f",
        seat: "#1d1b1f", rider: "#3a3121", pants: "#2b261d",
        helmet: "#f4efe2", visor: "#171419", glow: "#ffd76a",
      },
    },
    {
      id: "nightshade",
      name: "Nightshade",
      model: "500",
      num: "13",
      klass: "MX · FACTORY SPECIAL",
      tag: "A screaming factory special. Top speed is huge; so is the temptation to loop it.",
      stats: { power: 5, lift: 3, balance: 3 },
      accel: 328,
      maxSpeed: 520,
      lift: 1.03,
      balance: 0.94,
      style: "night",
      palette: {
        body: "#9148f0", body2: "#c38bff", accent: "#42f5c5",
        frame: "#151020", engine: "#2c2440", rim: "#42f5c5",
        seat: "#120c1c", rider: "#241b38", pants: "#1a1327",
        helmet: "#42f5c5", visor: "#0d0913", glow: "#42f5c5",
      },
    },
  ];

  const STORAGE_BEST = "wheelie-rider-bests-v1";
  const STORAGE_BIKE = "wheelie-rider-bike-v1";
  const STORAGE_MUTE = "wheelie-rider-muted-v1";
  const MAX_WHEELIE = 103;        // degrees before you loop out
  const CRASH_MAX = 118;          // visual tumble limit
  const SWEET_LO = 56;
  const SWEET_HI = 82;

  /* ---------------------------------------------------------------------
     DOM
     --------------------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);
  const shell = $("shell");
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const el = {
    score: $("score"), hudBest: $("hudBest"), bikeBtn: $("bikeBtn"),
    bikeSwatch: $("bikeSwatch"), bikeName: $("bikeName"),
    wheelieChip: $("wheelieChip"), wheelieTime: $("wheelieTime"), wheelieMult: $("wheelieMult"),
    gauge: $("gauge"), gaugeFill: $("gaugeFill"), gaugeNeedle: $("gaugeNeedle"),
    angleRead: $("angleRead"), speedRead: $("speedRead"),
    menu: $("menu"), gameover: $("gameover"), startBtn: $("startBtn"),
    menuBikeBtn: $("menuBikeBtn"), menuBikeName: $("menuBikeName"),
    menuBikeClass: $("menuBikeClass"), menuBikeNumber: $("menuBikeNumber"),
    menuBikeTag: $("menuBikeTag"), menuBest: $("menuBest"),
    statPower: $("statPower"), statLift: $("statLift"), statBalance: $("statBalance"),
    garagePrev: $("garagePrev"), garageNext: $("garageNext"),
    overScore: $("overScore"), overWheelie: $("overWheelie"),
    overSpeed: $("overSpeed"), overBest: $("overBest"),
    overReason: $("overReason"), newBest: $("newBest"),
    againBtn: $("againBtn"), garageBackBtn: $("garageBackBtn"),
    toast: $("toast"), muteBtn: $("muteBtn"), muteIcon: $("muteIcon"),
    bikePreview: $("bikePreview"), hud: $("hud"), controls: $("controls"),
  };

  /* ---------------------------------------------------------------------
     PERSISTENCE
     --------------------------------------------------------------------- */
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  }

  const bests = readJSON(STORAGE_BEST, {});
  BIKES.forEach((b) => { if (!Number.isFinite(bests[b.id])) bests[b.id] = 0; });

  let savedBike = 0;
  try {
    const raw = Number(localStorage.getItem(STORAGE_BIKE));
    if (Number.isInteger(raw) && raw >= 0 && raw < BIKES.length) savedBike = raw;
  } catch { /* ignore */ }

  let muted = false;
  try { muted = localStorage.getItem(STORAGE_MUTE) === "1"; } catch { /* ignore */ }

  /* ---------------------------------------------------------------------
     STATE
     --------------------------------------------------------------------- */
  const state = {
    mode: "menu",          // menu | playing | crashing | over
    bike: savedBike,
    score: 0,
    topSpeed: 0,
    wheelieTime: 0,
    wheeliePeak: 0,
    wheelieMult: 1,
    theta: 0,
    omega: 0,
    speed: 0,
    gas: 0,
    distance: 0,
    crashTimer: 0,
    crashSpin: 0,
    crashReason: "",
    time: 0,
    menuTime: 0,
    scroll: 0,
    wheelSpin: 0,
    shake: 0,
    flash: 0,
    bikeScreenX: 0,
    paused: false,
    lastSavedBest: 0,
  };

  const view = { w: 1280, h: 720, dpr: 1, scale: 1, groundY: 520, portrait: false };

  const keys = { gas: false, brake: false, leanBack: false, leanFwd: false };
  const pointers = new Map(); // pointerId -> action

  const held = (action) => {
    if (keys[action]) return true;
    for (const a of pointers.values()) if (a === action) return true;
    return false;
  };

  /* ---------------------------------------------------------------------
     AUDIO — tiny synthesized engine + crash, no assets
     --------------------------------------------------------------------- */
  const audio = {
    ctx: null,
    master: null,
    engineGain: null,
    osc1: null,
    osc2: null,
    filter: null,
    muted,
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        const ac = new AC();
        this.ctx = ac;
        this.master = ac.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(ac.destination);

        this.filter = ac.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 460;
        this.filter.Q.value = 5;

        this.engineGain = ac.createGain();
        this.engineGain.gain.value = 0.0;

        this.osc1 = ac.createOscillator();
        this.osc1.type = "sawtooth";
        this.osc1.frequency.value = 52;

        this.osc2 = ac.createOscillator();
        this.osc2.type = "square";
        this.osc2.frequency.value = 79;

        const o2gain = ac.createGain();
        o2gain.gain.value = 0.24;

        this.osc1.connect(this.filter);
        this.osc2.connect(o2gain).connect(this.filter);
        this.filter.connect(this.engineGain).connect(this.master);
        this.osc1.start();
        this.osc2.start();
        if (ac.state === "suspended") ac.resume().catch(() => {});
      } catch { this.ctx = null; }
    },
    setMuted(m) {
      this.muted = m;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.03);
      }
    },
    engine(speed, gas, active) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const f = 46 + speed * 0.44 + gas * 20;
      this.osc1.frequency.setTargetAtTime(f, t, 0.045);
      this.osc2.frequency.setTargetAtTime(f * 1.503, t, 0.045);
      this.filter.frequency.setTargetAtTime(260 + speed * 2.2 + gas * 520, t, 0.07);
      const vol = active ? 0.022 + gas * 0.024 : 0.006;
      this.engineGain.gain.setTargetAtTime(vol, t, 0.07);
    },
    crash() {
      this.ensure();
      if (!this.ctx) return;
      const ac = this.ctx;
      const t = ac.currentTime;

      // noise burst
      const len = Math.floor(ac.sampleRate * 0.55);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, 2.2);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 380;
      bp.Q.value = 0.8;
      const g = ac.createGain();
      g.gain.value = 0.26;
      src.connect(bp).connect(g).connect(this.master);
      src.start(t);

      // low thud
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(34, t + 0.4);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.5, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(og).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.55);
    },
    blip(freq = 620, dur = 0.06, vol = 0.07) {
      this.ensure();
      if (!this.ctx) return;
      const ac = this.ctx;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t);
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    },
  };

  /* ---------------------------------------------------------------------
     LAYOUT
     --------------------------------------------------------------------- */
  function resize() {
    const rect = shell.getBoundingClientRect();
    const w = Math.max(300, rect.width);
    const h = Math.max(280, rect.height);
    view.w = w; view.h = h;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * view.dpr);
    canvas.height = Math.round(h * view.dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    view.portrait = w < 720 && h > w;
    view.scale = view.portrait
      ? clamp(Math.min(w / 480, h / 850), 0.66, 1.08)
      : clamp(Math.min(w / 980, h / 600), 0.6, 1.2);
    view.groundY = h * (view.portrait ? 0.665 : 0.72);
    if (!state.bikeScreenX) state.bikeScreenX = bikeTargetX();
    renderBikePreview();
  }

  function bikeTargetX() {
    if (state.mode === "menu" && view.w >= 1000) return view.w * 0.715;
    return view.w * (view.portrait ? 0.355 : 0.305);
  }

  /* ---------------------------------------------------------------------
     GAME FLOW
     --------------------------------------------------------------------- */
  function resetRun() {
    state.score = 0;
    state.topSpeed = 0;
    state.wheelieTime = 0;
    state.wheeliePeak = 0;
    state.wheelieMult = 1;
    state.theta = 0;
    state.omega = 0;
    state.speed = 92;
    state.gas = 0;
    state.distance = 0;
    state.crashTimer = 0;
    state.crashSpin = 0;
    state.crashReason = "";
    state.time = 0;
    state.shake = 0;
    state.flash = 0;
    state.lastSavedBest = bests[BIKES[state.bike].id] || 0;
    particles.length = 0;
    dustTimer = 0;
    smokeTimer = 0;
    sparkTimer = 0;
  }

  function startRun() {
    audio.ensure();
    resetRun();
    state.mode = "playing";
    state.bikeScreenX = bikeTargetX();
    shell.classList.remove("mode-menu", "mode-over");
    shell.classList.add("mode-playing");
    el.menu.classList.add("hidden");
    el.gameover.classList.add("hidden");
    el.menu.setAttribute("aria-hidden", "true");
    el.gameover.setAttribute("aria-hidden", "true");
    updateBikeUI();
    showToast("HOLD GAS — FIND THE BALANCE POINT", 2200);
    audio.blip(520, 0.08, 0.06);
  }

  function toGarage() {
    state.mode = "menu";
    shell.classList.remove("mode-playing", "mode-crashing", "mode-over");
    shell.classList.add("mode-menu");
    el.gameover.classList.add("hidden");
    el.gameover.setAttribute("aria-hidden", "true");
    el.menu.classList.remove("hidden");
    el.menu.setAttribute("aria-hidden", "false");
    state.theta = 0;
    state.omega = 0;
    state.speed = 0;
    state.gas = 0;
    state.shake = 0;
    particles.length = 0;
    updateBikeUI();
    updateHUD();
    audio.engine(0, 0, false);
  }

  function crash(reason) {
    if (state.mode !== "playing") return;
    state.mode = "crashing";
    state.crashReason = reason;
    state.crashTimer = 0;
    state.crashSpin = Math.max(55, state.omega + 38);
    state.shake = reduceMotion ? 0 : 1;
    state.flash = 0.75;
    shell.classList.remove("mode-playing");
    shell.classList.add("mode-crashing");
    burstAt(bikeAnchor(), 38, "crash");
    audio.crash();
  }

  function finishRun() {
    state.mode = "over";
    shell.classList.remove("mode-crashing");
    shell.classList.add("mode-over");

    const bike = BIKES[state.bike];
    const prevBest = bests[bike.id] || 0;
    const score = Math.floor(state.score);
    const isBest = score > prevBest;
    if (isBest) {
      bests[bike.id] = score;
      writeJSON(STORAGE_BEST, bests);
    }
    updateBikeUI();
    updateHUD();

    el.overScore.textContent = fmt(score);
    el.overWheelie.textContent = state.wheeliePeak.toFixed(1) + "s";
    el.overSpeed.textContent = Math.round(state.topSpeed * 0.36);
    el.overBest.textContent = fmt(bests[bike.id]);
    el.overReason.textContent =
      state.crashReason === "loopout"
        ? "You looped it out. The sky was right there."
        : "You lost it. Line it up and try again.";
    el.newBest.classList.toggle("hidden", !isBest);
    el.gameover.classList.remove("hidden");
    el.gameover.setAttribute("aria-hidden", "false");
    state.flash = 0.5;
  }

  /* ---------------------------------------------------------------------
     INPUT
     --------------------------------------------------------------------- */
  const KEY_ACTIONS = {
    ArrowUp: "gas", KeyW: "gas",
    ArrowDown: "brake", KeyS: "brake",
    ArrowLeft: "leanBack", KeyA: "leanBack",
    ArrowRight: "leanFwd", KeyD: "leanFwd",
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      if (state.mode === "menu") { e.preventDefault(); startRun(); return; }
      if (state.mode === "over") { e.preventDefault(); startRun(); return; }
    }
    if (e.code === "KeyB") {
      if (!e.repeat) { e.preventDefault(); cycleBike(1); }
      return;
    }
    if (e.code === "KeyM") {
      if (!e.repeat) { e.preventDefault(); toggleMute(); }
      return;
    }
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    e.preventDefault();
    if (state.mode === "menu" && e.code === "ArrowUp") {
      // Fine to keep steering keys from starting a run, but Space/Enter is obvious.
    }
    keys[action] = true;
    audio.ensure();
  }, { passive: false });

  window.addEventListener("keyup", (e) => {
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    e.preventDefault();
    keys[action] = false;
  }, { passive: false });

  window.addEventListener("blur", () => {
    keys.gas = keys.brake = keys.leanBack = keys.leanFwd = false;
    pointers.clear();
    document.querySelectorAll(".ctrl.is-active").forEach((b) => b.classList.remove("is-active"));
  });

  document.querySelectorAll(".ctrl").forEach((btn) => {
    const action = btn.dataset.action;
    const release = (e) => {
      pointers.delete(e.pointerId);
      if (!held(action)) btn.classList.remove("is-active");
    };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      audio.ensure();
      if (state.mode === "menu") startRun();
      pointers.set(e.pointerId, action);
      btn.classList.add("is-active");
      try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  el.startBtn.addEventListener("click", startRun);
  el.againBtn.addEventListener("click", startRun);
  el.garageBackBtn.addEventListener("click", toGarage);
  el.bikeBtn.addEventListener("click", () => cycleBike(1));
  el.menuBikeBtn.addEventListener("click", () => cycleBike(1));
  el.garagePrev.addEventListener("click", () => cycleBike(-1));
  el.garageNext.addEventListener("click", () => cycleBike(1));
  el.muteBtn.addEventListener("click", toggleMute);

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(STORAGE_MUTE, muted ? "1" : "0"); } catch { /* ignore */ }
    audio.setMuted(muted);
    updateMuteUI();
    if (!muted) audio.blip(760, 0.06, 0.05);
  }

  function updateMuteUI() {
    el.muteIcon.textContent = muted ? "🔇" : "🔊";
    el.muteBtn.classList.toggle("muted", muted);
    el.muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    el.muteBtn.setAttribute("title", muted ? "Unmute sound (M)" : "Mute sound (M)");
  }

  /* ---------------------------------------------------------------------
     BIKE SELECTION
     --------------------------------------------------------------------- */
  function cycleBike(dir) {
    const prev = state.bike;
    state.bike = (state.bike + dir + BIKES.length) % BIKES.length;
    try { localStorage.setItem(STORAGE_BIKE, String(state.bike)); } catch { /* ignore */ }
    const bike = BIKES[state.bike];
    state.speed = Math.min(state.speed, bike.maxSpeed);
    state.bikeScreenX = state.bikeScreenX || bikeTargetX();
    updateBikeUI();
    updateHUD();
    audio.ensure();
    audio.blip(660, 0.07, 0.05);

    if (state.mode === "playing" || state.mode === "crashing") {
      burstAt(bikeAnchor(), 16, "swap");
      state.flash = Math.max(state.flash, 0.4);
      showToast(`<strong>${bike.name} ${bike.model}</strong><small>${bike.klass}</small>`, 1500);
    } else if (state.mode === "menu") {
      showToast(`<strong>${bike.name} ${bike.model}</strong><small>${bike.tag}</small>`, 1600);
    }
    if (prev !== state.bike) state.lastSavedBest = bests[bike.id] || 0;
  }

  function renderBikePreview() {
    const c = el.bikePreview;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const p = c.getContext("2d");
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    p.clearRect(0, 0, w, h);

    const bike = BIKES[state.bike];
    const pal = bike.palette;

    const sky = p.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#311a4c");
    sky.addColorStop(0.55, "#8d3c5c");
    sky.addColorStop(1, "#ff9a62");
    p.fillStyle = sky;
    p.fillRect(0, 0, w, h);

    // little sun
    const sx = w * 0.79, sy = h * 0.36, sr = h * 0.15;
    const glow = p.createRadialGradient(sx, sy, 1, sx, sy, sr * 3.6);
    glow.addColorStop(0, "rgba(255,218,140,0.45)");
    glow.addColorStop(1, "rgba(255,180,110,0)");
    p.fillStyle = glow;
    p.beginPath(); p.arc(sx, sy, sr * 3.6, 0, TAU); p.fill();
    p.fillStyle = "#ffd98d";
    p.beginPath(); p.arc(sx, sy, sr, 0, TAU); p.fill();
    p.fillStyle = "rgba(120,50,80,0.35)";
    for (let y = sy + sr * 0.12; y < sy + sr; y += sr * 0.28) {
      p.fillRect(sx - sr, y, sr * 2, Math.max(1, sr * 0.06));
    }

    // dune line
    const ground = h * 0.84;
    p.beginPath();
    p.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      p.lineTo(x, ground - 12 - Math.sin(x * 0.018 + 1.1) * 5 - Math.sin(x * 0.007) * 4);
    }
    p.lineTo(w, h);
    p.closePath();
    p.fillStyle = "#5a2b42";
    p.fill();

    p.fillStyle = "#8f4736";
    p.fillRect(0, ground, w, h - ground);
    p.fillStyle = "rgba(255,190,125,0.34)";
    p.fillRect(0, ground - 1, w, 1.4);

    // faint checkered start line
    for (let i = 0; i < 6; i++) {
      p.fillStyle = i % 2 ? "rgba(255,244,218,0.5)" : "rgba(35,20,30,0.35)";
      p.fillRect(8 + i * 5, ground + 4, 5, 4);
    }

    const s = h / 172;
    p.save();
    p.translate(w * 0.57 - 70 * s, ground - 25 * s);
    p.scale(s, s);

    // shadow
    p.fillStyle = "rgba(25,10,18,0.3)";
    p.beginPath();
    p.ellipse(72, 26, 100, 6, 0, 0, TAU);
    p.fill();

    // wheels
    const miniWheel = (x, y, r, front) => {
      p.strokeStyle = "#17121b";
      p.lineWidth = r * 0.28;
      p.beginPath(); p.arc(x, y, r * 0.86, 0, TAU); p.stroke();
      p.strokeStyle = pal.rim;
      p.lineWidth = 1.5;
      p.beginPath(); p.arc(x, y, r * 0.66, 0, TAU); p.stroke();
      p.lineWidth = 0.9;
      p.globalAlpha = 0.65;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.35;
        p.beginPath();
        p.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2);
        p.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
        p.stroke();
      }
      p.globalAlpha = 1;
      p.fillStyle = pal.accent;
      p.beginPath(); p.arc(x, y, front ? 3.2 : 2.4, 0, TAU); p.fill();
    };
    miniWheel(0, 0, 25, false);
    miniWheel(136, 2, 23, true);

    // swingarm + engine
    p.strokeStyle = pal.frame;
    p.lineWidth = 5;
    p.lineCap = "round";
    p.beginPath(); p.moveTo(0, 0); p.lineTo(32, -18); p.stroke();
    p.fillStyle = pal.engine;
    p.beginPath();
    if (p.roundRect) p.roundRect(28, -36, 28, 21, 4);
    else p.rect(28, -36, 28, 21);
    p.fill();

    // frame and forks
    p.strokeStyle = pal.frame;
    p.lineWidth = 3.4;
    p.beginPath();
    p.moveTo(31, -17);
    p.lineTo(55, -52);
    p.lineTo(104, -55);
    p.stroke();
    p.strokeStyle = "#c9b9a6";
    p.lineWidth = 3.4;
    p.beginPath(); p.moveTo(105, -56); p.lineTo(136, 2); p.stroke();

    // exhaust
    p.strokeStyle = bike.style === "night" ? pal.accent : "#bfae9f";
    p.lineWidth = 3;
    p.beginPath();
    p.moveTo(54, -27);
    p.quadraticCurveTo(29, -21, 4, -26);
    p.stroke();

    // rear fender
    p.strokeStyle = pal.body;
    p.lineWidth = 4.4;
    p.beginPath();
    p.moveTo(-20, -35);
    p.quadraticCurveTo(3, -50, 29, -39);
    p.stroke();

    // seat
    p.fillStyle = pal.seat;
    p.beginPath();
    p.moveTo(6, -49);
    p.quadraticCurveTo(21, -56, 43, -53);
    p.lineTo(49, -46);
    p.quadraticCurveTo(32, -43, 16, -43);
    p.closePath();
    p.fill();

    // tank
    p.fillStyle = pal.body;
    p.beginPath();
    p.moveTo(44, -48);
    p.quadraticCurveTo(62, -60, 79, -57);
    p.quadraticCurveTo(92, -55, 96, -46);
    p.lineTo(91, -35);
    p.quadraticCurveTo(73, -32, 55, -35);
    p.closePath();
    p.fill();
    p.fillStyle = pal.body2;
    p.globalAlpha = 0.8;
    p.beginPath();
    p.moveTo(55, -50);
    p.quadraticCurveTo(67, -57, 82, -54);
    p.quadraticCurveTo(73, -53, 65, -48);
    p.closePath();
    p.fill();
    p.globalAlpha = 1;

    // number plate
    p.fillStyle = pal.accent;
    p.beginPath();
    p.moveTo(83, -47);
    p.lineTo(99, -50);
    p.lineTo(98, -36);
    p.lineTo(87, -34);
    p.closePath();
    p.fill();

    // fender
    p.strokeStyle = pal.body;
    p.lineWidth = 3.6;
    p.beginPath(); p.arc(136, 2, 32, Math.PI * 1.06, Math.PI * 1.94); p.stroke();

    // rider
    p.strokeStyle = pal.pants;
    p.lineWidth = 6;
    p.beginPath();
    p.moveTo(36, -55); p.lineTo(24, -31); p.lineTo(39, -15);
    p.stroke();
    p.strokeStyle = pal.rider;
    p.lineWidth = 10;
    p.beginPath(); p.moveTo(36, -59); p.lineTo(54, -92); p.stroke();
    p.lineWidth = 5;
    p.beginPath(); p.moveTo(53, -91); p.lineTo(79, -80); p.lineTo(103, -66); p.stroke();
    p.fillStyle = pal.helmet;
    p.beginPath(); p.arc(60, -105, 9, 0, TAU); p.fill();
    p.fillStyle = pal.visor;
    p.beginPath();
    p.moveTo(62, -109); p.quadraticCurveTo(71, -108, 70, -102);
    p.quadraticCurveTo(65, -100, 62, -102); p.closePath(); p.fill();
    p.strokeStyle = pal.body;
    p.lineWidth = 1.8;
    p.beginPath(); p.arc(60, -105, 9, Math.PI, Math.PI * 1.55); p.stroke();

    p.restore();
  }

  function updateBikeUI() {
    const bike = BIKES[state.bike];
    const root = document.documentElement;
    root.style.setProperty("--bike", bike.palette.body);
    root.style.setProperty("--bike-2", bike.palette.body2);

    el.bikeSwatch.style.background =
      `radial-gradient(circle at 32% 28%, #fff6, transparent 36%), linear-gradient(140deg, ${bike.palette.body2}, ${bike.palette.body} 62%)`;
    el.bikeName.textContent = bike.name;
    el.menuBikeName.textContent = `${bike.name} ${bike.model}`;
    el.menuBikeClass.textContent = bike.klass;
    el.menuBikeNumber.textContent = "#" + bike.num;
    el.menuBikeTag.textContent = bike.tag;
    el.menuBest.textContent = fmt(bests[bike.id] || 0);
    el.statPower.style.width = (bike.stats.power / 5) * 100 + "%";
    el.statLift.style.width = (bike.stats.lift / 5) * 100 + "%";
    el.statBalance.style.width = (bike.stats.balance / 5) * 100 + "%";
    el.startBtn.style.filter = "";
    renderBikePreview();
  }

  /* ---------------------------------------------------------------------
     PHYSICS
     --------------------------------------------------------------------- */
  function update(dt) {
    state.time += dt;
    state.menuTime += dt;
    const bike = BIKES[state.bike];
    const playing = state.mode === "playing";
    const crashing = state.mode === "crashing";

    if (state.mode === "menu") {
      state.scroll += 7 * dt;
      state.wheelSpin += 0.35 * dt;
      state.bikeScreenX = lerp(state.bikeScreenX, bikeTargetX(), Math.min(1, dt * 4));
      state.theta = Math.sin(state.menuTime * 2.1) * 1.0;
      state.gas = lerp(state.gas, 0.06 + Math.max(0, Math.sin(state.menuTime * 3.4)) * 0.08, Math.min(1, dt * 3));
      updateParticles(dt);
      audio.engine(0, 0.06, false);
      updateHUD();
      return;
    }

    if (state.mode === "over") {
      state.bikeScreenX = lerp(state.bikeScreenX, bikeTargetX(), Math.min(1, dt * 4));
      state.shake = Math.max(0, state.shake - dt * 2.2);
      updateParticles(dt);
      updateHUD();
      return;
    }

    state.bikeScreenX = lerp(state.bikeScreenX, bikeTargetX(), Math.min(1, dt * 6));

    if (crashing) {
      state.crashTimer += dt;
      state.speed = Math.max(0, state.speed - 420 * dt);
      state.gas = lerp(state.gas, 0, Math.min(1, dt * 8));
      state.theta += state.crashSpin * dt;
      if (state.theta >= CRASH_MAX) {
        state.theta = CRASH_MAX;
        state.crashSpin = -Math.abs(state.crashSpin) * 0.16;
        if (Math.abs(state.crashSpin) < 8) state.crashSpin = 0;
      }
      state.omega = 0;
      state.wheelSpin += state.speed * dt * 0.052;
      state.scroll += state.speed * dt * view.scale * 0.78;
      state.shake = Math.max(0, state.shake - dt * 1.7);
      state.flash = Math.max(0, state.flash - dt * 2.4);
      updateParticles(dt);
      spawnAmbient(dt);
      audio.engine(state.speed, 0, false);
      if (state.crashTimer > 1.25) finishRun();
      updateHUD();
      return;
    }

    /* ---- riding ---- */
    const inGas = held("gas");
    const inBrake = held("brake");
    const lean = (held("leanBack") ? 1 : 0) - (held("leanFwd") ? 1 : 0);

    const throttleTarget = inGas ? 1 : 0;
    state.gas = lerp(state.gas, throttleTarget, Math.min(1, dt * 7.5));

    // Longitudinal speed
    const drag = 0.17 * state.speed + 9;
    const brakeForce = inBrake ? 620 : 0;
    const engineAccel = state.gas * bike.accel * (state.theta > 96 ? 0.82 : 1);
    state.speed += (engineAccel - drag - brakeForce) * dt;
    if (state.speed > bike.maxSpeed) state.speed = bike.maxSpeed;
    state.speed = Math.max(0, state.speed);

    // Wheelie / balance physics. The engine gets a little "hotter" the longer
    // a wheelie is held, so a lazy full-throttle cruise eventually needs input.
    const speedFactor = clamp(state.speed / 155, 0, 1);
    const liftFactor = 0.3 + 0.7 * speedFactor;
    const heat = 1 + Math.min(state.wheelieTime / 20, 0.16);
    const liftTorque = state.gas * 120 * bike.lift * liftFactor * heat;
    const thetaRad = state.theta * DEG;
    const gravity = 118 * Math.sin(thetaRad) * (1 + 0.06 * Math.min(state.theta, 110) / 90);
    const leanTorque = lean > 0 ? 31 * lean * bike.balance : 52 * lean;
    const damping = 3.15 * bike.balance * state.omega;
    state.omega += (liftTorque + leanTorque - gravity - damping) * dt;

    // A little trail chatter makes it feel alive without being cruel.
    if (!reduceMotion) {
      const chatter = Math.sin(state.time * 10.7) * 0.55 * speedFactor;
      const wander = Math.sin(state.time * 1.35 + state.wheelieTime * 0.7)
        * (2.2 + Math.min(state.wheelieTime, 14) * 0.75) * speedFactor;
      state.omega += (chatter + wander) * dt;
    }

    state.theta += state.omega * dt;

    if (state.theta < 0) {
      state.theta = 0;
      if (state.omega < 0) state.omega *= -0.18;
      state.omega = Math.max(0, state.omega);
    }

    if (state.theta > MAX_WHEELIE) {
      crash("loopout");
      updateHUD();
      return;
    }

    // Scoring
    state.topSpeed = Math.max(state.topSpeed, state.speed);
    state.distance += state.speed * dt;
    state.score += state.speed * dt * 0.032;

    const inWheelie = state.theta > 13;
    if (inWheelie) {
      state.wheelieTime += dt;
      state.wheeliePeak = Math.max(state.wheeliePeak, state.wheelieTime);
      state.wheelieMult = 1 + Math.min(state.wheelieTime / 5, 3);
      state.score += dt * (14 + state.theta * 1.05) * state.wheelieMult;
      if (state.theta > SWEET_LO && state.theta < SWEET_HI) state.score += dt * 34;
    } else {
      state.wheelieTime = 0;
      state.wheelieMult = 1;
    }

    state.wheelSpin += state.speed * dt * 0.052;
    state.scroll += state.speed * dt * view.scale * 0.78;
    state.shake = Math.max(0, state.shake - dt * 1.9);
    state.flash = Math.max(0, state.flash - dt * 2.5);

    updateParticles(dt);
    spawnAmbient(dt);
    audio.engine(state.speed, state.gas, true);
    updateHUD();
  }

  /* ---------------------------------------------------------------------
     PARTICLES
     --------------------------------------------------------------------- */
  const particles = [];
  let dustTimer = 0;
  let smokeTimer = 0;
  let sparkTimer = 0;

  function bikeAnchor() {
    return {
      x: state.bikeScreenX,
      y: view.groundY - 12 * view.scale,
    };
  }

  function localToScreen(lx, ly, theta, scale = view.scale) {
    const t = theta * DEG;
    const c = Math.cos(t), s = Math.sin(t);
    return {
      x: state.bikeScreenX + (lx * c + ly * s) * scale,
      y: view.groundY - 25 * scale + (-lx * s + ly * c) * scale,
    };
  }

  function addParticle(p) {
    if (particles.length > 220) particles.shift();
    particles.push({
      x: p.x, y: p.y, vx: p.vx, vy: p.vy,
      size: p.size, life: 1, ttl: p.ttl,
      color: p.color, grav: p.grav || 0, drag: p.drag === undefined ? 1.6 : p.drag,
      layer: p.layer || "back", glow: !!p.glow,
    });
  }

  function burstAt(anchor, count, kind) {
    const bike = BIKES[state.bike];
    const pal = bike.palette;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const spd = 40 + Math.random() * (kind === "crash" ? 280 : 150);
      addParticle({
        x: anchor.x + (Math.random() - 0.5) * 30,
        y: anchor.y + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * spd - 40,
        vy: Math.sin(a) * spd - 50,
        size: 2 + Math.random() * 6,
        ttl: 0.5 + Math.random() * 0.8,
        color: kind === "swap"
          ? [pal.body, pal.body2, pal.accent, "#fff1d0"][i % 4]
          : (i % 5 === 0 ? "#ffc857" : "#d99a66"),
        grav: kind === "crash" ? 360 : 160,
        drag: 1.1,
        layer: kind === "swap" ? "front" : "back",
        glow: kind === "swap" || i % 5 === 0,
      });
    }
  }

  function spawnAmbient(dt) {
    const speed = state.speed;
    const theta = state.theta;
    const scale = view.scale;
    const gas = state.gas;

    dustTimer -= dt;
    if (dustTimer <= 0 && speed > 42 && (gas > 0.08 || theta > 18)) {
      dustTimer = 0.038 + Math.random() * 0.035;
      const spread = 16 * scale;
      const n = Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        addParticle({
          x: state.bikeScreenX + (Math.random() - 0.5) * spread,
          y: view.groundY - Math.random() * 5 * scale,
          vx: -35 - Math.random() * 95 - speed * 0.08,
          vy: -18 - Math.random() * 55,
          size: (2.5 + Math.random() * 5.5) * scale,
          ttl: 0.55 + Math.random() * 0.55,
          color: Math.random() < 0.25 ? "#f4c08b" : "#c3855a",
          grav: 18,
          drag: 1.5,
          layer: "back",
        });
      }
    }

    // exhaust puffs
    smokeTimer -= dt;
    if (smokeTimer <= 0 && gas > 0.15) {
      smokeTimer = 0.09 + Math.random() * 0.06;
      const tip = localToScreen(-8, -25, theta, scale);
      addParticle({
        x: tip.x, y: tip.y,
        vx: -55 - Math.random() * 40 + speed * 0.02,
        vy: -14 - Math.random() * 16,
        size: (3 + Math.random() * 4) * scale,
        ttl: 0.4 + Math.random() * 0.35,
        color: "rgba(220,214,210,0.5)",
        grav: -8,
        drag: 1.1,
        layer: "front",
      });
    }

    // danger sparks
    sparkTimer -= dt;
    if (theta > 90 && sparkTimer <= 0) {
      sparkTimer = 0.045;
      addParticle({
        x: state.bikeScreenX + (Math.random() - 0.5) * 20 * scale,
        y: view.groundY - Math.random() * 7 * scale,
        vx: -80 - Math.random() * 160,
        vy: -60 - Math.random() * 130,
        size: (1.4 + Math.random() * 2.2) * scale,
        ttl: 0.28 + Math.random() * 0.3,
        color: Math.random() < 0.5 ? "#ffc857" : "#ff7a3d",
        grav: 420,
        drag: 0.4,
        layer: "front",
        glow: true,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt / p.ttl;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawParticles(layer) {
    for (const p of particles) {
      if (p.layer !== layer) continue;
      const a = clamp(p.life, 0, 1);
      ctx.globalAlpha = a * 0.72;
      if (p.glow) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.8 + (1 - a) * 1.4), 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.65 + (1 - a) * 1.1), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------------
     RENDER — SCENERY
     --------------------------------------------------------------------- */
  const PROP_WRAP = 2800;
  const props = [];
  (function buildProps() {
    let seed = 987654321;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const texts = ["SEND IT", "WHEELIE", "SUNSET DIRT", "FULL SEND", "NO BRAKES"];
    for (let i = 0; i < 30; i++) {
      const r = rnd();
      const type = r < 0.32 ? "cactus" : r < 0.55 ? "rock" : r < 0.76 ? "bush" : r < 0.9 ? "sign" : "post";
      props.push({
        x: i * (PROP_WRAP / 30) + rnd() * 70,
        type,
        size: 0.72 + rnd() * 0.8,
        flip: rnd() < 0.5,
        text: texts[Math.floor(rnd() * texts.length)],
      });
    }
  })();

  function drawSky() {
    const { w, h } = view;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#211147");
    g.addColorStop(0.34, "#5a2867");
    g.addColorStop(0.62, "#c64f67");
    g.addColorStop(0.82, "#ff8d5e");
    g.addColorStop(1, "#ffbd7c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawSun() {
    const { w, h } = view;
    const sx = w * (view.portrait ? 0.78 : 0.74);
    const sy = h * 0.43;
    const r = Math.min(w, h) * 0.075;

    const glow = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 4.2);
    glow.addColorStop(0, "rgba(255,210,130,0.33)");
    glow.addColorStop(0.5, "rgba(255,140,100,0.1)");
    glow.addColorStop(1, "rgba(255,120,90,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(sx, sy, r * 4.2, 0, TAU); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.clip();
    const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r);
    sg.addColorStop(0, "#fff3bb");
    sg.addColorStop(0.6, "#ffc46f");
    sg.addColorStop(1, "#ff8a5d");
    ctx.fillStyle = sg;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(96,32,80,0.5)";
    const bandH = Math.max(2, r * 0.075);
    for (let y = sy + r * 0.12; y < sy + r; y += bandH * 2.2) {
      const t = (y - sy) / r;
      ctx.fillRect(sx - r, y, r * 2, bandH * (0.4 + t * 0.9));
    }
    ctx.restore();
  }

  function drawCloud(x, y, s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffd9c0";
    ctx.beginPath();
    ctx.ellipse(x, y, 52 * s, 13 * s, -0.05, 0, TAU);
    ctx.ellipse(x - 32 * s, y + 3 * s, 30 * s, 10 * s, 0.04, 0, TAU);
    ctx.ellipse(x + 38 * s, y + 2 * s, 26 * s, 8 * s, 0.02, 0, TAU);
    ctx.ellipse(x + 2 * s, y - 10 * s, 28 * s, 12 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawClouds() {
    const { w, h } = view;
    const scroll = state.scroll;
    const baseY = h * 0.2;
    const clouds = [
      [0.08, 1.0, 0.16, 0.30],
      [0.36, 0.7, 0.21, 0.24],
      [0.62, 1.15, 0.13, 0.22],
      [0.9, 0.8, 0.26, 0.18],
    ];
    for (let i = 0; i < clouds.length; i++) {
      const [cx, s, cy, a] = clouds[i];
      const x = mod(cx * w - scroll * (0.012 + i * 0.006), w + 320) - 160;
      drawCloud(x, h * cy, s, a);
    }
  }

  function drawRidge(baseY, amp, color, scrollFactor, freq, phase) {
    const { w, h } = view;
    const off = state.scroll * scrollFactor;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = -20; x <= w + 30; x += 18) {
      const y = baseY
        - (Math.sin((x + off) * freq + phase) * amp
          + Math.sin((x + off) * freq * 2.7 + phase * 1.7) * amp * 0.28
          + amp * 0.58);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 30, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawBackground() {
    drawSky();
    drawSun();
    drawClouds();

    const gy = view.groundY;
    // distant mountains
    drawRidge(gy - 58, 82, "#5b2f5d", 0.045, 0.0042, 0.7);
    drawRidge(gy - 32, 58, "#472a4f", 0.09, 0.0061, 2.1);
    drawRidge(gy - 10, 30, "#3a2342", 0.17, 0.0092, 4.3);

    // haze just above the horizon
    const haze = ctx.createLinearGradient(0, gy - 140, 0, gy + 10);
    haze.addColorStop(0, "rgba(255,150,110,0)");
    haze.addColorStop(1, "rgba(255,170,120,0.22)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, gy - 140, view.w, 150);

    // rolling dunes
    ctx.beginPath();
    ctx.moveTo(0, view.h);
    for (let x = 0; x <= view.w + 20; x += 16) {
      const y = gy - 8
        - Math.sin((x + state.scroll * 0.26) * 0.0072) * 14 * view.scale
        - Math.sin((x + state.scroll * 0.26) * 0.017) * 4 * view.scale;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(view.w + 20, view.h);
    ctx.closePath();
    ctx.fillStyle = "#8e3f38";
    ctx.fill();

    drawGround();
  }

  function drawGround() {
    const { w, h, groundY: gy } = view;
    const g = ctx.createLinearGradient(0, gy, 0, h);
    g.addColorStop(0, "#c27245");
    g.addColorStop(0.16, "#a85637");
    g.addColorStop(0.5, "#88412f");
    g.addColorStop(1, "#3e1c1d");
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, w, h - gy);

    // sunlit surface
    ctx.fillStyle = "rgba(255,200,135,0.5)";
    ctx.fillRect(0, gy - 1, w, 2.5);
    ctx.fillStyle = "rgba(255,188,120,0.16)";
    ctx.fillRect(0, gy + 3, w, 9 * view.scale);

    // track ruts and stripes
    ctx.strokeStyle = "rgba(70,28,26,0.32)";
    ctx.lineWidth = 2;
    for (let r = 0; r < 2; r++) {
      const yBase = gy + (22 + r * 17) * view.scale;
      ctx.beginPath();
      for (let x = 0; x <= w + 16; x += 16) {
        const y = yBase + Math.sin((x + state.scroll + r * 90) * 0.02) * 2.4;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // pebbles / texture
    const count = 46;
    for (let i = 0; i < count; i++) {
      const span = w + 220;
      let x = mod(i * 173 - state.scroll * 1.02, span) - 110;
      const y = gy + 14 + ((i * 61) % Math.max(24, h - gy - 18));
      const s = 0.8 + ((i * 37) % 10) / 9;
      ctx.globalAlpha = 0.15 + ((i * 13) % 10) / 45;
      ctx.fillStyle = i % 3 === 0 ? "#ffcf9b" : "#54251f";
      ctx.beginPath();
      ctx.ellipse(x, y, 2.2 * s, 1.1 * s, (i * 0.7) % 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawProps();
    drawSpeedLines();
  }

  function drawProps() {
    const gy = view.groundY;
    const s = view.scale;
    const off = state.scroll;
    const menu = state.mode === "menu";
    for (const p of props) {
      let x = mod(p.x - off, PROP_WRAP);
      if (x > view.w + 180) continue;
      x -= 80;
      if (x < -180) continue;
      if (menu && Math.abs(x - state.bikeScreenX) < 250) continue;
      const scale = p.size * s;
      if (p.type === "cactus") {
        ctx.save();
        ctx.translate(x, gy + 1);
        ctx.scale(p.flip ? -scale : scale, scale);
        ctx.strokeStyle = "#3c5039";
        ctx.lineCap = "round";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-2, -52);
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-2, -33);
        ctx.lineTo(12, -36);
        ctx.lineTo(13, -47);
        ctx.moveTo(-2, -24);
        ctx.lineTo(-14, -27);
        ctx.lineTo(-15, -40);
        ctx.stroke();
        ctx.strokeStyle = "rgba(142,180,112,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, -8); ctx.lineTo(-5, -46);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === "rock") {
        ctx.save();
        ctx.translate(x, gy + 1);
        ctx.scale(p.flip ? -scale : scale, scale);
        ctx.fillStyle = "#6c3831";
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(-9, -9); ctx.lineTo(1, -12);
        ctx.lineTo(12, -8); ctx.lineTo(16, 0); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,190,135,0.18)";
        ctx.beginPath();
        ctx.moveTo(-9, -9); ctx.lineTo(1, -12); ctx.lineTo(3, -6); ctx.lineTo(-5, -4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (p.type === "bush") {
        ctx.save();
        ctx.translate(x, gy + 1);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#4d4b31";
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc((i - 2) * 7, -6 - (i % 2) * 4, 7 + (i % 3), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      } else if (p.type === "sign") {
        ctx.save();
        ctx.translate(x, gy + 1);
        ctx.scale(p.size * s, p.size * s);
        ctx.rotate(-0.055);
        ctx.strokeStyle = "#4b2c25";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -42);
        ctx.stroke();
        ctx.fillStyle = "#ffe6b8";
        ctx.strokeStyle = "#2a1620";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-34, -58, 68, 22, 3);
        else ctx.rect(-34, -58, 68, 22);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#3a1d27";
        ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.text, 0, -47);
        ctx.restore();
      } else {
        // striped marker post
        ctx.save();
        ctx.translate(x, gy + 1);
        ctx.scale(p.size * s, p.size * s);
        ctx.fillStyle = "#4b2c25";
        ctx.fillRect(-1.5, -28, 3, 28);
        ctx.fillStyle = "#ffe6b8";
        ctx.fillRect(-5, -32, 10, 5);
        ctx.restore();
      }
    }
  }

  function drawSpeedLines() {
    if (state.speed < 180) return;
    const { w, groundY: gy } = view;
    const intensity = clamp((state.speed - 180) / 300, 0, 1);
    ctx.save();
    ctx.globalAlpha = intensity * 0.24;
    ctx.strokeStyle = "#ffe2bc";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 12; i++) {
      const x = mod(i * 191 - state.scroll * 1.6, w + 200) - 100;
      const y = gy - 12 - ((i * 53) % Math.max(20, gy * 0.55));
      const len = 14 + state.speed * 0.09 + (i % 3) * 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------------
     RENDER — BIKE
     --------------------------------------------------------------------- */
  function drawShadow() {
    const { groundY: gy } = view;
    const s = view.scale;
    const lift = clamp(state.theta / 90, 0, 1);
    ctx.save();
    const g = ctx.createRadialGradient(state.bikeScreenX, gy + 2, 2, state.bikeScreenX, gy + 2, 105 * s);
    g.addColorStop(0, `rgba(29,12,18,${0.36 - lift * 0.08})`);
    g.addColorStop(0.6, `rgba(29,12,18,${0.16 - lift * 0.05})`);
    g.addColorStop(1, "rgba(29,12,18,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(state.bikeScreenX + 10 * s, gy + 2, 108 * s, 15 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function wheel(cx, cy, radius, spin, pal, style, front) {
    ctx.save();
    ctx.translate(cx, cy);

    // tire
    ctx.lineWidth = radius * 0.28;
    ctx.strokeStyle = "#17121b";
    ctx.beginPath();
    ctx.arc(0, 0, radius - radius * 0.14, 0, TAU);
    ctx.stroke();

    // tread blocks
    ctx.save();
    ctx.rotate(spin);
    ctx.strokeStyle = "rgba(255,255,255,0.075)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (radius - 5), Math.sin(a) * (radius - 5));
      ctx.lineTo(Math.cos(a) * (radius - 1.5), Math.sin(a) * (radius - 1.5));
      ctx.stroke();
    }
    ctx.restore();

    // rim
    ctx.strokeStyle = pal.rim;
    ctx.globalAlpha = style === "night" ? 0.95 : 0.8;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.66, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // spokes
    ctx.save();
    ctx.rotate(spin);
    ctx.strokeStyle = pal.rim;
    ctx.globalAlpha = style === "night" ? 0.9 : 0.55;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * (radius * 0.6), Math.sin(a) * (radius * 0.6));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // hub / brake disc
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(0, 0, front ? 4.2 : 3.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(30,24,32,0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.28, 0, TAU); ctx.stroke();

    ctx.restore();
  }

  function drawRider(pal, style, lean) {
    const shift = -lean * 3.2;
    const bob = reduceMotion ? 0 : Math.sin(state.time * 12) * 0.35;

    // far leg
    ctx.strokeStyle = pal.pants;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(34, -55);
    ctx.lineTo(23 + shift * 0.2, -31 + bob);
    ctx.lineTo(37, -15 + bob);
    ctx.stroke();

    // torso
    ctx.strokeStyle = pal.rider;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(36, -59);
    ctx.lineTo(55 + shift, -93 + bob);
    ctx.stroke();

    // jersey stripe
    ctx.strokeStyle = pal.body;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(40, -66);
    ctx.lineTo(52 + shift, -87 + bob);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // near leg
    ctx.strokeStyle = style === "night" ? pal.pants : pal.pants;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(40, -56);
    ctx.lineTo(47 + shift * 0.3, -30 + bob);
    ctx.lineTo(54, -17 + bob);
    ctx.stroke();

    // boot
    ctx.fillStyle = "#141016";
    ctx.beginPath();
    ctx.ellipse(56, -15 + bob, 7, 4, -0.15, 0, TAU);
    ctx.fill();

    // arm
    ctx.strokeStyle = pal.rider;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(52 + shift, -91 + bob);
    ctx.lineTo(79, -80 + bob);
    ctx.lineTo(103, -66);
    ctx.stroke();

    // glove
    ctx.fillStyle = "#151118";
    ctx.beginPath(); ctx.arc(104, -65, 3.6, 0, TAU); ctx.fill();

    // neck
    ctx.strokeStyle = pal.rider;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(57 + shift, -95 + bob);
    ctx.lineTo(60 + shift, -100 + bob);
    ctx.stroke();

    // helmet
    const hx = 61 + shift;
    const hy = -106 + bob;
    ctx.fillStyle = pal.helmet;
    ctx.beginPath();
    ctx.arc(hx, hy, 10.5, 0, TAU);
    ctx.fill();

    // jaw / chin bar
    ctx.fillStyle = pal.helmet;
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy + 5);
    ctx.quadraticCurveTo(hx + 8, hy + 10, hx + 11, hy + 2);
    ctx.quadraticCurveTo(hx + 4, hy + 9, hx - 4, hy + 8);
    ctx.closePath();
    ctx.fill();

    // visor
    ctx.fillStyle = pal.visor;
    ctx.beginPath();
    ctx.moveTo(hx + 1, hy - 4);
    ctx.quadraticCurveTo(hx + 11, hy - 5, hx + 12, hy + 2);
    ctx.quadraticCurveTo(hx + 7, hy + 4, hx + 1, hy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hx + 3, hy - 2);
    ctx.lineTo(hx + 9, hy - 1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // helmet stripe
    ctx.strokeStyle = pal.body;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(hx, hy, 10.5, Math.PI * 1.04, Math.PI * 1.5);
    ctx.stroke();
  }

  function drawBike() {
    const bike = BIKES[state.bike];
    const pal = bike.palette;
    const s = view.scale;
    const theta = state.mode === "menu"
      ? state.theta
      : state.theta;
    const lean = (held("leanBack") ? 1 : 0) - (held("leanFwd") ? 1 : 0);
    const axleY = view.groundY - 25 * s;
    const menuBob = state.mode === "menu" && !reduceMotion ? Math.sin(state.menuTime * 3.1) * 0.7 : 0;

    ctx.save();
    ctx.translate(state.bikeScreenX, axleY + menuBob);
    ctx.scale(s, s);

    // rear wheel (stays planted; frame rotates around the axle)
    wheel(0, 0, 25, state.wheelSpin, pal, bike.style, false);

    // rotating frame
    ctx.save();
    ctx.rotate(-theta * DEG);

    // front wheel, tucked behind the fork
    wheel(136, 2, 23, state.wheelSpin * 1.08, pal, bike.style, true);

    // swingarm
    ctx.strokeStyle = pal.frame;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(33, -17);
    ctx.stroke();

    // chain
    ctx.strokeStyle = "rgba(230,210,180,0.34)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(32, -33);
    ctx.stroke();

    // shock
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(24, -40);
    ctx.lineTo(34, -19);
    ctx.stroke();
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(25, -38);
    ctx.lineTo(33, -21);
    ctx.stroke();

    // engine
    ctx.fillStyle = pal.engine;
    roundRect(28, -37, 29, 22, 5);
    ctx.fill();
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 2;
    ctx.stroke();
    // cylinder fins
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(34 + i * 5.5, -35);
      ctx.lineTo(34 + i * 5.5, -19);
      ctx.stroke();
    }
    // skid plate
    ctx.fillStyle = pal.frame;
    roundRect(31, -17, 22, 4, 2);
    ctx.fill();

    // frame tubes
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(31, -17);
    ctx.lineTo(55, -52);
    ctx.lineTo(104, -55);
    ctx.stroke();
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(31, -17);
    ctx.lineTo(58, -30);
    ctx.stroke();

    // exhaust
    const exhaustColor = bike.style === "night" ? pal.accent : "#bfae9f";
    ctx.strokeStyle = exhaustColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(54, -28);
    ctx.quadraticCurveTo(31, -22, 8, -25);
    ctx.quadraticCurveTo(-2, -26, -9, -29);
    ctx.stroke();
    ctx.fillStyle = "#d8c7b5";
    roundRect(-13, -32, 6, 6, 2);
    ctx.fill();
    if (bike.style === "titan") {
      ctx.strokeStyle = exhaustColor;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(56, -23);
      ctx.quadraticCurveTo(36, -14, 18, -16);
      ctx.stroke();
    }

    // rear fender
    ctx.strokeStyle = pal.body;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-20, -35);
    ctx.quadraticCurveTo(3, -50, 29, -39);
    ctx.stroke();
    ctx.strokeStyle = pal.body2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-17, -38);
    ctx.quadraticCurveTo(4, -52, 27, -42);
    ctx.stroke();

    // seat
    ctx.fillStyle = pal.seat;
    ctx.beginPath();
    ctx.moveTo(6, -49);
    ctx.quadraticCurveTo(21, -56, 43, -53);
    ctx.lineTo(49, -46);
    ctx.quadraticCurveTo(32, -43, 16, -43);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(9, -50);
    ctx.quadraticCurveTo(23, -55, 42, -52);
    ctx.stroke();

    // tank / bodywork
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.moveTo(44, -48);
    ctx.quadraticCurveTo(62, -60, 79, -57);
    ctx.quadraticCurveTo(92, -55, 96, -46);
    ctx.lineTo(91, -35);
    ctx.quadraticCurveTo(73, -32, 55, -35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 2;
    ctx.stroke();

    // tank highlight
    ctx.fillStyle = pal.body2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(54, -50);
    ctx.quadraticCurveTo(66, -58, 82, -54);
    ctx.quadraticCurveTo(74, -53, 64, -48);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // radiator shroud / number plate
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(83, -47);
    ctx.lineTo(99, -50);
    ctx.lineTo(98, -36);
    ctx.lineTo(87, -34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (bike.style !== "night") {
      ctx.fillStyle = pal.frame;
      ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bike.num, 92, -42);
    }

    // front fender
    ctx.strokeStyle = bike.style === "sport" ? pal.accent : pal.body;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(136, 2, 32, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.strokeStyle = pal.body2;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(136, 2, 34, Math.PI * 1.12, Math.PI * 1.9);
    ctx.stroke();

    // forks
    ctx.strokeStyle = bike.style === "titan" ? "#8c8377" : "#c9b9a6";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(105, -58);
    ctx.lineTo(136, 2);
    ctx.stroke();
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(97, -66);
    ctx.lineTo(108, -53);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(103, -54);
    ctx.lineTo(131, -1);
    ctx.stroke();

    // handlebar
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(96, -68);
    ctx.lineTo(107, -64);
    ctx.stroke();
    ctx.fillStyle = "#18131c";
    roundRect(105, -68, 10, 5, 2);
    ctx.fill();

    // footpeg
    ctx.strokeStyle = pal.frame;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(50, -13);
    ctx.lineTo(58, -12);
    ctx.stroke();

    // neon underglow for the factory special
    if (bike.style === "night") {
      ctx.strokeStyle = pal.accent;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(35, -18);
      ctx.lineTo(88, -34);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawRider(pal, bike.style, lean);

    ctx.restore(); // frame rotation
    ctx.restore(); // translate / scale
  }

  /* ---------------------------------------------------------------------
     HUD
     --------------------------------------------------------------------- */
  const fmt = (n) => Math.floor(n).toLocaleString("en-US");

  let lastChipState = "";
  function updateHUD() {
    const bike = BIKES[state.bike];
    const playing = state.mode === "playing";
    const theta = state.theta;
    const displayScore = Math.floor(state.score);

    el.score.textContent = fmt(displayScore);
    el.hudBest.textContent = fmt(bests[bike.id] || 0);

    el.angleRead.textContent = Math.round(theta) + "°";
    el.speedRead.textContent = Math.round(state.speed * 0.36) + " km/h";
    el.gaugeFill.style.width = clamp(theta / 120, 0, 1) * 100 + "%";
    el.gaugeNeedle.style.left = clamp(theta / 120, 0, 1) * 100 + "%";
    el.gauge.classList.toggle("danger", playing && theta > 90);

    const active = playing && theta > 13;
    el.wheelieChip.classList.toggle("show", active);
    el.gauge.style.setProperty("--needle-color", theta > 90 ? "#ff3b5c" : "#fff");

    if (active) {
      el.wheelieTime.textContent = state.wheelieTime.toFixed(1) + "s";
      el.wheelieMult.textContent = "×" + state.wheelieMult.toFixed(1);
      const chipState = theta > 90 ? "danger" : (theta > SWEET_LO && theta < SWEET_HI) ? "sweet" : "normal";
      if (chipState !== lastChipState) {
        el.wheelieChip.classList.toggle("sweet", chipState === "sweet");
        el.wheelieChip.classList.toggle("danger", chipState === "danger");
        lastChipState = chipState;
      }
    } else if (lastChipState !== "normal") {
      el.wheelieChip.classList.remove("sweet", "danger");
      lastChipState = "normal";
    }
  }

  /* ---------------------------------------------------------------------
     TOAST
     --------------------------------------------------------------------- */
  let toastTimer = 0;
  function showToast(html, duration = 1800) {
    el.toast.innerHTML = html;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), duration);
  }

  /* ---------------------------------------------------------------------
     RENDER LOOP
     --------------------------------------------------------------------- */
  function render() {
    const { w, h, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    let shakeX = 0, shakeY = 0;
    if (state.shake > 0.001 && !reduceMotion) {
      shakeX = (Math.random() - 0.5) * state.shake * 13;
      shakeY = (Math.random() - 0.5) * state.shake * 9;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground();
    drawShadow();
    drawParticles("back");
    drawBike();
    drawParticles("front");

    ctx.restore();

    if (state.flash > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,196,120,${state.flash * 0.22})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------
     BOOT
     --------------------------------------------------------------------- */
  function boot() {
    resize();
    // make the coordinates valid before the first paint
    state.bikeScreenX = bikeTargetX();
    updateBikeUI();
    updateMuteUI();
    updateHUD();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 120));
    document.addEventListener("visibilitychange", () => { lastTime = performance.now(); });
    requestAnimationFrame(frame);
  }

  // small debug handle used by automated checks; harmless in normal play
  window.__WHEELIE_RIDER__ = {
    state,
    bikes: BIKES,
    start: startRun,
    crash,
    finish: finishRun,
    garage: toGarage,
    pickBike: (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= BIKES.length) return;
      state.bike = index;
      updateBikeUI();
    },
    inputs: () => ({
      gas: held("gas"), brake: held("brake"),
      leanBack: held("leanBack"), leanFwd: held("leanFwd"),
      keys: { ...keys }, pointers: pointers.size,
    }),
  };

  function roundRect(x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  boot();
})();
