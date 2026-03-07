// src/adapters/audio/audio-adapter.ts — Audio adapter (US5)
// Web Audio API, mute toggle (default muted per FR-014),
// stop on document.hidden per FR-015, user gesture unlock for iOS.

import type { GameEventBus } from '@core/events.js';

export interface AudioAdapter {
  /** Initialize audio context (must be called from user gesture). */
  init(): void;
  /** Play a sound effect by name. */
  play(name: string): void;
  /** Toggle mute state. Returns new mute state. */
  toggleMute(): boolean;
  /** Get current mute state. */
  isMuted(): boolean;
  /** Subscribe to game events for automatic SFX playback. */
  subscribeToGameEvents(events: GameEventBus): void;
  /** Handle visibility changes (pause/resume). */
  handleVisibility(hidden: boolean): void;
}

// Simple oscillator-based SFX definitions (placeholder until real assets)
interface SfxDef {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
}

const SFX_DEFS: Record<string, SfxDef> = {
  shoot: { frequency: 880, duration: 0.05, type: 'square', gain: 0.15 },
  explosion: { frequency: 200, duration: 0.2, type: 'sawtooth', gain: 0.25 },
  breach: { frequency: 150, duration: 0.3, type: 'triangle', gain: 0.3 },
  milestone: { frequency: 660, duration: 0.4, type: 'sine', gain: 0.2 },
  damage: { frequency: 100, duration: 0.15, type: 'square', gain: 0.2 },
};

export function createAudioAdapter(): AudioAdapter {
  let audioCtx: AudioContext | null = null;
  let muted = true; // Default muted per FR-014
  let initialized = false;

  function init(): void {
    if (initialized) return;
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      initialized = true;
      console.log('[Audio] Context created');
    } catch {
      console.warn('[Audio] Web Audio not available');
    }
  }

  function play(name: string): void {
    if (muted || !audioCtx || audioCtx.state === 'suspended') return;

    const def = SFX_DEFS[name];
    if (!def) return;

    try {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = def.type;
      osc.frequency.setValueAtTime(def.frequency, audioCtx.currentTime);

      gainNode.gain.setValueAtTime(def.gain, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + def.duration,
      );

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + def.duration);
    } catch {
      // Silent failure
    }
  }

  function toggleMute(): boolean {
    muted = !muted;

    // Resume audio context on unmute (user gesture unlock for iOS)
    if (!muted && audioCtx?.state === 'suspended') {
      audioCtx.resume();
    }

    console.log(`[Audio] Mute: ${muted}`);
    return muted;
  }

  function isMuted(): boolean {
    return muted;
  }

  function handleVisibility(hidden: boolean): void {
    if (!audioCtx) return;

    if (hidden) {
      // Stop all audio on background per FR-015
      audioCtx.suspend();
    } else if (!muted) {
      audioCtx.resume();
    }
  }

  function subscribeToGameEvents(events: GameEventBus): void {
    events.on('projectile-fired', () => play('shoot'));
    events.on('enemy-destroyed', () => play('explosion'));
    events.on('enemy-breached', () => play('breach'));
    events.on('milestone-reached', () => play('milestone'));
    events.on('life-lost', () => play('damage'));
  }

  return {
    init,
    play,
    toggleMute,
    isMuted,
    subscribeToGameEvents,
    handleVisibility,
  };
}
