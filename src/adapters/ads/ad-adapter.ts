// src/adapters/ads/ad-adapter.ts — Ad service interface & interstitial cadence (US4)
// Platform detection, unified ad interface, interstitial every N runs.

/** Result of an ad display attempt. */
export type AdResult = 'shown' | 'dismissed' | 'failed' | 'not-ready' | 'skipped';

/** Unified ad service interface for both native and web. */
export interface AdService {
  /** Initialize the ad SDK. */
  initialize(): Promise<void>;

  /** Show an interstitial ad. Returns result. isCancelled lets the caller abort between prepare and show. */
  showInterstitial(isCancelled?: () => boolean): Promise<AdResult>;

  /** Show the Watch-to-Continue rewarded ad. Returns result. */
  showRewarded(): Promise<AdResult>;

  /** Show the Revive Shield rewarded ad (dedicated placement). Returns result. */
  showRevive(): Promise<AdResult>;

  /** Show the Score Doubler rewarded ad (dedicated placement). Returns result. */
  showDouble(): Promise<AdResult>;

  /** Pre-warm the rewarded ad so it shows instantly when the user clicks. */
  preloadRewarded(): Promise<void>;

  /** Show an adaptive banner ad (e.g. on game-over screen). */
  showBanner(): Promise<void>;

  /** Hide the currently displayed banner ad. */
  hideBanner(): Promise<void>;

  /** Whether the ad service is available on this platform. */
  isAvailable(): boolean;
}

/** Creates a no-op ad service for when ads are blocked/unavailable. */
export function createNoOpAdService(): AdService {
  return {
    async initialize(): Promise<void> {},
    async showInterstitial(_isCancelled?: () => boolean): Promise<AdResult> { return 'skipped'; },
    async showRewarded(): Promise<AdResult> { return 'skipped'; },
    async showRevive(): Promise<AdResult> { return 'skipped'; },
    async showDouble(): Promise<AdResult> { return 'skipped'; },
    async preloadRewarded(): Promise<void> {},
    async showBanner(): Promise<void> {},
    async hideBanner(): Promise<void> {},
    isAvailable(): boolean { return false; },
  };
}

/** Interstitial cadence tracker. */
export interface InterstitialCadence {
  /** Call on each run completion. Shows interstitial if cadence threshold met. */
  onRunComplete(runIndex: number): Promise<AdResult>;
  /** Cancel any in-flight interstitial (e.g. user started playing before prepare finished). */
  cancel(): void;
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
  // Token increments whenever cancel() is called, invalidating in-flight operations.
  let token = 0;

  function cancel(): void { token++; }

  async function onRunComplete(runIndex: number): Promise<AdResult> {
    const myToken = ++token;
    if (cadence <= 0) return 'skipped';
    if (runIndex % cadence !== 0) return 'skipped';
    if (!adService.isAvailable()) return 'skipped';

    const isCancelled = (): boolean => token !== myToken;

    try {
      // Timeout wrapper per FR-018
      const result = await Promise.race([
        adService.showInterstitial(isCancelled),
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

  return { onRunComplete, cancel };
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
