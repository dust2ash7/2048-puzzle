// ====================== 2048 - V5 (Final Polish) ======================
let board = Array(16).fill(0);
let score = 0;
let bestScore = parseInt(localStorage.getItem("best2048")) || 0;
let isGameOver = false;
let hasWon = false;
let previousBoard = null;
let undoUsed = false;

const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startScreen = document.getElementById("start-screen");
const undoModal = document.getElementById("undo-modal");

let audioContext = null;
const tiles = [];

// ====================== AUDIO ======================
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type, value = 0) {
    if (!audioContext) return;
    try {
        if (type === "move") {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(260, audioContext.currentTime);
            gain.gain.setValueAtTime(0.16, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            osc.connect(gain).connect(audioContext.destination);
            osc.start(); osc.stop(audioContext.currentTime + 0.12);
        } 
        else if (type === "new") {
            const noise = audioContext.createBufferSource();
            const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
            noise.buffer = buffer;
            const filter = audioContext.createBiquadFilter();
            filter.type = "lowpass"; filter.frequency.value = 1350;
            const gain = audioContext.createGain();
            gain.gain.setValueAtTime(0.38, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
            noise.connect(filter).connect(gain).connect(audioContext.destination);
            noise.start();
        } 
        else if (type === "merge") {
            const base = 380 + Math.log2(Math.max(value, 4)) * 130;
            const osc1 = audioContext.createOscillator(); const gain1 = audioContext.createGain();
            osc1.type = "triangle"; osc1.frequency.setValueAtTime(base, audioContext.currentTime);
            gain1.gain.setValueAtTime(0.45, audioContext.currentTime); gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

            const osc2 = audioContext.createOscillator(); const gain2 = audioContext.createGain();
            osc2.type = "sine"; osc2.frequency.setValueAtTime(base * 1.5, audioContext.currentTime);
            gain2.gain.setValueAtTime(0.26, audioContext.currentTime); gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);

            osc1.connect(gain1).connect(audioContext.destination);
            osc2.connect(gain2).connect(audioContext.destination);
            osc1.start(); osc2.start();
            osc1.stop(audioContext.currentTime + 0.55);
            osc2.stop(audioContext.currentTime + 0.45);
        } 
        else if (type === "win") {
            [920, 1240, 1480, 1760, 1980].forEach((f, i) => setTimeout(() => {
                const o = audioContext.createOscillator();
                const g = audioContext.createGain();
                o.type = "sine"; o.frequency.value = f;
                g.gain.value = 0.4; g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.9);
                o.connect(g).connect(audioContext.destination);
                o.start(); o.stop(audioContext.currentTime + 1);
            }, i * 85));
        } 
        else if (type === "gameover") {
            [580, 460, 360, 260].forEach((f, i) => setTimeout(() => {
                const o = audioContext.createOscillator();
                const g = audioContext.createGain();
                o.type = "sawtooth"; o.frequency.value = f;
                g.gain.value = 0.32; g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.3);
                o.connect(g).connect(audioContext.destination);
                o.start(); o.stop(audioContext.currentTime + 1.4);
            }, i * 180));
        }
    } catch (e) {}
}

// ====================== CONFETTI ======================
let confettiCanvas = null, confettiCtx = null;
const confettiPieces = [];

class Confetto {
    constructor() {
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * -400;
        this.size = Math.random() * 14 + 9;
        this.speed = Math.random() * 8 + 6;
        this.angle = Math.random() * 360;
        this.angleSpeed = (Math.random() - 0.5) * 0.8;
        this.color = `hsl(${Math.random()*360}, 95%, 68%)`;
        this.shape = Math.random() > 0.5 ? "circle" : "rect";
    }
    update() { this.y += this.speed; this.angle += this.angleSpeed; this.speed += 0.1; }
    draw() {
        if (!confettiCtx) return;
        confettiCtx.save();
        confettiCtx.translate(this.x, this.y);
        confettiCtx.rotate(this.angle * Math.PI / 180);
        confettiCtx.fillStyle = this.color;
        if (this.shape === "circle") {
            confettiCtx.beginPath(); confettiCtx.arc(0, 0, this.size/2, 0, Math.PI*2); confettiCtx.fill();
        } else {
            confettiCtx.fillRect(-this.size/2, -this.size/2, this.size, this.size*0.6);
        }
        confettiCtx.restore();
    }
}

function launchConfetti(duration = 6500) {
    if (!confettiCanvas) {
        confettiCanvas = document.createElement("canvas");
        confettiCanvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:300;";
        document.body.appendChild(confettiCanvas);
        confettiCtx = confettiCanvas.getContext("2d");
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
    for (let i = 0; i < 380; i++) confettiPieces.push(new Confetto());

    const start = Date.now();
    function animate() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        for (let i = confettiPieces.length-1; i >= 0; i--) {
            const c = confettiPieces[i];
            c.update(); c.draw();
            if (c.y > confettiCanvas.height + 100) confettiPieces.splice(i, 1);
        }
        if (Date.now() - start < duration && confettiPieces.length > 0) requestAnimationFrame(animate);
    }
    animate();
}

// ====================== SETUP ======================
gridEl.style.position = "relative";

for (let i = 0; i < 16; i++) {
    const bg = document.createElement("div");
    bg.className = "absolute bg-zinc-900 rounded-3xl";
    bg.style.width = "calc(25% - 12px)";
    bg.style.height = "calc(25% - 12px)";
    const r = Math.floor(i/4), c = i%4;
    bg.style.left = `calc(${c*25}% + 6px)`;
    bg.style.top = `calc(${r*25}% + 6px)`;
    gridEl.appendChild(bg);
}

for (let i = 0; i < 16; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    gridEl.appendChild(tile);
    tiles.push(tile);
}

bestEl.textContent = bestScore;

// ====================== PARTICLES ======================
function createMergeExplosion(tileElement, value) {
    if (!tileElement) return;
    const rect = tileElement.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();
    const cx = rect.left - gridRect.left + rect.width / 2;
    const cy = rect.top - gridRect.top + rect.height / 2;

    const intensity = Math.min(3.8, Math.log2(value) / 4);
    const count = Math.floor(24 + intensity * 26);
    const baseHue = getTileHue(value);

    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        const hue = (baseHue + (Math.random() * 60 - 30)) % 360;
        p.style.backgroundColor = `hsl(${hue}, 95%, ${65 + Math.random() * 28}%)`;
        p.style.left = `${cx}px`;
        p.style.top = `${cy}px`;

        const angle = Math.random() * Math.PI * 2;
        const vel = 65 + Math.random() * 150 * intensity;
        p.style.setProperty("--dx", `${Math.cos(angle) * vel}px`);
        p.style.setProperty("--dy", `${Math.sin(angle) * vel - intensity * 30}px`);

        const sz = 7 + Math.random() * (14 + intensity * 6);
        p.style.width = `${sz}px`;
        p.style.height = `${sz}px`;
        p.style.animationDelay = `${Math.random() * 55}ms`;

        gridEl.appendChild(p);
        setTimeout(() => p.remove(), 1300);
    }

    if (value >= 256) {
        tileElement.style.transition = "transform 85ms ease-out, box-shadow 180ms";
        tileElement.style.transform = "scale(1.45)";
        tileElement.style.boxShadow = `0 0 70px hsl(${baseHue}, 95%, 85%)`;
        setTimeout(() => { tileElement.style.transform = "scale(1)"; tileElement.style.boxShadow = ""; }, 200);
    }
}

function getTileHue(v) {
    const map = {2:200,4:195,8:38,16:32,32:18,64:0,128:260,256:275,512:290,1024:310,2048:330,4096:350};
    return map[v] || 200;
}

function getColor(v) {
    const c = {2:"#f59e0b",4:"#eab308",8:"#c2410f",16:"#b91c1c",32:"#991b1b",64:"#7e22ce",
               128:"#6b21a8",256:"#581c87",512:"#1e40af",1024:"#1e3a8a",2048:"#14b8a6",4096:"#0f766e"};
    return c[v] || "#0c3a3a";
}

// ====================== GAME LOGIC ======================
function updateDisplay(oldBoard = null) {
    tiles.forEach((tile, i) => {
        const val = board[i];
        if (val === 0) { tile.style.opacity = "0"; return; }

        tile.style.left = `calc(${(i%4)*25}% + 6px)`;
        tile.style.top = `calc(${Math.floor(i/4)*25}% + 6px)`;
        tile.style.backgroundColor = getColor(val);
        tile.style.color = val >= 8 ? "#fff" : "#111";
        tile.style.fontSize = val >= 1000 ? "1.65rem" : "2.25rem";
        tile.textContent = val;
        tile.style.opacity = "1";

        if (oldBoard) {
            const old = oldBoard[i];
            if (old === 0 && val > 0) {
                tile.classList.add("new");
                setTimeout(() => tile.classList.remove("new"), 340);
                playSound("new");
            } else if (val > old && old > 0) {
                tile.classList.add("merged");
                createMergeExplosion(tile, val);
                setTimeout(() => tile.classList.remove("merged"), 420);
                playSound("merge", val);
            }
        }
    });
    scoreEl.textContent = score;
}

function slideLine(line) {
    let arr = line.filter(x => x !== 0);
    let i = 0;
    while (i < arr.length - 1) {
        if (arr[i] === arr[i+1]) {
            arr[i] *= 2;
            score += arr[i];
            arr.splice(i+1, 1);
        } else i++;
    }
    while (arr.length < 4) arr.push(0);
    return arr;
}

function move(dir) {
    if (isGameOver || hasWon) return;
    previousBoard = [...board];
    const oldBoard = [...board];
    let moved = false;
    let temp = [...board];

    if (dir === "Left" || dir === "Right") {
        for (let r = 0; r < 4; r++) {
            let start = r*4;
            let row = temp.slice(start, start+4);
            if (dir === "Right") row = row.reverse();
            let newRow = slideLine(row);
            if (dir === "Right") newRow = newRow.reverse();
            if (row.join() !== newRow.join()) moved = true;
            for (let j = 0; j < 4; j++) temp[start + j] = newRow[j];
        }
    } else {
        for (let c = 0; c < 4; c++) {
            let col = [temp[c], temp[c+4], temp[c+8], temp[c+12]];
            if (dir === "Down") col = col.reverse();
            let newCol = slideLine(col);
            if (dir === "Down") newCol = newCol.reverse();
            if (col.join() !== newCol.join()) moved = true;
            for (let j = 0; j < 4; j++) temp[j*4 + c] = newCol[j];
        }
    }

    if (moved) {
        board = temp;
        playSound("move");
        updateDisplay(oldBoard);

        setTimeout(() => {
            addRandomTile();
            updateDisplay(oldBoard);
            checkWin();
            checkGameOver();

            if (score > bestScore) {
                bestScore = score;
                localStorage.setItem("best2048", bestScore);
                bestEl.textContent = bestScore;
            }
        }, 180);
    }
}

function addRandomTile() {
    const empty = board.map((v,i) => v===0 ? i : null).filter(i => i !== null);
    if (empty.length) board[empty[Math.floor(Math.random()*empty.length)]] = Math.random() < 0.9 ? 2 : 4;
}

function checkWin() {
    if (hasWon || !board.includes(2048)) return;
    hasWon = true;
    playSound("win");
    launchConfetti(7000);
    showWinModal();
}

function checkGameOver() {
    if (board.includes(0)) return;
    for (let i = 0; i < 16; i++) {
        const v = board[i], r = Math.floor(i/4), c = i%4;
        if (c < 3 && board[i+1] === v) return;
        if (r < 3 && board[i+4] === v) return;
    }
    isGameOver = true;
    playSound("gameover");
    showGameOverModal();
}

// ====================== MODALS ======================
function showWinModal() {
    const m = document.createElement("div");
    m.className = "fixed inset-0 bg-black/90 flex items-center justify-center z-[200]";
    m.innerHTML = `<div class="bg-zinc-900 rounded-3xl p-12 text-center max-w-sm w-full mx-4">
        <h2 class="text-6xl mb-3">🎉 YOU WIN!</h2>
        <p class="text-3xl text-amber-400 mb-10">2048 Reached</p>
        <button onclick="this.closest('.fixed').remove(); restartGame()" class="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-7 rounded-3xl text-2xl">Play Again</button>
    </div>`;
    document.body.appendChild(m);
}

function showGameOverModal() {
    const m = document.createElement("div");
    m.className = "fixed inset-0 bg-black/90 flex items-center justify-center z-[200]";
    m.innerHTML = `<div class="bg-zinc-900 rounded-3xl p-12 text-center max-w-sm w-full mx-4">
        <h2 class="text-5xl mb-4">Game Over</h2>
        <p class="text-2xl mb-8">Final Score: <span class="font-bold text-white">${score}</span></p>
        <button onclick="this.closest('.fixed').remove(); restartGame()" class="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-7 rounded-3xl text-2xl">Try Again</button>
    </div>`;
    document.body.appendChild(m);
}

function restartGame() {
    board = Array(16).fill(0);
    score = 0;
    isGameOver = false;
    hasWon = false;
    undoUsed = false;
    previousBoard = null;
    document.getElementById("undo").classList.remove("opacity-50", "cursor-not-allowed");
    addRandomTile(); addRandomTile();
    updateDisplay();
}

// ====================== INPUT ======================
document.addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
        move(e.key.replace("Arrow",""));
    }
});

// Improved swipe threshold
let tsx = 0, tsy = 0;
gridEl.addEventListener("touchstart", e => {
    tsx = e.changedTouches[0].screenX;
    tsy = e.changedTouches[0].screenY;
});
gridEl.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].screenX - tsx;
    const dy = e.changedTouches[0].screenY - tsy;
    if (Math.abs(dx) < 80 && Math.abs(dy) < 80) return;   // ← Better threshold
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "Right" : "Left") : (dy > 0 ? "Down" : "Up"));
});

// Buttons
document.getElementById("restart").addEventListener("click", restartGame);

document.getElementById("undo").addEventListener("click", () => {
    if (undoUsed || !previousBoard || isGameOver) return;
    undoModal.classList.remove("hidden");
});

document.getElementById("watch-ad-btn").addEventListener("click", () => {
    let t = 6;
    const cd = document.getElementById("ad-countdown");
    const pg = document.getElementById("ad-progress");
    const int = setInterval(() => {
        t--; cd.textContent = t;
        pg.style.width = `${(6-t)*16.67}%`;
        if (t <= 0) {
            clearInterval(int);
            undoModal.classList.add("hidden");
            if (previousBoard) {
                board = [...previousBoard];
                score = Math.max(0, score - 80);
                undoUsed = true;
                document.getElementById("undo").classList.add("opacity-50", "cursor-not-allowed");
                updateDisplay();
            }
        }
    }, 1000);
});

document.getElementById("cancel-ad-btn").addEventListener("click", () => undoModal.classList.add("hidden"));

document.getElementById("start-button").addEventListener("click", () => {
    initAudio();
    startScreen.style.display = "none";
    addRandomTile();
    addRandomTile();
    updateDisplay();
});
