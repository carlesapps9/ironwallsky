# Quickstart — Iron Wall Sky

**Branch**: `001-sky-defense-core` | **Date**: 2026-02-28 | **Phase**: 1

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 LTS | Runtime |
| npm | ≥ 9 | Package manager |
| Git | ≥ 2.40 | Version control |
| Android Studio | Latest | Capacitor Android builds (optional) |
| Xcode | ≥ 15 | Capacitor iOS builds (optional, macOS only) |

---

## 1. Clone & Install

```bash
git clone <repo-url> IronwallSky
cd IronwallSky
npm install
```

### Key Dependencies

```jsonc
// package.json (expected)
{
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^6.x",
    "vitest": "^3.x",
    "@playwright/test": "^1.x",
    "vite-plugin-pwa": "^0.x"    // Workbox-powered SW generation
  },
  "dependencies": {
    "phaser": "^3.80.x",         // Custom build recommended
    "@capacitor/core": "^6.x",
    "@capacitor/cli": "^6.x",
    "@capacitor-community/admob": "^6.x"
  }
}
```

---

## 2. Project Configuration

### TypeScript — `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@core/*": ["./src/core/*"],
      "@adapters/*": ["./src/adapters/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

### Vite — `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,mp3,ogg}'],
      },
      manifest: {
        name: 'Iron Wall Sky',
        short_name: 'IronWallSky',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
      },
    }),
  ],
  optimizeDeps: {
    include: ['phaser'],  // Pre-bundle Phaser for fast dev cold start
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],  // Isolate Phaser into its own chunk
        },
      },
    },
  },
});
```

### Capacitor — `capacitor.config.ts`

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ironwallsky.game',
  appName: 'Iron Wall Sky',
  webDir: 'dist',
  // Dev only — remove before shipping:
  // server: { url: 'http://YOUR_LOCAL_IP:5173', cleartext: true },
};

export default config;
```

---

## 3. Development Workflow

### Start Dev Server

```bash
npm run dev          # vite dev → http://localhost:5173
```

Open in browser (portrait mobile viewport via DevTools device emulation).

### Run Tests

```bash
npm run test         # vitest run (unit + integration)
npm run test:watch   # vitest --watch
npm run test:e2e     # playwright test (requires build first)
```

### Build for Production

```bash
npm run build        # vite build → dist/
npm run preview      # vite preview → local production preview
```

### Build for Android

```bash
npm run build
npx cap sync android
npx cap open android   # Opens Android Studio
# Build APK/AAB from Android Studio
```

### Build for iOS (macOS only)

```bash
npm run build
npx cap sync ios
npx cap open ios       # Opens Xcode
# Build IPA from Xcode
```

---

## 4. Directory Convention

```text
src/core/       → Pure deterministic logic. NO Phaser, NO browser APIs.
src/adapters/   → Phaser rendering, audio, ads, storage, analytics.
```

**Enforcement**: A CI lint rule (or ESLint plugin) should flag any import
of `phaser`, `document`, `window`, `navigator`, or `localStorage` inside
`src/core/**`. The core must only depend on plain TypeScript types.

---

## 5. npm Scripts (Expected)

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest --watch",
    "test:e2e": "npx playwright test",
    "lint": "eslint src/ tests/",
    "check:bundle": "vite build && echo 'Check dist/ size manually or via CI script'"
  }
}
```

---

## 6. First Run Checklist

1. `npm install` — no errors
2. `npm run dev` — Vite starts, browser shows blank canvas or boot scene
3. `npm run test` — all unit tests pass (0 tests initially is OK)
4. `npm run build` — `dist/` created, check total compressed size
5. `npx cap sync android` (optional) — Capacitor syncs without errors
6. Open Android emulator or connect device → app runs in WebView

---

## 7. Environment Notes

### Service Worker

- **Web (browser)**: Registered automatically by `vite-plugin-pwa`.
- **Capacitor (native)**: **Skip SW registration** — assets are bundled
  locally by Capacitor. Detect via `Capacitor.isNativePlatform()`.

### Ads

- **Dev/test**: Ads are disabled. Use AdMob test ad unit IDs.
- **Production (native)**: `@capacitor-community/admob` with real ad units.
- **Production (web)**: Google Ad Manager GPT tag.

### Phaser Config

```typescript
const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,                          // WebGL with Canvas fallback
  width: 360,                                  // Base width (portrait)
  height: 640,                                 // Base height (portrait)
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    smoothStep: false,                         // Raw deltas for fixed timestep
  },
  render: {
    pixelArt: true,                            // Nearest-neighbor scaling
    failIfMajorPerformanceCaveat: false,       // Allow weak WebGL devices
  },
  scene: [BootScene, PlayScene, GameOverScene],
};
```
