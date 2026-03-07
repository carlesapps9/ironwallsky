// src/adapters/phaser/hud.ts — HUD overlay (US1)
// Score text display, row of heart/shield life icons.
// Updates on score-changed and life-lost events.

import Phaser from 'phaser';
import type { GameEventBus } from '@core/events.js';
import type { GameConfig } from '@core/config.js';

export class HUD {
  private scene: Phaser.Scene;
  private scoreText!: Phaser.GameObjects.Text;
  private heartIcons: Phaser.GameObjects.Image[] = [];
  private events: GameEventBus;
  private maxLives: number;

  constructor(scene: Phaser.Scene, events: GameEventBus, config: GameConfig) {
    this.scene = scene;
    this.events = events;
    this.maxLives = config.maxLives;

    this.createScoreDisplay();
    this.createLifeIcons(config.maxLives);
    this.subscribeToEvents();
  }

  private createScoreDisplay(): void {
    this.scoreText = this.scene.add.text(10, 10, 'Score: 0', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
    });
    this.scoreText.setDepth(100);
    this.scoreText.setScrollFactor(0);
  }

  private createLifeIcons(maxLives: number): void {
    const startX = this.scene.cameras.main.width - 30;
    const y = 15;

    for (let i = 0; i < maxLives; i++) {
      const icon = this.scene.add.image(startX - i * 28, y, 'heart');
      icon.setScale(0.8);
      icon.setDepth(100);
      icon.setScrollFactor(0);
      this.heartIcons.push(icon);
    }
  }

  private subscribeToEvents(): void {
    this.events.on('score-changed', (payload) => {
      this.scoreText.setText(`Score: ${payload.score}`);
    });

    this.events.on('life-lost', (payload) => {
      this.updateLives(payload.remaining);
    });
  }

  private updateLives(remaining: number): void {
    for (let i = 0; i < this.heartIcons.length; i++) {
      const lifeIndex = this.maxLives - 1 - i;
      this.heartIcons[i].setVisible(lifeIndex < remaining);
    }
  }

  /** Reset HUD for a new run. */
  reset(lives: number): void {
    this.scoreText.setText('Score: 0');
    for (let i = 0; i < this.heartIcons.length; i++) {
      this.heartIcons[i].setVisible(i < lives);
    }
  }

  destroy(): void {
    this.scoreText.destroy();
    for (const icon of this.heartIcons) {
      icon.destroy();
    }
    this.heartIcons = [];
  }
}
