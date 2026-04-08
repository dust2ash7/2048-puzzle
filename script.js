// ====================== 2048 - FIXED & WORKING ======================
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

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type, value = 0) {
    if (!audioContext) return;
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        switch (type) {
            case "move":    osc.type = "sine"; osc.frequency.value = 160; gain.gain.value = 0.12; break;
            case "merge":   osc.type = "triangle"; osc.frequency.value = 320 + Math.log2(value || 4) * 140; gain.gain.value = 0.28; break;
            case "spawn":   osc.type = "sine"; osc.frequency.value = 520; gain.gain.value = 0.1; break;
            case "win":
                [820, 1040, 1310, 1650].forEach((f,i) => setTimeout(() => {
                    const o = audioContext.createOscillator(); const g = audioContext.createGain();
                    o.type = "sine"; o.frequency.value = f; g.gain.value = 0.22;
                    o.connect(g).connect(audioContext.destination); o.start(); o.stop(audioContext.currentTime + 0.7);
                }, i*70));
                return;
            case "gameover":
                [480, 360, 240].forEach((f,i) => setTimeout(() => {
                    const o = audioContext.createOscillator(); const g = audioContext.createGain();
                    o.type = "sawtooth"; o.frequency.value = f; g.gain.value = 0.2;
                    o.connect(g).connect(audioContext.destination); o.start(); o.stop(audioContext.currentTime + 0.95);
                }, i*110));
                return;
        }
        osc.start();
        osc.stop(audioContext.currentTime + 0.4);
    } catch(e) {}
}

// === Grid Setup ===
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
    return { left: `calc(${col * 25}% + 6px)`, top: `calc(${row * 25}% + 6px)` };
}

function updateDisplay(previousGrid = null) {
    tiles.forEach((tile, i) => {
        const value = grid[i];
        if (value === 0) { tile.style.opacity = "0"; return; }

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
                playSound("merge", value);
            }
        }
    });
}

function getColor(value) {
    const colors = {2:"#f59e0b",4:"#eab308",8:"#c2410f",16:"#b91c1c",32:"#991b1b",64:"#7e22ce",128:"#6b21a8",256:"#581c87",512:"#1e40af",1024:"#1e3a8a",2048:"#14b8a6",4096:"#0f766e"};
    return colors[value] || "#0c3a3a";
}

function addRandomTile() {
    const empty = grid.map((v,i) => v===0 ? i : -1).filter(i => i>=0);
    if (empty.length === 0) return false;
    grid[empty[Math.floor(Math.random()*empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    return true;
}

// Movement logic (unchanged)
function slide(row) { /* ... same as before ... */ 
    let newRow = row.filter(v => v !== 0);
    for (let i = 0; i < newRow.length-1; i++) {
        if (newRow[i] === newRow[i+1]) {
            newRow[i] *= 2; score += newRow[i]; newRow.splice(i+1,1); i++;
        }
    }
    while (newRow.length < 4) newRow.push(0);
    return newRow;
}
function moveLeft() { let moved = false; for (let r=0; r<4; r++) { const start=r*4; const row=grid.slice(start,start+4); const newRow=slide(row); if (row.join()!==newRow.join()) moved=true; for (let i=0;i<4;i++) grid[start+i]=newRow[i]; } return moved; }
function rotateGrid() { const newGrid=Array(16).fill(0); for (let i=0;i<16;i++) { const r=Math.floor(i/4), c=i%4; newGrid[c*4+(3-r)]=grid[i]; } grid=newGrid; }

function move(direction) {
    if (gameOverFlag || hasWon) return;
    const previous = [...grid];
    let moved = false;
    if (direction==="Left") moved = moveLeft();
    else if (direction==="Right") { rotateGrid(); rotateGrid(); moved=moveLeft(); rotateGrid(); rotateGrid(); }
    else if (direction==="Up")    { rotateGrid(); rotateGrid(); rotateGrid(); moved=moveLeft(); rotateGrid(); }
    else if (direction==="Down")  { rotateGrid(); moved=moveLeft(); rotateGrid(); rotateGrid(); rotateGrid(); }

    if (moved) {
        playSound("move");
        updateDisplay(previous);
        setTimeout(() => {
            addRandomTile();
            updateDisplay(previous);
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
        setTimeout(() => alert("🎉 You Win!\n\nYou reached 2048!"), 300);
    }
}

function checkGameOver() {
    if (grid.includes(0)) return;
    for (let i = 0; i < 16; i++) {
        const v = grid[i]; if (v===0) continue;
        const r = Math.floor(i/4), c = i%4;
        if (c<3 && grid[i+1]===v) return;
        if (r<3 && grid[i+4]===v) return;
    }
    gameOverFlag = true;
    playSound("gameover");
    setTimeout(() => alert(`Game Over!\nFinal Score: ${score}`), 400);
}

// Controls
document.addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
        move(e.key.replace("Arrow",""));
    }
});

let tsX=0, tsY=0;
gridEl.addEventListener("touchstart", e=>{ tsX=e.changedTouches[0].screenX; tsY=e.changedTouches[0].screenY; });
gridEl.addEventListener("touchend", e=>{
    const dx = e.changedTouches[0].screenX - tsX;
    const dy = e.changedTouches[0].screenY - tsY;
    if (Math.abs(dx)<40 && Math.abs(dy)<40) return;
    move(Math.abs(dx)>Math.abs(dy) ? (dx>0?"Right":"Left") : (dy>0?"Down":"Up"));
});

document.getElementById("restart").addEventListener("click", () => {
    grid = Array(16).fill(0); score=0; gameOverFlag=false; hasWon=false;
    document.querySelectorAll('.tile').forEach(t=>t.style.opacity="0");
    addRandomTile(); addRandomTile(); updateDisplay();
});

// ====================== START BUTTON ======================
document.getElementById("start-button").addEventListener("click", () => {
    initAudio();
    startScreen.style.display = "none";
    addRandomTile();
    addRandomTile();
    updateDisplay();
});
