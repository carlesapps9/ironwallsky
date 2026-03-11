# Data Model: Security Vulnerability Remediation

**Date**: 2026-03-11 | **Spec**: [spec.md](spec.md)

## Entities

This feature is a dependency maintenance / DevSecOps feature. It does not introduce new runtime entities or modify the game's data model. The "entities" below describe the configuration artifacts that will be created or modified.

### DependabotConfig

**File**: `.github/dependabot.yml`

| Field | Type | Description |
|-------|------|-------------|
| version | int | Schema version (2) |
| updates[] | array | List of ecosystem update configurations |
| updates[].package-ecosystem | string | `npm` or `github-actions` |
| updates[].directory | string | Path to package manifest (`/`) |
| updates[].schedule.interval | string | `weekly` |
| updates[].groups | object | Grouping rules for PRs |

### CodeQLWorkflow

**File**: `.github/workflows/codeql.yml`

| Field | Type | Description |
|-------|------|-------------|
| triggers | push, pull_request, schedule | When scanning runs |
| language | javascript-typescript | Analysis target |
| build-mode | none | No build needed for JS/TS |

### CSPPolicy

**File**: `index.html` (meta tag)

| Directive | Value | Rationale |
|-----------|-------|-----------|
| default-src | 'self' | Restrict all resources to same origin by default |
| script-src | 'self' | No inline scripts, no eval |
| style-src | 'self' 'unsafe-inline' | Phaser injects inline styles |
| img-src | 'self' data: blob: | Phaser uses data URIs and blob URLs for textures |
| connect-src | 'self' + ad domains | Allow ad network and analytics requests |
| frame-src | ad domains | Allow ad iframes |
| worker-src | 'self' | Service worker |
| font-src | 'self' | Local fonts only |

### NpmOverrides

**File**: `package.json` (overrides section)

| Override | Version | Scope |
|----------|---------|-------|
| serialize-javascript | ^7.0.4 | Global — forces patched version for workbox-build chain |
| tar | ^7.5.11 | Global — forces latest patch for all consumers |

## State Transitions

N/A — no runtime state changes.

## Validation Rules

- `npm audit --audit-level=high` must exit 0 after all remediations.
- All CI gates must continue to pass after dependency upgrades.
- Capacitor Android build must succeed if Capacitor 8 upgrade is performed.

## Relationships

```
package.json
  ├── overrides (serialize-javascript, tar)
  ├── devDependencies (@capacitor/cli, @capacitor/assets, vite-plugin-pwa)
  └── dependencies (@capacitor/core, @capacitor/android, @capacitor-community/admob)

.github/
  ├── dependabot.yml (NEW)
  └── workflows/
      ├── ci.yml (MODIFIED — add npm audit step)
      └── codeql.yml (NEW)

index.html (MODIFIED — add CSP meta tag)
```
