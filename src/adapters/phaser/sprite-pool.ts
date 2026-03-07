// src/adapters/phaser/sprite-pool.ts — Sprite pool manager (US1)
// Phaser Group with get/killAndHide pattern, pre-warmed pools.

import Phaser from 'phaser';

export interface SpritePool {
  /** Get an inactive sprite from the pool, activate it at (x, y). */
  spawn(x: number, y: number, texture?: string, frame?: string | number): Phaser.GameObjects.Sprite | null;
  /** Return a sprite to the pool (deactivate + hide). */
  despawn(sprite: Phaser.GameObjects.Sprite): void;
  /** Get the underlying Phaser group. */
  getGroup(): Phaser.GameObjects.Group;
  /** Get all active sprites. */
  getActive(): Phaser.GameObjects.Sprite[];
}

/**
 * Creates a sprite pool backed by a Phaser Group.
 * Pre-warms the pool at creation time.
 */
export function createSpritePool(
  scene: Phaser.Scene,
  texture: string,
  poolSize: number,
  frame?: string | number,
): SpritePool {
  const group = scene.add.group({
    classType: Phaser.GameObjects.Sprite,
    maxSize: poolSize,
    runChildUpdate: false,
  });

  // Pre-warm: create all sprites, then deactivate
  for (let i = 0; i < poolSize; i++) {
    const sprite = scene.add.sprite(0, 0, texture, frame);
    sprite.setActive(false);
    sprite.setVisible(false);
    group.add(sprite);
  }

  function spawn(
    x: number,
    y: number,
    tex?: string,
    fr?: string | number,
  ): Phaser.GameObjects.Sprite | null {
    const sprite = group.getFirstDead(false) as Phaser.GameObjects.Sprite | null;
    if (!sprite) return null;

    sprite.setActive(true);
    sprite.setVisible(true);
    sprite.setPosition(x, y);

    if (tex) {
      sprite.setTexture(tex, fr);
    }

    return sprite;
  }

  function despawn(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setActive(false);
    sprite.setVisible(false);
    sprite.setPosition(-100, -100);
  }

  function getGroup(): Phaser.GameObjects.Group {
    return group;
  }

  function getActive(): Phaser.GameObjects.Sprite[] {
    return group.getChildren().filter(
      (child) => (child as Phaser.GameObjects.Sprite).active,
    ) as Phaser.GameObjects.Sprite[];
  }

  return { spawn, despawn, getGroup, getActive };
}
