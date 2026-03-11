# Contract: CI Security Gates

**Date**: 2026-03-11

## Purpose

Defines the security gate contract that all PRs to main must satisfy, complementing the existing CI gates defined in the constitution.

## Gate: npm audit

| Property | Value |
|----------|-------|
| Trigger | Every PR to main, every push to non-main branches |
| Audit level | `high` |
| Exit code 0 required | Yes |
| Allowed exceptions | None (use overrides to suppress known false positives) |

## Gate: CodeQL

| Property | Value |
|----------|-------|
| Trigger | PR to main, push to main, weekly schedule |
| Languages | javascript-typescript |
| Severity threshold | Error-level findings block merge |
| Alert dismissal | Requires documented justification |

## Gate: Dependabot

| Property | Value |
|----------|-------|
| Ecosystems | npm, github-actions |
| Schedule | Weekly |
| Auto-merge | Patch updates only (if CI passes) |
| Major versions | Manual review required |

## CSP Contract

| Directive | Allowed Sources | Rationale |
|-----------|----------------|-----------|
| script-src | 'self' | All JS is bundled by Vite; no CDN scripts |
| style-src | 'self' 'unsafe-inline' | Phaser injects inline styles |
| connect-src | 'self', ad/analytics domains | XHR/fetch to same origin + ad networks |
| frame-src | ad domains | Ad SDK iframes |
| default-src | 'self' | Baseline restriction |
