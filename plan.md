# 🎮 Neon Rain - Development Plan

## 1. The Game Concept

**Title:** Neon Rain  
**Genre:** 2D Infinite Dodger  
**Objective:** You control a neon square at the bottom of the screen. "Rain" (lines or shapes) falls from the top. You must dodge the rain. As time passes, the rain gets faster and more chaotic.  
**Visual Style:** Dark background (#111), bright neon colors (Cyan, Magenta, Lime) for entities. No sprites needed—we will draw everything using code.

---

## 2. The Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Rendering | HTML5 Canvas API (Context 2D) |
| Build Tool | Vite |
| Physics | Simple AABB Collision Detection |

---

## 3. Architecture & Class Structure

### A. Interfaces

```typescript
Vector2: { x: number, y: number }
GameObject: Interface requiring position, velocity, draw(), and update()
```

### B. Classes

- **Game**: The brain. Manages the canvas context, holds `lastTime`, and runs `loop()`
- **InputHandler**: Listens for keydown/keyup events, stores WASD/Arrow key states
- **Entity** (Base Class): Handles basic position and velocity math
- **Player** (extends Entity): Adds boundary logic and "Dash" mechanics
- **Enemy** (extends Entity): Handles falling logic and reset when off-screen

---

## 4. Development Phase Plan

### Phase 1: The Skeleton ✅ COMPLETE
**Goal:** Get a black screen and a running loop.

**Tasks:**
- [x] Initialize Vite with TypeScript
- [x] Create the Game class
- [x] Set up `requestAnimationFrame` for 60 FPS loop
- [x] Calculate `deltaTime` for smooth movement

**Test Cases:**
- [x] Canvas renders with dark background (#111) ✅
- [x] Game loop is running (FPS: 240+) ✅
- [x] No errors in browser console ✅

**Unit Tests:** 9/9 passing

---

### Phase 2: The Player ✅ COMPLETE
**Goal:** Move a square on the screen.

**Tasks:**
- [x] Draw a cyan rectangle using `ctx.fillRect`
- [x] Hook up InputHandler
- [x] Apply velocity: `position.x += velocity.x × deltaTime`

**Test Cases:**
- [x] Player square is visible (cyan color with neon glow) ✅
- [x] Player moves left with A/← ✅
- [x] Player moves right with D/→ ✅
- [x] Player moves up/down with W/S and arrows ✅
- [x] Player cannot move off-screen ✅
- [x] Movement is smooth regardless of frame rate ✅
- [x] Dash mechanic (Space/Shift) works ✅

**Unit Tests:** 32/32 passing (InputHandler: 17, Player: 15)

---

### Phase 3: The Threat (Enemy Spawner) ✅ COMPLETE
**Goal:** Make things fall.

**Tasks:**
- [x] Create an EnemyManager
- [x] Spawn new Enemy every X seconds
- [x] Update/draw enemies in loop
- [x] Remove off-screen enemies

**Test Cases:**
- [x] Enemies spawn at random X positions ✅
- [x] Enemies fall downward smoothly ✅
- [x] Enemies are removed when off-screen ✅
- [x] Multiple enemies can exist at once ✅
- [x] Difficulty increases over time ✅
- [x] Color variations (magenta, pink, orange, yellow) ✅

**Unit Tests:** 21/21 passing (Enemy: 10, EnemyManager: 11)

---

### Phase 4: Collision (The Math) ✅ COMPLETE
**Goal:** Detect when the player dies.

**AABB Collision Formula:**
```
x1 < x2 + w2 AND x1 + w1 > x2 AND y1 < y2 + h2 AND y1 + h1 > y2
```

**Tasks:**
- [x] Implement AABB collision detection
- [x] Stop loop on collision
- [x] Show "Game Over" screen

**Test Cases:**
- [x] Collision detected when player touches enemy ✅
- [x] No false positives (near misses don't trigger) ✅
- [x] Game stops on collision ✅
- [x] Game Over screen displays ✅
- [x] Score display with HUD ✅
- [x] High score persistence ✅
- [x] Restart with Space/Enter ✅

**Unit Tests:** 16/16 passing (Collision: 16)

---

### Phase 5: The "Juice" (Polish) ✅ COMPLETE
**Goal:** Make it feel good.

**Tasks:**
- [x] Particle trail when player moves
- [x] Score based on time survived
- [x] Increase difficulty every 10 seconds

**Test Cases:**
- [x] Particles fade out over time ✅
- [x] Score increases continuously ✅
- [x] Game gets harder over time ✅
- [x] Visual effects enhance gameplay ✅
- [x] Dash sparkle effects ✅
- [x] Death explosion particles ✅

**Unit Tests:** 17/17 passing (Particles: 17)

---

## Current Progress

✅ **Phase 1** - Complete (Game Loop, Canvas, Delta Time)
✅ **Phase 2** - Complete (Player, InputHandler, Movement)
✅ **Phase 3** - Complete (Enemy, EnemyManager, Difficulty Scaling)
✅ **Phase 4** - Complete (Collision Detection, Game Over, Score)
✅ **Phase 5** - Complete (Particles, Visual Effects, Polish)

---

## 🎉 GAME COMPLETE!

**Total Unit Tests:** 95 passing
**Total Lines of Code:** ~2000+
**Playable at:** http://localhost:5173/