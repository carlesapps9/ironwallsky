// src/adapters/phaser/hud.ts — HUD overlay (US1)
// Score text display, row of heart/shield life icons.
// Updates on score-changed and life-lost events.
// T072: combo multiplier display (combo-updated event).

import Phaser from 'phaser';
import type { GameEventBus } from '@core/events.js';
import type { GameConfig } from '@core/config.js';

export class HUD {
  private scene: Phaser.Scene;
  private scoreText!: Phaser.GameObjects.Text;
  private heartIcons: Phaser.GameObjects.Image[] = [];
  private events: GameEventBus;
  private maxLives: number;

  // T072: combo display
  private comboText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, events: GameEventBus, config: GameConfig) {
    this.scene = scene;
    this.events = events;
    this.maxLives = config.maxLives;

    this.createScoreDisplay();
    this.createLifeIcons(config.maxLives);
    this.createComboDisplay();
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

  // T072: combo multiplier text — positioned below score, hidden at 1.0
  private createComboDisplay(): void {
    this.comboText = this.scene.add.text(10, 34, '', {
      fontSize: '15px',
      color: '#ffdd00',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#aa6600',
      strokeThickness: 2,
    });
    this.comboText.setDepth(100);
    this.comboText.setScrollFactor(0);
    this.comboText.setVisible(false);
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

    // T072: show/hide combo multiplier; animate on change
    this.events.on('combo-updated', (payload) => {
      if (payload.multiplier <= 1.0) {
        this.comboText.setVisible(false);
        return;
      }
      const label = `x${payload.multiplier.toFixed(1)} COMBO (${payload.count})`;
      this.comboText.setText(label);
      this.comboText.setVisible(true);
      // Pulse animation on each combo increment
      this.scene.tweens.add({
        targets: this.comboText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 80,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
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
    this.comboText.setVisible(false);
    this.comboText.setText('');
  }

  destroy(): void {
    this.scoreText.destroy();
    this.comboText.destroy();
    for (const icon of this.heartIcons) {
      icon.destroy();
    }
    this.heartIcons = [];
  }
}
