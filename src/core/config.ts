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
  rewardedAdEnabled: boolean;
  adTimeoutMs: number;

  // Run targets
  targetMinDurationMs: number;
  targetMaxDurationMs: number;
}

/** Ad configuration subset. */
export interface AdConfig {
  interstitialCadence: number;
  rewardedAdEnabled: boolean;
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
  rewardedAdEnabled: true,
  adTimeoutMs: 5000,

  // Run targets
  targetMinDurationMs: 45000,
  targetMaxDurationMs: 120000,
};

/** Fixed timestep for core simulation (60 Hz). */
export const FIXED_DT = 1000 / 60; // ~16.667 ms

/** Maximum accumulator cap to prevent spiral of death. */
export const MAX_ACCUMULATOR = FIXED_DT * 5;

/** Pre-allocated pool sizes. */
export const PROJECTILE_POOL_SIZE = 50;
export const ENEMY_POOL_SIZE = 20;
