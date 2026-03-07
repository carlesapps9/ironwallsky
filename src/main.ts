// src/main.ts — Entry point
// Phaser GameConfig, core engine, scene registration, adapter wiring.

import Phaser from 'phaser';
import { createEngine, type GameEngine } from '@core/engine.js';
import { DEFAULT_CONFIG } from '@core/config.js';
import { BootScene } from '@adapters/phaser/boot-scene.js';
import { PlayScene } from '@adapters/phaser/play-scene.js';
import { GameOverScene } from '@adapters/phaser/gameover-scene.js';
import { createStorageAdapter } from '@adapters/storage/storage-adapter.js';
import { createPlatformAdService, createInterstitialCadence } from '@adapters/ads/ad-adapter.js';
import type { AdService } from '@adapters/ads/ad-adapter.js';
import { createAnalyticsAdapter } from '@adapters/analytics/analytics-adapter.js';
import { createAudioAdapter } from '@adapters/audio/audio-adapter.js';

// Create the core engine
const engine = createEngine(DEFAULT_CONFIG, Date.now());

// Wire storage adapter (US2)
const storage = createStorageAdapter();

async function initStorage(): Promise<void> {
  const saved = await storage.load();
  if (saved) {
    const state = engine.getState() as { highScore: { bestScore: number; dateAchieved: string } };
    state.highScore.bestScore = saved.bestScore;
    state.highScore.dateAchieved = saved.dateAchieved;
    console.log(`[Storage] Loaded high score: ${saved.bestScore}`);
  }

  engine.events.on('high-score-beaten', (payload) => {
    storage.save({ bestScore: payload.newBest, dateAchieved: new Date().toISOString() });
  });
}

initStorage();

// Boot scene callback to pass collision masks to engine
const bootScene = new BootScene((masks) => {
  engine.setCollisionMasks(masks);
});

// Phaser Game Configuration per quickstart.md
const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    smoothStep: false,
  },
  render: {
    pixelArt: true,
  },
  backgroundColor: '#050510',
  scene: [bootScene, PlayScene, GameOverScene],
  callbacks: {
    preBoot: (game) => {
      // Make engine available to scenes via registry
      game.registry.set('engine', engine);
    },
  },
};

// Override PlayScene init to inject engine
const originalPlayInit = PlayScene.prototype.init;
PlayScene.prototype.init = function (data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  if (!d.engine) {
    (d as Record<string, unknown>).engine = engine;
  }
  originalPlayInit.call(this, d as { engine: GameEngine });
};

const originalGameOverInit = GameOverScene.prototype.init;
GameOverScene.prototype.init = function (data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  if (!d.engine) {
    (d as Record<string, unknown>).engine = engine;
  }
  originalGameOverInit.call(this, d as { engine: GameEngine; adService?: AdService });
};

// Launch the game
const game = new Phaser.Game(phaserConfig);

// Expose to Playwright for screenshot automation (harmless in production)
(window as unknown as Record<string, unknown>).__game   = game;
(window as unknown as Record<string, unknown>).__engine = engine;

// Wire analytics (US4)
const analytics = createAnalyticsAdapter();
analytics.subscribeToGameEvents(engine.events);

// Wire audio (US5)
const audio = createAudioAdapter();
audio.subscribeToGameEvents(engine.events);

// Visibility change handler (US5: pause/resume + audio)
document.addEventListener('visibilitychange', () => {
  const hidden = document.hidden;
  audio.handleVisibility(hidden);

  if (hidden) {
    engine.pauseRun();
    // Try to show pause overlay on the active play scene
    const playScene = game.scene.getScene('PlayScene') as PlayScene & { showPauseOverlay?: () => void };
    if (playScene?.showPauseOverlay && game.scene.isActive('PlayScene')) {
      playScene.showPauseOverlay();
    }
  }
});

// Orientation change handler (FR-023: pause on orientation change without losing state)
window.addEventListener('orientationchange', () => {
  if (engine.getState().run.phase === 'playing') {
    engine.pauseRun();
    const playScene = game.scene.getScene('PlayScene') as PlayScene & { showPauseOverlay?: () => void };
    if (playScene?.showPauseOverlay && game.scene.isActive('PlayScene')) {
      playScene.showPauseOverlay();
    }
  }
});

// User gesture to unlock audio (tap anywhere on first interaction)
document.addEventListener('pointerdown', () => {
  audio.init();
}, { once: true });

// Listen for mute toggle from play scene (US5: FR-014)
game.events.on('audio-toggle-mute', () => {
  audio.toggleMute();
});

// Wire ads (US4)
let adService: AdService | null = null;

async function initAds(): Promise<void> {
  try {
    adService = await createPlatformAdService();
    await adService.initialize();

    const cadence = createInterstitialCadence(
      adService,
      DEFAULT_CONFIG.interstitialCadence,
      DEFAULT_CONFIG.adTimeoutMs,
    );

    // Show interstitial at game-over cadence
    engine.events.on('run-phase-changed', (payload) => {
      if (payload.to === 'game-over') {
        const runIndex = engine.getState().run.runIndex;
        cadence.onRunComplete(runIndex).then((result) => {
          analytics.track({ name: 'interstitial', params: { result } });
        });
      }
    });

    console.log('[Ads] Ad service ready');
  } catch {
    console.log('[Ads] Ad initialization skipped');
  }
}

initAds();

// Service worker registration (web only, skip on Capacitor)
async function registerServiceWorker(): Promise<void> {
  try {
    // Check if we're on Capacitor native
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      console.log('[SW] Skipping service worker on native platform');
      return;
    }
  } catch {
    // @capacitor/core not available — we're on web
  }

  // vite-plugin-pwa handles registration automatically via virtual module
  if ('serviceWorker' in navigator) {
    try {
      const { registerSW } = await import('virtual:pwa-register');
      registerSW({ immediate: true });
      console.log('[SW] Service worker registered');
    } catch {
      console.log('[SW] PWA registration not available');
    }
  }
}

registerServiceWorker();

export { game, engine };
