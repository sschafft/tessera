"use client";

import * as Tone from "tone";

/**
 * Tessera sound effects — synth-only via Tone.js per the locked
 * decision in TDD §10. No binary asset files. Browser autoplay
 * policies require a user gesture before AudioContext can start;
 * `enableAudio()` resolves only after that gesture happens.
 */

let enabled = false;
let synth: Tone.PolySynth | null = null;

export async function enableAudio(): Promise<void> {
  if (enabled) return;
  try {
    await Tone.start();
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.0, release: 0.4 },
    }).toDestination();
    enabled = true;
  } catch {
    // AudioContext not yet available (no user gesture). Caller should
    // retry after the next gesture.
  }
}

export function isAudioEnabled(): boolean {
  return enabled;
}

export function playRoundEnd(): void {
  if (!enabled || !synth) return;
  const now = Tone.now();
  // Two-note triumphant ding (E5 → A5).
  synth.triggerAttackRelease("E5", "8n", now);
  synth.triggerAttackRelease("A5", "4n", now + 0.15);
}

export function playTimePressure(): void {
  if (!enabled || !synth) return;
  const now = Tone.now();
  // Dramatic descending sting (G4 → D4 → A3).
  synth.triggerAttackRelease("G4", "16n", now);
  synth.triggerAttackRelease("D4", "16n", now + 0.08);
  synth.triggerAttackRelease("A3", "8n", now + 0.16);
}

export function playGameEnd(): void {
  if (!enabled || !synth) return;
  const now = Tone.now();
  // Resolved fanfare (C5 → E5 → G5 → C6).
  const notes: [string, number][] = [
    ["C5", 0],
    ["E5", 0.12],
    ["G5", 0.24],
    ["C6", 0.4],
  ];
  for (const [note, t] of notes) {
    synth.triggerAttackRelease(note, "8n", now + t);
  }
}
