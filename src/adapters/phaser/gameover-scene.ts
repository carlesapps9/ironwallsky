// src/adapters/phaser/gameover-scene.ts — Game Over / Continue-Offer scene (US1+US4)
// Displays final score, personal best, run duration, enemies destroyed.
// T074: Revive Shield button (continue-offer phase, reviveAvailable).
// T075: Score Doubler button (continue-offer phase, !doublersUsed).
// T076: Share Card button (continue-offer + game-over phases).

import Phaser from 'phaser';
import type { GameEngine } from '@core/engine.js';
import type { AdService } from '@adapters/ads/ad-adapter.js';

// T013: Module-level session flag — persists across runs but not across app restarts
let streakRecoveryUsedThisSession = false;

export class GameOverScene extends Phaser.Scene {
  private engine!: GameEngine;
  private adService: AdService | null = null;
  // Guard: prevents two ad shows running concurrently (e.g. Continue + Revive tapped together).
  private adInFlight = false;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { engine: GameEngine; adService?: AdService }): void {
    this.engine = data.engine;
    this.adService = data.adService ?? null;
    this.adInFlight = false; // reset on every scene (re)start
  }

  create(): void {
    const state = this.engine.getState();
    const run = state.run;
    const config = state.config;

    // T017: Show banner ad on game-over screen
    if (this.adService) {
      this.adService.showBanner().catch(() => {});
    }

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

    // T022: Session stats — best combo multiplier and highest wave
    const statsY = cy + 12;
    if (run.bestComboMultiplier > 1.0) {
      this.add
        .text(cx - 60, statsY, `Best Combo: x${run.bestComboMultiplier.toFixed(1)}`, {
          fontSize: '13px',
          color: '#ffdd00',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
        .setDepth(10);
    }
    if (run.currentDifficultyLevel > 0) {
      this.add
        .text(cx + 60, statsY, `Wave: ${run.currentDifficultyLevel}`, {
          fontSize: '13px',
          color: '#aabbcc',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
        .setDepth(10);
    }

    // T012: Streak badge — shown when dailyStreak > 1
    if (state.highScore.dailyStreak > 1) {
      this.add
        .text(cx, cy + 18, `🔥 ${state.highScore.dailyStreak}-day streak`, {
          fontSize: '15px',
          color: '#ffaa44',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(10);
    }

    // Rewarded ad continue button (if applicable)
    if (
      run.phase === 'continue-offer' &&
      !run.continueUsed &&
      config.continueEnabled
    ) {
      this.createContinueButton(cx, cy + 30);
    }

    // T074: Revive Shield button — continue-offer phase, reviveAvailable, reviveEnabled flag
    if (
      run.phase === 'continue-offer' &&
      run.reviveAvailable &&
      config.reviveEnabled
    ) {
      this.createReviveButton(cx, cy + 80);
    }

    // T075: Score Doubler button — continue-offer phase, !doublersUsed, doublerEnabled flag
    if (
      run.phase === 'continue-offer' &&
      !run.doublersUsed &&
      config.doublerEnabled
    ) {
      this.createDoublerButton(cx, cy + 130);
    }

    // T076: Share Score button — both continue-offer and game-over phases
    this.createShareButton(cx, cy + 170, run.score, config.scoreTweetTemplate);

    // T013: Streak recovery ad offer — when streak > 3 and at risk
    if (this.isStreakAtRisk(state.highScore.lastPlayedDate, state.highScore.dailyStreak)) {
      this.createStreakRecoveryButton(cx, cy + 210, state.highScore.dailyStreak);
    }

    // T024: Extra life ad button — shown only after first run (runIndex > 0)
    const showExtraLife = run.runIndex > 0;
    let retryYOffset = 220;
    if (this.isStreakAtRisk(state.highScore.lastPlayedDate, state.highScore.dailyStreak)) {
      retryYOffset = 260;
    }
    if (showExtraLife) {
      this.createExtraLifeButton(cx, cy + retryYOffset);
      retryYOffset += 50;
    }

    // Retry button (48x48 minimum touch target per FR-024)
    this.createRetryButton(cx, cy + retryYOffset);
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

    btn.on('pointerdown', () => {
      void this.runAdButton(btn, () => this.adService!.showRewarded(), () => {
        this.engine.grantContinue();
        this.scene.start('PlayScene', { engine: this.engine, adService: this.adService });
      });
    });
  }

  // T074: Revive Shield — restore 1 life, set reviveAvailable = false, resume play
  private createReviveButton(x: number, y: number): void {
    const btn = this.add
      .text(x, y, '🛡 Revive Shield (Ad)', {
        fontSize: '15px',
        color: '#000000',
        fontFamily: 'monospace',
        backgroundColor: '#ffaa00',
        padding: { left: 14, right: 14, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    btn.setSize(Math.max(btn.width, 48), Math.max(btn.height, 48));

    btn.on('pointerdown', () => {
      void this.runAdButton(btn, () => this.adService!.showRevive(), () => {
        this.engine.grantRevive();
        this.scene.start('PlayScene', { engine: this.engine, adService: this.adService });
      });
    });
  }

  // T075: Score Doubler — doubles run.score display; does NOT affect bestScore comparison
  private createDoublerButton(x: number, y: number): void {
    const btn = this.add
      .text(x, y, '✕2 Score Doubler (Ad)', {
        fontSize: '15px',
        color: '#000000',
        fontFamily: 'monospace',
        backgroundColor: '#cc44ff',
        padding: { left: 14, right: 14, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    btn.setSize(Math.max(btn.width, 48), Math.max(btn.height, 48));

    btn.on('pointerdown', () => {
      void this.runAdButton(btn, () => this.adService!.showDouble(), () => {
        this.engine.grantScoreDouble();
        this.scene.restart();
      });
    });
  }

  // T076: Share Card — Web Share API with clipboard fallback; no PII (constitution rule 40)
  private createShareButton(x: number, y: number, score: number, template: string): void {
    const btn = this.add
      .text(x, y, '↗ Share Score', {
        fontSize: '15px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#1d9bf0',
        padding: { left: 14, right: 14, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    btn.setSize(Math.max(btn.width, 48), Math.max(btn.height, 48));

    // Toast feedback text
    const toast = this.add
      .text(x, y + 40, '', {
        fontSize: '13px',
        color: '#00ff88',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    btn.on('pointerdown', async () => {
      const text = template.replace('{score}', String(score));
      const shareData = {
        title: 'Iron Wall Sky',
        text,
        url: typeof window !== 'undefined' ? window.location.href : '',
      };

      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share(shareData);
          this.engine.events.emit('share-card-tapped', { score, method: 'native' });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          this.engine.events.emit('share-card-tapped', { score, method: 'clipboard' });
          this.showToast(toast, 'Copied!');
        }
      } catch {
        // Share cancelled or unavailable — silently ignore
      }
    });
  }

  private showToast(toast: Phaser.GameObjects.Text, message: string): void {
    toast.setText(message);
    toast.setVisible(true);
    toast.setAlpha(1);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      delay: 1200,
      duration: 600,
      onComplete: () => toast.setVisible(false),
    });
  }

  /** Brief flash feedback on an ad button when the ad is unavailable. */
  private showButtonFeedback(btn: Phaser.GameObjects.Text, message: string): void {
    const feedback = this.add
      .text(btn.x, btn.y + 28, message, {
        fontSize: '12px',
        color: '#ff6644',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: feedback,
      alpha: 0,
      duration: 1500,
      onComplete: () => feedback.destroy(),
    });
  }

  /**
   * Unified ad-button handler:
   * - Guards against concurrent ad shows (adInFlight)
   * - Shows "⏳ Loading..." on the button while the ad prepares
   * - Calls onGranted() only on 'shown'; shows feedback and re-enables on anything else
   */
  private async runAdButton(
    btn: Phaser.GameObjects.Text,
    showAd: () => Promise<import('@adapters/ads/ad-adapter.js').AdResult>,
    onGranted: () => void,
  ): Promise<void> {
    if (this.adInFlight) return;
    this.adInFlight = true;
    btn.disableInteractive();
    const originalText = btn.text;
    btn.setText('⏳ Loading...');

    if (!this.adService || !this.adService.isAvailable()) {
      this.adInFlight = false;
      btn.setText(originalText);
      this.showButtonFeedback(btn, 'Ads not available');
      btn.setInteractive({ useHandCursor: true });
      return;
    }

    try {
      const result = await showAd();
      if (result === 'shown') {
        this.adInFlight = false; // reset before grant (scene may stay or navigate away)
        onGranted();
        return;
      }
      const msg = result === 'dismissed' ? 'Ad skipped' : 'Ad not available';
      this.adInFlight = false;
      btn.setText(originalText);
      this.showButtonFeedback(btn, msg);
      btn.setInteractive({ useHandCursor: true });
    } catch {
      this.adInFlight = false;
      btn.setText(originalText);
      this.showButtonFeedback(btn, 'Ad failed');
      btn.setInteractive({ useHandCursor: true });
    }
  }

  // T013: Check if daily streak is at risk (not played today or yesterday) and worth recovering
  private isStreakAtRisk(lastPlayedDate: string, dailyStreak: number): boolean {
    if (dailyStreak <= 3 || !lastPlayedDate || streakRecoveryUsedThisSession) return false;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
    return lastPlayedDate !== today && lastPlayedDate !== yesterday;
  }

  // T013: Streak recovery rewarded ad button
  private createStreakRecoveryButton(x: number, y: number, streak: number): void {
    const btn = this.add
      .text(x, y, `Watch ad to save your ${streak}-day streak!`, {
        fontSize: '14px',
        color: '#000000',
        fontFamily: 'monospace',
        backgroundColor: '#ffaa44',
        padding: { left: 14, right: 14, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    btn.setSize(Math.max(btn.width, 48), Math.max(btn.height, 48));

    btn.on('pointerdown', () => {
      void this.runAdButton(btn, () => this.adService!.showRewarded(), () => {
        this.engine.recoverStreak();
        streakRecoveryUsedThisSession = true;
        btn.setVisible(false);
      });
    });
  }

  // T024: Extra life ad button — watch ad for extra life on next run
  private createExtraLifeButton(x: number, y: number): void {
    const btn = this.add
      .text(x, y, '▶ Watch ad for extra life?', {
        fontSize: '15px',
        color: '#000000',
        fontFamily: 'monospace',
        backgroundColor: '#44ff88',
        padding: { left: 14, right: 14, top: 10, bottom: 10 },
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    btn.setSize(Math.max(btn.width, 48), Math.max(btn.height, 48));

    btn.on('pointerdown', () => {
      void this.runAdButton(btn, () => this.adService!.showRewarded(), () => {
        // T025: Start new run then grant bonus life before first step
        this.engine.startNewRun();
        this.engine.grantBonusLife();
        this.scene.start('PlayScene', { engine: this.engine, adService: this.adService });
      });
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
      this.scene.start('PlayScene', { engine: this.engine, adService: this.adService });
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
