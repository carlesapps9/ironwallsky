# Capacitor 6 → 8 Upgrade — Planning Stub

> **Status:** Deferred — this stub captures scope for future planning.
> **Motivation:** Fully resolve moderate `tar` CVEs (GHSA-xxx) that remain after the Capacitor 6 lockfile. See `specs/main/tasks.md` FR-SEC-02.

## Scope

The following packages must all be upgraded in lockstep (Capacitor uses a monorepo versioning strategy — all core packages must share the same major):

| Package | Current | Target |
|---|---|---|
| `@capacitor/core` | ^6.x | ^8.x |
| `@capacitor/android` | ^6.x | ^8.x |
| `@capacitor/splash-screen` | ^6.x | ^8.x |
| `@capacitor-community/admob` | ^5.x | compatible with Cap 8 |

## Required steps (not yet broken into tasks)

1. **Research** — confirm `@capacitor-community/admob` has a Cap 8-compatible release and note breaking changes.
2. **Bump packages** — update `package.json` dependencies, run `npm install`, resolve peer conflicts.
3. **Android SDK update** — update `android/variables.gradle` `compileSdkVersion` / `targetSdkVersion` per Capacitor 8 requirements.
4. **Run Capacitor sync** — `npx cap sync android` to regenerate native bridge files.
5. **CI validation** — confirm `android-release.yml` build succeeds end-to-end with new Capacitor version.
6. **Audit gate** — run `npm audit` to confirm `tar` CVEs are resolved.
7. **Remove npm overrides** — once upstream packages ship patched versions, remove the `overrides.tar` entry from `package.json`.

## Acceptance criteria

- `npm audit --audit-level=moderate` returns 0 findings.
- Android release CI produces a valid signed AAB.
- All unit + integration tests pass.
- `@capacitor-community/admob` ad loading verified on device/emulator.
