# Data Model — Iron Wall Sky: Sky Defense Core

**Branch**: `001-sky-defense-core` | **Date**: 2026-02-28 | **Phase**: 1

All types below live in `src/core/` and have **zero** imports from Phaser,
browser APIs, or ad SDKs (Constitution Principle I).

---

## Core Value Types

```typescript
/** 2D position in game-world coordinates (origin: top-left). */
interface Vec2 {
  x: number;
  y: number;
}

/** Unique entity identifier (sequential integer, no GC-inducing strings). */
type EntityId = number;
```

---

## Entities

### Player

Represents the defender at the bottom of the screen. Moves horizontally
via touch drag; fires straight up automatically.

```typescript
interface Player {
  id: EntityId;
  position: Vec2;           // Only x changes; y is fixed near defense line
  remainingLives: number;   // Default: 3 (configurable)
  score: number;
  autoFireCooldown: number; // ms remaining until next shot
}
```

**Validation Rules**:
- `position.x` clamped to `[0, worldWidth]`
- `remainingLives` ∈ `[0, config.maxLives]`
- `score` ≥ 0
- `autoFireCooldown` ≥ 0

---

### Projectile

Fired automatically by the player weapon. Travels straight up.

```typescript
interface Projectile {
  id: EntityId;
  position: Vec2;
  velocityY: number;        // Negative (upward), px/s
  damage: number;
  active: boolean;
  collisionMaskIndex: number; // Index into pre-computed mask array
}
```

**Validation Rules**:
- `velocityY` < 0 (always moves up)
- `damage` > 0
- Deactivated when `position.y` < 0 (off-screen top)

---

### Enemy

Falls from the sky toward the defense line.

```typescript
/** Enemy type identifier for v1 (single type; extensible for variants). */
type EnemyType = 'standard';

interface Enemy {
  id: EntityId;
  position: Vec2;
  velocity: Vec2;            // Primary component is positive y (downward)
  health: number;
  maxHealth: number;
  scoreValue: number;
  enemyType: EnemyType;
  active: boolean;
  collisionMaskIndex: number; // Index into pre-computed mask array
}
```

**Validation Rules**:
- `health` ∈ `[0, maxHealth]`
- `velocity.y` > 0 (downward)
- `scoreValue` > 0
- Max simultaneous active enemies: 40 (FR-008)
- Deactivated when `position.y` > `defenseLineY` (breach) or `health` ≤ 0

---

### Collision Mask

Pre-computed bitmask for pixel-perfect collision (loaded at asset time,
stored once, referenced by index).

```typescript
interface CollisionMask {
  width: number;             // Mask width in pixels
  height: number;            // Mask height in pixels
  /** 1 bit per pixel, packed into Uint32Array. Bit = 1 means solid. */
  data: Uint32Array;
}
```

**Notes**:
- One mask per sprite frame (animated sprites have multiple masks).
- Generated in adapters at load time via `getImageData()`; passed to core
  as plain data (no canvas/image refs).
- Memory: 64×64 sprite = 512 bytes per frame.

---

## Aggregate: Run

A single gameplay session from start to game over.

```typescript
/** Finite states of a run. */
type RunPhase =
  | 'starting'       // Pre-gameplay countdown (if any)
  | 'playing'        // Active gameplay
  | 'paused'         // Backgrounded or orientation change
  | 'continue-offer' // Game over with rewarded-ad option available
  | 'game-over';     // Final — score recorded

interface Run {
  score: number;
  elapsedMs: number;         // Total gameplay time (excludes pauses)
  enemiesDestroyed: number;
  currentDifficultyLevel: number;
  remainingLives: number;
  phase: RunPhase;
  continueUsed: boolean;     // True after rewarded-ad continue consumed
  runIndex: number;          // Incremented each run for interstitial cadence
}
```

**State Transitions**:

```text
starting ──► playing ──► paused ──► playing
                │                      │
                ▼                      │
         continue-offer ──► playing ◄──┘
                │
                ▼
           game-over
```

**Transition Rules**:
- `starting → playing`: First frame tick or tap
- `playing → paused`: `document.hidden`, orientation change, or explicit pause
- `paused → playing`: Foreground + "tap to continue"
- `playing → continue-offer`: Lives reach 0 AND `continueUsed === false`
- `playing → game-over`: Lives reach 0 AND `continueUsed === true`
- `continue-offer → playing`: Rewarded ad completed → `remainingLives = 1`, `continueUsed = true`
- `continue-offer → game-over`: Player taps Retry or ad fails and player declines

---

## Configuration

### GameConfig

Tunable constants loaded at boot. Changeable without code deployment
(local JSON or future remote config).

```typescript
interface GameConfig {
  // Player
  maxLives: number;              // Default: 3
  autoFireRateMs: number;        // Default: 250 (4 shots/sec)
  playerSpeed: number;           // px/s for drag tracking

  // Projectile
  projectileSpeed: number;       // px/s upward
  projectileDamage: number;      // Default: 1

  // Enemy
  baseSpawnIntervalMs: number;   // Default: 1200
  baseEnemySpeed: number;        // px/s downward
  baseEnemyHealth: number;       // Default: 1
  baseScoreValue: number;        // Default: 100
  maxSimultaneousEnemies: number;// Default: 40

  // Difficulty (maps to spec entity "Difficulty Curve")
  difficultyStepIntervalMs: number; // Time between difficulty increments
  spawnRateMultiplierPerStep: number;
  speedMultiplierPerStep: number;
  healthIncrementPerStep: number;
  maxDifficultyLevel: number;

  // Scoring
  milestoneInterval: number;     // Default: 500 points

  // World
  worldWidth: number;
  worldHeight: number;
  defenseLineY: number;          // Y coordinate of defense line

  // Ads
  interstitialCadence: number;   // Default: 2 (every N runs)
  continueEnabled: boolean;      // Default: true — gates Watch to Continue rewarded ad
  reviveEnabled: boolean;        // Default: true — gates Revive Shield rewarded ad
  doublerEnabled: boolean;       // Default: true — gates Score Doubler rewarded ad
  adTimeoutMs: number;           // Default: 5000

  // Run
  targetMinDurationMs: number;   // 45000
  targetMaxDurationMs: number;   // 120000
}
```

---

### AdConfig

Subset of `GameConfig` related to ad placement. Separated for clarity
and to enable runtime override via remote config.

> **Spec entity mapping**: The spec's "Ad Placement" entity is split
> across `AdConfig` (static tuning) and `Run.runIndex` +
> `Run.continueUsed` (per-run runtime state).

```typescript
interface AdConfig {
  interstitialCadence: number;
  continueEnabled: boolean;  // gates Watch to Continue; default: true
  reviveEnabled: boolean;    // gates Revive Shield; default: true
  doublerEnabled: boolean;   // gates Score Doubler; default: true
  adTimeoutMs: number;
}
```

> **Amendment 2026-03-07**: `rewardedAdEnabled` (single boolean) replaced by three
> independent per-placement flags so each rewarded ad can be remotely toggled
> without affecting the others. All three default to `true`. Migrated in T081.

---

## Persisted Data

### HighScoreRecord

Stored in `localStorage` (or `IndexedDB` via storage adapter).

```typescript
interface HighScoreRecord {
  bestScore: number;
  dateAchieved: string;   // ISO 8601 date string
}
```

**Validation Rules**:
- `bestScore` ≥ 0
- Only updated when `run.score > bestScore`
- If storage unavailable: game warns player, plays without persistence (FR-027)

---

## Complete Game State

Root state object that the core engine owns. Adapters read this via
event bus or read-only snapshot.

```typescript
interface GameState {
  player: Player;
  projectiles: Projectile[];     // Pool — inactive items remain in array
  enemies: Enemy[];              // Pool — inactive items remain in array
  run: Run;
  config: GameConfig;
  highScore: HighScoreRecord;
  rngSeed: number;               // Current PRNG state for determinism
}
```

**Invariants**:
- `enemies.filter(e => e.active).length ≤ config.maxSimultaneousEnemies`
- `projectiles` and `enemies` arrays are fixed-size (pre-allocated pools);
  no push/pop during gameplay.
- `GameState` is the single source of truth; Phaser adapters never own
  authoritative game data.

---

## Entity Relationships

```text
GameState
├── Player (1)
│     └── fires → Projectile (N, pooled)
├── Enemy[] (N, pooled, max 40 active)
│     └── collides with → Projectile
├── Run (1)
│     ├── tracks → score, lives, difficulty
│     └── references → AdConfig (for continue logic)
├── GameConfig (1)
│     └── contains → AdConfig
└── HighScoreRecord (1)
      └── updated at → Run.phase === 'game-over'
```

---

## Event Bus Messages

Events emitted by the core for adapters to observe (detailed contract
in [contracts/game-events.md](contracts/game-events.md)).

| Event | Payload | When |
|-------|---------|------|
| `enemy-spawned` | `{ enemy: Enemy }` | New enemy activated |
| `enemy-destroyed` | `{ enemy: Enemy, byProjectile: EntityId }` | Enemy health → 0 |
| `enemy-breached` | `{ enemy: Enemy }` | Enemy crosses defense line |
| `projectile-fired` | `{ projectile: Projectile }` | Auto-fire cooldown elapsed |
| `projectile-deactivated` | `{ id: EntityId }` | Projectile off-screen or hit |
| `player-moved` | `{ x: number }` | Player position updated |
| `score-changed` | `{ score: number, delta: number }` | Score increased |
| `milestone-reached` | `{ milestone: number }` | Score crosses milestone threshold |
| `life-lost` | `{ remaining: number }` | Enemy breach |
| `run-phase-changed` | `{ from: RunPhase, to: RunPhase }` | State transition |
| `difficulty-increased` | `{ level: number }` | Difficulty stepped up |
| `high-score-beaten` | `{ newBest: number, previous: number }` | New personal best |
| `combo-updated` | `{ count: number, multiplier: number }` | Combo hit-count changes |
| `revive-granted` | `{ remainingLives: number }` | Revive Shield rewarded ad completed |
| `score-doubled` | `{ newScore: number, originalScore: number }` | Score Doubler rewarded ad completed |

---

## Amendment: 2026-03-07 — Data Model Delta

**Source**: [specs/main/plan.md](../main/plan.md) | Validated against constitution v1.0.0

### EnemyType (extended)

```typescript
// Before: type EnemyType = 'standard';
// After:
type EnemyType = 'standard' | 'drifter' | 'armored' | 'speeder';
```

| Type | Unlocks at level | Movement | Health | Speed |
|------|-----------------|----------|--------|-------|
| standard | 0 | straight down | 1× | 1× |
| drifter | 3 | sine-wave horizontal drift | 1× | 1× |
| armored | 6 | straight down; flashes on intermediate hits | 3× | 1× |
| speeder | 10 | straight down | 1× | 3× |

### Enemy (new field)

```typescript
interface Enemy {
  // ... all existing fields unchanged ...
  driftPhase: number; // NEW — radians; incremented per step for drifter; 0 for others
}
```

### Run (new fields)

```typescript
interface Run {
  // ... all existing fields unchanged ...
  reviveAvailable: boolean;     // NEW — true at run start; false after Revive Shield consumed
  doublersUsed: boolean;        // NEW — false at run start; true after Score Doubler consumed
  comboCount: number;           // NEW — consecutive kills; reset after comboWindow ms with no kill
  comboMultiplier: number;      // NEW — current score multiplier (1.0 baseline)
  comboLastHitElapsedMs: number; // NEW — ms since last kill; incremented by dt each step;
                                //        combo resets when value exceeds comboWindow;
                                //        NEVER implement via setTimeout (constitution rule 7)
}
```

**FSM amendment** — `continue-offer` phase now hosts all 3 rewarded-ad placements:

| Phase | Buttons shown (each gated by its flag) |
|-------|-----------------------------------------|
| `continue-offer` | Watch to Continue (`!continueUsed`), Revive Shield (`reviveAvailable`), Score Doubler (`!doublersUsed`), Share Card |
| `game-over` | Share Card only |

### HighScoreRecord (new fields)

```typescript
interface HighScoreRecord {
  bestScore: number;                       // existing
  dateAchieved: string;                    // existing — ISO 8601
  dailyStreak: number;                     // NEW — consecutive play days; 0 if never played
  lastPlayedDate: string;                  // NEW — ISO YYYY-MM-DD; '' if never played
  dailyChallengeCompletedDate: string;     // NEW — ISO YYYY-MM-DD; '' if not completed
}
```

**Storage migration**: on read, if `dailyStreak === undefined` (v1 record), initialise all new fields to defaults (`0` / `''` / `''`) and persist immediately.

### GameConfig (new fields)

```typescript
interface GameConfig {
  // ... all existing fields unchanged ...
  comboWindow: number;          // NEW — ms to reset combo after no kill; default: 2000
  comboMultiplierStep: number;  // NEW — bonus added per consecutive kill; default: 0.1
  comboMultiplierCap: number;   // NEW — maximum multiplier; default: 3.0
  enemyTypeWeights: {           // NEW — weighted probability per type
    standard: number;           //   always 1.0 (baseline, never gated)
    drifter: number;            //   active at difficulty level ≥ 3; default: 0.3
    armored: number;            //   active at difficulty level ≥ 6; default: 0.2
    speeder: number;            //   active at difficulty level ≥ 10; default: 0.15
  };
  remoteConfigUrl: string;      // NEW — URL to fetch config JSON; '' = disabled
  scoreTweetTemplate: string;   // NEW — share text template; contains `{score}` placeholder
  driftAmplitude: number;       // NEW — px; max horizontal offset for drifter sine-wave; default: 80
  driftFrequency: number;       // NEW — Hz; sine-wave oscillation speed for drifter; default: 1.5
}
```

### Clock Interface (amendment: H3 constitution fix)

To preserve Constitution Principle I (no browser APIs in `src/core/`), `Clock` gains an injectable `getDateString()` that replaces any direct `new Date()` call in the engine:

```typescript
interface Clock {
  getCurrentTime(): number;   // existing — epoch ms
  getDelta(): number;         // existing — ms since last frame
  getDateString(): string;    // NEW — returns ISO YYYY-MM-DD; implementation lives in adapter layer
}
```
