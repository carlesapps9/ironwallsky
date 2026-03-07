// src/core/engine.ts — Game engine with fixed-timestep loop, FSM, and commands

import type {
  GameState,
  Player,
  Projectile,
  Enemy,
  Run,
  CollisionMask,
} from './entities.js';
import type { GameConfig } from './config.js';
import {
  DEFAULT_CONFIG,
  FIXED_DT,
  MAX_ACCUMULATOR,
  PROJECTILE_POOL_SIZE,
  ENEMY_POOL_SIZE,
} from './config.js';
import type { GameEventBus } from './events.js';
import { createEventBus } from './events.js';
import type { SeededRng } from './rng.js';
import { createRng } from './rng.js';
import { updateMovement } from './systems/movement.js';
import { updateCollisions } from './systems/collision.js';
import { updateSpawner } from './systems/spawner.js';
import { updateDifficulty } from './systems/difficulty.js';
import { updateScoring } from './systems/scoring.js';
import type { RunPhase } from './entities.js';

// ─── Engine Commands Interface ───

/** Commands that adapters can send to the core engine. */
export interface EngineCommands {
  /** Update player horizontal position from touch/drag input. */
  setPlayerX(x: number): void;

  /** Request a new run (retry from game-over). */
  startNewRun(): void;

  /** Pause the current run (backgrounded, orientation change). */
  pauseRun(): void;

  /** Resume from pause (foreground + user tap). */
  resumeRun(): void;

  /** Rewarded ad completed — grant continue. */
  grantContinue(): void;
}

/** Full engine API exposed to adapters. */
export interface GameEngine extends EngineCommands {
  /** Advance simulation by deltaMs (accumulator-based fixed timestep). */
  step(deltaMs: number): void;

  /** Read-only access to current game state. */
  getState(): Readonly<GameState>;

  /** The event bus for adapter subscriptions. */
  readonly events: GameEventBus;

  /** Set collision masks (called once after boot scene loads assets). */
  setCollisionMasks(masks: CollisionMask[]): void;
}

// ─── Game State Factory ───

function createPlayer(config: GameConfig): Player {
  return {
    id: 0,
    position: { x: config.worldWidth / 2, y: config.defenseLineY - 40 },
    remainingLives: config.maxLives,
    score: 0,
    autoFireCooldown: 0,
  };
}

function createProjectilePool(): Projectile[] {
  const pool: Projectile[] = [];
  for (let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
    pool.push({
      id: i + 1,
      position: { x: 0, y: 0 },
      velocityY: 0,
      damage: 1,
      active: false,
      collisionMaskIndex: 0,
    });
  }
  return pool;
}

function createEnemyPool(): Enemy[] {
  const pool: Enemy[] = [];
  for (let i = 0; i < ENEMY_POOL_SIZE; i++) {
    pool.push({
      id: PROJECTILE_POOL_SIZE + i + 1,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      health: 0,
      maxHealth: 1,
      scoreValue: 100,
      enemyType: 'standard',
      active: false,
      collisionMaskIndex: 1,
    });
  }
  return pool;
}

function createRun(config: GameConfig, runIndex: number): Run {
  return {
    score: 0,
    elapsedMs: 0,
    enemiesDestroyed: 0,
    currentDifficultyLevel: 0,
    remainingLives: config.maxLives,
    phase: 'starting',
    continueUsed: false,
    runIndex,
  };
}

export function createGameState(
  config: GameConfig = DEFAULT_CONFIG,
  seed: number = Date.now(),
): GameState {
  return {
    player: createPlayer(config),
    projectiles: createProjectilePool(),
    enemies: createEnemyPool(),
    run: createRun(config, 0),
    config,
    highScore: { bestScore: 0, dateAchieved: '' },
    rngSeed: seed,
    collisionMasks: [],
    nextEntityId: PROJECTILE_POOL_SIZE + ENEMY_POOL_SIZE + 1,
  };
}

// ─── Spawner State ───

interface SpawnerState {
  timeSinceLastSpawn: number;
}

// ─── Engine Implementation ───

export function createEngine(
  config: GameConfig = DEFAULT_CONFIG,
  seed: number = Date.now(),
): GameEngine {
  const events: GameEventBus = createEventBus();
  const state: GameState = createGameState(config, seed);
  let rng: SeededRng = createRng(seed);
  let accumulator = 0;
  let spawnerState: SpawnerState = { timeSinceLastSpawn: 0 };
  let difficultyTimer = 0;
  let lastMilestone = 0;

  function transitionPhase(to: RunPhase): void {
    const from = state.run.phase;
    if (from === to) return;
    console.log(`[Engine] Phase transition: ${from} → ${to}`);
    state.run.phase = to;
    events.emit('run-phase-changed', { from, to });
  }

  function fireProjectile(): void {
    const player = state.player;
    if (player.autoFireCooldown > 0) return;

    // Find inactive projectile from pool
    const proj = state.projectiles.find((p) => !p.active);
    if (!proj) return;

    proj.active = true;
    proj.position.x = player.position.x;
    proj.position.y = player.position.y - 10;
    proj.velocityY = -state.config.projectileSpeed;
    proj.damage = state.config.projectileDamage;

    player.autoFireCooldown = state.config.autoFireRateMs;

    events.emit('projectile-fired', {
      id: proj.id,
      x: proj.position.x,
      y: proj.position.y,
    });
  }

  function handleBreach(enemy: Enemy): void {
    enemy.active = false;
    state.run.remainingLives--;
    state.player.remainingLives = state.run.remainingLives;

    events.emit('enemy-breached', { id: enemy.id, x: enemy.position.x });
    events.emit('life-lost', { remaining: state.run.remainingLives });

    if (state.run.remainingLives <= 0) {
      if (!state.run.continueUsed && state.config.rewardedAdEnabled) {
        transitionPhase('continue-offer');
      } else {
        endRun();
      }
    }
  }

  function endRun(): void {
    transitionPhase('game-over');
    // Check high score
    if (state.run.score > state.highScore.bestScore) {
      const previous = state.highScore.bestScore;
      state.highScore.bestScore = state.run.score;
      state.highScore.dateAchieved = new Date().toISOString();
      events.emit('high-score-beaten', {
        newBest: state.run.score,
        previous,
      });
    }
  }

  function fixedStep(dt: number): void {
    if (state.run.phase !== 'playing') return;

    state.run.elapsedMs += dt;

    // Auto-fire cooldown
    state.player.autoFireCooldown = Math.max(
      0,
      state.player.autoFireCooldown - dt,
    );
    fireProjectile();

    // Update systems
    updateMovement(state, dt);

    // Breach detection — enemies that passed defense line
    for (const enemy of state.enemies) {
      if (enemy.active && enemy.position.y >= state.config.defenseLineY) {
        handleBreach(enemy);
        if (state.run.phase !== 'playing') return;
      }
    }

    // Collision detection
    updateCollisions(state, events);

    // Spawner
    spawnerState.timeSinceLastSpawn += dt;
    updateSpawner(state, events, rng, spawnerState);

    // Difficulty
    difficultyTimer += dt;
    const result = updateDifficulty(state, events, difficultyTimer);
    difficultyTimer = result.timer;

    // Scoring (milestone check)
    updateScoring(state, events, lastMilestone);
    lastMilestone =
      Math.floor(state.run.score / state.config.milestoneInterval) *
      state.config.milestoneInterval;
  }

  const engine: GameEngine = {
    events,

    step(deltaMs: number): void {
      if (
        state.run.phase === 'game-over' ||
        state.run.phase === 'paused' ||
        state.run.phase === 'continue-offer'
      ) {
        return;
      }

      // Auto-start on first step
      if (state.run.phase === 'starting') {
        transitionPhase('playing');
      }

      accumulator += deltaMs;
      // Spiral-of-death prevention
      if (accumulator > MAX_ACCUMULATOR) {
        accumulator = MAX_ACCUMULATOR;
      }

      while (accumulator >= FIXED_DT) {
        fixedStep(FIXED_DT);
        accumulator -= FIXED_DT;
        if (state.run.phase !== 'playing') break;
      }
    },

    getState(): Readonly<GameState> {
      return state;
    },

    setPlayerX(x: number): void {
      const clamped = Math.max(0, Math.min(state.config.worldWidth, x));
      state.player.position.x = clamped;
      events.emit('player-moved', { x: clamped });
    },

    startNewRun(): void {
      const nextRunIndex = state.run.runIndex + 1;
      const newSeed = state.rngSeed + nextRunIndex;
      rng = createRng(newSeed);
      state.rngSeed = newSeed;

      state.player = createPlayer(config);
      state.run = createRun(config, nextRunIndex);

      // Reset pools
      for (const p of state.projectiles) {
        p.active = false;
      }
      for (const e of state.enemies) {
        e.active = false;
      }

      accumulator = 0;
      spawnerState = { timeSinceLastSpawn: 0 };
      difficultyTimer = 0;
      lastMilestone = 0;

      transitionPhase('starting');
    },

    pauseRun(): void {
      if (state.run.phase === 'playing') {
        transitionPhase('paused');
      }
    },

    resumeRun(): void {
      if (state.run.phase === 'paused') {
        accumulator = 0; // Reset accumulator after pause
        transitionPhase('playing');
      }
    },

    grantContinue(): void {
      if (state.run.phase === 'continue-offer') {
        state.run.continueUsed = true;
        state.run.remainingLives = 1;
        state.player.remainingLives = 1;
        events.emit('life-lost', { remaining: 1 }); // Update HUD
        transitionPhase('playing');
      }
    },

    setCollisionMasks(masks: CollisionMask[]): void {
      state.collisionMasks = masks;
    },
  };

  return engine;
}
