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
  let bannerId = '';
  // Pre-warm state: which adId has been prepared but not yet shown.
  let preloadedAdId: string | null = null;
  let preloadInProgress = false;
  // Interstitial pre-warm state — shared by showInterstitial and preloadInterstitial
  // to prevent concurrent AdMob.prepareInterstitial calls which can error on some SDK versions.
  let interstitialReady = false;
  let interstitialPreparing = false;
  // Banner state — prevents double-show on scene restart (e.g. Score Doubler).
  let bannerShowing = false;

  /**
   * Ensures the interstitial is prepared exactly once.
   * If a prepare is already in-flight, polls until it finishes (max 8s) instead
   * of issuing a second concurrent AdMob.prepareInterstitial call.
   */
  async function ensureInterstitialReady(): Promise<boolean> {
    if (!initialized || !admobModule) return false;
    if (!isValidAdId(interstitialId)) return false;
    if (interstitialReady) return true; // already prepared
    if (interstitialPreparing) {
      // Wait for the in-flight prepare to settle (100ms polls, 8s max)
      let waited = 0;
      while (interstitialPreparing && waited < 8000) {
        await new Promise<void>((r) => setTimeout(r, 100));
        waited += 100;
      }
      return interstitialReady;
    }
    interstitialPreparing = true;
    try {
      const { AdMob } = admobModule;
      await AdMob.prepareInterstitial({ adId: interstitialId });
      interstitialReady = true;
      return true;
    } catch {
      interstitialReady = false;
      return false;
    } finally {
      interstitialPreparing = false;
    }
  }

  async function initialize(): Promise<void> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      const platform = Capacitor.getPlatform(); // 'android' | 'ios'

      if (platform === 'ios') {
        interstitialId = import.meta.env.VITE_ADMOB_INTERSTITIAL_IOS as string ?? '';
        rewardedId = import.meta.env.VITE_ADMOB_REWARDED_IOS as string ?? '';
        reviveId = import.meta.env.VITE_ADMOB_REVIVE_IOS as string ?? '';
        doubleId = import.meta.env.VITE_ADMOB_DOUBLE_IOS as string ?? '';
        bannerId = import.meta.env.VITE_ADMOB_BANNER_IOS as string ?? '';
      } else {
        interstitialId = import.meta.env.VITE_ADMOB_INTERSTITIAL_ANDROID as string ?? '';
        rewardedId = import.meta.env.VITE_ADMOB_REWARDED_ANDROID as string ?? '';
        reviveId = import.meta.env.VITE_ADMOB_REVIVE_ANDROID as string ?? '';
        doubleId = import.meta.env.VITE_ADMOB_DOUBLE_ANDROID as string ?? '';
        bannerId = import.meta.env.VITE_ADMOB_BANNER_ANDROID as string ?? '';
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
      // Log only in dev builds — platform name reveals device info in production (OWASP A09)
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
        console.log(`[Ads] Native AdMob initialized (testing=${String(isTesting)}, platform=${platform})`);
      }
    } catch (err) {
      console.warn('[Ads] Native AdMob init failed:', err);
      initialized = false;
    }
  }

  async function showInterstitial(isCancelled?: () => boolean): Promise<AdResult> {
    if (!initialized || !admobModule) return 'not-ready';
    if (!isValidAdId(interstitialId)) return 'not-ready';

    try {
      // Shared lock — won't double-prepare if preloadInterstitial is in flight.
      const ready = await ensureInterstitialReady();
      if (!ready) return 'not-ready';
      interstitialReady = false; // consume

      // Guard: if the user started playing while we were preparing, skip the show
      // and re-warm for the next game-over.
      if (isCancelled?.()) {
        preloadInterstitial().catch(() => {});
        return 'skipped';
      }

      const { AdMob } = admobModule;
      await AdMob.showInterstitial();

      // Re-warm for the next game-over (fire-and-forget).
      preloadInterstitial().catch(() => {});

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

      // Skip prepare if this ad unit was pre-warmed (shows instantly).
      if (preloadedAdId !== adId) {
        await AdMob.prepareRewardVideoAd({ adId });
      }
      preloadedAdId = null; // consume the pre-loaded slot

      // showRewardVideoAd resolves with AdMobRewardItem when the user earns
      // the reward. If the user dismisses early the promise rejects.
      const reward = await AdMob.showRewardVideoAd();

      // Pre-warm for the next game-over (fire-and-forget).
      preloadRewarded().catch(() => {});

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

  /** Pre-warm the primary rewarded ad so it shows instantly when the user clicks. */
  async function preloadRewarded(): Promise<void> {
    if (!initialized || !admobModule) return;
    if (!isValidAdId(rewardedId)) return;
    if (preloadInProgress) return;
    preloadInProgress = true;
    try {
      const { AdMob } = admobModule;
      await AdMob.prepareRewardVideoAd({ adId: rewardedId });
      preloadedAdId = rewardedId;
    } catch {
      preloadedAdId = null;
    } finally {
      preloadInProgress = false;
    }
  }

  /** Pre-warm the interstitial ad so it fires instantly at game-over. */
  async function preloadInterstitial(): Promise<void> {
    // ensureInterstitialReady handles the lock — safe to call concurrently.
    await ensureInterstitialReady();
  }

  function isAvailable(): boolean {
    return initialized;
  }

  async function showBanner(): Promise<void> {
    if (!initialized || !admobModule) return;
    if (!isValidAdId(bannerId)) return;
    if (bannerShowing) return; // already visible — skip to avoid flicker on scene restart
    try {
      const { AdMob, BannerAdSize, BannerAdPosition } = admobModule;
      await AdMob.showBanner({
        adId: bannerId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
      });
      bannerShowing = true;
    } catch (err) {
      console.warn('[Ads] Banner show failed:', err);
    }
  }

  async function hideBanner(): Promise<void> {
    if (!initialized || !admobModule) return;
    if (!bannerShowing) return;
    try {
      const { AdMob } = admobModule;
      await AdMob.hideBanner();
      bannerShowing = false;
    } catch (err) {
      console.warn('[Ads] Banner hide failed:', err);
    }
  }

  return { initialize, showInterstitial, showRewarded, showRevive, showDouble, preloadRewarded, preloadInterstitial, showBanner, hideBanner, isAvailable };
}
