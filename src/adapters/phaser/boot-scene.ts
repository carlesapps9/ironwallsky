// src/adapters/phaser/boot-scene.ts — Boot scene (US1)
// Shows loading indicator, preloads placeholder assets, generates collision masks,
// transitions to play scene.

import Phaser from 'phaser';
import type { CollisionMask } from '@core/entities.js';

export class BootScene extends Phaser.Scene {
  private onMasksReady?: (masks: CollisionMask[]) => void;

  constructor(onMasksReady?: (masks: CollisionMask[]) => void) {
    super({ key: 'BootScene' });
    this.onMasksReady = onMasksReady;
  }

  preload(): void {
    // Loading indicator
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 120, height / 2 - 15, 240, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 40, 'Loading...', {
      fontSize: '16px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4a90d9, 1);
      progressBar.fillRect(width / 2 - 116, height / 2 - 11, 232 * value, 22);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder textures if no real assets exist
    this.createPlaceholderAssets();
  }

  create(): void {
    // Generate collision masks from sprite data
    const masks = this.generateCollisionMasks();

    if (this.onMasksReady) {
      this.onMasksReady(masks);
    }

    // Title screen — shown briefly before auto-starting PlayScene
    this.showTitleScreen();
  }

  private showTitleScreen(): void {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const cx = W / 2;

    this.cameras.main.setBackgroundColor('#050510');

    // Starfield
    for (let i = 0; i < 120; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(0, H);
      const r = Math.random() < 0.15 ? 2 : 1;
      const alpha = Phaser.Math.FloatBetween(0.3, 1.0);
      const star = this.add.circle(x, y, r, 0xffffff, alpha);
      this.tweens.add({
        targets: star,
        alpha: { from: alpha, to: alpha * 0.2 },
        duration: Phaser.Math.Between(800, 2400),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1200),
      });
    }

    // Game title
    this.add.text(cx, H * 0.28, 'IRON WALL SKY', {
      fontSize: '36px',
      color: '#48c7e8',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#0088aa',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(cx, H * 0.38, 'SKY DEFENSE ARCADE', {
      fontSize: '16px',
      color: '#7799bb',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Draw a simple shield icon using graphics
    const icon = this.add.graphics();
    const iCx = cx;
    const iTop = H * 0.50;
    const hw = 42;
    const sh = 56;
    const mid = iTop + sh * 0.6;
    icon.fillStyle(0x48c7e8, 1);
    icon.fillRect(iCx - hw, iTop, hw * 2, mid - iTop);
    for (let y = 0; y <= sh - (mid - iTop); y++) {
      const frac = y / (sh - (mid - iTop));
      const w2 = hw * (1 - frac);
      icon.fillRect(Math.round(iCx - w2), Math.round(mid + y), Math.round(w2 * 2), 1);
    }
    icon.fillStyle(0x050510, 1);
    icon.fillRect(iCx - hw + 10, iTop + 8, (hw - 10) * 2, (mid - iTop) - 12);
    for (let y = 0; y <= (sh - (mid - iTop)) - 8; y++) {
      const frac = y / ((sh - (mid - iTop)) - 8);
      const w2 = (hw - 10) * (1 - frac);
      icon.fillRect(Math.round(iCx - w2), Math.round(mid + y), Math.round(w2 * 2), 1);
    }

    // Pulse the icon
    this.tweens.add({
      targets: icon,
      scaleX: 1.06, scaleY: 1.06,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Tap-to-start text (blinking)
    const tapText = this.add.text(cx, H * 0.80, 'TAP TO START', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: tapText,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Version
    this.add.text(cx, H * 0.92, 'v1.0', {
      fontSize: '12px',
      color: '#334455',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Advance on tap or after 4 seconds (auto)
    const advance = (): void => {
      this.input.off('pointerdown', advance);
      this.scene.start('PlayScene');
    };
    this.input.once('pointerdown', advance);
    this.time.delayedCall(4000, advance);
  }

  private createPlaceholderAssets(): void {
    // Player sprite — Rocket ship (space themed)
    const playerGraphics = this.add.graphics({ x: 0, y: 0 });
    // Rocket body (silver-blue fuselage)
    playerGraphics.fillStyle(0x8cb4d9, 1);
    playerGraphics.fillTriangle(16, 0, 6, 24, 26, 24); // nose cone
    playerGraphics.fillStyle(0x6a9ec9, 1);
    playerGraphics.fillRect(8, 18, 16, 10); // body
    // Cockpit window
    playerGraphics.fillStyle(0x00eeff, 1);
    playerGraphics.fillCircle(16, 12, 3);
    // Engine exhaust nozzle
    playerGraphics.fillStyle(0x555577, 1);
    playerGraphics.fillRect(10, 28, 12, 4);
    // Side fins
    playerGraphics.fillStyle(0xff6633, 1);
    playerGraphics.fillTriangle(6, 24, 0, 32, 8, 28); // left fin
    playerGraphics.fillTriangle(26, 24, 32, 32, 24, 28); // right fin
    // Engine glow
    playerGraphics.fillStyle(0xff8800, 0.8);
    playerGraphics.fillTriangle(12, 30, 20, 30, 16, 36);
    playerGraphics.generateTexture('player', 32, 38);
    playerGraphics.destroy();

    // Projectile — Laser bolt (cyan energy beam)
    const projGraphics = this.add.graphics({ x: 0, y: 0 });
    // Outer glow
    projGraphics.fillStyle(0x00ccff, 0.4);
    projGraphics.fillRect(0, 1, 8, 14);
    // Core beam
    projGraphics.fillStyle(0x00ffff, 1);
    projGraphics.fillRect(2, 0, 4, 16);
    // Bright center
    projGraphics.fillStyle(0xffffff, 1);
    projGraphics.fillRect(3, 2, 2, 12);
    projGraphics.generateTexture('projectile', 8, 16);
    projGraphics.destroy();

    // Enemy sprite — UFO / Alien saucer
    const enemyGraphics = this.add.graphics({ x: 0, y: 0 });
    // Saucer dome (green-tinted glass)
    enemyGraphics.fillStyle(0x44ff88, 0.7);
    enemyGraphics.fillEllipse(16, 10, 16, 12);
    // Saucer body (metallic disc)
    enemyGraphics.fillStyle(0x888899, 1);
    enemyGraphics.fillEllipse(16, 16, 32, 10);
    // Accent ring
    enemyGraphics.lineStyle(1, 0xaabbcc);
    enemyGraphics.strokeEllipse(16, 16, 30, 8);
    // Lights on saucer (portholes)
    enemyGraphics.fillStyle(0xff4444, 1);
    enemyGraphics.fillCircle(8, 16, 2);
    enemyGraphics.fillStyle(0xffff00, 1);
    enemyGraphics.fillCircle(16, 18, 2);
    enemyGraphics.fillStyle(0x44ff44, 1);
    enemyGraphics.fillCircle(24, 16, 2);
    // Bottom beam hint
    enemyGraphics.fillStyle(0x66ffaa, 0.3);
    enemyGraphics.fillTriangle(10, 20, 22, 20, 16, 30);
    enemyGraphics.generateTexture('enemy', 32, 32);
    enemyGraphics.destroy();

    // Life icon — Oxygen tank / space helmet
    const heartGraphics = this.add.graphics({ x: 0, y: 0 });
    // Helmet visor (blue-cyan dome)
    heartGraphics.fillStyle(0x3388ff, 1);
    heartGraphics.fillCircle(13, 10, 9);
    // Visor glass
    heartGraphics.fillStyle(0x00ddff, 0.8);
    heartGraphics.fillCircle(13, 9, 6);
    // Visor reflection
    heartGraphics.fillStyle(0xffffff, 0.5);
    heartGraphics.fillCircle(11, 7, 2);
    // Antenna
    heartGraphics.lineStyle(2, 0xcccccc);
    heartGraphics.lineBetween(13, 1, 13, 4);
    heartGraphics.fillStyle(0xff3333, 1);
    heartGraphics.fillCircle(13, 1, 2);
    heartGraphics.generateTexture('heart', 26, 26);
    heartGraphics.destroy();
  }

  private generateCollisionMasks(): CollisionMask[] {
    const masks: CollisionMask[] = [];

    // Generate masks for projectile and enemy textures
    const textures = ['projectile', 'enemy'];
    for (const texKey of textures) {
      const mask = this.generateMaskFromTexture(texKey);
      if (mask) {
        masks.push(mask);
      } else {
        // Fallback: solid mask
        const fallbackSize = texKey === 'projectile' ? { w: 8, h: 16 } : { w: 32, h: 32 };
        masks.push(createSolidMask(fallbackSize.w, fallbackSize.h));
      }
    }

    return masks;
  }

  private generateMaskFromTexture(textureKey: string): CollisionMask | null {
    try {
      const texture = this.textures.get(textureKey);
      if (!texture || texture.key === '__MISSING') return null;

      const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const width = source.width;
      const height = source.height;

      // Create offscreen canvas to read pixel data
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(source, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      // Create bitmask: 1 bit per pixel, packed into Uint32Array
      const totalBits = width * height;
      const data = new Uint32Array(Math.ceil(totalBits / 32));

      for (let i = 0; i < totalBits; i++) {
        const alpha = pixels[i * 4 + 3];
        if (alpha > 128) {
          data[i >>> 5] |= 1 << (i & 31);
        }
      }

      return { width, height, data };
    } catch {
      return null;
    }
  }
}

function createSolidMask(width: number, height: number): CollisionMask {
  const totalBits = width * height;
  const data = new Uint32Array(Math.ceil(totalBits / 32));
  data.fill(0xffffffff);
  return { width, height, data };
}
