# Quickstart: Security Vulnerability Remediation

**Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)

## Prerequisites

- Node.js 20+
- npm 10+
- Git
- GitHub repository admin access (for Dependabot and code scanning settings)
- (Optional) Android SDK + JDK 21 if verifying Capacitor upgrade

## Implementation Order

### Step 1: Apply npm overrides (LOW RISK)

Add `overrides` to `package.json` to force patched versions of transitive dependencies:

```json
{
  "overrides": {
    "serialize-javascript": "^7.0.4",
    "tar": "^7.5.11"
  }
}
```

Then run `npm install` and verify with `npm audit`.

### Step 2: Fix vite-plugin-pwa version range

Update `package.json` to match installed version:
```diff
- "vite-plugin-pwa": "^0.21.0"
+ "vite-plugin-pwa": "^1.2.0"
```

### Step 3: Add Dependabot config

Create `.github/dependabot.yml` — no code changes, just a YAML config file.

### Step 4: Add CodeQL workflow

Create `.github/workflows/codeql.yml` — no code changes, just a YAML workflow file.

### Step 5: Add CSP to index.html

Add a single `<meta>` tag. Test that:
- Game loads and runs normally
- Phaser renders correctly
- Service worker registers
- Ads load (if testing with real ad units)

### Step 6: Add npm audit CI gate

Add one step to `.github/workflows/ci.yml` in the lint-typecheck job.

### Step 7: (Deferred) Capacitor 8 upgrade

This is a major version upgrade affecting multiple packages and the Android project. It should be planned as a separate feature branch with dedicated testing.

## Verification

```bash
# Check all vulnerabilities are addressed
npm audit

# Run existing tests
npm test

# Build and verify
npm run build

# Check bundle size hasn't changed
du -sh dist/
```

## Rollback

All changes are in configuration files and `package.json`. Revert the commit to roll back.
