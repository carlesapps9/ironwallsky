// src/adapters/ads/native-ad-adapter.ts — Native AdMob adapter (US4)
// Dynamic import @capacitor-community/admob for Capacitor native.
// Try/catch all calls per FR-017.

import type { AdService, AdResult } from './ad-adapter.js';

/** Returns true if `id` is a valid AdMob ad-unit string (not undefined/empty). */
function isValidAdId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id !== 'undefined';
}

export function createNativeAdAdapter(): AdService {
  let initialized = false;
  let admobModule: typeof import('@capacitor-community/admob') | null = null;
  let interstitialId = '';
  let rewardedId = '';
  let reviveId = '';
  let doubleId = '';

  async function initialize(): Promise<void> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform(); // 'android' | 'ios'

      if (platform === 'ios') {
        interstitialId = import.meta.env.VITE_ADMOB_INTERSTITIAL_IOS as string ?? '';
        rewardedId = import.meta.env.VITE_ADMOB_REWARDED_IOS as string ?? '';
        reviveId = import.meta.env.VITE_ADMOB_REVIVE_IOS as string ?? '';
        doubleId = import.meta.env.VITE_ADMOB_DOUBLE_IOS as string ?? '';
      } else {
        interstitialId = import.meta.env.VITE_ADMOB_INTERSTITIAL_ANDROID as string ?? '';
        rewardedId = import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string ?? '';
        reviveId = import.meta.env.VITE_ADMOB_REVIVE_ANDROID as string ?? '';
        doubleId = import.meta.env.VITE_ADMOB_DOUBLE_ANDROID as string ?? '';
      }

      admobModule = await import('@capacitor-community/admob');
      const { AdMob } = admobModule;

      const isTesting = import.meta.env.VITE_ADMOB_TESTING === 'true';
      await AdMob.initialize({
        initializeForTesting: isTesting,
      });

      // iOS ATT per research.md §6
      try {
        await AdMob.requestTrackingAuthorization();
      } catch {
        console.log('[Ads] ATT not available or denied');
      }

      initialized = true;
      console.log(`[Ads] Native AdMob initialized (testing=${String(isTesting)}, platform=${platform})`);
    } catch (err) {
      console.warn('[Ads] Native AdMob init failed:', err);
      initialized = false;
    }
  }

  async function showInterstitial(): Promise<AdResult> {
    if (!initialized || !admobModule) return 'not-ready';
    if (!isValidAdId(interstitialId)) return 'not-ready';

    try {
      const { AdMob } = admobModule;

      await AdMob.prepareInterstitial({
        adId: interstitialId,
      });
      await AdMob.showInterstitial();
      return 'shown';
    } catch (err) {
      console.warn('[Ads] Interstitial failed:', err);
      return 'failed';
    }
  }

  /** Show a rewarded ad for a given ad unit, with dismiss detection. */
  async function showRewardedAd(adId: string, label: string): Promise<AdResult> {
    if (!initialized || !admobModule) return 'not-ready';
    if (!isValidAdId(adId)) {
      console.warn(`[Ads] ${label}: no valid ad unit ID configured`);
      return 'not-ready';
    }

    try {
      const { AdMob } = admobModule;

      await AdMob.prepareRewardVideoAd({ adId });

      // showRewardVideoAd resolves with AdMobRewardItem when the user earns
      // the reward. If the user dismisses early the promise rejects.
      const reward = await AdMob.showRewardVideoAd();
      if (reward) {
        return 'shown';
      }
      return 'dismissed';
    } catch (err) {
      // Dismissal before reward also throws on some plugin versions
      const msg = String(err);
      if (msg.includes('dismiss') || msg.includes('close') || msg.includes('cancel')) {
        console.log(`[Ads] ${label}: user dismissed`);
        return 'dismissed';
      }
      console.warn(`[Ads] ${label} failed:`, err);
      return 'failed';
    }
  }

  async function showRewarded(): Promise<AdResult> {
    return showRewardedAd(rewardedId, 'Rewarded (continue)');
  }

  async function showRevive(): Promise<AdResult> {
    return showRewardedAd(reviveId || rewardedId, 'Revive Shield');
  }

  async function showDouble(): Promise<AdResult> {
    return showRewardedAd(doubleId || rewardedId, 'Score Doubler');
  }

  function isAvailable(): boolean {
    return initialized;
  }

  return { initialize, showInterstitial, showRewarded, showRevive, showDouble, isAvailable };
}
