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
  let musicGain = null;
  let musicNodes = [];
  let musicTimer = null;
  let musicStarted = false;
  let muted = false;
  let theme = "obsidian";
  const MUSIC_VOL = 0.12;
  const MASTER_VOL = 0.7;
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
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || "{}");
      if (raw.stats) Object.assign(stats, raw.stats);
      if (raw.daily && raw.daily.date === utcDate()) daily = raw.daily;
      else daily = { date: utcDate(), best: 0 };
      if (raw.theme) theme = raw.theme;
      muted = !!raw.muted;
    } catch (_) {}
  }
  function save() { localStorage.setItem(STORE, JSON.stringify({ stats, daily, theme, muted })); }
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
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.0001;
        musicGain.connect(masterGain);
      }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function fadeMusic(to, dur) {
    if (!musicGain || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const g = musicGain.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(Math.max(0.0001, g.value), t0);
    g.linearRampToValueAtTime(Math.max(0.0001, to), t0 + dur);
  }
  function musicStop() {
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    musicNodes.forEach((n) => {
      try { n.stop(); } catch (_) {}
      try { n.disconnect(); } catch (_) {}
    });
    musicNodes = [];
    musicStarted = false;
    if (musicGain) musicGain.gain.value = 0.0001;
  }
  function musicStart() {
    ensureAudio();
    if (!audioCtx || !musicGain || muted) return;
    if (!musicStarted) {
      const ctx = audioCtx;
      const dest = musicGain;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2200;
      filter.Q.value = 0.5;
      filter.connect(dest);
      musicNodes.push(filter);
      const chords = [
        [261.63, 329.63, 392.00, 493.88],
        [220.00, 261.63, 329.63, 415.30],
        [174.61, 220.00, 261.63, 349.23],
        [196.00, 246.94, 293.66, 349.23],
      ];
      const walk = [0, 2, 1, 3, 2, 0, 3, 1];
      const noteDur = 0.17;
      let tick = 0;
      let nextTime = ctx.currentTime + 0.04;
      function pluck(freq, when, vol, type) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, when);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(vol, when + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, when + noteDur * 1.55);
        o.connect(g).connect(filter);
        o.start(when);
        o.stop(when + noteDur * 1.65);
        musicNodes.push(o);
        if (musicNodes.length > 48) {
          const drop = musicNodes.splice(1, 16);
          drop.forEach((n) => { try { n.disconnect(); } catch (_) {} });
        }
      }
      function schedule() {
        if (!musicStarted) return;
        const horizon = ctx.currentTime + 0.4;
        while (nextTime < horizon) {
          const chord = chords[Math.floor(tick / walk.length) % chords.length];
          const idx = walk[tick % walk.length];
          pluck(chord[idx], nextTime, 0.11, "triangle");
          if (tick % 8 === 0) pluck(chord[0] * 0.5, nextTime, 0.08, "sine");
          tick += 1;
          nextTime += noteDur;
        }
        musicTimer = setTimeout(schedule, 110);
      }
      musicStarted = true;
      schedule();
    }
    fadeMusic(MUSIC_VOL, 0.55);
  }
  function duckMusic(level, holdMs) {
    if (!musicStarted || muted) return;
    fadeMusic(level, 0.12);
    setTimeout(() => {
      if (musicStarted && !muted && !over) fadeMusic(MUSIC_VOL, 0.5);
      else if (musicStarted && !muted && over) fadeMusic(0.03, 0.3);
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
      showOverlay(els.win);
      announce("You win. Score " + score + ".");
      if (locked) over = true;
    } else if (locked) {
      over = true; sfx("over"); duckMusic(0.03, 1500);
      els.overCopy.textContent = "Final score " + score + ". Highest tile " + hi + ".";
      showOverlay(els.over);
      announce("Game over. Score " + score + ".");
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
    const spawned = spawn();
    if (spawned) {
      makeTile(spawned.tile.id, spawned.tile.value, spawned.r, spawned.c, "is-new");
      sfx("spawn");
    }
    sfx("move");
    setTimeout(() => {
      if (gen !== moveGen) return;
      afterMove(result.merges, result.scoreDelta, spawned);
    }, animMs);
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
  function bindUi() {
    document.addEventListener("keydown", onKey);
    els.board.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
    els.board.addEventListener("touchend", onSwipe, { passive: true });
    els.mute.addEventListener("click", () => setMuted(!muted));
    els.neu.addEventListener("click", () => { musicStop(); newGame(); musicStart(); });
    els.undo.addEventListener("click", doUndo);
    els.modeClassic.addEventListener("click", () => { if (mode !== "classic") { musicStop(); newGame("classic"); musicStart(); } });
    els.modeDaily.addEventListener("click", () => { if (mode !== "daily") { musicStop(); newGame("daily"); musicStart(); } });
    $("start-classic").addEventListener("click", () => { hideOverlay(els.start); started = true; newGame("classic"); musicStart(); });
    $("start-daily").addEventListener("click", () => { hideOverlay(els.start); started = true; newGame("daily"); musicStart(); });
    $("win-continue").addEventListener("click", () => { continued = true; hideOverlay(els.win); });
    $("win-new").addEventListener("click", () => { musicStop(); hideOverlay(els.win); newGame(); musicStart(); });
    $("win-undo").addEventListener("click", doUndo);
    $("over-new").addEventListener("click", () => { musicStop(); hideOverlay(els.over); newGame(); musicStart(); });
    $("over-undo").addEventListener("click", doUndo);
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
  load();
  updateModeUi();
  refreshMeters(0);
  bindUi();
  registerSw();
})();
