// src/core/entities.ts — Pure entity interfaces (Constitution Principle I: no Phaser/browser imports)

/** 2D position in game-world coordinates (origin: top-left). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Unique entity identifier (sequential integer, no GC-inducing strings). */
export type EntityId = number;

/** Enemy type identifier — variants unlock progressively by difficulty level. */
export type EnemyType = 'standard' | 'drifter' | 'armored' | 'speeder';

/** Represents the defender at the bottom of the screen. */
export interface Player {
  id: EntityId;
  position: Vec2;
  remainingLives: number;
  score: number;
  autoFireCooldown: number; // ms remaining until next shot
}

/** Fired automatically by the player weapon. Travels straight up. */
export interface Projectile {
  id: EntityId;
  position: Vec2;
  velocityY: number; // Negative (upward), px/s
  damage: number;
  active: boolean;
  collisionMaskIndex: number;
}

/** Falls from the sky toward the defense line. */
export interface Enemy {
  id: EntityId;
  position: Vec2;
  velocity: Vec2;
  health: number;
  maxHealth: number;
  scoreValue: number;
  enemyType: EnemyType;
  active: boolean;
  collisionMaskIndex: number;
  /** Radians; incremented each step for drifter sine-wave; 0 for all others. */
  driftPhase: number;
}

/** Pre-computed bitmask for pixel-perfect collision. */
export interface CollisionMask {
  width: number;
  height: number;
  /** 1 bit per pixel, packed into Uint32Array. Bit = 1 means solid. */
  data: Uint32Array;
}

/** Finite states of a run. */
export type RunPhase =
  | 'starting'
  | 'playing'
  | 'paused'
  | 'continue-offer'
  | 'game-over';

/** A single gameplay session from start to game over. */
export interface Run {
  score: number;
  elapsedMs: number;
  enemiesDestroyed: number;
  currentDifficultyLevel: number;
  remainingLives: number;
  phase: RunPhase;
  continueUsed: boolean;
  runIndex: number;
  /** True at run start; false after Revive Shield rewarded ad consumed. */
  reviveAvailable: boolean;
  /** False at run start; true after Score Doubler rewarded ad consumed. */
  doublersUsed: boolean;
  /** Consecutive kills without a miss. Reset when comboLastHitElapsedMs > comboWindow. */
  comboCount: number;
  /** Current score multiplier (1.0 baseline). Never exceeds comboMultiplierCap. */
  comboMultiplier: number;
  /** ms elapsed since last kill; incremented by dt each step via dt accumulator — NEVER setTimeout. */
  comboLastHitElapsedMs: number;
  /** Highest combo multiplier achieved during this run. */
  bestComboMultiplier: number;
  /** Whether streak recovery ad was offered this session (module-level, not per-run). */
  streakRecoveryOffered: boolean;
}

/** Persisted high score data (v2 — backward-compatible with v1). */
export interface HighScoreRecord {
  bestScore: number;
  dateAchieved: string;               // ISO 8601
  dailyStreak: number;                // Consecutive play days; 0 if never played.
  lastPlayedDate: string;             // ISO YYYY-MM-DD; '' if never played.
  dailyChallengeCompletedDate: string;// ISO YYYY-MM-DD; '' if not completed.
  // TODO(daily-challenge): dailyChallengeCompletedDate is persisted but no challenge
  // mechanic is defined yet — implement when a future spec defines the trigger,
  // validation, and reward.
}

/** Root state object that the core engine owns. */
export interface GameState {
  player: Player;
  projectiles: Projectile[];
  enemies: Enemy[];
  run: Run;
  config: GameConfig;
  highScore: HighScoreRecord;
  rngSeed: number;
  collisionMasks: CollisionMask[];
  nextEntityId: number;
}

// Forward reference — imported from config.ts at usage sites
import type { GameConfig } from './config.js';
