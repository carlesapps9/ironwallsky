# Tasks: Security Vulnerability Remediation

**Input**: Design documents from `/specs/main/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: Not requested — this is a configuration/DevSecOps feature with no new runtime logic.

**Organization**: Tasks grouped by user story. US1 (npm overrides) must complete before US5 (CI gate) to avoid false failures. US2, US3, US4 are fully independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Baseline audit — confirm current vulnerability state before making changes.

- [x] T001 Run `npm audit --json > specs/main/audit-baseline.json` and verify 10 high-severity findings match research.md

**Checkpoint**: Baseline documented — implementation can begin

---

## Phase 2: Foundational

**Purpose**: No shared blocking infrastructure required for this feature — all user stories modify distinct files and can proceed independently after Phase 1.

> All user story phases can begin in parallel after T001 completes, with the exception that US5 must come after US1 (the npm audit CI gate will fail unless overrides are applied first).

---

## Phase 3: User Story 1 — npm Dependency Overrides (P1) 🎯 MVP

**Goal**: Suppress 7/10 high-severity CVEs (serialize-javascript, tar, minimatch, vite-plugin-pwa range) by adding `overrides` to `package.json` and fixing the installed-vs-declared version mismatch.

**Independent Test**: `npm audit --audit-level=high` exits 0 (or reports only the 3 unresolvable minimatch CVEs via `replace` if the scoped override doesn't cover all paths). `npm ci && npm run build` passes. `npm test` passes.

- [x] T002 [US1] Add `"overrides"` block to `package.json` with `"serialize-javascript": "^7.0.4"` and `"tar": "^7.5.11"` to patch build-time RCE and path-traversal CVEs
- [x] T003 [US1] Add scoped override `"replace>minimatch": "^5.1.0"` in `package.json` overrides to address the 3 minimatch ReDoS CVEs via the `@capacitor/assets` → `@trapezedev/project` → `replace` path
- [x] T004 [US1] Fix `vite-plugin-pwa` version range in `package.json` devDependencies from `"^0.21.0"` to `"^1.2.0"` to match installed version and eliminate the phantom `vite-plugin-pwa` high alert
- [ ] T005 [US1] Run `npm install` to apply overrides, then run `npm audit --audit-level=high` and confirm the count is either **0** (if the scoped minimatch override fully resolves all CVEs) or **≤ 3** scoped only to `replace/node_modules/minimatch` (accepted risk — `replace` is unmaintained, patterns are developer-controlled at build time); record the actual remaining count with full advisory details in `specs/main/audit-baseline.json`
- [ ] T006 [US1] Run `npm test` and `npm run build` to confirm overrides do not break Vitest unit/integration tests or the Vite production build; then run `npx cap ls` to verify the Capacitor Android project configuration remains valid after the `tar` and `serialize-javascript` overrides (satisfies NFR-SEC-02 — if Android SDK is available locally, also run `npm run sync:android` to confirm the full sync succeeds)

**Checkpoint**: npm audit passes at `--audit-level=high`, build and tests green — US1 complete

---

## Phase 4: User Story 2 — Dependabot Configuration (P2)

**Goal**: Enable automated dependency update PRs for npm and GitHub Actions ecosystems to prevent future vulnerability drift.

**Independent Test**: Push `.github/dependabot.yml` to a branch and confirm GitHub shows "Dependabot enabled" on the repo Security tab. Dependabot creates its first batch of PRs within 24 h of the weekly schedule trigger (or manually trigger via GitHub UI).

- [x] T007 [US2] Create `.github/dependabot.yml` with two ecosystems: **(1) npm** — weekly schedule, minor/patch updates grouped by type (production vs dev), Capacitor major-version updates ignored (requires manual planning per research.md §4); **(2) github-actions** — weekly schedule, major-version auto-merge disabled

**Checkpoint**: `.github/dependabot.yml` present with both ecosystems — US2 complete

---

## Phase 5: User Story 3 — CodeQL Code Scanning (P3)

**Goal**: Enable continuous static analysis of project JavaScript/TypeScript source for security vulnerabilities (XSS, prototype pollution, insecure randomness, regex injection).

**Independent Test**: Push `.github/workflows/codeql.yml` to a branch — the CodeQL action appears in the Actions tab and completes successfully. Confirm zero alerts on the initial scan (codebase was pre-verified clean in research.md §5).

- [ ] T009 [P] [US3] Create `.github/workflows/codeql.yml` that triggers on `push` to non-main branches, `pull_request` to main, and a weekly `schedule` cron; configure `language: javascript-typescript` with `build-mode: none`
- [ ] T010 [P] [US3] Set CodeQL job to use `actions/checkout@v4`, `github/codeql-action/init@v3`, `github/codeql-action/analyze@v3` with `category: /language:javascript-typescript`; add `concurrency` group to cancel in-progress duplicate runs

**Checkpoint**: CodeQL workflow file present, triggers defined — US3 complete

---

## Phase 6: User Story 4 — Content Security Policy (P4)

**Goal**: Add a CSP `<meta>` tag to `index.html` to prevent XSS and block unauthorized resource loading, while preserving Phaser's need for inline styles and the AdMob SDK's iframe/connect requirements.

**Independent Test**: `npm run build && npm run preview` — load the game locally, verify Phaser renders, no console CSP violations, service worker registers, ad adapter initializes (or gracefully fails if ad IDs not configured).

- [x] T011 [P] [US4] Add `<meta http-equiv="Content-Security-Policy">` tag inside `<head>` of `index.html` with the policy from research.md §6: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://pagead2.googlesyndication.com https://*.google.com https://*.doubleclick.net; frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; worker-src 'self'; font-src 'self'`
- [ ] T012 [US4] Run `npm run build` and open `dist/index.html` in a browser (or `npm run preview`) to verify zero CSP violation errors in DevTools console for Phaser canvas renderer, service worker script, and web manifest link

**Checkpoint**: CSP meta tag present, build passes, no Phaser console CSP errors — US4 complete

---

## Phase 7: User Story 5 — npm Audit CI Gate (P5)

**Goal**: Add `npm audit --audit-level=high` as a CI step so future high/critical vulnerabilities automatically fail the build before they can be merged to main.

**Independent Test**: Confirm CI workflow syntax is valid via `npx action-validator .github/workflows/ci.yml` or by pushing to a branch and verifying the lint-typecheck job completes with the new audit step visible in GitHub Actions logs.

> **Prerequisite**: US1 (T002–T006) must be merged first, otherwise this gate will fail on the existing overridden findings.

- [x] T013 [US5] Add `npm audit --audit-level=high` step to the `lint-typecheck` job in `.github/workflows/ci.yml`, positioned after `npm ci` and before the ESLint step, with name `"Security audit"` and a comment referencing the overrides in `package.json` for any remaining accepted-risk findings

**Checkpoint**: CI workflow includes audit gate, lint-typecheck job runs it — US5 complete

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and deferred work tracking.

- [x] T014 [P] Add a `## Security` section to `README.md` documenting: (a) how to run `npm audit`, (b) the accepted-risk minimatch CVEs and why they're low-risk, (c) that Capacitor 8 upgrade is planned to fully resolve the tar CVEs
- [x] T015 [P] Create `specs/main/tasks-capacitor8-upgrade.md` as a planning stub for the deferred Capacitor 6 → 8 major version upgrade (FR-SEC-02), listing the companion package upgrades required: `@capacitor/core`, `@capacitor/android`, `@capacitor/splash-screen`, `@capacitor-community/admob` all → v8; Android `variables.gradle` SDK version bump; full CI + Android build validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: N/A — no shared blocking infrastructure
- **Phase 3 (US1)**: Depends on Phase 1; must complete before Phase 7 (US5)
- **Phase 4 (US2)**: Independent — can run in parallel with US1, US3, US4
- **Phase 5 (US3)**: Independent — can run in parallel with US1, US2, US4
- **Phase 6 (US4)**: Independent — can run in parallel with US1, US2, US3
- **Phase 7 (US5)**: Depends on Phase 3 (US1) completion
- **Phase 8 (Polish)**: Can start any time; not blocking any other phase

### User Story Dependencies

```
T001 (baseline)
  └── T002–T006 (US1: npm overrides)   ←── must complete first
        └── T013 (US5: CI gate)

  └── T007 (US2: Dependabot)            ← parallel, anytime after T001
  └── T009–T010 (US3: CodeQL)          ← parallel, anytime after T001
  └── T011–T012 (US4: CSP)             ← parallel, anytime after T001
  └── T014–T015 (Polish)               ← parallel, anytime
```

### Parallel Opportunities

All P-marked tasks modify separate files and have no intra-phase dependencies:
- T007 covers both npm and github-actions ecosystems in a single file creation (T008 merged into T007)
- T009 and T010 are both parts of the same CodeQL workflow file — write together
- T011 and T012 are write + verify steps — sequential within US4
- T014 and T015 are independent documentation tasks

---

## Parallel Execution Example: MVP (US1 only)

```bash
# 1. Baseline
npm audit --json > specs/main/audit-baseline.json

# 2. Edit package.json (T002 + T003 + T004 in one edit)
#    - Add overrides block: serialize-javascript, tar, replace>minimatch
#    - Fix vite-plugin-pwa range: ^0.21.0 → ^1.2.0

# 3. Apply and verify
npm install
npm audit --audit-level=high   # T005 — must exit 0 or ≤3 accepted
npm test                        # T006
npm run build                   # T006
```

---

## Implementation Strategy

**MVP Scope**: Phase 3 (US1) alone delivers the highest value — resolves 7/10 CVEs and fixes the version range mismatch. All other phases add defence-in-depth but don't change the runtime application.

**Recommended delivery order**:
1. US1 (T002–T006) — merge immediately, unblocks US5 and reduces noise
2. US2 + US3 + US4 in parallel (separate PRs, independent files)
3. US5 (T013) — merge after US1 is on main
4. Polish (T014–T015) — low priority, can be deferred

**Total tasks**: 14 (T008 merged into T007)
- US1: 5 tasks | US2: 1 task | US3: 2 tasks | US4: 2 tasks | US5: 1 task | Polish: 2 tasks | Setup: 1 task
