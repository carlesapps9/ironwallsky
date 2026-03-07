// src/adapters/phaser/gameover-scene.ts — Game Over scene (US1+US4)
// Displays final score, personal best, run duration, enemies destroyed.
// Retry button, rewarded ad continue button.

import Phaser from 'phaser';
import type { GameEngine } from '@core/engine.js';
import type { AdService } from '@adapters/ads/ad-adapter.js';

export class GameOverScene extends Phaser.Scene {
  private engine!: GameEngine;
  private adService: AdService | null = null;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { engine: GameEngine; adService?: AdService }): void {
    this.engine = data.engine;
    this.adService = data.adService ?? null;
  }

  create(): void {
    const state = this.engine.getState();
    const run = state.run;
    const config = state.config;

    const cx = config.worldWidth / 2;
    const cy = config.worldHeight / 2;

    this.cameras.main.setBackgroundColor('#050510');

    // Starfield background for game-over
    this.createStarfield(config.worldWidth, config.worldHeight);

    // Title
    this.add
      .text(cx, cy - 160, 'MISSION FAILED', {
        fontSize: '28px',
        color: '#ff6644',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#ff2200',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Score
    this.add
      .text(cx, cy - 100, `Score: ${run.score}`, {
        fontSize: '24px',
        color: '#00ffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Personal best — US3 enhanced with highlight animation
    const isNewRecord = run.score >= state.highScore.bestScore && run.score > 0;
    const bestColor = isNewRecord ? '#00ff88' : '#7799bb';
    const bestLabel = isNewRecord ? '★ NEW BEST!' : 'Best';
    const bestText = this.add
      .text(cx, cy - 65, `${bestLabel}: ${state.highScore.bestScore}`, {
        fontSize: '16px',
        color: bestColor,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // US3: New record highlight animation
    if (isNewRecord) {
      this.tweens.add({
        targets: bestText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Glow effect (space cyan)
      bestText.setStroke('#00aaff', 3);
    }

    // Duration
    const durationSec = (run.elapsedMs / 1000).toFixed(1);
    this.add
      .text(cx, cy - 30, `Time: ${durationSec}s`, {
        fontSize: '14px',
        color: '#8899bb',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Enemies destroyed
    this.add
      .text(cx, cy - 5, `Enemies: ${run.enemiesDestroyed}`, {
        fontSize: '14px',
        color: '#8899bb',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Rewarded ad continue button (if applicable)
    if (
      run.phase === 'continue-offer' &&
      !run.continueUsed &&
      config.continueEnabled
    ) {
      this.createContinueButton(cx, cy + 50);
    }

    // Retry button (48x48 minimum touch target per FR-024)
    this.createRetryButton(cx, cy + 120);
  }

  private createContinueButton(x: number, y: number): void {
    const btn = this.add
      .text(x, y, '▶ Watch Ad to Continue', {
        fontSize: '16px',
        color: '#000000',
        fontFamily: 'monospace',
        backgroundColor: '#00ff88',
        padding: { left: 16, right: 16, top: 12, bottom: 12 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    // Ensure minimum 48x48 touch target
    btn.setSize(
      Math.max(btn.width, 48),
      Math.max(btn.height, 48),
    );

    btn.on('pointerdown', async () => {
      if (this.adService && this.adService.isAvailable()) {
        try {
          const result = await this.adService.showRewarded();
          if (result === 'shown') {
            this.engine.grantContinue();
            this.scene.start('PlayScene', { engine: this.engine });
            return;
          }
          // Ad failed/skipped — do NOT grant continue (US4.6)
          // Option remains available; player can retry the ad or tap Retry
        } catch {
          // Fall through — never block retry per FR-017
          // Continue option remains since it was not consumed
        }
      }
      // If ad service unavailable, do nothing — player must use Retry button
    });
  }

  private createRetryButton(x: number, y: number): void {
    const btn = this.add
      .text(x, y, '↻ LAUNCH AGAIN', {
        fontSize: '20px',
        color: '#000000',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        backgroundColor: '#00aaff',
        padding: { left: 24, right: 24, top: 14, bottom: 14 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    // Ensure minimum 48x48 touch target
    btn.setSize(
      Math.max(btn.width, 48),
      Math.max(btn.height, 48),
    );

    btn.on('pointerdown', () => {
      this.engine.startNewRun();
      this.scene.start('PlayScene', { engine: this.engine });
    });
  }

  /** Space-themed starfield for game-over background. */
  private createStarfield(width: number, height: number): void {
    const gfx = this.add.graphics();
    gfx.setDepth(0);

    // Subtle nebula
    gfx.fillStyle(0x220011, 0.3);
    gfx.fillCircle(width * 0.6, height * 0.4, 100);

    const starCount = 50;
    for (let i = 0; i < starCount; i++) {
      const hash = ((i * 2654435761 + 99) >>> 0) % 0xFFFFFF;
      const sx = hash % width;
      const sy = ((hash * 7 + 13) % height);
      const brightness = 0.2 + ((hash % 100) / 100) * 0.5;
      gfx.fillStyle(0xffffff, brightness);
      gfx.fillCircle(sx, sy, (hash % 3 === 0) ? 1 : 0.5);
    }
  }
}
