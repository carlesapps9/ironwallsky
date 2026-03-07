// tests/unit/collision.test.ts — T054: Collision system unit tests
// AABB broad-phase, bitmask narrow-phase, event emission.

import { describe, it, expect, vi } from 'vitest';
import type { GameState } from '@core/entities.js';
import { DEFAULT_CONFIG } from '@core/config.js';
import { updateCollisions } from '@core/systems/collision.js';
import { createGameState } from '@core/engine.js';
import { createEventBus } from '@core/events.js';

function makeState(): GameState {
  return createGameState(DEFAULT_CONFIG, 42);
}

describe('Collision System', () => {
  it('should detect AABB overlap between projectile and enemy', () => {
    const state = makeState();
    const events = createEventBus();
    const destroyed = vi.fn();
    const deactivated = vi.fn();
    events.on('enemy-destroyed', destroyed);
    events.on('projectile-deactivated', deactivated);

    // Place projectile and enemy at same position (overlapping)
    const proj = state.projectiles[0];
    proj.active = true;
    proj.position = { x: 100, y: 100 };
    proj.damage = 1;

    const enemy = state.enemies[0];
    enemy.active = true;
    enemy.position = { x: 100, y: 100 };
    enemy.health = 1;
    enemy.maxHealth = 1;
    enemy.scoreValue = 100;

    updateCollisions(state, events);

    expect(destroyed).toHaveBeenCalledOnce();
    expect(deactivated).toHaveBeenCalledOnce();
    expect(proj.active).toBe(false);
    expect(enemy.active).toBe(false);
  });

  it('should not detect collision when entities are far apart', () => {
    const state = makeState();
    const events = createEventBus();
    const destroyed = vi.fn();
    events.on('enemy-destroyed', destroyed);

    const proj = state.projectiles[0];
    proj.active = true;
    proj.position = { x: 10, y: 10 };
    proj.damage = 1;

    const enemy = state.enemies[0];
    enemy.active = true;
    enemy.position = { x: 300, y: 300 };
    enemy.health = 1;

    updateCollisions(state, events);

    expect(destroyed).not.toHaveBeenCalled();
    expect(proj.active).toBe(true);
    expect(enemy.active).toBe(true);
  });

  it('should reduce enemy health on hit without destroying if health > damage', () => {
    const state = makeState();
    const events = createEventBus();
    const destroyed = vi.fn();
    events.on('enemy-destroyed', destroyed);

    const proj = state.projectiles[0];
    proj.active = true;
    proj.position = { x: 100, y: 100 };
    proj.damage = 1;

    const enemy = state.enemies[0];
    enemy.active = true;
    enemy.position = { x: 100, y: 100 };
    enemy.health = 3;
    enemy.maxHealth = 3;

    updateCollisions(state, events);

    expect(enemy.health).toBe(2);
    expect(enemy.active).toBe(true);
    expect(destroyed).not.toHaveBeenCalled();
    expect(proj.active).toBe(false);
  });

  it('should update score when enemy is destroyed', () => {
    const state = makeState();
    const events = createEventBus();
    const scoreChanged = vi.fn();
    events.on('score-changed', scoreChanged);

    const proj = state.projectiles[0];
    proj.active = true;
    proj.position = { x: 100, y: 100 };
    proj.damage = 1;

    const enemy = state.enemies[0];
    enemy.active = true;
    enemy.position = { x: 100, y: 100 };
    enemy.health = 1;
    enemy.scoreValue = 250;

    updateCollisions(state, events);

    expect(scoreChanged).toHaveBeenCalledWith(
      expect.objectContaining({ score: 250, delta: 250 }),
    );
    expect(state.run.score).toBe(250);
  });

  it('should not check inactive projectiles', () => {
    const state = makeState();
    const events = createEventBus();
    const destroyed = vi.fn();
    events.on('enemy-destroyed', destroyed);

    const proj = state.projectiles[0];
    proj.active = false;
    proj.position = { x: 100, y: 100 };

    const enemy = state.enemies[0];
    enemy.active = true;
    enemy.position = { x: 100, y: 100 };
    enemy.health = 1;

    updateCollisions(state, events);

    expect(destroyed).not.toHaveBeenCalled();
  });

  it('should emit projectile-deactivated with reason hit-enemy', () => {
    const state = makeState();
    const events = createEventBus();
    const deactivated = vi.fn();
    events.on('projectile-deactivated', deactivated);

    const proj = state.projectiles[0];
    proj.active = true;
    proj.position = { x: 100, y: 100 };
    proj.damage = 1;

    const enemy = state.enemies[0];
    enemy.active = true;
    enemy.position = { x: 100, y: 100 };
    enemy.health = 1;

    updateCollisions(state, events);

    expect(deactivated).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'hit-enemy' }),
    );
  });
});
