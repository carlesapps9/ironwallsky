# Research: Security Vulnerability Remediation

**Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)

## 1. serialize-javascript RCE (GHSA-5c6j-r48x-rmvq)

**Decision**: Upgrade `vite-plugin-pwa` from `^0.21.0` to `^1.2.0` (already installed as 1.2.0 but package.json range is wrong).

**Rationale**: `vite-plugin-pwa@1.2.0` uses `workbox-build@7.4.0` which depends on `@rollup/plugin-terser@0.4.4` → `serialize-javascript@6.0.2` (still vulnerable ≤7.0.2). The `vite-plugin-pwa` team has not yet bumped workbox to a version with `serialize-javascript@7.0.4`. However:
- The vulnerability (RCE via `RegExp.flags` / `Date.prototype.toISOString()`) requires an attacker to control the serialized input. In this project, `serialize-javascript` is only used at **build time** by Rollup's terser plugin to serialize worker code; it never runs at runtime in the browser or processes user input.
- **Risk assessment: LOW** — build-time-only, developer-controlled input.
- **Mitigation**: Add an `overrides` entry in `package.json` to force `serialize-javascript@^7.0.4`, and monitor vite-plugin-pwa for an upstream fix.

**Alternatives considered**:
- Downgrade to `vite-plugin-pwa@0.19.8`: breaks Vite 6 compatibility.
- Remove vite-plugin-pwa: loses PWA support (violates Constitution §V).
- Wait for upstream fix: acceptable since build-time-only risk, but override is proactive.

## 2. node-tar Path Traversal (6 CVEs)

**Decision**: Upgrade `@capacitor/cli` from `^6.2.1` to `^8.2.0` and `@capacitor/core` + related packages to v8.

**Rationale**: `@capacitor/cli@6.2.1` depends on `tar@6.2.1` which has 6 high-severity path traversal/symlink poisoning CVEs. Capacitor CLI v8.2.0 uses `tar@^7.5.3` which resolves all fixed CVEs. Additional override for `tar@^7.5.11` covers the remaining GHSA-qffp-2rhf-9h96 and GHSA-9ppj-qmqm-q256 advisories.

**Risk assessment: MEDIUM** — tar is used by Capacitor CLI during `cap sync/add` operations (dev/CI-time), not at runtime. But path traversal in tar extraction could be exploited if malicious plugin packages are processed.

**Required companion upgrades for Capacitor 8**:
- `@capacitor/core` → `^8.0.0`
- `@capacitor/android` → `^8.0.0`
- `@capacitor/splash-screen` → `^8.0.0`
- `@capacitor-community/admob` → `^8.0.0` (major version, check API compat)
- `@capacitor/assets` (devDep) → check for v4+ compatible with CLI 8
- Android: update `variables.gradle` for Capacitor 8 SDK requirements

**Alternatives considered**:
- npm overrides for tar only: may break Capacitor CLI internal operations if API changed between tar 6→7.
- Stay on Capacitor 6: leaves 6 unpatched CVEs in development tooling. Acceptable short-term but not recommended.
- Capacitor 7: stepping stone available but v8 is current stable.

## 3. minimatch ReDoS (3 CVEs in ≤3.1.3)

**Decision**: Apply npm override for `minimatch@^5.0.0` scoped to `replace` package path. Monitor upstream `@trapezedev/project` for update.

**Rationale**: `minimatch@3.0.5` is pulled by `replace@1.2.2` → `@trapezedev/project@7.1.3` → `@capacitor/assets@3.0.5`. The `replace` package is unmaintained (last publish 2022). The ReDoS vulnerabilities could cause CPU exhaustion if an attacker controls glob patterns, but in this project the patterns are hardcoded at build time.

**Risk assessment: LOW** — build-time-only, developer-controlled patterns.

**Alternatives considered**:
- Fork `@trapezedev/project`: too much maintenance overhead for a dev tool.
- Override minimatch globally: could break eslint and other tools using minimatch v3 correctly.
- Scoped override in `package.json`: clean, contained, and doesn't affect other consumers.

## 4. Dependabot Configuration

**Decision**: Add `.github/dependabot.yml` with npm and GitHub Actions ecosystems.

**Rationale**: The project currently has no automated dependency update mechanism. Dependabot will:
- Create PRs for security updates automatically.
- Group minor/patch updates to reduce PR noise.
- Run weekly scans for both npm packages and GitHub Actions versions.

**Configuration**:
- npm updates: weekly, grouped by dependency type (production vs dev).
- GitHub Actions: weekly, all version updates.
- Ignore major version bumps for Capacitor (require manual planning).

## 5. CodeQL Code Scanning

**Decision**: Add `.github/workflows/codeql.yml` for JavaScript/TypeScript analysis.

**Rationale**: The project has no static analysis for security vulnerabilities in its own code. CodeQL catches:
- XSS via DOM manipulation
- Prototype pollution
- Insecure randomness usage
- Path traversal in file operations
- Regex injection

The codebase scan found no current vulnerabilities (no innerHTML, eval, document.write usage), but continuous scanning prevents regressions.

**Configuration**: Run on PRs to main and weekly scheduled scan.

## 6. Content Security Policy

**Decision**: Add CSP meta tag to `index.html`.

**Rationale**: The app currently has no CSP. While the game is a static PWA with no server-side rendering, a CSP provides defense-in-depth against XSS if a dependency is compromised.

**Proposed policy**:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://pagead2.googlesyndication.com https://*.google.com; frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; worker-src 'self'; font-src 'self'
```

Note: `'unsafe-inline'` for styles is required because Phaser injects inline styles. Script CSP is strict (`'self'` only) since Vite bundles all JS.

## 7. npm audit CI Gate

**Decision**: Add `npm audit --audit-level=high` to CI workflow.

**Rationale**: Currently the CI workflow checks lint, types, tests, and bundle size, but does not check for known vulnerabilities. Adding an audit step ensures new high/critical vulnerabilities fail the build.

**Implementation**: Add as a step in the existing lint-typecheck job (fastest gate). Use `--audit-level=high` to avoid blocking on moderate/low findings that may not have fixes available.

**Alternative**: Use a dedicated security scanning action (e.g., `snyk`, `socket-security`). Rejected because npm audit is zero-dependency and sufficient for this project's scale.

## 8. Exposed AdMob App ID in AndroidManifest.xml

**Decision**: Accept as non-issue — AdMob App IDs are intentionally public.

**Rationale**: The AdMob App ID `ca-app-pub-1616644616833222~9015068869` in `AndroidManifest.xml` is not a secret. It's required to be in the manifest for the Google Mobile Ads SDK to initialize. Ad Unit IDs are loaded from environment variables at build time. The `.env` file containing actual configuration values is properly gitignored and confirmed not tracked by git.

## 9. Keystore Credentials

**Decision**: Accept current handling — properly secured.

**Rationale**: `android/keystore.properties` is gitignored, `*.jks` and `*.keystore` are gitignored, and an `.example` file with placeholder values is provided. The CI workflow uses GitHub Secrets for keystore credentials. No action needed.
