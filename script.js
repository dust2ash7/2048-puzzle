// ====================== 2048 with TRUE SLIDING ANIMATIONS + START SCREEN ======================
let grid = Array(16).fill(0);
let score = 0;
let bestScore = parseInt(localStorage.getItem("best2048")) || 0;
let gameOverFlag = false;
let hasWon = false;

const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const startScreen = document.getElementById("start-screen");

// Setup grid container
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
    const row = Math.floor(i / 4);
    const col = i % 4;
    bg.style.left = `calc(${col * 25}% + 6px)`;
    bg.style.top = `calc(${row * 25}% + 6px)`;
    gridEl.appendChild(bg);
}

// Tile elements
for (let i = 0; i < 16; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.style.transition = "all 0.18s cubic-bezier(0.4, 0.0, 0.2, 1)";
    gridEl.appendChild(tile);
    tiles.push(tile);
}

bestEl.textContent = bestScore;

function getTilePosition(index) {
    const row = Math.floor(index / 4);
    const col = index % 4;
    const size = 25;
    const gap = 6;
    return {
        left: `calc(${col * size}% + ${gap}px)`,
        top: `calc(${row * size}% + ${gap}px)`
    };
}

function updateDisplay(previousGrid = null) {
    document.querySelectorAll('.merged').forEach(el => {
        if (!grid.includes(parseInt(el.textContent))) el.remove();
    });

    tiles.forEach((tile, visualIndex) => {
        const value = grid[visualIndex];
        if (value === 0) {
            tile.style.opacity = "0";
            tile.style.transform = "scale(0.8)";
            return;
        }

        const pos = getTilePosition(visualIndex);
        tile.style.left = pos.left;
        tile.style.top = pos.top;
        tile.style.width = "calc(25% - 12px)";
        tile.style.height = "calc(25% - 12px)";
        tile.style.backgroundColor = getColor(value);
        tile.style.color = value >= 8 ? "#fff" : "#111";
        tile.style.fontSize = value >= 1000 ? "1.75rem" : "2.25rem";
        tile.textContent = value;
        tile.style.opacity = "1";
        tile.style.transform = "scale(1)";

        if (previousGrid) {
            const oldValue = previousGrid[visualIndex];
            if (oldValue === 0 && value > 0) {
                tile.classList.add("new");
                setTimeout(() => tile.classList.remove("new"), 280);
            } else if (value > oldValue && oldValue > 0) {
                tile.classList.add("merged");
                setTimeout(() => tile.classList.remove("merged"), 300);
            }
        }
    });
}

function getColor(value) {
    const colors = {
        2: "#f59e0b", 4: "#eab308", 8: "#c2410f", 16: "#b91c1c",
        32: "#991b1b", 64: "#7e22ce", 128: "#6b21a8", 256: "#581c87",
        512: "#1e40af", 1024: "#1e3a8a", 2048: "#0f766e", 4096: "#0c4a4a"
    };
    return colors[value] || "#0c3a3a";
}

function addRandomTile() {
    const empty = grid.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
    if (empty.length === 0) return false;
    const pos = empty[Math.floor(Math.random() * empty.length)];
    grid[pos] = Math.random() < 0.9 ? 2 : 4;
    return true;
}

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

function moveLeft() {
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
        setTimeout(() => alert("🎉 You Win!\n\nYou reached 2048!"), 200);
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
    setTimeout(() => alert(`Game Over!\nFinal Score: ${score}`), 300);
}

// ====================== CONTROLS ======================
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
    document.querySelectorAll('.tile').forEach(t => { if (t.textContent) t.style.opacity = "0"; });
    addRandomTile();
    addRandomTile();
    updateDisplay();
});

// ====================== START SCREEN LOGIC ======================
document.getElementById("start-button").addEventListener("click", () => {
    startScreen.style.display = "none";   // Hide start screen
    addRandomTile();
    addRandomTile();
    updateDisplay();
});

// Game does NOT start automatically — waits for player to click Start
