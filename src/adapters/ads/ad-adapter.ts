// src/adapters/ads/ad-adapter.ts — Ad service interface & interstitial cadence (US4)
// Platform detection, unified ad interface, interstitial every N runs.

/** Result of an ad display attempt. */
export type AdResult = 'shown' | 'dismissed' | 'failed' | 'not-ready' | 'skipped';

/** Unified ad service interface for both native and web. */
export interface AdService {
  /** Initialize the ad SDK. */
  initialize(): Promise<void>;

  /** Show an interstitial ad. Returns result. */
  showInterstitial(): Promise<AdResult>;

  /** Show a rewarded ad. Returns result. */
  showRewarded(): Promise<AdResult>;

  /** Whether the ad service is available on this platform. */
  isAvailable(): boolean;
}

/** Creates a no-op ad service for when ads are blocked/unavailable. */
export function createNoOpAdService(): AdService {
  return {
    async initialize(): Promise<void> {},
    async showInterstitial(): Promise<AdResult> { return 'skipped'; },
    async showRewarded(): Promise<AdResult> { return 'skipped'; },
    isAvailable(): boolean { return false; },
  };
}

/** Interstitial cadence tracker. */
export interface InterstitialCadence {
  /** Call on each run completion. Shows interstitial if cadence threshold met. */
  onRunComplete(runIndex: number): Promise<AdResult>;
}

/**
 * Creates interstitial cadence logic.
 * Shows interstitial every N runs per AdConfig.interstitialCadence.
 * 5s timeout per FR-018. Never blocks retry per FR-017.
 */
export function createInterstitialCadence(
  adService: AdService,
  cadence: number,
  timeoutMs: number = 5000,
): InterstitialCadence {
  async function onRunComplete(runIndex: number): Promise<AdResult> {
    if (cadence <= 0) return 'skipped';
    if (runIndex % cadence !== 0) return 'skipped';
    if (!adService.isAvailable()) return 'skipped';

    try {
      // Timeout wrapper per FR-018
      const result = await Promise.race([
        adService.showInterstitial(),
        new Promise<AdResult>((resolve) =>
          setTimeout(() => resolve('failed'), timeoutMs),
        ),
      ]);
      return result;
    } catch {
      // Never block retry per FR-017
      console.warn('[Ads] Interstitial failed, skipping');
      return 'failed';
    }
  }

  return { onRunComplete };
}

/**
 * Creates the appropriate ad service based on platform.
 * Native: @capacitor-community/admob
 * Web: Google Ad Manager GPT
 */
export async function createPlatformAdService(): Promise<AdService> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { createNativeAdAdapter } = await import('./native-ad-adapter.js');
      return createNativeAdAdapter();
    }
  } catch {
    // Not on Capacitor
  }

  try {
    const { createWebAdAdapter } = await import('./web-ad-adapter.js');
    return createWebAdAdapter();
  } catch {
    // Web ads unavailable
  }

  return createNoOpAdService();
}
