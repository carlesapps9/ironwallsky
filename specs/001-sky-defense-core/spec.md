# Feature Specification: Iron Wall Sky

**Feature Branch**: `001-sky-defense-core`
**Created**: 2026-02-28
**Status**: Draft
**Input**: User description: "Build a defense game, where player shoots to enemies falling from the sky. A minimal, highly replayable game optimized for organic traffic (short, clip-friendly runs), ads-first monetization, and low operational overhead."

## Clarifications

### Session 2026-02-28

- Q: How does the player move horizontally? → A: Player slides horizontally by dragging; aim is always straight up.
- Q: What collision model for hit detection? → A: Per-sprite pixel-perfect collision.
- Q: How many rewarded-ad continues per run? → A: 1 continue per run maximum.
- Q: How should remaining lives be displayed? → A: Row of heart/shield icons (one removed per breach).
- Q: Max simultaneous enemies on screen? → A: 40.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Core Gameplay Loop (Priority: P1)

A player opens the game on their phone and is playing within seconds. Enemies
fall from the top of the screen in portrait orientation. The player slides
horizontally by dragging on the screen, and the weapon fires straight up
automatically at a steady rate — no aiming or fire input is required.
Each destroyed enemy awards points. As the run progresses, enemies appear
faster, move in varied patterns, and take more hits to destroy. The run ends
when a configurable number of enemies reach the bottom (the "defense line").
The player sees their final score, their personal best, and can instantly
retry with a single tap.

**Why this priority**: Without a playable shoot-and-defend loop there is no
game. This is the minimum slice that delivers entertainment value and validates
the core concept.

**Independent Test**: Launch the game, drag to move, observe auto-fire
straight up, position under falling enemies, survive until game over, see
score, tap to retry — all without network, audio, or ads.

**Acceptance Scenarios**:

1. **Given** the game is loaded,
   **When** the player taps "Play" (or the game auto-starts),
   **Then** enemies begin falling from the top of the screen within 1 second.

2. **Given** gameplay is active,
   **When** the player drags horizontally on the screen,
   **Then** the player character slides left or right to follow the touch,
   clamped to the visible screen bounds.

3. **Given** gameplay is active,
   **When** the auto-fire timer elapses,
   **Then** a projectile fires straight up from the player's current
   horizontal position with visible feedback (flash, animation).

4. **Given** a projectile collides with an enemy,
   **When** the collision is detected,
   **Then** the enemy is destroyed with visual feedback, the score increases,
   and any remaining projectile continues or disappears based on type.

5. **Given** an enemy reaches the defense line,
   **When** it crosses the threshold,
   **Then** visual feedback indicates a "breach," a heart/shield icon is
   removed from the life row, and when all icons are gone the run ends.

6. **Given** the run has ended (game over),
   **When** the game-over screen is displayed,
   **Then** the player sees: final score, personal best score, and a
   prominently placed "Retry" button that restarts gameplay with one tap
   (≤ 1 interaction from game over to playing again).

7. **Given** the player is mid-run,
   **When** more time elapses,
   **Then** difficulty scales: enemies spawn more frequently, move faster, and/or
   require additional hits, creating escalating challenge curve.

---

### User Story 2 — Offline & Installable Experience (Priority: P2)

A player discovers the game via a shared clip or search result, plays it in
the browser, then adds it to their home screen. On subsequent visits — even
without internet — the game loads instantly and is fully playable. Scores
persist between sessions. If the player goes offline mid-session nothing
breaks; the only degraded features are ads and optional telemetry.

**Why this priority**: Offline reliability and installability are force
multipliers for organic growth — players can share confidently, and the
home-screen icon drives repeat engagement without paid acquisition.

**Independent Test**: Install the PWA, enable airplane mode, open the game,
play a full run, see persisted high score, close and reopen — all without
network.

**Acceptance Scenarios**:

1. **Given** the player has visited the game once (assets cached),
   **When** they open the game with no network connection,
   **Then** the game loads and is fully playable with no error banners.

2. **Given** the player is on a supported mobile browser,
   **When** prompted (or via browser menu),
   **Then** they can install the game to their home screen and it opens in
   standalone mode in portrait orientation.

3. **Given** the player achieves a high score,
   **When** they close and later reopen the game (online or offline),
   **Then** their personal best score is preserved.

4. **Given** the player is mid-run and the network drops,
   **When** the game detects connectivity loss,
   **Then** gameplay continues without interruption; any pending analytics
   or ad requests silently fail without affecting the experience.

---

### User Story 3 — Score Chasing & Clip-Friendly Runs (Priority: P3)

A player completes a run and wants to beat their own score. Each run is short
enough (target: 45–120 seconds) that retrying feels low-commitment. The
escalating difficulty curve ensures skilled players get visibly higher scores,
creating shareable "how far can you get?" moments. Scoring milestones (e.g.,
every 500 points) are marked with brief celebratory feedback that reads well
in screen recordings or short clips.

**Why this priority**: Score chasing and clip-worthy moments drive organic
sharing and repeat play — both critical for ad impressions and unpaid growth.

**Independent Test**: Play three consecutive runs, confirm each run lasts
45–120 s at average skill, verify milestone celebrations trigger, confirm
high score updates.

**Acceptance Scenarios**:

1. **Given** average player skill,
   **When** the player completes a run,
   **Then** the run duration is between 45 and 120 seconds.

2. **Given** the player's score crosses a milestone threshold,
   **When** the milestone is reached,
   **Then** a brief visual celebration (screen effect, text flash) plays
   and is visible even when the game is muted.

3. **Given** the player beats their personal best,
   **When** the run ends,
   **Then** the game-over screen highlights the new record with distinct
   visual treatment (color change, animation).

4. **Given** the player has completed a run,
   **When** the game-over screen is shown,
   **Then** the screen includes at minimum: final score, personal best,
   run duration, and enemies destroyed — data points that are interesting
   in a screenshot or clip.

---

### User Story 4 — Ads-First Monetization (Priority: P4)

The game is 100 % ad-supported with no in-app purchases. Revenue comes from
two ad placements at natural break points — never during active gameplay:

1. **Interstitial ad (game-over screen)**: After every Nth completed run
   (configurable, default: every 2 runs), a skippable interstitial may
   appear before the game-over screen content loads. If the ad is blocked,
   fails, or times out the game-over screen loads normally.
2. **Rewarded ad (“Watch to continue”)**: On the game-over screen the player
   may tap "Watch ad to continue" to view a rewarded video; on completion
   the run resumes with one extra life. This option is available **once per
   run** \u2014 after the continue is used, the next game over is final.

The player is never forced to wait for an ad to start a new run — skipping,
ad-blocker usage, or SDK failure does not degrade gameplay. Ad frequency is
configurable without a code change (via a local config constant or remote
config when available). Revenue metrics (impressions, fill rate, eCPM) are
tracked via optional, failure-tolerant analytics.

**Why this priority**: Ads are the sole revenue source. Getting placement,
frequency, and graceful degradation right is critical to sustaining the
project without harming retention.

**Independent Test**: Complete multiple runs, observe interstitial cadence,
use "watch to continue," confirm retry is never blocked by ad failure,
confirm game is fully playable with ads blocked.

**Acceptance Scenarios**:

1. **Given** the player completes a run and the interstitial cadence
   threshold is met (e.g., every 2nd run),
   **When** the game-over transition begins,
   **Then** a skippable interstitial ad is requested; if it loads within
   5 seconds it is shown, otherwise the game-over screen appears directly.

2. **Given** an interstitial is showing,
   **When** the player skips or the ad completes,
   **Then** the game-over screen appears immediately with no additional delay.

3. **Given** the player taps "Retry,"
   **When** an ad is still loading or has failed,
   **Then** the new run begins immediately — the ad never blocks retry.

4. **Given** the game-over screen offers "Watch ad to continue,"
   **When** the player chooses this option and the rewarded video completes,
   **Then** the run resumes with one additional life from the point of failure;
   the "Watch ad" option is no longer available for this run.

5. **Given** the player has already used the rewarded continue once in this run,
   **When** the run ends again (final game over),
   **Then** the game-over screen does NOT offer "Watch ad to continue" —
   only Retry and score display are shown.

6. **Given** the rewarded ad fails to load or is skipped before completion,
   **When** the player returns to the game-over screen,
   **Then** no life is granted and the "Watch ad" option remains available
   for one more attempt (the continue has not been consumed).

7. **Given** the player's device blocks ads entirely,
   **When** they play multiple consecutive runs,
   **Then** there is zero degradation in gameplay, features, or performance.

8. **Given** ad frequency configuration is changed,
   **When** the new value is applied (app restart; v1 uses local config
   only — remote config is a future enhancement),
   **Then** the interstitial cadence reflects the updated value without a
   code deployment.

---

### User Story 5 — Visual & Audio Feedback (Priority: P5)

Every player action and game event has clear, immediate visual feedback so the
game is fully enjoyable when muted. Audio (sound effects and optional music)
enhances the experience but is never the sole indicator of any event. Players
can toggle audio on/off; the default state is muted (respecting common mobile
usage in public).

**Why this priority**: Clear feedback drives satisfaction and readability in
shared clips. Mute-safe design respects mobile context and is required by the
constitution.

**Independent Test**: Play an entire run with audio muted — every event
(shoot, hit, breach, milestone, game over) must be unambiguously
communicated via visual cues alone.

**Acceptance Scenarios**:

1. **Given** audio is muted (default),
   **When** the auto-fire shoots a projectile straight up,
   **Then** a visual flash/animation provides clear feedback at the player's
   position.

2. **Given** audio is muted,
   **When** an enemy is destroyed,
   **Then** a destruction animation and score pop-up appear at the impact
   point.

3. **Given** audio is muted,
   **When** an enemy breaches the defense line,
   **Then** the screen flashes or shakes and a heart/shield icon is visually
   removed from the life row.

4. **Given** the player enables audio via the settings toggle,
   **When** gameplay events occur,
   **Then** corresponding sound effects play in addition to visual feedback.

5. **Given** the player has audio enabled,
   **When** they lock the screen or switch apps (background),
   **Then** all audio stops immediately and does not resume until the game
   is foregrounded and unpaused.

---

### Edge Cases

- **Rapid horizontal movement**: Player drags rapidly left and right —
  position updates to the latest touch x-coordinate; auto-fire rate is
  unaffected.
- **Pixel-perfect collision performance**: Collision masks MUST be
  pre-computed from sprite data at load time; per-frame collision checks
  MUST stay within the 8 ms CPU budget (FR-003). With up to 40 enemies
  on screen, a fast AABB pre-check MUST filter candidate pairs before
  pixel comparison to keep within budget.
- **Screen resize / orientation change**: Game adapts layout without losing
  state; an active run pauses if orientation changes mid-play.
- **Background / foreground**: Switching apps pauses the run; returning
  resumes from the paused state with a visible "tap to continue" overlay.
- **Very long run**: If a highly skilled player survives beyond the expected
  difficulty curve, difficulty caps at a maximum level (max 40 enemies on
  screen) to prevent numerical overflow or unplayable speeds.
- **Storage full**: If local storage is unavailable, the game still plays
  but warns the player that high scores cannot be saved.
- **First-time visit on slow connection**: The game shows a lightweight
  loading indicator; gameplay is not available until the critical app shell
  and boot-scene assets are cached.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST present enemies that originate from the top
  edge of the screen and move downward toward a defense line near the
  bottom.
- **FR-002**: The player MUST move horizontally by dragging on the screen;
  the weapon MUST fire projectiles straight up automatically at a
  configurable rate; no aiming or fire input is required.
- **FR-003**: When a projectile collides with an enemy (detected via
  per-sprite pixel-perfect collision), the enemy MUST take damage; upon
  reaching zero health the enemy is destroyed and a score value is awarded.
- **FR-004**: When a configurable number of enemies reach the defense
  line (default: 3 lives, displayed as a row of heart/shield icons), the
  run MUST end and the game-over screen MUST appear.
- **FR-005**: The game-over screen MUST display final score, personal
  best, enemies destroyed, and run duration.
- **FR-006**: The game MUST provide a single-tap retry from the game-over
  screen that starts a new run within 1 second.
- **FR-007**: Difficulty MUST escalate during a run by increasing enemy
  spawn rate, enemy speed, and/or enemy health on a linear step curve
  (configurable multipliers per step at fixed time intervals).
- **FR-008**: Difficulty MUST cap at a defined maximum to prevent
  numerical overflow or unplayable states; the maximum number of
  simultaneous enemies on screen MUST NOT exceed 40.
- **FR-009**: Average run duration at moderate skill MUST fall between
  45 and 120 seconds.
- **FR-010**: The game MUST persist the player's personal best score
  locally across sessions.
- **FR-011**: The game MUST be fully playable offline after the first
  visit; no gameplay feature may depend on network availability.
- **FR-012**: The game MUST be installable as a PWA with a Web App
  Manifest (standalone, portrait orientation).
- **FR-013**: All player feedback (shooting, hits, breaches, milestones,
  game over) MUST be conveyed through visual cues; audio MUST be an
  optional enhancement, never the sole signal.
- **FR-014**: Audio MUST default to muted and MUST be togglable by the
  player.
- **FR-015**: Audio MUST stop immediately when the game is backgrounded
  and MUST NOT resume until the game is foregrounded and unpaused.
- **FR-016**: Ads MUST appear only at natural break points (game-over
  screen or voluntary "watch to continue"); ads MUST NEVER interrupt
  active gameplay.
- **FR-017**: If an ad fails to load, times out (> 5 s), or is blocked,
  the game MUST continue without error or degraded functionality.
- **FR-018**: A skippable interstitial ad MAY be shown after every Nth
  completed run (configurable, default: every 2 runs) during the
  game-over transition; if it fails, the game-over screen loads normally.
- **FR-019**: A "watch ad to continue" rewarded-video option MAY be
  offered on the game-over screen **once per run**; completing the full
  video grants one additional life and resumes the run; skipping or
  failure grants nothing but the option remains until consumed or the
  player retries.
- **FR-020**: Ad interstitial cadence and rewarded-ad availability MUST
  be configurable without a code change (local constant or remote config).
- **FR-021**: Ad revenue metrics (impressions, fill rate, eCPM) MUST be
  trackable via optional, failure-tolerant analytics; tracking failure
  MUST NOT affect gameplay.
- **FR-022**: The game MUST pause when the player backgrounds the app or
  the screen locks, and resume with a "tap to continue" overlay on
  foreground.
- **FR-023**: The game MUST handle orientation changes without losing
  run state; an active run pauses if orientation changes.
- **FR-024**: All interactive touch targets MUST be at least 48 × 48 CSS
  pixels with at least 8 px spacing.
- **FR-025**: Scoring milestones (configurable intervals, e.g., every 500
  points) MUST trigger brief visual celebrations.
- **FR-026**: The game MUST display a loading indicator on first visit
  while critical assets are cached.
- **FR-027**: If local storage is unavailable, the game MUST warn the
  player and continue without score persistence.

### Key Entities

- **Player**: The defender at the bottom of the screen. Attributes:
  position (horizontal, player-controlled via drag), remaining lives,
  current score, auto-fire rate, fire-rate cooldown.
- **Projectile**: Fired automatically by the player's weapon. Attributes:
  position, velocity vector, damage value, active/inactive state,
  collision mask (pixel data for hit detection).
- **Enemy**: Falls from the sky. Attributes: position, velocity, health,
  score value, enemy type/variant, collision mask (pixel data for hit
  detection).
- **Run**: A single gameplay session. Attributes: current score, elapsed
  time, enemies destroyed count, current difficulty level, remaining
  lives.
- **Difficulty Curve**: Controls escalation over time. Attributes: spawn
  rate, enemy speed multiplier, enemy health multiplier, current level,
  maximum level cap.
- **High Score Record**: Persisted locally. Attributes: best score,
  date achieved.
- **Ad Placement**: Controls monetization triggers. Attributes:
  interstitial cadence (runs between interstitials), rewarded-ad
  availability flag, timeout threshold, current run counter,
  continue-used flag (max 1 per run).
- **Ad Config**: Tunable monetization settings. Attributes: interstitial
  frequency, rewarded-ad enabled flag, ad timeout duration; changeable
  without code deployment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can go from first tap to active gameplay in
  under 3 seconds (excluding first-visit asset download).
- **SC-002**: The average run lasts 45–120 seconds at moderate skill,
  encouraging rapid retry cycles.
- **SC-003**: The player can retry from game over to active gameplay in
  ≤ 1 tap and ≤ 1 second.
- **SC-004**: The game loads and is fully playable offline after the
  initial visit (0 network requests required for gameplay).
- **SC-005**: The game is fully functional with all ads blocked — no
  errors, no missing features, no degraded performance.
- **SC-006**: 100 % of player feedback events are visually
  communicated; the game is completely playable when muted.
- **SC-007**: The initial load (compressed) is ≤ 150 kB total transfer
  (per constitution budget).
- **SC-008**: No frame takes longer than 8 ms of CPU time at 60 fps on
  a mid-range mobile device.
- **SC-009**: 90 % of first-time players complete at least one full run
  without confusion or abandonment (validated via playtest).
- **SC-010**: Ad impressions per session average ≥ 1 across players who
  complete at least 2 runs (revenue baseline).

## Assumptions

- The player base is predominantly mobile users on mid-range Android and
  iOS devices in portrait orientation.
- Monetization is 100 % ad-supported; there are no in-app purchases in
  this version.
- No user accounts or cloud sync — all data is device-local.
- A single enemy type (with scaling health/speed) is sufficient for the
  initial version; additional enemy variants are a future enhancement.
- The player character slides horizontally by dragging and fires
  straight up automatically — the only input is horizontal positioning.
- Sound assets will be minimal (< 5 effects + optional ambient loop) to
  stay within bundle budget.
- The game targets modern evergreen browsers (last 2 versions of Chrome,
  Safari, Firefox, Edge); no IE or legacy WebView support.
