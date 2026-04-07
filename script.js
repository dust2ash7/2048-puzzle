// ====================== 2048 - TRUE SLIDING + SOUNDS + VISUAL EFFECTS ======================
let grid = Array(16).fill(0);
let score = 0;
let bestScore = parseInt(localStorage.getItem("best2048")) || 0;
let gameOverFlag = false;
let hasWon = false;

const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startScreen = document.getElementById("start-screen");

let audioContext;

// Web Audio Sounds
function playSound(type, value = 0) {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        switch (type) {
            case "move":
                osc.type = "sine"; osc.frequency.value = 160;
                gain.gain.value = 0.12; gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
                break;
            case "merge":
                const freq = 320 + Math.log2(value || 4) * 140;
                osc.type = "triangle"; osc.frequency.value = freq;
                gain.gain.value = 0.28; gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.32);
                break;
            case "spawn":
                osc.type = "sine"; osc.frequency.value = 520;
                gain.gain.value = 0.1; gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.09);
                break;
            case "win":
                [820, 1040, 1310, 1650].forEach((f,i) => setTimeout(() => {
                    const o = audioContext.createOscillator();
                    const g = audioContext.createGain();
                    o.type = "sine"; o.frequency.value = f;
                    g.gain.value = 0.22;
                    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.7);
                    o.connect(g).connect(audioContext.destination);
                    o.start(); o.stop(audioContext.currentTime + 0.7);
                }, i*70));
                return;
            case "gameover":
                [480, 360, 240].forEach((f,i) => setTimeout(() => {
                    const o = audioContext.createOscillator();
                    const g = audioContext.createGain();
                    o.type = "sawtooth"; o.frequency.value = f;
                    g.gain.value = 0.2;
                    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.9);
                    o.connect(g).connect(audioContext.destination);
                    o.start(); o.stop(audioContext.currentTime + 0.95);
                }, i*110));
                return;
        }
        osc.start();
        osc.stop(audioContext.currentTime + 0.4);
    } catch(e) {}
}

function initAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

// Grid Setup
gridEl.style.position = "relative";
gridEl.style.width = "100%";
gridEl.style.aspectRatio = "1 / 1";

const tiles = [];

// Background cells
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

// Tile elements
for (let i = 0; i < 16; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.transition = "all 0.18s cubic-bezier(0.4, 0, 0.2, 1)";
    gridEl.appendChild(tile);
    tiles.push(tile);
}

bestEl.textContent = bestScore;

function getTilePosition(index) {
    const row = Math.floor(index / 4);
    const col = index % 4;
    return {
        left: `calc(${col * 25}% + 6px)`,
        top: `calc(${row * 25}% + 6px)`
    };
}

// Create particle burst
function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "absolute w-2 h-2 rounded-full pointer-events-none";
        p.style.backgroundColor = color;
        p.style.left = x + "px";
        p.style.top = y + "px";
        p.style.opacity = "0.9";
        
        const angle = Math.random() * Math.PI * 2;
        const vel = 40 + Math.random() * 90;
        const tx = Math.cos(angle) * vel;
        const ty = Math.sin(angle) * vel - 30;

        gridEl.appendChild(p);

        p.animate([
            { transform: `translate(0px, 0px) scale(1)`, opacity: 0.9 },
            { transform: `translate(${tx}px, ${ty}px) scale(0.2)`, opacity: 0 }
        ], {
            duration: 600 + Math.random() * 400,
            easing: "cubic-bezier(0.25, 0.1, 0.25, 1)"
        });

        setTimeout(() => p.remove(), 1200);
    }
}

function updateDisplay(previousGrid = null) {
    tiles.forEach((tile, i) => {
        const value = grid[i];
        if (value === 0) {
            tile.style.opacity = "0";
            return;
        }

        const pos = getTilePosition(i);
        tile.style.left = pos.left;
        tile.style.top = pos.top;
        tile.style.backgroundColor = getColor(value);
        tile.style.color = value >= 8 ? "#fff" : "#111";
        tile.style.fontSize = value >= 1000 ? "1.75rem" : "2.25rem";
        tile.textContent = value;
        tile.style.opacity = "1";

        if (previousGrid) {
            const oldVal = previousGrid[i];
            if (oldVal === 0 && value > 0) {
                tile.classList.add("new");
                setTimeout(() => tile.classList.remove("new"), 320);
                playSound("spawn");
            } else if (value > oldVal && oldVal > 0) {
                tile.classList.add("merged");
                setTimeout(() => tile.classList.remove("merged"), 380);

                // Visual merge effects
                const rect = tile.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2 - gridEl.getBoundingClientRect().left;
                const centerY = rect.top + rect.height / 2 - gridEl.getBoundingClientRect().top;

                createParticles(centerX, centerY, 18, "#fefce8");
                playSound("merge", value);
            }
        }
    });
}

function getColor(value) {
    const colors = {
        2: "#f59e0b", 4: "#eab308", 8: "#c2410f", 16: "#b91c1c",
        32: "#991b1b", 64: "#7e22ce", 128: "#6b21a8", 256: "#581c87",
        512: "#1e40af", 1024: "#1e3a8a", 2048: "#14b8a6", 4096: "#0f766e"
    };
    return colors[value] || "#0c3a3a";
}

// ... (slide, moveLeft, rotateGrid functions remain the same as before)
function slide(row) {
    let newRow = row.filter(val => val !== 0);
    for (let i = 0; i < newRow.length - 1; i++) {
        if (newRow[i] === newRow[i + 1]) {
            newRow[i] *= 2;
            score += newRow[i];
            newRow.splice(i + 1, 1);
            i++;
        }
    }
    while (newRow.length < 4) newRow.push(0);
    return newRow;
}

function moveLeft() { /* same as previous version */ 
    let moved = false;
    for (let r = 0; r < 4; r++) {
        const start = r * 4;
        const row = grid.slice(start, start + 4);
        const newRow = slide(row);
        if (row.join() !== newRow.join()) moved = true;
        for (let i = 0; i < 4; i++) grid[start + i] = newRow[i];
    }
    return moved;
}

function rotateGrid() {
    const newGrid = Array(16).fill(0);
    for (let i = 0; i < 16; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        newGrid[col * 4 + (3 - row)] = grid[i];
    }
    grid = newGrid;
}

function move(direction) {
    if (gameOverFlag || hasWon) return;

    const previousGrid = [...grid];
    let moved = false;

    if (direction === "Left") moved = moveLeft();
    else if (direction === "Right") { rotateGrid(); rotateGrid(); moved = moveLeft(); rotateGrid(); rotateGrid(); }
    else if (direction === "Up")    { rotateGrid(); rotateGrid(); rotateGrid(); moved = moveLeft(); rotateGrid(); }
    else if (direction === "Down")  { rotateGrid(); moved = moveLeft(); rotateGrid(); rotateGrid(); rotateGrid(); }

    if (moved) {
        playSound("move");
        updateDisplay(previousGrid);

        setTimeout(() => {
            addRandomTile();
            updateDisplay(previousGrid);
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

function checkWin() {
    if (hasWon) return;
    if (grid.includes(2048)) {
        hasWon = true;
        playSound("win");

        // Win celebration
        const rect = gridEl.getBoundingClientRect();
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                createParticles(
                    Math.random() * rect.width,
                    Math.random() * rect.height * 0.6,
                    24, "#67e8f9"
                );
            }, i * 120);
        }

        setTimeout(() => alert("🎉 You Win!\n\nYou reached 2048!"), 300);
    }
}

function checkGameOver() {
    if (grid.includes(0)) return;
    for (let i = 0; i < 16; i++) {
        const value = grid[i];
        if (value === 0) continue;
        const row = Math.floor(i / 4), col = i % 4;
        if (col < 3 && grid[i+1] === value) return;
        if (row < 3 && grid[i+4] === value) return;
    }

    gameOverFlag = true;
    playSound("gameover");

    // Shake effect on game over
    gridEl.style.transition = "transform 0.08s";
    gridEl.style.transform = "translateX(8px)";
    setTimeout(() => gridEl.style.transform = "translateX(-8px)", 80);
    setTimeout(() => gridEl.style.transform = "translateX(6px)", 160);
    setTimeout(() => gridEl.style.transform = "translateX(0)", 240);

    setTimeout(() => alert(`Game Over!\nFinal Score: ${score}`), 400);
}

function addRandomTile() {
    const empty = grid.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
    if (empty.length === 0) return false;
    const pos = empty[Math.floor(Math.random() * empty.length)];
    grid[pos] = Math.random() < 0.9 ? 2 : 4;
    return true;
}

// Controls (same as before)
document.addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
        move(e.key.replace("Arrow", ""));
    }
});

let touchStartX = 0, touchStartY = 0;
gridEl.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
});
gridEl.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "Right" : "Left");
    else move(dy > 0 ? "Down" : "Up");
});

document.getElementById("restart").addEventListener("click", () => {
    grid = Array(16).fill(0);
    score = 0;
    gameOverFlag = false;
    hasWon = false;
    document.querySelectorAll('.tile').forEach(t => t.style.opacity = "0");
    addRandomTile();
    addRandomTile();
    updateDisplay();
});

// Start Screen
document.getElementById("start-button").addEventListener("click", () => {
    initAudio();
    startScreen.style.display = "none";
    addRandomTile();
    addRandomTile();
    updateDisplay();
});
