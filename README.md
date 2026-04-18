<div align="center">

# 🌧️ Neon Rain

**dodge. survive. glow.**

*A fast-paced 2D infinite dodger game with neon visuals*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://render.com/)

</div>

---

## ✨ What is this?

**Neon Rain** is a browser arcade game where neon obstacles fall from the sky and your only job is to *not get hit*. Simple concept. Increasingly cruel execution.

Built from scratch with vanilla TypeScript and rendered straight onto an HTML5 canvas — no game engine, no framework, just vibes and `requestAnimationFrame`.

A tiny WebSocket server lives alongside the game, ready for real-time features like leaderboards or multiplayer mayhem.

---

## 🛠️ Built with

| thing | what it does |
|---|---|
| 🟦 TypeScript | all the logic, all the fun |
| 🎨 HTML5 Canvas | where the magic gets painted |
| ⚡ Vite | lightning-fast dev experience |
| 🔌 ws (WebSocket) | real-time server stuff |
| 🧪 Vitest | keeps things from breaking |
| 🚀 Render | ships it to the world |

---

## 🚀 Running it locally

### you'll need
- Node.js v20+
- npm

### let's go

```bash
git clone https://github.com/ghimpumihai/Neon-Rain.git
cd Neon-Rain
npm install
```

Then open two terminals and run:

```bash
# terminal 1 — the game
npm run dev

# terminal 2 — the server
npm run dev:server
```

Open [http://localhost:5173](http://localhost:5173) and start dodging 🌧️

---

## 📦 Building for prod

```bash
npm run build
npm run start
```

Render does this automatically on every push to `main` via `render.yaml`. Push and forget. 🎉

---

## 🗂️ Project structure

```
Neon-Rain/
├── 🎮 src/                  # the game lives here
│   ├── main.ts              # game loop & entry point
│   └── style.css            # neon aesthetic
├── 🔌 server/               # websocket server
│   └── index.ts
├── index.html               # canvas shell
├── vite.config.ts
└── render.yaml              # deployment config
```

---

## 🧰 Scripts cheatsheet

| command | does what |
|---|---|
| `npm run dev` | start the frontend |
| `npm run dev:server` | start the ws server |
| `npm run build` | production build |
| `npm run start` | run in production |
| `npm test` | run the test suite |

---

<div align="center">

made with 💜 by [ghimpumihai](https://github.com/ghimpumihai)

</div>