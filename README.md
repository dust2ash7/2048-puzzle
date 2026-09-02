# 2048 Premium

A flagship-quality remake of 2048: editorial type, butter-smooth tiles, themes, a UTC daily challenge, and a working PWA. No accounts, no ads, no paywall.

![2048](avatar.jpg)

### [Play live](https://dust2ash7.github.io/2048-puzzle/)

---

## How to play

Slide the 4×4 grid so equal numbers collide. Each tile may merge **once per move**. After a successful slide, a **2** appears (90%) or a **4** (10%). Reach **2048** to win — you can keep going. The run ends when the board is full and no adjacent pair can merge.

**Controls**
- Desktop: arrow keys or WASD
- Phone: swipe on the board (the rest of the page still scrolls)
- Undo last move: button or `U`

## Features

- Authentic 2048 rules, including continue-after-win
- Transform-based tile motion and a merge pop (honors `prefers-reduced-motion`)
- Undo of the last successful move
- Three palettes — **Obsidian** (dark), **Porcelain** (light), **Aurora** (night) — saved in `localStorage`
- Stats: best score, best tile, games played, wins
- Daily challenge: board RNG seeded from the UTC date; today’s best is saved
- Web Audio beeps with mute (also silent when reduced motion is on)
- Start screen, win overlay (Continue / New Game / Undo), game-over overlay (New Game / Undo)
- PWA: installable, caches the app shell, GitHub Pages compatible
- Keyboard, swipe, focus rings, button labels, contrast, `aria-live` status

## Run locally

This is a static site. From the repo root:

```bash
# Python
python3 -m http.server 8080

# or Node
npx --yes serve .
```

Then open `http://localhost:8080`. A local server is recommended so the service worker and manifest resolve correctly.

## GitHub Pages

Already wired for project pages with files at the repository root:

**https://dust2ash7.github.io/2048-puzzle/**

If you fork it, enable Pages on the `main` branch (root).

## Files

| File | Role |
| --- | --- |
| `index.html` | Shell, overlays, PWA hooks |
| `style.css` | Theme system, board, motion |
| `script.js` | Rules, input, audio, persistence |
| `manifest.json` / `sw.js` | Installable app shell |
| `avatar.jpg` | Icon / brand mark |
