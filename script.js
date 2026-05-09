// ====================== 2048 - POLISHED V3 (with Win Confetti) ======================
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
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain).connect(audioContext.destination);

        if (type === "move") {
            osc.type = "sine"; osc.frequency.setValueAtTime(180, audioContext.currentTime);
            gain.gain.value = 0.15; osc.start(); osc.stop(audioContext.currentTime + 0.08);
        } else if (type === "merge") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(420 + Math.log2(value) * 120, audioContext.currentTime);
            gain.gain.value = 0.35;
            osc.start(); osc.stop(audioContext.currentTime + 0.25);
        } else if (type === "win") {
            const notes = [880, 1100, 1320, 1760];
            notes.forEach((freq, i) => {
                setTimeout(() => {
                    const o = audioContext.createOscillator();
                    const g = audioContext.createGain();
                    o.type = "sine"; o.frequency.value = freq;
                    g.gain.value = 0.3;
                    o.connect(g).connect(audioContext.destination);
                    o.start(); o.stop(audioContext.currentTime + 0.6);
                }, i * 80);
            });
        } else if (type === "gameover") {
            [520, 420, 280].forEach((f, i) => setTimeout(() => {
                const o = audioContext.createOscillator();
                const g = audioContext.createGain();
                o.type = "sawtooth"; o.frequency.value = f; g.gain.value = 0.25;
                o.connect(g).connect(audioContext.destination);
                o.start(); o.stop(audioContext.currentTime + 0.8);
            }, i * 120));
        }
    } catch (e) {}
}

// ====================== CONFETTI ======================
let confettiCanvas = null;
let confettiCtx = null;

function initConfetti() {
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.style.position = "fixed";
    confettiCanvas.style.top = "0";
    confettiCanvas.style.left = "0";
    confettiCanvas.style.width = "100%";
    confettiCanvas.style.height = "100%";
    confettiCanvas.style.pointerEvents = "none";
    confettiCanvas.style.zIndex = "300";
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext("2d");
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
}

const confettiPieces = [];

class Confetto {
    constructor() {
        this.x = Math.random() * confettiCanvas.width;
        this.y = Math.random() * confettiCanvas.height - confettiCanvas.height;
        this.size = Math.random() * 12 + 8;
        this.speed = Math.random() * 6 + 4;
        this.angle = Math.random() * 360;
        this.angleSpeed = Math.random() * 0.3 - 0.15;
        this.color = `hsl(${Math.random() * 360}, 90%, 65%)`;
        this.shape = Math.random() > 0.5 ? "circle" : "rect";
    }
    update() {
        this.y += this.speed;
        this.angle += this.angleSpeed;
        this.speed += 0.08;
    }
    draw() {
        confettiCtx.save();
        confettiCtx.translate(this.x, this.y);
        confettiCtx.rotate(this.angle * Math.PI / 180);
        confettiCtx.fillStyle = this.color;
        if (this.shape === "circle") {
            confettiCtx.beginPath();
            confettiCtx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            confettiCtx.fill();
        } else {
            confettiCtx.fillRect(-this.size/2, -this.size/2, this.size, this.size * 0.6);
        }
        confettiCtx.restore();
    }
}

function launchConfetti(duration = 4500) {
    if (!confettiCanvas) initConfetti();
    
    for (let i = 0; i < 280; i++) {
        confettiPieces.push(new Confetto());
    }

    const startTime = Date.now();
    function animate() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        
        for (let i = confettiPieces.length - 1; i >= 0; i--) {
            const c = confettiPieces[i];
            c.update();
            c.draw();
            if (c.y > confettiCanvas.height) confettiPieces.splice(i, 1);
        }

        if (Date.now() - startTime < duration && confettiPieces.length > 0) {
            requestAnimationFrame(animate);
        } else {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
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
    const r = Math.floor(i / 4), c = i % 4;
    bg.style.left = `calc(${c * 25}% + 6px)`;
    bg.style.top = `calc(${r * 25}% + 6px)`;
    gridEl.appendChild(bg);
}

for (let i = 0; i < 16; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    gridEl.appendChild(tile);
    tiles.push(tile);
}

bestEl.textContent = bestScore;

// ====================== PARTICLE EXPLOSION ======================
function createMergeExplosion(tileElement, value) {
    if (!tileElement) return;
    const rect = tileElement.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();

    const centerX = rect.left - gridRect.left + rect.width / 2;
    const centerY = rect.top - gridRect.top + rect.height / 2;

    const intensity = Math.min(3.2, Math.log2(value) / 4.5);
    const count = Math.floor(18 + intensity * 22);
    const baseHue = getTileHue(value);

    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "particle";

        const hue = (baseHue + (Math.random() * 50 - 25)) % 360;
        p.style.backgroundColor = `hsl(${hue}, 92%, ${65 + Math.random() * 25}%)`;
        p.style.left = `${centerX}px`;
        p.style.top = `${centerY}px`;

        const angle = Math.random() * Math.PI * 2;
        const vel = 50 + Math.random() * 135 * intensity;
        const dx = Math.cos(angle) * vel;
        const dy = Math.sin(angle) * vel - intensity * 22;

        p.style.setProperty("--dx", `${dx}px`);
        p.style.setProperty("--dy", `${dy}px`);

        const size = 6 + Math.random() * (11 + intensity * 5);
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;

        p.style.animationDelay = `${Math.random() * 70}ms`;

        if (Math.random() < 0.15) {
            p.style.width = `${size * 2.1}px`;
            p.style.height = `${size * 2.1}px`;
            p.style.animationDuration = "0.58s";
        }

        gridEl.appendChild(p);
        setTimeout(() => p.remove(), 1150);
    }

    if (value >= 256) {
        tileElement.style.transition = "transform 90ms, box-shadow 160ms";
        tileElement.style.transform = "scale(1.38)";
        tileElement.style.boxShadow = `0 0 55px hsl(${baseHue}, 95%, 78%)`;
        setTimeout(() => {
            tileElement.style.transform = "scale(1)";
            tileElement.style.boxShadow = "";
        }, 170);
    }
}

function getTileHue(value) {
    const map = {2:200,4:195,8:38,16:32,32:18,64:0,128:260,256:275,512:290,1024:310,2048:330,4096:350};
    return map[value] || 200;
}

// ====================== CORE ======================
function getColor(value) {
    const colors = {
        2:"#f59e0b", 4:"#eab308", 8:"#c2410f", 16:"#b91c1c",
        32:"#991b1b", 64:"#7e22ce", 128:"#6b21a8", 256:"#581c87",
        512:"#1e40af", 1024:"#1e3a8a", 2048:"#14b8a6", 4096:"#0f766e"
    };
    return colors[value] || "#0c3a3a";
}

function updateDisplay(oldBoard = null) {
    tiles.forEach((tile, i) => {
        const val = board[i];
        if (val === 0) { tile.style.opacity = "0"; return; }

        tile.style.left = `calc(${(i % 4) * 25}% + 6px)`;
        tile.style.top = `calc(${Math.floor(i / 4) * 25}% + 6px)`;
        tile.style.backgroundColor = getColor(val);
        tile.style.color = val >= 8 ? "#fff" : "#111";
        tile.style.fontSize = val >= 1000 ? "1.7rem" : "2.25rem";
        tile.textContent = val;
        tile.style.opacity = "1";

        if (oldBoard) {
            const oldVal = oldBoard[i];
            if (oldVal === 0 && val > 0) {
                tile.classList.add("new");
                setTimeout(() => tile.classList.remove("new"), 340);
            } else if (val > oldVal && oldVal > 0) {
                tile.classList.add("merged");
                createMergeExplosion(tile, val);
                setTimeout(() => tile.classList.remove("merged"), 400);
                playSound("merge", val);
            }
        }
    });
    scoreEl.textContent = score;
}

// Proper slide with merge-once rule
function slideLine(line) {
    let newLine = line.filter(n => n !== 0);
    let i = 0;
    while (i < newLine.length - 1) {
        if (newLine[i] === newLine[i + 1]) {
            newLine[i] *= 2;
            score += newLine[i];
            newLine.splice(i + 1, 1);
        } else {
            i++;
        }
    }
    while (newLine.length < 4) newLine.push(0);
    return newLine;
}

function move(direction) {
    if (isGameOver || hasWon) return;

    previousBoard = [...board];
    const oldBoard = [...board];
    let moved = false;
    let temp = [...board];

    if (direction === "Left" || direction === "Right") {
        for (let r = 0; r < 4; r++) {
            const start = r * 4;
            let row = temp.slice(start, start + 4);
            if (direction === "Right") row = row.reverse();
            const newRow = slideLine(row);
            if (direction === "Right") newRow.reverse();
            if (row.join() !== newRow.join()) moved = true;
            for (let i = 0; i < 4; i++) temp[start + i] = newRow[i];
        }
    } else {
        for (let c = 0; c < 4; c++) {
            let col = [temp[c], temp[c+4], temp[c+8], temp[c+12]];
            if (direction === "Down") col = col.reverse();
            const newCol = slideLine(col);
            if (direction === "Down") newCol.reverse();
            if (col.join() !== newCol.join()) moved = true;
            for (let i = 0; i < 4; i++) temp[i*4 + c] = newCol[i];
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
        }, 160);
    }
}

function addRandomTile() {
    const empty = board.map((v, i) => v === 0 ? i : null).filter(i => i !== null);
    if (empty.length === 0) return;
    board[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
}

function checkWin() {
    if (hasWon) return;
    if (board.includes(2048)) {
        hasWon = true;
        playSound("win");
        launchConfetti(5000);
        showWinModal();
    }
}

function checkGameOver() {
    if (board.includes(0)) return;
    for (let i = 0; i < 16; i++) {
        const val = board[i];
        const r = Math.floor(i / 4), c = i % 4;
        if (c < 3 && board[i+1] === val) return;
        if (r < 3 && board[i+4] === val) return;
    }
    isGameOver = true;
    playSound("gameover");
    showGameOverModal();
}

// ====================== MODALS ======================
function showWinModal() {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[200]";
    modal.innerHTML = `
        <div class="bg-zinc-900 rounded-3xl p-10 text-center max-w-xs w-full mx-4">
            <h2 class="text-5xl mb-4">🎉 You Win!</h2>
            <p class="text-2xl text-amber-400 mb-8">You reached 2048</p>
            <button onclick="this.closest('.fixed').remove(); restartGame()" 
                    class="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-6 rounded-3xl text-xl">
                Play Again
            </button>
        </div>`;
    document.body.appendChild(modal);
}

function showGameOverModal() {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[200]";
    modal.innerHTML = `
        <div class="bg-zinc-900 rounded-3xl p-10 text-center max-w-xs w-full mx-4">
            <h2 class="text-4xl mb-4">Game Over</h2>
            <p class="text-xl text-zinc-400 mb-8">Final Score: <span class="text-white font-bold">${score}</span></p>
            <button onclick="this.closest('.fixed').remove(); restartGame()" 
                    class="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-6 rounded-3xl text-xl">
                Try Again
            </button>
        </div>`;
    document.body.appendChild(modal);
}

function restartGame() {
    board = Array(16).fill(0);
    score = 0;
    isGameOver = false;
    hasWon = false;
    undoUsed = false;
    previousBoard = null;
    document.getElementById("undo").classList.remove("opacity-50", "cursor-not-allowed");
    addRandomTile();
    addRandomTile();
    updateDisplay();
}

// ====================== INPUT & BUTTONS ======================
document.addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
        move(e.key.replace("Arrow", ""));
    }
});

let tsX = 0, tsY = 0;
gridEl.addEventListener("touchstart", e => { tsX = e.changedTouches[0].screenX; tsY = e.changedTouches[0].screenY; });
gridEl.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].screenX - tsX;
    const dy = e.changedTouches[0].screenY - tsY;
    if (Math.abs(dx) < 50 && Math.abs(dy) < 50) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "Right" : "Left") : (dy > 0 ? "Down" : "Up"));
});

document.getElementById("restart").addEventListener("click", restartGame);

document.getElementById("undo").addEventListener("click", () => {
    if (undoUsed || !previousBoard || isGameOver) return;
    undoModal.classList.remove("hidden");
});

document.getElementById("watch-ad-btn").addEventListener("click", () => {
    let time = 6;
    const countdown = document.getElementById("ad-countdown");
    const progress = document.getElementById("ad-progress");
    const interval = setInterval(() => {
        time--; countdown.textContent = time;
        progress.style.width = `${(6-time)*16.67}%`;
        if (time <= 0) {
            clearInterval(interval);
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
