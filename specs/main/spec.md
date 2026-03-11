# Feature Spec: Security Vulnerability Remediation

**Date**: 2026-03-11 | **Branch**: `main`

## Problem Statement

GitHub Dependabot and npm audit have identified **10 high-severity vulnerabilities** across project dependencies. Additionally, the project lacks proactive code scanning (CodeQL) and a Dependabot configuration file, leaving it exposed to future supply-chain risks. These issues must be reviewed, prioritized, and mitigated to maintain a secure software supply chain.

## Requirements

### FR-SEC-01: Remediate serialize-javascript RCE (HIGH)

Add `"serialize-javascript": "^7.0.4"` to the `overrides` block in `package.json` to force the patched version through the `vite-plugin-pwa` → `workbox-build` → `@rollup/plugin-terser` chain. Simultaneously, correct the `vite-plugin-pwa` devDependency range from `"^0.21.0"` to `"^1.2.0"` to match the installed version. **Accepted risk**: the vulnerability is build-time-only with developer-controlled input; no runtime exposure to end users.

### FR-SEC-02: Remediate node-tar path traversal vulnerabilities (HIGH)

Address 6 CVEs in `tar@6.2.1` (via `@capacitor/cli`).

- **Immediate mitigation**: add `"tar": "^7.5.11"` to the `overrides` block in `package.json`.
- **Full resolution (deferred)**: upgrade Capacitor CLI from v6 to v8, which natively depends on `tar@^7.5.3+`. Requires companion upgrades of `@capacitor/core`, `@capacitor/android`, `@capacitor/splash-screen`, and `@capacitor-community/admob`. Tracked as a separate feature stub (T015).

**Accepted risk during mitigation period**: `tar` is used only by Capacitor CLI at dev/CI time; it is never executed at runtime in the browser or on users' devices.

### FR-SEC-03: Remediate minimatch ReDoS vulnerabilities (HIGH)

Apply a scoped override `"replace>minimatch": "^5.1.0"` in `package.json` to break the `@capacitor/assets` → `@trapezedev/project` → `replace` → `minimatch@3.0.5` chain.

**Acceptance criteria**: after `npm install`, `npm audit --audit-level=high` reports either:
- **0 high-severity findings** (scoped override fully effective), or
- **≤ 3 high-severity findings** scoped only to `replace/node_modules/minimatch` (accepted risk — `replace` is unmaintained, patterns are hardcoded at build time under developer control).

Document the actual remaining count in `specs/main/audit-baseline.json`.

### FR-SEC-04: Enable GitHub Dependabot alerts

Add `.github/dependabot.yml` to enable automated dependency update PRs for npm and GitHub Actions ecosystems.

### FR-SEC-05: Enable GitHub CodeQL code scanning

Add a CodeQL workflow to `.github/workflows/` for JavaScript/TypeScript static analysis on PRs and pushes.

### FR-SEC-06: Add Content Security Policy

Add a CSP meta tag to `index.html` restricting script sources, preventing inline scripts (except Vite-generated), and blocking unsafe eval.

### FR-SEC-07: Audit npm audit CI gate

Add an `npm audit --audit-level=high` step to the CI workflow to fail builds on new high/critical vulnerabilities.

## Non-Functional Requirements

- NFR-SEC-01: All dependency upgrades must pass existing CI gates (tests, lint, build, bundle size).
- NFR-SEC-02: Capacitor upgrade (if performed) must maintain Android build compatibility.
- NFR-SEC-03: No new runtime dependencies introduced for security fixes.

## Requirement → Task Traceability

| Requirement | User Story | Task IDs | Notes |
|------------|-----------|----------|-------|
| FR-SEC-01 | US1 | T002, T004, T005, T006 | npm override + version-range correction |
| FR-SEC-02 | US1 (partial) | T002, T015 | Override immediate; Capacitor 8 deferred |
| FR-SEC-03 | US1 | T003, T005 | Scoped override; acceptance per A1 criteria |
| FR-SEC-04 | US2 | T007 | `.github/dependabot.yml` |
| FR-SEC-05 | US3 | T009, T010 | `.github/workflows/codeql.yml` |
| FR-SEC-06 | US4 | T011, T012 | CSP meta tag in `index.html` |
| FR-SEC-07 | US5 | T013 | npm audit step in `ci.yml` (depends on US1) |
| NFR-SEC-01 | US1 | T006 | Web build + Vitest tests |
| NFR-SEC-02 | US1 | T006 | Android Capacitor sync verification |
| NFR-SEC-03 | US1 | — | Satisfied by design (overrides only) |

## Out of Scope

- Android-specific security hardening (ProGuard rules, network security config) — separate feature.
- Runtime application security monitoring (WAF, RASP).
- Penetration testing.
