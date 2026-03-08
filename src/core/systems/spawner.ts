// src/core/systems/spawner.ts — Spawner system (US1)
// Spawns enemies at configurable interval from seeded RNG x-position.
// Activates from pool, respects maxSimultaneousEnemies cap.
// T069: weighted enemy type selection by difficulty level.

import type { EnemyType, GameState } from '../entities.js';
import type { GameEventBus } from '../events.js';
import type { SeededRng } from '../rng.js';

/** Spawner state tracked externally by the engine. */
export interface SpawnerState {
  timeSinceLastSpawn: number;
}

/** T069: pick enemy type via weighted probability gated by difficulty level. */
function pickEnemyType(
  level: number,
  weights: GameState['config']['enemyTypeWeights'],
  rng: SeededRng,
): EnemyType {
  const eligible: Array<{ type: EnemyType; weight: number }> = [
    { type: 'standard', weight: weights.standard },
  ];
  if (level >= 3)  eligible.push({ type: 'drifter',  weight: weights.drifter });
  if (level >= 6)  eligible.push({ type: 'armored',  weight: weights.armored });
  if (level >= 10) eligible.push({ type: 'speeder',  weight: weights.speeder });

  const total = eligible.reduce((sum, e) => sum + e.weight, 0);
  let pick = rng.next() * total;
  for (const entry of eligible) {
    pick -= entry.weight;
    if (pick <= 0) return entry.type;
  }
  return 'standard';
}

/**
 * Spawn enemies based on elapsed time and difficulty-scaled spawn interval.
 * @param state - Current game state (mutated in place).
 * @param events - Event bus for emitting spawn events.
 * @param rng - Seeded PRNG for deterministic x-position and type selection.
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

  // T069: select weighted enemy type
  const enemyType = pickEnemyType(level, config.enemyTypeWeights, rng);

  // Calculate difficulty-scaled base speed and health
  const baseSpeed =
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
  enemy.health = enemyType === 'armored' ? health * 2 : health;
  enemy.maxHealth = enemy.health;
  enemy.scoreValue = config.baseScoreValue;
  enemy.enemyType = enemyType;
  enemy.driftPhase = 0;

  // Per-type velocity
  enemy.velocity.y = enemyType === 'speeder' ? baseSpeed * 3 : baseSpeed;

  events.emit('enemy-spawned', {
    id: enemy.id,
    x: enemy.position.x,
    y: enemy.position.y,
    enemyType: enemy.enemyType,
    health: enemy.health,
  });
}
