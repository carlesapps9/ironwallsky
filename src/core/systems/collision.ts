// src/core/systems/collision.ts — Collision system (US1)
// AABB broad-phase overlap check, bitmask narrow-phase pixel-perfect test.
// Emits enemy-destroyed and projectile-deactivated events.

import type { GameState, Projectile, Enemy, CollisionMask } from '../entities.js';
import type { GameEventBus } from '../events.js';

/** Simple AABB rectangle for collision checks. */
interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Default sprite dimensions for AABB (can be adjusted per entity type). */
const PROJECTILE_SIZE = { width: 8, height: 16 };
const ENEMY_SIZE = { width: 32, height: 32 };

function getProjectileAABB(proj: Projectile): AABB {
  return {
    x: proj.position.x - PROJECTILE_SIZE.width / 2,
    y: proj.position.y - PROJECTILE_SIZE.height / 2,
    width: PROJECTILE_SIZE.width,
    height: PROJECTILE_SIZE.height,
  };
}

function getEnemyAABB(enemy: Enemy): AABB {
  return {
    x: enemy.position.x - ENEMY_SIZE.width / 2,
    y: enemy.position.y - ENEMY_SIZE.height / 2,
    width: ENEMY_SIZE.width,
    height: ENEMY_SIZE.height,
  };
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Performs bitmask narrow-phase collision check.
 * Returns true if any solid pixel overlaps.
 */
function bitmaskCollision(
  aAABB: AABB,
  bAABB: AABB,
  aMask: CollisionMask | undefined,
  bMask: CollisionMask | undefined,
): boolean {
  // If no masks available, AABB overlap is sufficient
  if (!aMask || !bMask) return true;

  // Calculate overlap rectangle
  const overlapX = Math.max(aAABB.x, bAABB.x);
  const overlapY = Math.max(aAABB.y, bAABB.y);
  const overlapEndX = Math.min(aAABB.x + aAABB.width, bAABB.x + bAABB.width);
  const overlapEndY = Math.min(
    aAABB.y + aAABB.height,
    bAABB.y + bAABB.height,
  );

  if (overlapEndX <= overlapX || overlapEndY <= overlapY) return false;

  // Check each pixel in the overlap region
  for (let py = overlapY; py < overlapEndY; py++) {
    for (let px = overlapX; px < overlapEndX; px++) {
      // Map to mask-local coordinates
      const aLocalX = Math.floor(
        ((px - aAABB.x) / aAABB.width) * aMask.width,
      );
      const aLocalY = Math.floor(
        ((py - aAABB.y) / aAABB.height) * aMask.height,
      );
      const bLocalX = Math.floor(
        ((px - bAABB.x) / bAABB.width) * bMask.width,
      );
      const bLocalY = Math.floor(
        ((py - bAABB.y) / bAABB.height) * bMask.height,
      );

      const aBitIndex = aLocalY * aMask.width + aLocalX;
      const bBitIndex = bLocalY * bMask.width + bLocalX;

      const aWord = aMask.data[aBitIndex >>> 5];
      const bWord = bMask.data[bBitIndex >>> 5];
      const aBit = (aWord >>> (aBitIndex & 31)) & 1;
      const bBit = (bWord >>> (bBitIndex & 31)) & 1;

      if (aBit && bBit) return true;
    }
  }

  return false;
}

/**
 * Updates collisions between projectiles and enemies.
 * @param state - Current game state (mutated in place).
 * @param events - Event bus for emitting collision events.
 */
export function updateCollisions(state: GameState, events: GameEventBus): void {
  for (const proj of state.projectiles) {
    if (!proj.active) continue;

    const projAABB = getProjectileAABB(proj);

    for (const enemy of state.enemies) {
      if (!enemy.active) continue;

      const enemyAABB = getEnemyAABB(enemy);

      // Broad phase: AABB overlap
      if (!aabbOverlap(projAABB, enemyAABB)) continue;

      // Narrow phase: bitmask check
      const projMask = state.collisionMasks[proj.collisionMaskIndex];
      const enemyMask = state.collisionMasks[enemy.collisionMaskIndex];

      if (!bitmaskCollision(projAABB, enemyAABB, projMask, enemyMask)) continue;

      // Collision confirmed
      enemy.health -= proj.damage;
      proj.active = false;

      events.emit('projectile-deactivated', {
        id: proj.id,
        reason: 'hit-enemy',
      });

      if (enemy.health <= 0) {
        enemy.active = false;

        // T070: apply combo multiplier to score award
        const multiplied = Math.round(enemy.scoreValue * state.run.comboMultiplier);
        state.run.score += multiplied;
        state.player.score = state.run.score;
        state.run.enemiesDestroyed++;

        // T070: increment combo; step multiplier; reset window timer
        state.run.comboCount++;
        state.run.comboMultiplier = Math.min(
          state.config.comboMultiplierCap,
          state.run.comboMultiplier + state.config.comboMultiplierStep,
        );
        state.run.comboLastHitElapsedMs = 0;

        events.emit('enemy-destroyed', {
          id: enemy.id,
          x: enemy.position.x,
          y: enemy.position.y,
          killedByProjectileId: proj.id,
          scoreAwarded: multiplied,
        });

        events.emit('score-changed', {
          score: state.run.score,
          delta: multiplied,
        });

        events.emit('combo-updated', {
          count: state.run.comboCount,
          multiplier: state.run.comboMultiplier,
        });
      }

      break; // Projectile can only hit one enemy
    }
  }
}
