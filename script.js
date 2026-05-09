// ====================== 2048 - V4 (Better Sounds + Confetti) ======================
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

// ====================== IMPROVED AUDIO ======================
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
            osc.frequency.setValueAtTime(240, audioContext.currentTime);
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
            osc.connect(gain).connect(audioContext.destination);
            osc.start();
            osc.stop(audioContext.currentTime + 0.15);
            
        } else if (type === "merge") {
            // Richer merge sound that rises with value
            const baseFreq = 380 + Math.log2(value) * 110;
            
            // Main tone
            const osc1 = audioContext.createOscillator();
            const gain1 = audioContext.createGain();
            osc1.type = "triangle";
            osc1.frequency.setValueAtTime(baseFreq, audioContext.currentTime);
            gain1.gain.setValueAtTime(0.4, audioContext.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45);
            
            // Harmonic layer
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(baseFreq * 1.5, audioContext.currentTime);
            gain2.gain.setValueAtTime(0.25, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
            
            osc1.connect(gain1).connect(audioContext.destination);
            osc2.connect(gain2).connect(audioContext.destination);
            
            osc1.start();
            osc2.start();
            osc1.stop(audioContext.currentTime + 0.5);
            osc2.stop(audioContext.currentTime + 0.4);
            
        } else if (type === "new") {
            // Satisfying pop for new tiles
            const noise = audioContext.createBufferSource();
            const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.08, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            noise.buffer = buffer;
            
            const filter = audioContext.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(1200, audioContext.currentTime);
            
            const gain = audioContext.createGain();
            gain.gain.setValueAtTime(0.35, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
            
            noise.connect(filter).connect(gain).connect(audioContext.destination);
            noise.start();
            
        } else if (type === "win") {
            const melody = [880, 1100, 1320, 1760, 1980];
            melody.forEach((freq, i) => {
                setTimeout(() => {
                    const o = audioContext.createOscillator();
                    const g = audioContext.createGain();
                    o.type = "sine";
                    o.frequency.value = freq;
                    g.gain.value = 0.35;
                    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
                    o.connect(g).connect(audioContext.destination);
                    o.start();
                    o.stop(audioContext.currentTime + 0.9);
                }, i * 90);
            });
        } else if (type === "gameover") {
            const notes = [520, 420, 340, 260];
            notes.forEach((freq, i) => {
                setTimeout(() => {
                    const o = audioContext.createOscillator();
                    const g = audioContext.createGain();
                    o.type = "sawtooth";
                    o.frequency.value = freq;
                    g.gain.value = 0.3;
                    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.1);
                    o.connect(g).connect(audioContext.destination);
                    o.start();
                    o.stop(audioContext.currentTime + 1.2);
                }, i * 160);
            });
        }
    } catch (e) {}
}

// ====================== CONFETTI (from V3) ======================
let confettiCanvas = null;
let confettiCtx = null;
const confettiPieces = [];

class Confetto { /* ... same as V3 ... */ 
    constructor() {
        this.x = Math.random() * (confettiCanvas ? confettiCanvas.width : window.innerWidth);
        this.y = Math.random() * -200;
        this.size = Math.random() * 13 + 8;
        this.speed = Math.random() * 7 + 5;
        this.angle = Math.random() * 360;
        this.angleSpeed = Math.random() * 0.4 - 0.2;
        this.color = `hsl(${Math.random()*360}, 95%, 65%)`;
        this.shape = Math.random() > 0.5 ? "circle" : "rect";
    }
    update() {
        this.y += this.speed;
        this.angle += this.angleSpeed;
        this.speed += 0.09;
    }
    draw() {
        if (!confettiCtx) return;
        confettiCtx.save();
        confettiCtx.translate(this.x, this.y);
        confettiCtx.rotate(this.angle * Math.PI / 180);
        confettiCtx.fillStyle = this.color;
        if (this.shape === "circle") {
            confettiCtx.beginPath();
            confettiCtx.arc(0, 0, this.size/2, 0, Math.PI*2);
            confettiCtx.fill();
        } else {
            confettiCtx.fillRect(-this.size/2, -this.size/2, this.size, this.size*0.65);
        }
        confettiCtx.restore();
    }
}

function launchConfetti(duration = 5500) {
    if (!confettiCanvas) {
        confettiCanvas = document.createElement("canvas");
        confettiCanvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:300;";
        document.body.appendChild(confettiCanvas);
        confettiCtx = confettiCanvas.getContext("2d");
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
    
    for (let i = 0; i < 320; i++) confettiPieces.push(new Confetto());
    
    const start = Date.now();
    function animate() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        for (let i = confettiPieces.length-1; i >= 0; i--) {
            const c = confettiPieces[i];
            c.update();
            c.draw();
            if (c.y > confettiCanvas.height + 50) confettiPieces.splice(i, 1);
        }
        if (Date.now() - start < duration && confettiPieces.length > 0) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

// ====================== REST OF THE CODE (same as V3 but with new sounds) ======================
gridEl.style.position = "relative";

// Background cells + tiles setup (same as before)
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

// Particle explosion (same strong version)
function createMergeExplosion(tileElement, value) {
    if (!tileElement) return;
    const rect = tileElement.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();
    const centerX = rect.left - gridRect.left + rect.width / 2;
    const centerY = rect.top - gridRect.top + rect.height / 2;

    const intensity = Math.min(3.4, Math.log2(value) / 4.3);
    const count = Math.floor(20 + intensity * 24);
    const baseHue = getTileHue(value);

    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        const hue = (baseHue + (Math.random() * 55 - 27)) % 360;
        p.style.backgroundColor = `hsl(${hue}, 94%, ${68 + Math.random()*24}%)`;
        p.style.left = `${centerX}px`;
        p.style.top = `${centerY}px`;

        const angle = Math.random() * Math.PI * 2;
        const vel = 55 + Math.random() * 140 * intensity;
        p.style.setProperty("--dx", `${Math.cos(angle) * vel}px`);
        p.style.setProperty("--dy", `${Math.sin(angle) * vel - intensity*25}px`);

        const size = 7 + Math.random() * (12 + intensity*6);
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.animationDelay = `${Math.random()*65}ms`;

        gridEl.appendChild(p);
        setTimeout(() => p.remove(), 1200);
    }

    if (value >= 256) {
        tileElement.style.transition = "transform 85ms, box-shadow 160ms";
        tileElement.style.transform = "scale(1.4)";
        tileElement.style.boxShadow = `0 0 60px hsl(${baseHue}, 95%, 80%)`;
        setTimeout(() => { tileElement.style.transform = "scale(1)"; tileElement.style.boxShadow = ""; }, 180);
    }
}

function getTileHue(value) {
    const map = {2:200,4:195,8:38,16:32,32:18,64:0,128:260,256:275,512:290,1024:310,2048:330,4096:350};
    return map[value] || 200;
}

function getColor(value) { /* same as before */ 
    const colors = {2:"#f59e0b",4:"#eab308",8:"#c2410f",16:"#b91c1c",32:"#991b1b",64:"#7e22ce",128:"#6b21a8",256:"#581c87",512:"#1e40af",1024:"#1e3a8a",2048:"#14b8a6",4096:"#0f766e"};
    return colors[value] || "#0c3a3a";
}

// ... (keep the rest of the code: updateDisplay, slideLine, move, addRandomTile, checkWin, etc. same as V3)

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
                playSound("new");           // ← New improved sound
            } else if (val > oldVal && oldVal > 0) {
                tile.classList.add("merged");
                createMergeExplosion(tile, val);
                setTimeout(() => tile.classList.remove("merged"), 400);
                playSound("merge", val);    // ← Much richer merge sound
            }
        }
    });
    scoreEl.textContent = score;
}

// (Include the full move(), slideLine(), checkWin(), modals, etc. from V3)

function checkWin() {
    if (hasWon) return;
    if (board.includes(2048)) {
        hasWon = true;
        playSound("win");
        launchConfetti(6000);
        showWinModal();
    }
}

// ... rest of the file remains the same as V3 (input handlers, buttons, restart, etc.)
