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

/**
 * Crossing into the last two minutes of the round — single warm
 * chime with a touch of sting. Loud enough to be noticed mid-call but
 * not jarring.
 */
export function playLastTwoMinutes(): void {
  if (!enabled || !synth) return;
  const now = Tone.now();
  synth.triggerAttackRelease("F5", "8n", now);
  synth.triggerAttackRelease("D5", "4n", now + 0.18);
}

/**
 * Triumphant fanfare for the moment the pair gets every piece right.
 * Distinct from playTestSolution (partial credit) and playGameEnd
 * (the whole game wrapping up) — this is the round-solve "you did
 * it" celebration that fires for both the builder and the guider.
 */
export function playSolved(): void {
  if (!enabled || !synth) return;
  const now = Tone.now();
  // Major chord arpeggio climbing two octaves, then a held resolve.
  const notes: [string, string, number][] = [
    ["C5", "16n", 0],
    ["E5", "16n", 0.08],
    ["G5", "16n", 0.16],
    ["C6", "16n", 0.24],
    ["E6", "16n", 0.32],
    ["G6", "8n", 0.42],
    ["C7", "4n", 0.6],
  ];
  for (const [note, dur, t] of notes) {
    synth.triggerAttackRelease(note, dur, now + t);
  }
}

/**
 * Builder's "Test solution" celebration — a quick rising arpeggio
 * scaled to how many pieces they got right. More right → louder,
 * higher final note. Zero correct → a single soft bloop, no fanfare.
 */
export function playTestSolution(correctCount: number): void {
  if (!enabled || !synth) return;
  const now = Tone.now();
  if (correctCount === 0) {
    synth.triggerAttackRelease("C4", "16n", now);
    return;
  }
  // Cap the celebration around 4 notes so a 12-correct round doesn't
  // feel obnoxious.
  const steps = Math.min(4, correctCount);
  const ladders: Record<number, [string, number][]> = {
    1: [["E5", 0]],
    2: [["E5", 0], ["A5", 0.12]],
    3: [["C5", 0], ["E5", 0.1], ["G5", 0.2]],
    4: [["C5", 0], ["E5", 0.1], ["G5", 0.2], ["C6", 0.32]],
  };
  for (const [note, t] of ladders[steps]!) {
    synth.triggerAttackRelease(note, "8n", now + t);
  }
}
