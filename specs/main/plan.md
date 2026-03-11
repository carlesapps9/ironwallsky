# Implementation Plan: Security Vulnerability Remediation

**Branch**: `main` | **Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/main/spec.md`

## Summary

Remediate 10 high-severity npm dependency vulnerabilities identified by npm audit (proxy for Dependabot findings), add proactive security infrastructure (Dependabot config, CodeQL scanning, CSP headers, npm audit CI gate), and plan Capacitor 8 upgrade to resolve remaining transitive vulnerabilities.

## Technical Context

**Language/Version**: TypeScript 5.6, ES2022 target  
**Primary Dependencies**: Phaser 3.80, Capacitor 6.2, vite-plugin-pwa 1.2  
**Storage**: localStorage + IndexedDB (client-side only)  
**Testing**: Vitest (unit/integration), Playwright (e2e)  
**Target Platform**: Web (PWA) + Android (Capacitor)  
**Project Type**: Mobile game (PWA + native wrapper)  
**Performance Goals**: 60 fps, ≤150 kB compressed initial load  
**Constraints**: Offline-capable, zero server infrastructure, touch-first mobile UX  
**Scale/Scope**: Single developer, ~15 source files, 6 dependencies, 8 devDependencies

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| III | Minimal Dependencies | ✅ PASS | No new runtime dependencies. npm overrides only affect build-time transitive deps |
| III | Performance Budgets | ✅ PASS | No bundle size impact — changes are config/package.json only |
| V | Offline-First | ✅ PASS | PWA functionality preserved; vite-plugin-pwa version range fix only |
| VI | CI Gates | ✅ PASS | Adding new gate (npm audit) strengthens CI; existing gates unchanged |
| IX | Minimal Ops | ✅ PASS | No new server infrastructure; all changes are static config |

**Post-Phase-1 Re-check**: All gates continue to pass. CSP addition (FR-SEC-06) needs testing to confirm Phaser compatibility but doesn't add dependencies or infrastructure.

## Vulnerability Summary

| # | Package | Installed | Severity | CVE Count | Attack Surface | Fix |
|---|---------|-----------|----------|-----------|---------------|-----|
| 1 | serialize-javascript | 6.0.2 | HIGH | 1 (RCE) | Build-time only | npm override → ^7.0.4 |
| 2 | tar | 6.2.1 | HIGH | 6 (path traversal) | Dev CLI tool | npm override → ^7.5.11; full fix = Capacitor 8 |
| 3 | minimatch | 3.0.5 | HIGH | 3 (ReDoS) | Build-time only | No upstream fix; accept risk + monitor |
| 4 | vite-plugin-pwa | 1.2.0 | HIGH | 1 (via workbox-build) | Build-time only | npm override covers serialize-javascript |

**Key finding**: All 10 vulnerabilities are in **build-time/dev-time** transitive dependencies. None affect the runtime application delivered to users. Risk is limited to developer machines and CI runners processing untrusted packages.

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 configuration artifacts model
├── quickstart.md        # Phase 1 implementation guide
├── contracts/
│   └── ci-security-gates.md  # Security gate contracts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code Changes

```text
# Files to MODIFY
package.json                          # Add overrides, fix vite-plugin-pwa range
index.html                            # Add CSP meta tag
.github/workflows/ci.yml             # Add npm audit step

# Files to CREATE
.github/dependabot.yml                # Dependabot configuration
.github/workflows/codeql.yml         # CodeQL code scanning workflow
```

**Structure Decision**: All changes are configuration-level. No new source directories or modules. Existing project structure is unchanged.

## Complexity Tracking

No constitution violations. All changes are configuration-level with zero new runtime dependencies.
