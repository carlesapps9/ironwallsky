// src/adapters/ads/native-ad-adapter.ts — Native AdMob adapter (US4)
// Dynamic import @capacitor-community/admob for Capacitor native.
// Try/catch all calls per FR-017.

import type { AdService, AdResult } from './ad-adapter.js';

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
        interstitialId = import.meta.env.VITE_ADMOB_INTERSTITIAL_IOS as string;
        rewardedId = import.meta.env.VITE_ADMOB_REWARDED_IOS as string;
        reviveId = import.meta.env.VITE_ADMOB_REVIVE_IOS as string;
        doubleId = import.meta.env.VITE_ADMOB_DOUBLE_IOS as string;
      } else {
        interstitialId = import.meta.env.VITE_ADMOB_INTERSTITIAL_ANDROID as string;
        rewardedId = import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string;
        reviveId = import.meta.env.VITE_ADMOB_REVIVE_ANDROID as string;
        doubleId = import.meta.env.VITE_ADMOB_DOUBLE_ANDROID as string;
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
      console.log('[Ads] Native AdMob initialized');
    } catch (err) {
      console.warn('[Ads] Native AdMob init failed:', err);
      initialized = false;
    }
  }

  async function showInterstitial(): Promise<AdResult> {
    if (!initialized || !admobModule) return 'not-ready';

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

  async function showRewarded(): Promise<AdResult> {
    if (!initialized || !admobModule) return 'not-ready';

    try {
      const { AdMob } = admobModule;

      await AdMob.prepareRewardVideoAd({
        adId: rewardedId,
      });

      await AdMob.showRewardVideoAd();
      return 'shown';
    } catch (err) {
      console.warn('[Ads] Rewarded ad failed:', err);
      return 'failed';
    }
  }

  // T079: Revive Shield — dedicated placement, own ad unit ID
  async function showRevive(): Promise<AdResult> {
    if (!initialized || !admobModule) return 'not-ready';

    try {
      const { AdMob } = admobModule;

      await AdMob.prepareRewardVideoAd({
        adId: reviveId || rewardedId, // fallback to continue ad unit if not configured
      });

      await AdMob.showRewardVideoAd();
      return 'shown';
    } catch (err) {
      console.warn('[Ads] Revive Shield ad failed:', err);
      return 'failed';
    }
  }

  // T079: Score Doubler — dedicated placement, own ad unit ID
  async function showDouble(): Promise<AdResult> {
    if (!initialized || !admobModule) return 'not-ready';

    try {
      const { AdMob } = admobModule;

      await AdMob.prepareRewardVideoAd({
        adId: doubleId || rewardedId, // fallback to continue ad unit if not configured
      });

      await AdMob.showRewardVideoAd();
      return 'shown';
    } catch (err) {
      console.warn('[Ads] Score Doubler ad failed:', err);
      return 'failed';
    }
  }

  function isAvailable(): boolean {
    return initialized;
  }

  return { initialize, showInterstitial, showRewarded, showRevive, showDouble, isAvailable };
}
