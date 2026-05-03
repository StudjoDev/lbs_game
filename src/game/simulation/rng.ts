import type { RunState } from "../types";

export function nextRandom(state: RunState): number {
  state.rngSeed = (state.rngSeed * 1664525 + 1013904223) >>> 0;
  return state.rngSeed / 4294967296;
}

export function randomRange(state: RunState, min: number, max: number): number {
  return min + (max - min) * nextRandom(state);
}

export function randomInt(state: RunState, min: number, maxExclusive: number): number {
  return Math.floor(randomRange(state, min, maxExclusive));
}
