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
      if (loaded) {
        console.log('[Ads] Web GPT initialized');
      } else {
        console.log('[Ads] GPT unavailable — using simulated ad overlays');
      }
      // Mark available even if GPT failed: show* methods use simulated overlays
      // that work without GPT so the ad flow remains functional.
      initialized = true;
    } catch {
      console.warn('[Ads] Web ad init failed — using simulated ad overlays');
      initialized = true;
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

  async function showBanner(): Promise<void> {
    if (!initialized) return;
    // Remove existing banner if any
    const existing = document.getElementById('iws-banner');
    if (existing) return;

    try {
      const banner = document.createElement('div');
      banner.id = 'iws-banner';
      banner.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 50px;
        z-index: 9999;
        background: #222;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #888;
        font-family: monospace;
        font-size: 12px;
        border-top: 1px solid #444;
      `;
      banner.textContent = 'Ad Banner (simulated)';
      document.body.appendChild(banner);
    } catch {
      console.warn('[Ads] Web banner show failed');
    }
  }

  async function hideBanner(): Promise<void> {
    try {
      const banner = document.getElementById('iws-banner');
      if (banner) banner.remove();
    } catch {
      console.warn('[Ads] Web banner hide failed');
    }
  }

  return { initialize, showInterstitial, showRewarded, showRevive, showDouble, showBanner, hideBanner, isAvailable };
}
