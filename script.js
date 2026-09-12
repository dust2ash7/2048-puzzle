(() => {
  "use strict";
  const SIZE = 4;
  const WIN = 2048;
  const MOVE_MS = 160;
  const STORE = "2048premium.v1";
  const $ = (id) => document.getElementById(id);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animMs = reduced ? 0 : MOVE_MS;
  const els = {
    html: document.documentElement,
    board: $("board"),
    tiles: $("tiles"),
    score: $("score"),
    best: $("best"),
    bestTile: $("best-tile"),
    scorePop: $("score-pop"),
    live: $("live"),
    dailyMeta: $("daily-meta"),
    mute: $("btn-mute"),
    iconSound: $("icon-sound"),
    iconMute: $("icon-mute"),
    undo: $("btn-undo"),
    neu: $("btn-new"),
    start: $("start-overlay"),
    win: $("win-overlay"),
    over: $("over-overlay"),
    stats: $("stats-overlay"),
    winCopy: $("win-copy"),
    overCopy: $("over-copy"),
    modeClassic: $("mode-classic"),
    modeDaily: $("mode-daily"),
  };
  let idSeq = 1;
  let board = emptyBoard();
  let score = 0;
  let over = false;
  let won = false;
  let continued = false;
  let busy = false;
  let started = false;
  let mode = "classic";
  let rng = null;
  let undoSnap = null;
  let audioCtx = null;
  let masterGain = null;
  let musicEl = null;
  let musicStarted = false;
  let musicWanted = false;
  let muted = false;
  let theme = "obsidian";
  const MUSIC_VOL = 0.14;
  const MASTER_VOL = 0.7;
  const MUSIC_SRC = "./audio/music-bed.mp3";
  const stats = { bestScore: 0, bestTile: 2, gamesPlayed: 0, wins: 0 };
  let daily = { date: utcDate(), best: 0 };
  let countedGame = false;
  let moveGen = 0;
  function emptyBoard() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }
  function utcDate() { return new Date().toISOString().slice(0, 10); }
  function formatDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function makeRng(seed) {
    let s = seed >>> 0;
    return {
      get state() { return s; },
      set state(v) { s = v >>> 0; },
      next() {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
    };
  }
  function rand() { return rng ? rng.next() : Math.random(); }
  let pendingRun = null;
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || "{}");
      if (raw.stats) Object.assign(stats, raw.stats);
      if (raw.daily && raw.daily.date === utcDate()) daily = raw.daily;
      else daily = { date: utcDate(), best: 0 };
      if (raw.theme) theme = raw.theme;
      muted = !!raw.muted;
      pendingRun = raw.run || null;
      return raw;
    } catch (_) {
      pendingRun = null;
      return {};
    }
  }
  function captureRun() {
    if (!started || over) return null;
    return {
      mode,
      score: score|0,
      won,
      continued,
      idSeq,
      countedGame,
      board: board.map((row) => row.map((c) => (c ? { id: c.id, value: c.value } : null))),
      rngState: rng ? rng.state : null,
      dailyDate: mode === "daily" ? utcDate() : null,
    };
  }
  function save() {
    const run = captureRun();
    localStorage.setItem(STORE, JSON.stringify({
      stats,
      daily,
      theme,
      muted,
      run: run !== null ? run : (started ? null : pendingRun),
    }));
  }
  function isResumable(run) {
    if (!run || !run.board) return false;
    if (run.mode === "daily" && run.dailyDate !== utcDate()) return false;
    return true;
  }
  function resumeRun(raw) {
    const run = raw && raw.run;
    if (!isResumable(run)) return false;
    if (run.mode === "daily") {
      const today = utcDate();
      if (daily.date !== today) daily = { date: today, best: 0 };
      rng = makeRng(hashSeed("2048-daily-" + today));
      if (run.rngState != null) rng.state = run.rngState;
    } else {
      rng = null;
    }
    mode = run.mode === "daily" ? "daily" : "classic";
    board = run.board.map((row) => row.map((c) => (c ? { id: c.id, value: c.value } : null)));
    score = Number(run.score) || 0;
    won = !!run.won;
    continued = !!run.continued;
    over = false;
    idSeq = run.idSeq || 1;
    countedGame = !!run.countedGame;
    busy = false;
    started = true;
    setUndo(null);
    rebuildTiles();
    hideOverlay(els.start);
    hideOverlay(els.win);
    hideOverlay(els.over);
    if (won && !continued) {
      const hi = highestTile();
      els.winCopy.textContent = "You reached " + hi + ". Score " + score + ". Keep sliding, or start a fresh grid.";
      showOverlay(els.win);
    }
    pendingRun = null;
    updateModeUi();
    refreshMeters(0);
    announce(mode === "daily" ? "Daily challenge resumed." : "Game resumed.");
    return true;
  }
  function confirmNewGame() {
    if (score > 0 && !window.confirm("Start a new game? Your current progress will be lost.")) {
      return false;
    }
    return true;
  }
  function shareText() {
    const hi = highestTile();
    const bit = mode === "daily" ? "Daily " + utcDate() + " · " : "";
    return "2048 Premium — " + bit + "score " + score + ", best tile " + hi + ". https://dust2ash7.github.io/2048-puzzle/";
  }
  async function shareResult() {
    const text = shareText();
    const url = "https://dust2ash7.github.io/2048-puzzle/";
    try {
      if (navigator.share) {
        await navigator.share({ title: "2048 Premium", text, url });
        announce("Shared.");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(text);
      announce("Copied to clipboard.");
    } catch (_) {
      announce("Could not copy result.");
    }
  }
  function applyTheme(name) {
    theme = name;
    els.html.setAttribute("data-theme", name);
    document.querySelectorAll(".swatch").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeId === name));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    const cs = getComputedStyle(els.html);
    if (meta) meta.setAttribute("content", cs.getPropertyValue("--theme-color").trim() || "#0e0c0a");
    save();
  }
  function setMuted(v) {
    muted = v;
    els.mute.setAttribute("aria-pressed", String(muted));
    els.mute.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    els.iconSound.classList.toggle("is-hidden", muted);
    els.iconMute.classList.toggle("is-hidden", !muted);
    if (masterGain) masterGain.gain.value = muted ? 0 : MASTER_VOL;
    if (musicEl) {
      if (muted) {
        musicEl.pause();
      } else if (musicWanted) {
        musicEl.volume = over ? 0.03 : MUSIC_VOL;
        const p = musicEl.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    }
    save();
  }
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
      if (audioCtx) {
        masterGain = audioCtx.createGain();
        masterGain.gain.value = muted ? 0 : MASTER_VOL;
        masterGain.connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function ensureMusicEl() {
    if (musicEl) return musicEl;
    const el = new Audio(MUSIC_SRC);
    el.loop = true;
    el.preload = "auto";
    el.volume = MUSIC_VOL;
    musicEl = el;
    return el;
  }
  function musicStop() {
    musicWanted = false;
    musicStarted = false;
    if (musicEl) {
      try { musicEl.pause(); } catch (_) {}
      try { musicEl.currentTime = 0; } catch (_) {}
    }
  }
  function musicStart() {
    musicWanted = true;
    ensureAudio();
    if (muted) return;
    const el = ensureMusicEl();
    el.volume = MUSIC_VOL;
    const p = el.play();
    if (p && typeof p.then === "function") {
      p.then(() => { musicStarted = true; }).catch(() => { musicStarted = false; });
    } else {
      musicStarted = true;
    }
  }
  function duckMusic(level, holdMs) {
    if (!musicWanted || muted || !musicEl) return;
    musicEl.volume = Math.max(0, Math.min(1, level));
    setTimeout(() => {
      if (!musicWanted || muted || !musicEl) return;
      if (!over) musicEl.volume = MUSIC_VOL;
      else musicEl.volume = 0.03;
    }, holdMs);
  }
  function tone(freq, dur, type, vol, delay) {
    if (muted || !audioCtx || !masterGain) return;
    const t0 = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(Math.max(0.0001, vol), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  function sfx(kind, value) {
    if (muted) return;
    ensureAudio();
    if (!audioCtx) return;
    if (kind === "move") tone(240, 0.08, "sine", 0.05);
    else if (kind === "spawn") tone(520, 0.07, "triangle", 0.04);
    else if (kind === "merge") {
      const base = 320 + Math.log2(Math.max(value, 4)) * 42;
      tone(base, 0.16, "triangle", 0.08);
      tone(base * 1.5, 0.12, "sine", 0.04, 0.02);
    } else if (kind === "win") {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, "sine", 0.07, i * 0.09));
    } else if (kind === "over") {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, "sine", 0.05, i * 0.1));
    }
  }

  function ensureFxLayer() {
    let layer = els.board.querySelector(".fx-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "fx-layer";
      layer.setAttribute("aria-hidden", "true");
      els.board.appendChild(layer);
    }
    return layer;
  }
  function cellCenter(r, c) {
    const gap = parseFloat(getComputedStyle(els.board).getPropertyValue("--gap")) || 10;
    const rect = els.board.getBoundingClientRect();
    const pad = gap;
    const inner = Math.min(rect.width, rect.height) - pad * 2;
    const cell = (inner - gap * 3) / 4;
    const x = pad + c * (cell + gap) + cell / 2;
    const y = pad + r * (cell + gap) + cell / 2;
    return { x, y, cell };
  }
  function tileAccent(value) {
    const face = document.createElement("div");
    face.className = "tile-face tile-v" + value;
    face.style.position = "absolute";
    face.style.visibility = "hidden";
    face.style.pointerEvents = "none";
    els.board.appendChild(face);
    const bg = getComputedStyle(face).backgroundColor;
    face.remove();
    return bg || getComputedStyle(els.html).getPropertyValue("--accent").trim() || "#e2a35a";
  }
  function themeAccentColors() {
    const cs = getComputedStyle(els.html);
    const keys = ["--accent", "--v8", "--v16", "--v32", "--v64", "--v128", "--v256", "--v512"];
    return keys.map((k) => cs.getPropertyValue(k).trim()).filter(Boolean);
  }
  function spawnSparks(r, c, value) {
    if (reduced) return;
    const layer = ensureFxLayer();
    const { x, y } = cellCenter(r, c);
    const color = tileAccent(value);
    const n = Math.max(8, Math.round(8 + Math.log2(Math.max(value, 2))));
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "spark";
      const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.4;
      const dist = 18 + Math.random() * 28 + Math.min(24, Math.log2(value) * 2);
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.setProperty("--spark", color);
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      p.style.setProperty("--spark-ms", 380 + Math.random() * 120 + "ms");
      layer.appendChild(p);
      setTimeout(() => p.remove(), 560);
    }
  }
  function spawnSoftRing(tileWrap) {
    if (reduced || !tileWrap) return;
    const ring = document.createElement("span");
    ring.className = "soft-ring";
    ring.setAttribute("aria-hidden", "true");
    tileWrap.appendChild(ring);
    setTimeout(() => ring.remove(), 560);
  }
  function floatMergeScore(r, c, value) {
    const layer = ensureFxLayer();
    const { x, y } = cellCenter(r, c);
    const el = document.createElement("span");
    el.className = "float-score";
    el.textContent = "+" + value;
    el.style.left = x + "px";
    el.style.top = y + "px";
    layer.appendChild(el);
    setTimeout(() => el.remove(), reduced ? 50 : 820);
  }
  function boardShakeFor(value) {
    if (reduced) return;
    let cls = null;
    let ms = 0;
    if (value >= 512) { cls = "is-shake-lg"; ms = 120; }
    else if (value >= 128) { cls = "is-shake-sm"; ms = 80; }
    if (!cls) return;
    els.board.classList.remove("is-shake-sm", "is-shake-lg");
    void els.board.offsetWidth;
    els.board.classList.add(cls);
    setTimeout(() => els.board.classList.remove(cls), ms + 20);
  }
  function hitstopMs(merges) {
    if (reduced) return 0;
    let maxV = 0;
    for (const m of merges) if (m.value > maxV) maxV = m.value;
    if (maxV >= 256) {
      els.board.classList.add("is-hitstop");
      setTimeout(() => els.board.classList.remove("is-hitstop"), 30);
      return 30;
    }
    return 0;
  }
  function playMergeJuice(merges) {
    if (!merges || !merges.length) return 0;
    let maxV = 0;
    for (const m of merges) {
      if (m.value > maxV) maxV = m.value;
      spawnSparks(m.r, m.c, m.value);
      floatMergeScore(m.r, m.c, m.value);
    }
    boardShakeFor(maxV);
    return hitstopMs(merges);
  }
  function winFlourish(done) {
    if (!reduced) {
      els.board.classList.remove("is-pulse");
      void els.board.offsetWidth;
      els.board.classList.add("is-pulse");
      setTimeout(() => els.board.classList.remove("is-pulse"), 920);
      const layer = ensureFxLayer();
      const colors = themeAccentColors();
      const rect = els.board.getBoundingClientRect();
      const n = 48;
      for (let i = 0; i < n; i++) {
        const bit = document.createElement("span");
        bit.className = "confetti";
        const x = Math.random() * rect.width;
        const y = Math.random() * rect.height * 0.35;
        bit.style.left = x + "px";
        bit.style.top = y + "px";
        bit.style.setProperty("--confetti", colors[i % colors.length] || "var(--accent)");
        bit.style.setProperty("--dx", (Math.random() - 0.5) * 160 + "px");
        bit.style.setProperty("--dy", 80 + Math.random() * 220 + "px");
        bit.style.setProperty("--rot", (Math.random() * 520 - 260) + "deg");
        bit.style.setProperty("--c-ms", 900 + Math.random() * 400 + "ms");
        layer.appendChild(bit);
        setTimeout(() => bit.remove(), 1400);
      }
    }
    setTimeout(done, reduced ? 0 : 1000);
  }
  function overJuice() {
    if (reduced) return;
    els.board.classList.remove("is-over-juice");
    void els.board.offsetWidth;
    els.board.classList.add("is-over-juice");
    setTimeout(() => els.board.classList.remove("is-over-juice"), 720);
    const layer = ensureFxLayer();
    const { x, y } = cellCenter(1.5, 1.5);
    const color = getComputedStyle(els.html).getPropertyValue("--muted").trim() || "#888";
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("span");
      p.className = "spark";
      const ang = (Math.PI * 2 * i) / 12;
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.setProperty("--spark", color);
      p.style.setProperty("--dx", Math.cos(ang) * 36 + "px");
      p.style.setProperty("--dy", Math.sin(ang) * 36 + "px");
      p.style.opacity = "0.55";
      layer.appendChild(p);
      setTimeout(() => p.remove(), 500);
    }
  }

  function announce(msg) { els.live.textContent = msg; }
  function snapshot() {
    return {
      board: board.map((row) => row.map((c) => (c ? { id: c.id, value: c.value } : null))),
      score, over, won, continued, idSeq,
      rngState: rng ? rng.state : null,
      countedGame,
    };
  }
  function restore(snap) {
    board = snap.board.map((row) => row.map((c) => (c ? { id: c.id, value: c.value } : null)));
    score = snap.score; over = snap.over; won = snap.won; continued = snap.continued;
    idSeq = snap.idSeq; countedGame = snap.countedGame;
    if (rng && snap.rngState != null) rng.state = snap.rngState;
    rebuildTiles(); refreshMeters(0); setUndo(null);
    hideOverlay(els.win); hideOverlay(els.over);
  }
  function empties() {
    const out = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board[r][c]) out.push([r, c]);
    return out;
  }
  function spawn() {
    const spots = empties();
    if (!spots.length) return null;
    const [r, c] = spots[Math.floor(rand() * spots.length)];
    const value = rand() < 0.9 ? 2 : 4;
    const tile = { id: idSeq++, value };
    board[r][c] = tile;
    return { r, c, tile };
  }
  function lineCells(dir, index) {
    const cells = [];
    if (dir === "left") for (let c = 0; c < SIZE; c++) cells.push({ r: index, c });
    else if (dir === "right") for (let c = SIZE - 1; c >= 0; c--) cells.push({ r: index, c });
    else if (dir === "up") for (let r = 0; r < SIZE; r++) cells.push({ r, c: index });
    else for (let r = SIZE - 1; r >= 0; r--) cells.push({ r, c: index });
    return cells;
  }
  function computeMove(dir) {
    const next = emptyBoard();
    const absorbed = [];
    const merges = [];
    let scoreDelta = 0;
    let changed = false;
    for (let i = 0; i < SIZE; i++) {
      const coords = lineCells(dir, i);
      const packed = [];
      for (const pos of coords) {
        const t = board[pos.r][pos.c];
        if (t) packed.push({ ...t, fromR: pos.r, fromC: pos.c });
      }
      const placed = [];
      let p = 0;
      while (p < packed.length) {
        const cur = packed[p];
        const nxt = packed[p + 1];
        const dest = coords[placed.length];
        if (nxt && cur.value === nxt.value) {
          const value = cur.value * 2;
          placed.push({ id: cur.id, value, merge: true });
          next[dest.r][dest.c] = { id: cur.id, value };
          absorbed.push({ id: nxt.id, r: dest.r, c: dest.c });
          merges.push({ id: cur.id, value, r: dest.r, c: dest.c });
          scoreDelta += value;
          changed = true;
          p += 2;
        } else {
          placed.push({ id: cur.id, value: cur.value, merge: false });
          next[dest.r][dest.c] = { id: cur.id, value: cur.value };
          if (cur.fromR !== dest.r || cur.fromC !== dest.c) changed = true;
          p += 1;
        }
      }
    }
    return { next, absorbed, merges, scoreDelta, changed };
  }
  function canMove() {
    if (empties().length) return true;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const v = board[r][c].value;
      if (c + 1 < SIZE && board[r][c + 1].value === v) return true;
      if (r + 1 < SIZE && board[r + 1][c].value === v) return true;
    }
    return false;
  }
  function highestTile() {
    let m = 0;
    for (const row of board) for (const t of row) if (t && t.value > m) m = t.value;
    return m;
  }
  function tileEl(id) { return els.tiles.querySelector(`[data-id="${id}"]`); }
  function makeTile(id, value, r, c, extraClass) {
    const wrap = document.createElement("div");
    wrap.className = "tile no-trans" + (extraClass ? " " + extraClass : "");
    wrap.dataset.id = String(id);
    wrap.style.setProperty("--r", r);
    wrap.style.setProperty("--c", c);
    const face = document.createElement("div");
    face.className = "tile-face tile-v" + value;
    face.textContent = value;
    wrap.appendChild(face);
    els.tiles.appendChild(wrap);
    wrap.offsetHeight;
    wrap.classList.remove("no-trans");
    if (extraClass && extraClass.split(/\s+/).includes("is-new")) spawnSoftRing(wrap);
    return wrap;
  }
  function paintFace(el, value) {
    const face = el.querySelector(".tile-face");
    face.className = "tile-face tile-v" + value;
    face.textContent = value;
  }
  function rebuildTiles() {
    els.tiles.innerHTML = "";
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const t = board[r][c];
      if (t) makeTile(t.id, t.value, r, c);
    }
  }
  function refreshMeters(delta) {
    els.score.textContent = String(score);
    els.best.textContent = String(stats.bestScore);
    els.bestTile.textContent = String(stats.bestTile);
    els.undo.disabled = !undoSnap || busy;
    if (delta) {
      els.scorePop.textContent = "+" + delta;
      els.scorePop.classList.remove("is-on");
      void els.scorePop.offsetWidth;
      els.scorePop.classList.add("is-on");
    }
  }
  function persistProgress() {
    const hi = highestTile();
    if (score > stats.bestScore) stats.bestScore = score;
    if (hi > stats.bestTile) stats.bestTile = hi;
    if (mode === "daily" && daily.date === utcDate() && score > daily.best) daily.best = score;
    save();
    refreshMeters(0);
  }
  function setUndo(snap) {
    undoSnap = snap;
    els.undo.disabled = !undoSnap;
    $("win-undo").disabled = !undoSnap;
    $("over-undo").disabled = !undoSnap;
  }
  function hideOverlay(node) { node.classList.remove("is-open"); node.hidden = true; }
  function showOverlay(node) { node.hidden = false; requestAnimationFrame(() => node.classList.add("is-open")); }
  function updateModeUi() {
    els.modeClassic.setAttribute("aria-selected", String(mode === "classic"));
    els.modeDaily.setAttribute("aria-selected", String(mode === "daily"));
    const today = utcDate();
    if (mode === "daily") els.dailyMeta.textContent = "Daily · " + formatDate(today) + " UTC · best " + daily.best;
    else els.dailyMeta.textContent = "Classic run · best " + stats.bestScore;
  }
  function fillStatsPanel() {
    $("stat-best").textContent = String(stats.bestScore);
    $("stat-tile").textContent = String(stats.bestTile);
    $("stat-games").textContent = String(stats.gamesPlayed);
    $("stat-wins").textContent = String(stats.wins);
    $("stat-daily").textContent = daily.date === utcDate() ? String(daily.best) : "-";
  }
  function newGame(nextMode) {
    pendingRun = null;
    mode = nextMode || mode;
    if (mode === "daily") {
      const today = utcDate();
      if (daily.date !== today) daily = { date: today, best: 0 };
      rng = makeRng(hashSeed("2048-daily-" + today));
    } else rng = null;
    board = emptyBoard(); score = 0; over = false; won = false; continued = false; busy = false;
    idSeq = 1; countedGame = false; moveGen += 1; setUndo(null);
    hideOverlay(els.win); hideOverlay(els.over); els.tiles.innerHTML = "";
    const a = spawn(); const b = spawn();
    if (a) makeTile(a.tile.id, a.tile.value, a.r, a.c, "is-new");
    if (b) makeTile(b.tile.id, b.tile.value, b.r, b.c, "is-new");
    persistProgress(); refreshMeters(0); updateModeUi();
    announce(mode === "daily" ? "Daily challenge started." : "New game.");
  }
  function markGameStarted() {
    if (!countedGame) { stats.gamesPlayed += 1; countedGame = true; save(); }
  }
  function afterMove(merges, scoreDelta, spawned) {
    persistProgress(); refreshMeters(scoreDelta);
    if (scoreDelta) announce("Score " + score + (merges.length ? ", merged " + merges.map((m) => m.value).join(", ") : ""));
    const hi = highestTile();
    const locked = !canMove();
    if (!won && !continued && hi >= WIN) {
      won = true; stats.wins += 1; save();
      sfx("win"); duckMusic(0.04, 1200);
      els.winCopy.textContent = "You reached " + hi + ". Score " + score + ". Keep sliding, or start a fresh grid.";
      announce("You win. Score " + score + ".");
      if (locked) over = true;
      winFlourish(() => {
        showOverlay(els.win);
        busy = false;
        els.undo.disabled = !undoSnap;
      });
      return;
    } else if (locked) {
      over = true; sfx("over"); duckMusic(0.03, 1500);
      els.overCopy.textContent = "Final score " + score + ". Highest tile " + hi + ".";
      overJuice();
      showOverlay(els.over);
      announce("Game over. Score " + score + ".");
      save();
    }
    busy = false;
    els.undo.disabled = !undoSnap;
  }
  function overlayOpen() {
    return ["start", "win", "over", "stats"].some((id) => $(id + "-overlay").classList.contains("is-open"));
  }
  function move(dir) {
    if (!started || busy || over || overlayOpen()) return;
    const result = computeMove(dir);
    if (!result.changed) return;
    busy = true;
    const gen = ++moveGen;
    markGameStarted();
    setUndo(snapshot());
    board = result.next;
    score += result.scoreDelta;
    for (const row of board) {
      for (const t of row) {
        if (!t) continue;
        let el = tileEl(t.id);
        if (!el) el = makeTile(t.id, t.value, 0, 0);
        const pos = findId(t.id);
        el.style.setProperty("--r", pos[0]);
        el.style.setProperty("--c", pos[1]);
        if (result.merges.some((m) => m.id === t.id)) {
          el.classList.add("is-merge");
          paintFace(el, t.value);
          sfx("merge", t.value);
          setTimeout(() => el.classList.remove("is-merge"), animMs);
        }
      }
    }
    for (const a of result.absorbed) {
      const el = tileEl(a.id);
      if (el) { el.classList.add("is-absorbed"); setTimeout(() => el.remove(), animMs); }
    }
    const stopMs = playMergeJuice(result.merges);
    const spawned = spawn();
    if (spawned) {
      makeTile(spawned.tile.id, spawned.tile.value, spawned.r, spawned.c, "is-new");
      sfx("spawn");
    }
    sfx("move");
    setTimeout(() => {
      if (gen !== moveGen) return;
      afterMove(result.merges, result.scoreDelta, spawned);
    }, animMs + stopMs);
  }
  function findId(id) {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] && board[r][c].id === id) return [r, c];
    return [0, 0];
  }
  function onKey(e) {
    if (!started) return;
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") { e.preventDefault(); move("left"); }
    else if (k === "arrowright" || k === "d") { e.preventDefault(); move("right"); }
    else if (k === "arrowup" || k === "w") { e.preventDefault(); move("up"); }
    else if (k === "arrowdown" || k === "s") { e.preventDefault(); move("down"); }
    else if (k === "u") { e.preventDefault(); doUndo(); }
  }
  function onSwipe(e) {
    if (!started || busy) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  }
  let startX = 0, startY = 0;
  function showResumeOffer(run) {
    const offer = $("resume-offer");
    const fresh = $("start-fresh");
    const copy = $("resume-copy");
    if (!offer || !fresh) return;
    const modeLabel = run.mode === "daily" ? "Daily" : "Classic";
    const hi = Math.max(2, ...run.board.flat().filter(Boolean).map((c) => c.value));
    copy.textContent = modeLabel + " run in progress — score " + (run.score || 0) + ", best tile " + hi + ". Resume or start a new game?";
    offer.hidden = false;
    fresh.hidden = true;
    showOverlay(els.start);
    announce("Saved game found. Choose Resume or New Game.");
  }
  function showFreshStart() {
    const offer = $("resume-offer");
    const fresh = $("start-fresh");
    if (offer) offer.hidden = true;
    if (fresh) fresh.hidden = false;
    showOverlay(els.start);
  }
  function discardPendingRun() {
    pendingRun = null;
    save();
  }
  function bindUi() {
    document.addEventListener("keydown", onKey);
    els.board.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
    els.board.addEventListener("touchend", onSwipe, { passive: true });
    els.mute.addEventListener("click", () => setMuted(!muted));
    els.neu.addEventListener("click", () => { if (!confirmNewGame()) return; musicStop(); newGame(); musicStart(); });
    els.undo.addEventListener("click", doUndo);
    els.modeClassic.addEventListener("click", () => { if (mode !== "classic") { if (!confirmNewGame()) return; musicStop(); newGame("classic"); musicStart(); } });
    els.modeDaily.addEventListener("click", () => { if (mode !== "daily") { if (!confirmNewGame()) return; musicStop(); newGame("daily"); musicStart(); } });
    $("start-classic").addEventListener("click", () => { discardPendingRun(); hideOverlay(els.start); started = true; newGame("classic"); musicStart(); });
    $("start-daily").addEventListener("click", () => { discardPendingRun(); hideOverlay(els.start); started = true; newGame("daily"); musicStart(); });
    $("start-resume").addEventListener("click", () => {
      const ok = resumeRun({ run: pendingRun });
      if (!ok) {
        discardPendingRun();
        showFreshStart();
        announce("Saved game could not be restored.");
        return;
      }
      save();
      musicStart();
    });
    $("start-discard").addEventListener("click", () => {
      discardPendingRun();
      showFreshStart();
      announce("Saved game discarded. Choose Classic or Daily.");
    });
    $("win-continue").addEventListener("click", () => { continued = true; hideOverlay(els.win); });
    $("win-new").addEventListener("click", () => { if (!confirmNewGame()) return; musicStop(); hideOverlay(els.win); newGame(); musicStart(); });
    $("win-undo").addEventListener("click", doUndo);
    $("win-share").addEventListener("click", () => { shareResult(); });
    $("over-new").addEventListener("click", () => { if (!confirmNewGame()) return; musicStop(); hideOverlay(els.over); newGame(); musicStart(); });
    $("over-undo").addEventListener("click", doUndo);
    $("over-share").addEventListener("click", () => { shareResult(); });
    $("btn-stats").addEventListener("click", () => { fillStatsPanel(); showOverlay(els.stats); });
    $("stats-close").addEventListener("click", () => hideOverlay(els.stats));
    document.querySelectorAll(".swatch").forEach((btn) => btn.addEventListener("click", () => applyTheme(btn.dataset.themeId)));
    applyTheme(theme);
    setMuted(muted);
  }
  function doUndo() {
    if (!undoSnap || busy) return;
    restore(undoSnap);
    announce("Undid last move.");
  }
  function registerSw() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }
  const stored = load();
  updateModeUi();
  refreshMeters(0);
  bindUi();
  registerSw();
  if (isResumable(pendingRun)) {
    showResumeOffer(pendingRun);
  } else {
    pendingRun = null;
    save();
    showFreshStart();
  }
  updateModeUi();
  refreshMeters(0);
})();
