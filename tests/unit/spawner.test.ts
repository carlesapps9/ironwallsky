// tests/unit/spawner.test.ts — T055: Spawner system unit tests
// Spawn interval, pool activation, max-enemy cap, RNG positioning.

import { describe, it, expect } from 'vitest';
import type { GameState } from '@core/entities.js';
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
