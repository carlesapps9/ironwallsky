// tests/unit/spawner.test.ts — T055 + T085: Spawner system unit tests
// Spawn interval, pool activation, max-enemy cap, RNG positioning.
// T085: weighted enemy-type selection by difficulty level.

import { describe, it, expect } from 'vitest';
import type { GameState, EnemyType } from '@core/entities.js';
import { DEFAULT_CONFIG } from '@core/config.js';
import { updateSpawner } from '@core/systems/spawner.js';
import type { SpawnerState } from '@core/systems/spawner.js';
import { createGameState } from '@core/engine.js';
import { createEventBus } from '@core/events.js';
import { createRng } from '@core/rng.js';

function makeState(): GameState {
  return createGameState(DEFAULT_CONFIG, 42);
}

describe('Spawner System', () => {
  it('should not spawn enemy before spawn interval elapses', () => {
    const state = makeState();
    const events = createEventBus();
    const rng = createRng(42);
    const spawnerState: SpawnerState = { timeSinceLastSpawn: 0 };

    updateSpawner(state, events, rng, spawnerState);

    const activeEnemies = state.enemies.filter((e) => e.active);
    expect(activeEnemies.length).toBe(0);
  });

  it('should spawn enemy after spawn interval elapses', () => {
    const state = makeState();
    const events = createEventBus();
    const rng = createRng(42);
    const spawnerState: SpawnerState = {
      timeSinceLastSpawn: state.config.baseSpawnIntervalMs + 1,
    };

    updateSpawner(state, events, rng, spawnerState);

    const activeEnemies = state.enemies.filter((e) => e.active);
    expect(activeEnemies.length).toBe(1);
  });

  it('should spawn enemy at random x position within bounds', () => {
    const state = makeState();
    const events = createEventBus();
    const rng = createRng(42);
    const spawnerState: SpawnerState = {
      timeSinceLastSpawn: state.config.baseSpawnIntervalMs + 1,
    };

    updateSpawner(state, events, rng, spawnerState);

    const enemy = state.enemies.find((e) => e.active);
    expect(enemy).toBeDefined();
    expect(enemy!.position.x).toBeGreaterThanOrEqual(20);
    expect(enemy!.position.x).toBeLessThanOrEqual(state.config.worldWidth - 20);
  });

  it('should spawn enemy above the screen (y < 0)', () => {
    const state = makeState();
    const events = createEventBus();
    const rng = createRng(42);
    const spawnerState: SpawnerState = {
      timeSinceLastSpawn: state.config.baseSpawnIntervalMs + 1,
    };

    updateSpawner(state, events, rng, spawnerState);

    const enemy = state.enemies.find((e) => e.active);
    expect(enemy).toBeDefined();
    expect(enemy!.position.y).toBeLessThan(0);
  });

  it('should not exceed max simultaneous enemies', () => {
    const state = makeState();
    const events = createEventBus();
    const rng = createRng(42);

    // Activate all enemies
    for (const enemy of state.enemies) {
      enemy.active = true;
    }

    // Manually set count above cap
    state.config.maxSimultaneousEnemies = state.enemies.length;

    const spawnerState: SpawnerState = {
      timeSinceLastSpawn: state.config.baseSpawnIntervalMs + 1,
    };

    const countBefore = state.enemies.filter((e) => e.active).length;
    updateSpawner(state, events, rng, spawnerState);
    const countAfter = state.enemies.filter((e) => e.active).length;

    expect(countAfter).toBe(countBefore);
  });

  it('should emit enemy-spawned event', () => {
    const state = makeState();
    const events = createEventBus();
    const rng = createRng(42);
    let emitted = false;

    events.on('enemy-spawned', () => {
      emitted = true;
    });

    const spawnerState: SpawnerState = {
      timeSinceLastSpawn: state.config.baseSpawnIntervalMs + 1,
    };

    updateSpawner(state, events, rng, spawnerState);

    expect(emitted).toBe(true);
  });

  it('should produce deterministic spawns with same seed', () => {
    const state1 = makeState();
    const state2 = makeState();
    const events1 = createEventBus();
    const events2 = createEventBus();
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    const spawner1: SpawnerState = {
      timeSinceLastSpawn: state1.config.baseSpawnIntervalMs + 1,
    };
    const spawner2: SpawnerState = {
      timeSinceLastSpawn: state2.config.baseSpawnIntervalMs + 1,
    };

    updateSpawner(state1, events1, rng1, spawner1);
    updateSpawner(state2, events2, rng2, spawner2);

    const e1 = state1.enemies.find((e) => e.active);
    const e2 = state2.enemies.find((e) => e.active);

    expect(e1!.position.x).toBe(e2!.position.x);
  });
});

// T085: Weighted enemy-type spawner tests
describe('Weighted Enemy-Type Spawner', () => {
  /** Helper: spawn many enemies at a given difficulty level with a fixed seed. */
  function spawnMany(level: number, count: number, seed = 99): EnemyType[] {
    const types: EnemyType[] = [];
    for (let i = 0; i < count; i++) {
      const state = makeState();
      state.run.currentDifficultyLevel = level;
      const events = createEventBus();
      // Use unique sub-seed per iteration for variety while remaining deterministic
      const rng = createRng(seed + i);
      const spawnerState: SpawnerState = {
        timeSinceLastSpawn: state.config.baseSpawnIntervalMs + 1,
      };
      updateSpawner(state, events, rng, spawnerState);
      const enemy = state.enemies.find((e) => e.active);
      if (enemy) types.push(enemy.enemyType);
    }
    return types;
  }

  it('should only spawn standard enemies at difficulty level < 3', () => {
    const types = spawnMany(0, 100);
    expect(types.length).toBe(100);
    expect(types.every((t) => t === 'standard')).toBe(true);
  });

  it('should only spawn standard enemies at difficulty level 2', () => {
    const types = spawnMany(2, 100);
    expect(types.every((t) => t === 'standard')).toBe(true);
  });

  it('should include drifter at difficulty level >= 3', () => {
    const types = spawnMany(3, 1000);
    expect(types).toContain('drifter');
    expect(types).toContain('standard');
    // armored/speeder should NOT appear at level 3
    expect(types).not.toContain('armored');
    expect(types).not.toContain('speeder');
  });

  it('should include armored at difficulty level >= 6', () => {
    const types = spawnMany(6, 1000);
    expect(types).toContain('standard');
    expect(types).toContain('drifter');
    expect(types).toContain('armored');
    // speeder should NOT appear at level 6
    expect(types).not.toContain('speeder');
  });

  it('should include speeder at difficulty level >= 10', () => {
    const types = spawnMany(10, 1000);
    expect(types).toContain('standard');
    expect(types).toContain('drifter');
    expect(types).toContain('armored');
    expect(types).toContain('speeder');
  });

  it('should produce correct distribution over 1000 spawns with fixed seed', () => {
    const types = spawnMany(10, 1000, 42);
    const counts: Record<string, number> = { standard: 0, drifter: 0, armored: 0, speeder: 0 };
    for (const t of types) counts[t]++;

    // With weights standard:1.0, drifter:0.3, armored:0.2, speeder:0.15
    // Total = 1.65, so expected ratios: standard~60%, drifter~18%, armored~12%, speeder~9%
    // Allow ±10% tolerance for seeded RNG variance
    expect(counts.standard).toBeGreaterThan(400); // > 40%
    expect(counts.standard).toBeLessThan(800);    // < 80%
    expect(counts.drifter).toBeGreaterThan(50);   // > 5%
    expect(counts.armored).toBeGreaterThan(30);   // > 3%
    expect(counts.speeder).toBeGreaterThan(20);   // > 2%
  });

  it('should give armored enemies double health', () => {
    // Force level 6+ and spawn until we get an armored enemy
    const state = makeState();
    state.run.currentDifficultyLevel = 6;
    const events = createEventBus();

    // Try many seeds to find one that produces armored
    for (let seed = 0; seed < 200; seed++) {
      const s = makeState();
      s.run.currentDifficultyLevel = 6;
      const ev = createEventBus();
      const rng = createRng(seed);
      const spawnerState: SpawnerState = {
        timeSinceLastSpawn: s.config.baseSpawnIntervalMs + 1,
      };
      updateSpawner(s, ev, rng, spawnerState);
      const enemy = s.enemies.find((e) => e.active && e.enemyType === 'armored');
      if (enemy) {
        // Armored should have 2× the base health for this level
        const level = s.run.currentDifficultyLevel;
        const expectedBaseHealth = s.config.baseEnemyHealth + s.config.healthIncrementPerStep * level;
        expect(enemy.health).toBe(expectedBaseHealth * 2);
        return;
      }
    }
    // If no armored found in 200 seeds, the test setup is wrong
    expect.unreachable('should have spawned an armored enemy within 200 seeds');
  });

  it('should give speeder enemies 3x base speed', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = makeState();
      s.run.currentDifficultyLevel = 10;
      const ev = createEventBus();
      const rng = createRng(seed);
      const spawnerState: SpawnerState = {
        timeSinceLastSpawn: s.config.baseSpawnIntervalMs + 1,
      };
      updateSpawner(s, ev, rng, spawnerState);
      const enemy = s.enemies.find((e) => e.active && e.enemyType === 'speeder');
      if (enemy) {
        const level = s.run.currentDifficultyLevel;
        const baseSpeed = s.config.baseEnemySpeed * Math.pow(s.config.speedMultiplierPerStep, level);
        expect(enemy.velocity.y).toBeCloseTo(baseSpeed * 3, 1);
        return;
      }
    }
    expect.unreachable('should have spawned a speeder enemy within 200 seeds');
  });
});
