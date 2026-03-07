// src/core/systems/spawner.ts — Spawner system (US1)
// Spawns enemies at configurable interval from seeded RNG x-position.
// Activates from pool, respects maxSimultaneousEnemies cap.

import type { GameState } from '../entities.js';
import type { GameEventBus } from '../events.js';
import type { SeededRng } from '../rng.js';

/** Spawner state tracked externally by the engine. */
export interface SpawnerState {
  timeSinceLastSpawn: number;
}

/**
 * Spawn enemies based on elapsed time and difficulty-scaled spawn interval.
 * @param state - Current game state (mutated in place).
 * @param events - Event bus for emitting spawn events.
 * @param rng - Seeded PRNG for deterministic x-position.
 * @param spawnerState - Mutable timer state.
 */
export function updateSpawner(
  state: GameState,
  events: GameEventBus,
  rng: SeededRng,
  spawnerState: SpawnerState,
): void {
  const config = state.config;
  const level = state.run.currentDifficultyLevel;

  // Calculate scaled spawn interval
  const spawnInterval =
    config.baseSpawnIntervalMs *
    Math.pow(config.spawnRateMultiplierPerStep, level);

  if (spawnerState.timeSinceLastSpawn < spawnInterval) return;

  spawnerState.timeSinceLastSpawn -= spawnInterval;

  // Check active enemy cap
  const activeCount = state.enemies.filter((e) => e.active).length;
  if (activeCount >= config.maxSimultaneousEnemies) return;

  // Find inactive enemy from pool
  const enemy = state.enemies.find((e) => !e.active);
  if (!enemy) return;

  // Calculate difficulty-scaled speed and health
  const speed =
    config.baseEnemySpeed * Math.pow(config.speedMultiplierPerStep, level);
  const health =
    config.baseEnemyHealth + config.healthIncrementPerStep * level;

  // Spawn at random x position with margin
  const margin = 20;
  const x = rng.nextInt(margin, config.worldWidth - margin);

  enemy.active = true;
  enemy.position.x = x;
  enemy.position.y = -32; // Start above screen
  enemy.velocity.x = 0;
  enemy.velocity.y = speed;
  enemy.health = health;
  enemy.maxHealth = health;
  enemy.scoreValue = config.baseScoreValue;
  enemy.enemyType = 'standard';

  events.emit('enemy-spawned', {
    id: enemy.id,
    x: enemy.position.x,
    y: enemy.position.y,
    enemyType: enemy.enemyType,
    health: enemy.health,
  });
}
