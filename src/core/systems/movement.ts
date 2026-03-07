// src/core/systems/movement.ts — Movement system (US1)
// Applies velocity × dt to player, enemies, and projectiles.
// Clamps player to world bounds. Deactivates off-screen projectiles.

import type { GameState } from '../entities.js';

/**
 * Updates positions of all active entities based on velocity and delta time.
 * @param state - Current game state (mutated in place).
 * @param dt - Fixed timestep delta in ms.
 */
export function updateMovement(state: GameState, dt: number): void {
  const dtSec = dt / 1000;
  const config = state.config;

  // Update active projectiles
  for (const proj of state.projectiles) {
    if (!proj.active) continue;
    proj.position.y += proj.velocityY * dtSec;

    // Deactivate off-screen projectiles (top of screen)
    if (proj.position.y < 0) {
      proj.active = false;
    }
  }

  // Update active enemies
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    enemy.position.x += enemy.velocity.x * dtSec;
    enemy.position.y += enemy.velocity.y * dtSec;
  }

  // Clamp player to world bounds
  state.player.position.x = Math.max(
    0,
    Math.min(config.worldWidth, state.player.position.x),
  );
}
