// ====================== 2048 GAME LOGIC ======================
let grid = Array(16).fill(0);
let score = 0;
let bestScore = localStorage.getItem("best2048") || 0;
let gameOverFlag = false;

const gridEl = document.getElementById("grid");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const tiles = [];

// Create 16 tile elements
for (let i = 0; i < 16; i++) {
    const tile = document.createElement("div");
    tile.className = "tile w-full h-full rounded-3xl bg-zinc-900 text-white flex items-center justify-center";
    gridEl.appendChild(tile);
    tiles.push(tile);
}

bestEl.textContent = bestScore;

function updateDisplay() {
    tiles.forEach((tile, i) => {
        const value = grid[i];
        tile.textContent = value || "";
        tile.style.backgroundColor = value ? getColor(value) : "#18181b";
        tile.style.color = value >= 8 ? "#fff" : "#000";
        tile.style.fontSize = value >= 1000 ? "1.75rem" : "2.25rem";
    });
    scoreEl.textContent = score;
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
    const empty = grid.map((v, i) => (v === 0 ? i : -1)).filter(i => i >= 0);
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
        if (JSON.stringify(row) !== JSON.stringify(newRow)) moved = true;
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
    if (gameOverFlag) return;
    let moved = false;

    if (direction === "Left") moved = moveLeft();
    else if (direction === "Right") {
        rotateGrid(); rotateGrid();
        moved = moveLeft();
        rotateGrid(); rotateGrid();
    } else if (direction === "Up") {
        rotateGrid(); rotateGrid(); rotateGrid();
        moved = moveLeft();
        rotateGrid();
    } else if (direction === "Down") {
        rotateGrid();
        moved = moveLeft();
        rotateGrid(); rotateGrid(); rotateGrid();
    }

    if (moved) {
        addRandomTile();
        updateDisplay();
        checkGameOver();
    }
}

// Keyboard controls
document.addEventListener("keydown", e => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        move(e.key.replace("Arrow", ""));
    }
});

// Touch swipe support (mobile)
let touchStartX = 0, touchStartY = 0;
gridEl.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
});
gridEl.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    const dy = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy)) {
        move(dx > 0 ? "Right" : "Left");
    } else {
        move(dy > 0 ? "Down" : "Up");
    }
});

// Restart button
document.getElementById("restart").addEventListener("click", () => {
    grid = Array(16).fill(0);
    score = 0;
    gameOverFlag = false;
    addRandomTile();
    addRandomTile();
    updateDisplay();
});

// Game over check
function checkGameOver() {
    // Check if board is full
    if (!grid.includes(0)) {
        // Check if any adjacent tiles can merge
        for (let i = 0; i < 16; i++) {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const value = grid[i];
            if (value === 0) continue;
            // Right
            if (col < 3 && grid[i + 1] === value) return;
            // Down
            if (row < 3 && grid[i + 4] === value) return;
        }
        gameOverFlag = true;
        setTimeout(() => alert("Game Over! Final score: " + score), 300);
    }

    // Update best score
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("best2048", bestScore);
        bestEl.textContent = bestScore;
    }
};

// Start new game
addRandomTile();
addRandomTile();
updateDisplay();
