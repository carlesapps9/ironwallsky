// src/adapters/phaser/play-scene.ts — Play scene (US1)
// Subscribes to all gameplay events, syncs sprites to core state,
// handles touch/drag input, manages HUD and sprite pools.

import Phaser from 'phaser';
import type { GameEngine } from '@core/engine.js';
import type { GameEventBus, GameEventType, GameEventMap } from '@core/events.js';
import { createSpritePool } from './sprite-pool.js';
import type { SpritePool } from './sprite-pool.js';
import { HUD } from './hud.js';

export class PlayScene extends Phaser.Scene {
  private engine!: GameEngine;
  private projectilePool!: SpritePool;
  private enemyPool!: SpritePool;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private hud!: HUD;
  private isDragging = false;

  // Sprite tracking maps: entityId -> Phaser sprite
  private projectileSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();

  // VFX containers (US5 will add more)
  private vfxLayer!: Phaser.GameObjects.Container;

  // US5: Mute toggle button
  private muteButton!: Phaser.GameObjects.Text;
  private audioMuted = true; // default muted per FR-014

  // Stored handler refs for cleanup (prevent listener leak across restarts)
  private boundHandlers: Array<{ event: string; handler: (...args: never[]) => void }> = [];

  // True while the 3-2-1 countdown is active after ad-powered resume
  private resumeCountdown = false;

  constructor() {
    super({ key: 'PlayScene' });
  }

  init(data: { engine: GameEngine }): void {
    this.engine = data.engine;
  }

  create(): void {
    const events = this.engine.events;
    const config = this.engine.getState().config;

    // Background — deep space
    this.cameras.main.setBackgroundColor('#050510');

    // Starfield background
    this.createStarfield(config.worldWidth, config.worldHeight);

    // Defense line (glowing energy barrier)
    const defenseLineGfx = this.add.graphics();
    defenseLineGfx.lineStyle(2, 0x00aaff, 0.4);
    defenseLineGfx.lineBetween(0, config.defenseLineY, config.worldWidth, config.defenseLineY);
    // Glow effect beneath defense line
    defenseLineGfx.fillStyle(0x0066cc, 0.08);
    defenseLineGfx.fillRect(0, config.defenseLineY, config.worldWidth, 40);
    defenseLineGfx.setDepth(1);

    // VFX layer
    this.vfxLayer = this.add.container(0, 0);
    this.vfxLayer.setDepth(90);

    // Player sprite
    this.playerSprite = this.add.sprite(
      config.worldWidth / 2,
      config.defenseLineY - 40,
      'player',
    );
    this.playerSprite.setDepth(10);

    // Sprite pools
    this.projectilePool = createSpritePool(this, 'projectile', 50);
    this.enemyPool = createSpritePool(this, 'enemy', 20);

    // HUD
    this.hud = new HUD(this, events, config);

    // US5: Mute toggle button (FR-014: default muted, togglable)
    this.createMuteButton(config);

    // Subscribe to game events
    this.subscribeToEvents(events);

    // Touch/drag input
    this.setupInput();

    // Register cleanup for scene shutdown (Phaser does NOT auto-call shutdown();
    // it only emits the SHUTDOWN event on this.events)
    this.events.once('shutdown', this.cleanup, this);

    // Start a new run only if nobody else has already set the engine phase.
    // - 'starting': first boot or retry (GameOverScene called startNewRun())
    // - 'playing': continue/revive just granted (grantContinue/grantRevive set 'playing')
    // In both cases, do NOT reset — the engine state is already correct.
    const phase = this.engine.getState().run.phase;
    if (phase !== 'starting' && phase !== 'playing') {
      this.engine.startNewRun();
    }

    // After continue/revive, show countdown so the player has time to get ready
    if (phase === 'playing') {
      this.showResumeCountdown();
    }
  }

  update(_time: number, delta: number): void {
    // Freeze engine during resume countdown but keep rendering
    if (!this.resumeCountdown) {
      this.engine.step(delta);
    }

    // Sync sprites to core state
    this.syncSprites();
  }

  /** 3-2-1-GO countdown after ad-powered continue/revive. */
  private showResumeCountdown(): void {
    this.resumeCountdown = true;
    const config = this.engine.getState().config;
    const cx = config.worldWidth / 2;
    const cy = config.worldHeight / 2;

    const label = this.add
      .text(cx, cy, '3', {
        fontSize: '64px',
        color: '#00ffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#0066aa',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100);

    const steps = ['3', '2', '1', 'GO!'];
    let i = 0;

    const advance = (): void => {
      if (i >= steps.length) {
        label.destroy();
        this.resumeCountdown = false;
        return;
      }
      label.setText(steps[i]);
      label.setScale(1.5);
      this.tweens.add({
        targets: label,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
      i++;
      this.time.delayedCall(800, advance);
    };

    advance();
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.engine.setPlayerX(pointer.x);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && pointer.isDown) {
        this.engine.setPlayerX(pointer.x);
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  /** Generate a procedural starfield background. */
  private createStarfield(width: number, height: number): void {
    const gfx = this.add.graphics();
    gfx.setDepth(0);

    // Distant nebula glow
    gfx.fillStyle(0x110022, 0.4);
    gfx.fillCircle(width * 0.7, height * 0.3, 120);
    gfx.fillStyle(0x001133, 0.3);
    gfx.fillCircle(width * 0.2, height * 0.7, 90);

    // Stars — varying sizes and brightness
    const starCount = 80;
    const starSeed = 42;
    for (let i = 0; i < starCount; i++) {
      // Deterministic pseudo-random positions (no RNG dependency)
      const hash = ((i * 2654435761 + starSeed) >>> 0) % 0xFFFFFF;
      const sx = (hash % width);
      const sy = ((hash * 7 + 13) % height);
      const brightness = 0.3 + ((hash % 100) / 100) * 0.7;
      const size = (hash % 3 === 0) ? 2 : 1;

      if (size === 2) {
        gfx.fillStyle(0xaaccff, brightness * 0.4);
        gfx.fillCircle(sx, sy, 3); // glow
      }
      gfx.fillStyle(0xffffff, brightness);
      gfx.fillCircle(sx, sy, size * 0.5);
    }

    // A few colored stars (blue giants, red dwarfs)
    const colorStars = [
      { x: 50, y: 80, color: 0x6688ff, r: 1.2 },
      { x: 280, y: 150, color: 0xff8866, r: 1.0 },
      { x: 160, y: 400, color: 0xaaddff, r: 1.5 },
      { x: 310, y: 530, color: 0xffcc88, r: 0.8 },
    ];
    for (const s of colorStars) {
      gfx.fillStyle(s.color, 0.3);
      gfx.fillCircle(s.x, s.y, s.r + 2);
      gfx.fillStyle(s.color, 0.8);
      gfx.fillCircle(s.x, s.y, s.r);
    }
  }

  /** US5: Create mute toggle button (48x48 touch target per FR-024).
   * Positioned bottom-right to avoid overlapping HUD heart icons (top-right). */
  private createMuteButton(config: { worldWidth: number; worldHeight: number }): void {
    const label = this.audioMuted ? '🔇' : '🔊';
    // Bottom-right corner: center at (worldWidth-28, worldHeight-32)
    // Gives 4px right margin and 8px bottom margin with 48px hit area
    this.muteButton = this.add.text(config.worldWidth - 28, config.worldHeight - 32, label, {
      fontSize: '24px',
    });
    this.muteButton.setOrigin(0.5, 0.5);
    this.muteButton.setDepth(110);
    this.muteButton.setScrollFactor(0);
    this.muteButton.setInteractive({ useHandCursor: true });
    this.muteButton.setSize(Math.max(this.muteButton.width, 48), Math.max(this.muteButton.height, 48));

    this.muteButton.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.audioMuted = !this.audioMuted;
      this.muteButton.setText(this.audioMuted ? '🔇' : '🔊');
      // Emit custom event so main.ts audio adapter can react
      this.game.events.emit('audio-toggle-mute');
    });
  }

  private subscribeToEvents(events: GameEventBus): void {
    // Helper to register + track handlers for cleanup in shutdown()
    const on = <K extends GameEventType>(
      event: K,
      handler: (payload: GameEventMap[K]) => void,
    ) => {
      events.on(event, handler);
      this.boundHandlers.push({ event, handler: handler as (...args: never[]) => void });
    };

    on('projectile-fired', (payload) => {
      const sprite = this.projectilePool.spawn(payload.x, payload.y);
      if (sprite) {
        sprite.setDepth(5);
        this.projectileSprites.set(payload.id, sprite);
      }

      // US5: Muzzle flash VFX (visible when muted per FR-013)
      this.addMuzzleFlash(payload.x, payload.y);
    });

    on('projectile-deactivated', (payload) => {
      const sprite = this.projectileSprites.get(payload.id);
      if (sprite) {
        this.projectilePool.despawn(sprite);
        this.projectileSprites.delete(payload.id);
      }
    });

    on('enemy-spawned', (payload) => {
      const sprite = this.enemyPool.spawn(payload.x, payload.y);
      if (sprite) {
        sprite.setDepth(5);
        this.enemySprites.set(payload.id, sprite);
      }
    });

    on('enemy-destroyed', (payload) => {
      const sprite = this.enemySprites.get(payload.id);
      if (sprite) {
        // US5: Enhanced destruction animation + score pop-up
        this.addDestroyEffect(payload.x, payload.y, payload.scoreAwarded);
        this.addExplosionEffect(payload.x, payload.y);
        this.enemyPool.despawn(sprite);
        this.enemySprites.delete(payload.id);
      }
    });

    on('enemy-breached', (payload) => {
      const sprite = this.enemySprites.get(payload.id);
      if (sprite) {
        this.enemyPool.despawn(sprite);
        this.enemySprites.delete(payload.id);
      }

      // US5: Screen shake + breach flash (visible when muted)
      this.addBreachEffect();
    });

    on('player-moved', (payload) => {
      this.playerSprite.x = payload.x;
    });

    on('run-phase-changed', (payload) => {
      if (payload.to === 'game-over' || payload.to === 'continue-offer') {
        this.scene.start('GameOverScene', { engine: this.engine });
      }
    });

    // US3: Milestone celebration VFX
    on('milestone-reached', (payload) => {
      this.addMilestoneCelebration(payload.milestone);
    });
  }

  /** US3: Screen-wide milestone celebration (visible when muted per FR-013/FR-025). */
  private addMilestoneCelebration(milestone: number): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // Large text flash (space cyan/gold)
    const text = this.add.text(cx, cy, `★ ${milestone} ★`, {
      fontSize: '48px',
      color: '#00ffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#0088ff',
      strokeThickness: 4,
    });
    text.setOrigin(0.5);
    text.setDepth(100);
    text.setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      yoyo: true,
      hold: 400,
      onComplete: () => text.destroy(),
    });

    // Particle burst effect (space-colored star particles)
    const particleColors = [0x00ffff, 0x0088ff, 0xffcc44, 0xff66aa, 0x44ff88, 0xffffff,
      0x00ffff, 0x0088ff, 0xffcc44, 0xff66aa, 0x44ff88, 0xffffff];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const particle = this.add.rectangle(cx, cy, 6, 6, particleColors[i]);
      particle.setDepth(99);

      this.tweens.add({
        targets: particle,
        x: cx + Math.cos(angle) * 150,
        y: cy + Math.sin(angle) * 150,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 600,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private syncSprites(): void {
    const state = this.engine.getState();

    // Sync player
    this.playerSprite.x = state.player.position.x;

    // Sync active projectiles
    for (const proj of state.projectiles) {
      if (proj.active) {
        const sprite = this.projectileSprites.get(proj.id);
        if (sprite) {
          sprite.setPosition(proj.position.x, proj.position.y);
        }
      }
    }

    // Sync active enemies
    for (const enemy of state.enemies) {
      if (enemy.active) {
        const sprite = this.enemySprites.get(enemy.id);
        if (sprite) {
          sprite.setPosition(enemy.position.x, enemy.position.y);
        }
      }
    }
  }

  private addDestroyEffect(x: number, y: number, score: number): void {
    // Score pop-up floating text
    const text = this.add.text(x, y, `+${score}`, {
      fontSize: '14px',
      color: '#ffff00',
      fontFamily: 'monospace',
    });
    text.setOrigin(0.5);
    text.setDepth(95);

    this.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  /** US5: Explosion sprite at impact point. */
  private addExplosionEffect(x: number, y: number): void {
    // Expanding circle explosion (alien green-cyan)
    const circle = this.add.circle(x, y, 4, 0x44ff88, 0.8);
    circle.setDepth(94);

    this.tweens.add({
      targets: circle,
      radius: 24,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => circle.destroy(),
    });

    // Debris particles (metallic alien fragments)
    const debrisColors = [0x44ff88, 0x888899, 0x00ccff, 0xffcc44, 0xff4444, 0x44ff44];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const debris = this.add.rectangle(x, y, 4, 4, debrisColors[i]);
      debris.setDepth(93);

      this.tweens.add({
        targets: debris,
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        alpha: 0,
        rotation: Math.random() * 3,
        duration: 400,
        ease: 'Power1',
        onComplete: () => debris.destroy(),
      });
    }
  }

  /** US5: Muzzle flash at player position (cyan laser glow). */
  private addMuzzleFlash(x: number, y: number): void {
    const flash = this.add.circle(x, y - 5, 6, 0x00ffff, 0.9);
    flash.setDepth(11);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 0.3,
      scaleY: 0.3,
      duration: 80,
      onComplete: () => flash.destroy(),
    });
  }

  private addBreachEffect(): void {
    // US5: Camera shake
    this.cameras.main.shake(200, 0.01);

    // Red overlay flash
    const flash = this.add.rectangle(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      this.cameras.main.width,
      this.cameras.main.height,
      0xff0000,
      0.3,
    );
    flash.setDepth(80);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  /** US5: Pause overlay — shown on document.hidden or orientation change. */
  private pauseOverlay: Phaser.GameObjects.Container | null = null;

  showPauseOverlay(): void {
    if (this.pauseOverlay) return;

    this.engine.pauseRun();

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    const bg = this.add.rectangle(cx, cy, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
    bg.setDepth(200);

    const text = this.add.text(cx, cy, 'PAUSED\n\nTap to Continue', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'monospace',
      align: 'center',
    });
    text.setOrigin(0.5);
    text.setDepth(201);

    this.pauseOverlay = this.add.container(0, 0, [bg, text]);
    this.pauseOverlay.setDepth(200);

    // Tap to resume
    bg.setInteractive();
    bg.on('pointerdown', () => {
      this.hidePauseOverlay();
    });
  }

  hidePauseOverlay(): void {
    if (!this.pauseOverlay) return;

    this.pauseOverlay.destroy(true);
    this.pauseOverlay = null;
    this.engine.resumeRun();
  }

  shutdown(): void {
    // Called by Phaser only if explicitly registered — see cleanup() below.
    this.cleanup();
  }

  private cleanup(): void {
    // Guard against double-cleanup
    if (this.boundHandlers.length === 0) return;

    // Unsubscribe all engine event handlers to prevent listener leak on restart
    for (const { event, handler } of this.boundHandlers) {
      this.engine.events.off(event as GameEventType, handler as never);
    }
    this.boundHandlers = [];

    this.hud?.destroy();
    this.projectileSprites.clear();
    this.enemySprites.clear();
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy(true);
      this.pauseOverlay = null;
    }
  }
}
