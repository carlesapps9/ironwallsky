// src/core/config.ts — Game configuration interfaces and defaults

/** Tunable constants loaded at boot. */
export interface GameConfig {
  // Player
  maxLives: number;
  autoFireRateMs: number;
  playerSpeed: number;

  // Projectile
  projectileSpeed: number;
  projectileDamage: number;

  // Enemy
  baseSpawnIntervalMs: number;
  baseEnemySpeed: number;
  baseEnemyHealth: number;
  baseScoreValue: number;
  maxSimultaneousEnemies: number;

  // Difficulty
  difficultyStepIntervalMs: number;
  spawnRateMultiplierPerStep: number;
  speedMultiplierPerStep: number;
  healthIncrementPerStep: number;
  maxDifficultyLevel: number;

  // Scoring
  milestoneInterval: number;

  // World
  worldWidth: number;
  worldHeight: number;
  defenseLineY: number;

  // Ads
  interstitialCadence: number;
  /** Gates Watch to Continue rewarded ad. Default: true. */
  continueEnabled: boolean;
  /** Gates Revive Shield rewarded ad. Default: true. */
  reviveEnabled: boolean;
  /** Gates Score Doubler rewarded ad. Default: true. */
  doublerEnabled: boolean;
  adTimeoutMs: number;

  // Run targets
  targetMinDurationMs: number;
  targetMaxDurationMs: number;

  // Combo multiplier
  /** ms after last kill before combo resets; default: 2000. */
  comboWindow: number;
  /** Multiplier added per consecutive kill; default: 0.1. */
  comboMultiplierStep: number;
  /** Maximum score multiplier; default: 3.0. */
  comboMultiplierCap: number;

  // Enemy type weights (applied when difficulty level unlocks each type)
  enemyTypeWeights: {
    standard: number;  // Always 1.0 (baseline)
    drifter: number;   // Active at level ≥ 3; default: 0.3
    armored: number;   // Active at level ≥ 6; default: 0.2
    speeder: number;   // Active at level ≥ 10; default: 0.15
  };

  // Drifter movement
  /** Max px horizontal offset for drifter sine-wave; default: 80. */
  driftAmplitude: number;
  /** Hz; sine-wave oscillation speed for drifter; default: 1.5. */
  driftFrequency: number;

  // Remote config
  /** URL to fetch config JSON at boot; '' = disabled. Default: ''. */
  remoteConfigUrl: string;

  // Share card
  /** Template for share text; use {score} placeholder. */
  scoreTweetTemplate: string;
}

/** Ad configuration subset (per-placement flags replace single rewardedAdEnabled). */
export interface AdConfig {
  interstitialCadence: number;
  /** Gates Watch to Continue rewarded ad. */
  continueEnabled: boolean;
  /** Gates Revive Shield rewarded ad. */
  reviveEnabled: boolean;
  /** Gates Score Doubler rewarded ad. */
  doublerEnabled: boolean;
  adTimeoutMs: number;
}

/** Default game configuration. */
export const DEFAULT_CONFIG: GameConfig = {
  // Player
  maxLives: 3,
  autoFireRateMs: 250,
  playerSpeed: 400,

  // Projectile
  projectileSpeed: 600,
  projectileDamage: 1,

  // Enemy
  baseSpawnIntervalMs: 1200,
  baseEnemySpeed: 120,
  baseEnemyHealth: 1,
  baseScoreValue: 100,
  maxSimultaneousEnemies: 40,

  // Difficulty
  difficultyStepIntervalMs: 8000,
  spawnRateMultiplierPerStep: 0.92,
  speedMultiplierPerStep: 1.08,
  healthIncrementPerStep: 0,
  maxDifficultyLevel: 15,

  // Scoring
  milestoneInterval: 500,

  // World (portrait 360x640)
  worldWidth: 360,
  worldHeight: 640,
  defenseLineY: 600,

  // Ads
  interstitialCadence: 2,
  continueEnabled: true,
  reviveEnabled: true,
  doublerEnabled: true,
  adTimeoutMs: 5000,

  // Run targets
  targetMinDurationMs: 45000,
  targetMaxDurationMs: 120000,

  // Combo
  comboWindow: 2000,
  comboMultiplierStep: 0.1,
  comboMultiplierCap: 3.0,

  // Enemy type weights
  enemyTypeWeights: {
    standard: 1.0,
    drifter: 0.3,
    armored: 0.2,
    speeder: 0.15,
  },

  // Drifter movement
  driftAmplitude: 80,
  driftFrequency: 1.5,

  // Remote config (disabled by default)
  remoteConfigUrl: '',

  // Share card
  scoreTweetTemplate: 'I scored {score} pts in Iron Wall Sky! Can you beat me? 🔥',
};

/** Fixed timestep for core simulation (60 Hz). */
export const FIXED_DT = 1000 / 60; // ~16.667 ms

/** Maximum accumulator cap to prevent spiral of death. */
export const MAX_ACCUMULATOR = FIXED_DT * 5;

/** Pre-allocated pool sizes. */
export const PROJECTILE_POOL_SIZE = 50;
export const ENEMY_POOL_SIZE = 20;
