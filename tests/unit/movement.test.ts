// tests/unit/movement.test.ts — T053 + T086: Movement system unit tests
// Velocity application, world-bound clamping, off-screen deactivation.
// T086: drifter sine-wave, speeder 3× speed, armored/standard unaffected.

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

// T086: Drifter + speeder movement variant tests
describe('Movement Variants (T086)', () => {
  describe('Drifter movement', () => {
    it('should apply sine-wave to drifter velocity.x each step', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.enemyType = 'drifter';
      enemy.position.x = 180;
      enemy.position.y = 50;
      enemy.velocity = { x: 0, y: 120 };
      enemy.driftPhase = 0;

      updateMovement(state, FIXED_DT);

      // After one step, driftPhase should have advanced
      expect(enemy.driftPhase).toBeGreaterThan(0);
      // velocity.x should have been set to sin(driftPhase) * driftAmplitude
      // At driftPhase ~0, sin starts near 0 but the update assigns from the NEW phase
      // so velocity.x = sin(newDriftPhase) * amplitude
      const expectedPhase = (FIXED_DT / 1000) * state.config.driftFrequency * 2 * Math.PI;
      expect(enemy.driftPhase).toBeCloseTo(expectedPhase, 5);
    });

    it('should produce lateral oscillation over multiple steps', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.enemyType = 'drifter';
      enemy.position.x = 180;
      enemy.position.y = 50;
      enemy.velocity = { x: 0, y: 120 };
      enemy.driftPhase = 0;

      const startX = enemy.position.x;

      // Step many times to accumulate lateral displacement
      for (let i = 0; i < 60; i++) {
        updateMovement(state, FIXED_DT);
      }

      // After ~1 second of sine-wave, x should differ from start
      expect(enemy.position.x).not.toBe(startX);
    });

    it('should advance driftPhase proportional to driftFrequency', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.enemyType = 'drifter';
      enemy.position = { x: 180, y: 50 };
      enemy.velocity = { x: 0, y: 120 };
      enemy.driftPhase = 0;

      // Step once
      updateMovement(state, FIXED_DT);

      const expectedDelta = (FIXED_DT / 1000) * state.config.driftFrequency * 2 * Math.PI;
      expect(enemy.driftPhase).toBeCloseTo(expectedDelta, 5);
    });
  });

  describe('Speeder movement', () => {
    it('should move speeder at its assigned velocity (3× base set by spawner)', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.enemyType = 'speeder';
      enemy.position.x = 100;
      enemy.position.y = 50;
      // Spawner sets speeder velocity to 3× base
      const speedY = state.config.baseEnemySpeed * 3;
      enemy.velocity = { x: 0, y: speedY };

      updateMovement(state, FIXED_DT);

      const dtSec = FIXED_DT / 1000;
      expect(enemy.position.y).toBeCloseTo(50 + speedY * dtSec, 1);
    });

    it('should not apply sine-wave to speeder velocity.x', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.enemyType = 'speeder';
      enemy.position.x = 180;
      enemy.position.y = 50;
      enemy.velocity = { x: 0, y: 360 };
      enemy.driftPhase = 0;

      updateMovement(state, FIXED_DT);

      // Speeder should not have driftPhase incremented nor velocity.x changed
      expect(enemy.driftPhase).toBe(0);
      expect(enemy.velocity.x).toBe(0);
    });
  });

  describe('Armored and standard unaffected', () => {
    it('armored enemy moves at assigned velocity without sine-wave', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.enemyType = 'armored';
      enemy.position = { x: 180, y: 50 };
      enemy.velocity = { x: 0, y: 120 };
      enemy.driftPhase = 0;

      updateMovement(state, FIXED_DT);

      const dtSec = FIXED_DT / 1000;
      expect(enemy.position.y).toBeCloseTo(50 + 120 * dtSec, 1);
      expect(enemy.position.x).toBe(180); // no lateral movement
      expect(enemy.driftPhase).toBe(0);
    });

    it('standard enemy moves at assigned velocity without sine-wave', () => {
      const state = makeState();
      const enemy = state.enemies[0];
      enemy.active = true;
      enemy.enemyType = 'standard';
      enemy.position = { x: 180, y: 50 };
      enemy.velocity = { x: 0, y: 120 };
      enemy.driftPhase = 0;

      updateMovement(state, FIXED_DT);

      const dtSec = FIXED_DT / 1000;
      expect(enemy.position.y).toBeCloseTo(50 + 120 * dtSec, 1);
      expect(enemy.position.x).toBe(180);
      expect(enemy.driftPhase).toBe(0);
    });
  });
});
