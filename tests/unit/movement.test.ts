// tests/unit/movement.test.ts — T053: Movement system unit tests
// Velocity application, world-bound clamping, off-screen deactivation.

import { describe, it, expect } from 'vitest';
import type { GameState } from '@core/entities.js';
import { DEFAULT_CONFIG, FIXED_DT } from '@core/config.js';
import { updateMovement } from '@core/systems/movement.js';
import { createGameState } from '@core/engine.js';

function makeState(): GameState {
  return createGameState(DEFAULT_CONFIG, 42);
}

describe('Movement System', () => {
  describe('Projectile movement', () => {
    it('should move active projectiles upward by velocity × dt', () => {
      const state = makeState();
      const proj = state.projectiles[0];
      proj.active = true;
      proj.position.x = 100;
      proj.position.y = 300;
      proj.velocityY = -600; // px/s upward

      updateMovement(state, FIXED_DT);

      expect(proj.position.y).toBeLessThan(300);
      // ≈ 300 + (-600 * 16.667/1000) = 300 - 10 = 290
      expect(proj.position.y).toBeCloseTo(300 + (-600 * FIXED_DT / 1000), 1);
    });

    it('should deactivate projectiles that go off-screen (y < 0)', () => {
      const state = makeState();
      const proj = state.projectiles[0];
      proj.active = true;
      proj.position.x = 100;
      proj.position.y = 5;
      proj.velocityY = -600;

      updateMovement(state, FIXED_DT);

      expect(proj.active).toBe(false);
    });

    it('should not move inactive projectiles', () => {
      const state = makeState();
      const proj = state.projectiles[0];
      proj.active = false;
      proj.position.y = 300;
      proj.velocityY = -600;

      updateMovement(state, FIXED_DT);

      expect(proj.position.y).toBe(300);
    });
  });

  describe('Enemy movement', () => {
    it('should move active enemies downward by velocity × dt', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.position.x = 100;
      enemy.position.y = 50;
      enemy.velocity = { x: 0, y: 120 }; // px/s downward

      updateMovement(state, FIXED_DT);

      expect(enemy.position.y).toBeGreaterThan(50);
      expect(enemy.position.y).toBeCloseTo(50 + (120 * FIXED_DT / 1000), 1);
    });

    it('should not move inactive enemies', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = false;
      enemy.position.y = 50;
      enemy.velocity = { x: 0, y: 120 };

      updateMovement(state, FIXED_DT);

      expect(enemy.position.y).toBe(50);
    });
  });

  describe('Player clamping', () => {
    it('should clamp player x to 0 when negative', () => {
      const state = makeState();
      state.player.position.x = -50;

      updateMovement(state, FIXED_DT);

      expect(state.player.position.x).toBe(0);
    });

    it('should clamp player x to worldWidth when exceeding', () => {
      const state = makeState();
      state.player.position.x = state.config.worldWidth + 50;

      updateMovement(state, FIXED_DT);

      expect(state.player.position.x).toBe(state.config.worldWidth);
    });

    it('should not clamp player x when within bounds', () => {
      const state = makeState();
      state.player.position.x = 180;

      updateMovement(state, FIXED_DT);

      expect(state.player.position.x).toBe(180);
    });
  });
});
