# Quickstart: Playability, Engagement & Monetization Improvements

**Date**: 2026-03-28

## Prerequisites

- Node.js 18+, npm 9+
- Android Studio (for Android builds)
- Existing `.env` with AdMob ad unit IDs

## New Environment Variables

Add to `.env`:

```
VITE_ADMOB_BANNER_ANDROID=ca-app-pub-XXXXX/XXXXX
VITE_ADMOB_BANNER_IOS=ca-app-pub-XXXXX/XXXXX
```

## Development

```bash
npm run dev          # Start Vite dev server at localhost:5173
npm test             # Run all 120+ Vitest tests
npx tsc --noEmit     # Type-check
```

## Implementation Order

### Phase A: Core Engine Changes (no visual changes)

1. **Add `bestComboMultiplier` to Run entity** — `entities.ts`, `engine.ts`
2. **Add streak bonus logic** — `engine.ts` step() transition
3. **Add `grantBonusLife()` method** — `engine.ts`
4. **Add `recoverStreak()` method** — `engine.ts`
5. **Add new events** — `events.ts` (streak-bonus-applied, streak-recovered)
6. **Unit tests** — scoring.test.ts, engine.test.ts

### Phase B: Playability (visual only, no monetization)

7. **Enemy type tints** — play-scene.ts enemy-spawned handler
8. **Speeder spawn warning** — play-scene.ts
9. **Wave labels** — play-scene.ts difficulty-increased handler
10. **Tap-to-move** — play-scene.ts input handler

### Phase C: Engagement UI

11. **Streak display on game-over** — gameover-scene.ts
12. **Streak bonus HUD notification** — hud.ts
13. **Session stats on game-over** — gameover-scene.ts (bestCombo, wave)

### Phase D: Monetization

14. **AdService banner interface** — ad-adapter.ts
15. **Native banner implementation** — native-ad-adapter.ts
16. **Web banner simulation** — web-ad-adapter.ts
17. **Banner on game-over screen** — gameover-scene.ts
18. **Streak recovery rewarded ad** — gameover-scene.ts
19. **Pre-run extra life ad** — gameover-scene.ts

### Phase E: Integration & Release

20. **Integration tests** — streak.test.ts
21. **Full validation** — tsc, tests, build, cap sync, bundleRelease
22. **Version bump & release**

## Build & Release

```bash
npm run build                          # Production build
npx cap sync android                   # Sync to Android
cd android && ./gradlew bundleRelease  # Build AAB
```

AAB output: `android/app/build/outputs/bundle/release/app-release.aab`

## Testing New Features

- **Streak bonus**: Set `dailyStreak = 5` in localStorage, start a run → see "+500 streak bonus"
- **Enemy tints**: Play past wave 3 → drifters appear blue; wave 6 → armored orange; wave 10 → speeders red
- **Wave labels**: Watch for "WAVE N" flash on difficulty increases
- **Banner ad**: Die → game-over screen shows banner at bottom (native) or simulated (web)
- **Streak recovery**: Set `dailyStreak = 5, lastPlayedDate = 3 days ago` → see streak recovery offer
