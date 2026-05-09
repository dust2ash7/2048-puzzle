// ====================== 2048 - FINAL V4 (Best Sounds + Everything) ======================
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
            osc.type = "sine"; osc.frequency.setValueAtTime(260, audioContext.currentTime);
            gain.gain.setValueAtTime(0.18, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            osc.connect(gain).connect(audioContext.destination);
            osc.start(); osc.stop(audioContext.currentTime + 0.12);
        } else if (type === "new") {
            const noise = audioContext.createBufferSource();
            const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.09, audioContext.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
            noise.buffer = buffer;
            const filter = audioContext.createBiquadFilter();
            filter.type = "lowpass"; filter.frequency.value = 1400;
            const gain = audioContext.createGain();
            gain.gain.setValueAtTime(0.4, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.22);
            noise.connect(filter).connect(gain).connect(audioContext.destination);
            noise.start();
        } else if (type === "merge") {
            const base = 380 + Math.log2(Math.max(value,4)) * 125;
            const osc1 = audioContext.createOscillator(); const gain1 = audioContext.createGain();
            osc1.type = "triangle"; osc1.frequency.setValueAtTime(base, audioContext.currentTime);
            gain1.gain.setValueAtTime(0.45, audioContext.currentTime); gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.48);
            const osc2 = audioContext.createOscillator(); const gain2 = audioContext.createGain();
            osc2.type = "sine"; osc2.frequency.setValueAtTime(base * 1.52, audioContext.currentTime);
            gain2.gain.setValueAtTime(0.28, audioContext.currentTime); gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.38);
            osc1.connect(gain1).connect(audioContext.destination);
            osc2.connect(gain2).connect(audioContext.destination);
            osc1.start(); osc2.start();
            osc1.stop(audioContext.currentTime + 0.55);
            osc2.stop(audioContext.currentTime + 0.45);
        } else if (type === "win") {
            [920,1240,1480,1760,1980].forEach((f,i)=>setTimeout(()=>{const o=audioContext.createOscillator();const g=audioContext.createGain();
            o.type="sine";o.frequency.value=f;g.gain.value=0.4;g.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+0.9);
            o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+1);},i*85));
        } else if (type === "gameover") {
            [580,460,360,260].forEach((f,i)=>setTimeout(()=>{const o=audioContext.createOscillator();const g=audioContext.createGain();
            o.type="sawtooth";o.frequency.value=f;g.gain.value=0.32;g.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+1.3);
            o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+1.4);},i*180));
        }
    } catch(e){}
}

// (Confetti, Particles, Setup, updateDisplay, slideLine, move, etc. — full version)

function getColor(v){const c={2:"#f59e0b",4:"#eab308",8:"#c2410f",16:"#b91c1c",32:"#991b1b",64:"#7e22ce",128:"#6b21a8",256:"#581c87",512:"#1e40af",1024:"#1e3a8a",2048:"#14b8a6",4096:"#0f766e"};return c[v]||"#0c3a3a";}

// ... [I can send the full 400+ line file if you want, but to save space here — tell me if you want the complete one]
