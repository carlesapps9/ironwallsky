// src/adapters/ads/web-ad-adapter.ts — Web ad adapter (US4)
// Lazy-inject Google Ad Manager GPT script tag.
// DOM overlay above canvas, try/catch all calls per FR-017.

import type { AdService, AdResult } from './ad-adapter.js';

declare global {
  interface Window {
    googletag?: {
      cmd: Array<() => void>;
      defineSlot(
        adUnitPath: string,
        size: [number, number],
        divId: string,
      ): { addService(service: unknown): unknown };
      pubads(): unknown;
      enableServices(): void;
      display(divId: string): void;
      destroySlots(slots?: unknown[]): void;
    };
  }
}

const GPT_SCRIPT_URL = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

export function createWebAdAdapter(): AdService {
  let initialized = false;
  let gptLoaded = false;

  async function loadGPT(): Promise<boolean> {
    if (gptLoaded) return true;

    return new Promise((resolve) => {
      try {
        const script = document.createElement('script');
        script.src = GPT_SCRIPT_URL;
        script.async = true;
        script.onload = () => {
          gptLoaded = true;
          resolve(true);
        };
        script.onerror = () => {
          console.warn('[Ads] GPT script failed to load');
          resolve(false);
        };
        document.head.appendChild(script);
      } catch {
        resolve(false);
      }
    });
  }

  async function initialize(): Promise<void> {
    try {
      const loaded = await loadGPT();
      initialized = loaded;
      if (loaded) {
        console.log('[Ads] Web GPT initialized');
      }
    } catch {
      console.warn('[Ads] Web ad init failed');
      initialized = false;
    }
  }

  function createAdOverlay(divId: string): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.id = divId;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    document.body.appendChild(overlay);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 24px;
      color: white;
      background: none;
      border: none;
      cursor: pointer;
      min-width: 48px;
      min-height: 48px;
    `;
    closeBtn.onclick = () => {
      overlay.remove();
    };
    overlay.appendChild(closeBtn);

    return overlay;
  }

  async function showInterstitial(): Promise<AdResult> {
    if (!initialized) return 'not-ready';

    try {
      const divId = 'iws-interstitial';
      const overlay = createAdOverlay(divId);

      // In a real implementation, GPT would render the ad into the overlay.
      // For now, simulate with a brief overlay.
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 2000);
      });

      return 'shown';
    } catch {
      return 'failed';
    }
  }

  async function showRewarded(): Promise<AdResult> {
    if (!initialized) return 'not-ready';

    try {
      const divId = 'iws-rewarded';
      const overlay = createAdOverlay(divId);

      // Simulate rewarded ad view time
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 3000);
      });

      return 'shown';
    } catch {
      return 'failed';
    }
  }

  // T080: Revive Shield — distinct GPT slot name, same overlay pattern, 5 s timeout
  async function showRevive(): Promise<AdResult> {
    if (!initialized) return 'not-ready';

    try {
      const divId = 'iws-revive';
      const overlay = createAdOverlay(divId);

      const result = await Promise.race([
        new Promise<AdResult>((resolve) => {
          // GPT slot: /ironwallsky/revive-shield — real GPT display would go here
          setTimeout(() => {
            overlay.remove();
            resolve('shown');
          }, 3000);
        }),
        new Promise<AdResult>((resolve) =>
          setTimeout(() => {
            overlay.remove();
            resolve('failed');
          }, 5000),
        ),
      ]);

      return result;
    } catch {
      return 'failed';
    }
  }

  // T080: Score Doubler — distinct GPT slot name, same overlay pattern, 5 s timeout
  async function showDouble(): Promise<AdResult> {
    if (!initialized) return 'not-ready';

    try {
      const divId = 'iws-double';
      const overlay = createAdOverlay(divId);

      const result = await Promise.race([
        new Promise<AdResult>((resolve) => {
          // GPT slot: /ironwallsky/score-doubler — real GPT display would go here
          setTimeout(() => {
            overlay.remove();
            resolve('shown');
          }, 3000);
        }),
        new Promise<AdResult>((resolve) =>
          setTimeout(() => {
            overlay.remove();
            resolve('failed');
          }, 5000),
        ),
      ]);

      return result;
    } catch {
      return 'failed';
    }
  }

  function isAvailable(): boolean {
    return initialized;
  }

  return { initialize, showInterstitial, showRewarded, showRevive, showDouble, isAvailable };
}
