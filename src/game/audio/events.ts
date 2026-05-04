import type { CombatEventState } from "../types";
import { sfxVariantCatalog, type SfxKey, type SfxVariantProfile } from "./catalog";

export const sfxThrottleMs: Partial<Record<SfxKey, number>> = {
  sfx_hit: 42,
  sfx_player_hit: 90
};

export class SfxThrottle {
  private readonly lastPlayedAt = new Map<SfxKey, number>();

  canPlay(key: SfxKey, nowMs: number): boolean {
    const waitMs = sfxThrottleMs[key] ?? 0;
    const lastPlayedAt = this.lastPlayedAt.get(key) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - lastPlayedAt < waitMs) {
      return false;
    }
    this.lastPlayedAt.set(key, nowMs);
    return true;
  }

  reset(): void {
    this.lastPlayedAt.clear();
  }
}

export interface NormalizedSfxVariantProfile {
  key: SfxKey;
  variantKeys: readonly string[];
  detuneRange: readonly [number, number];
  volumeJitter: readonly [number, number];
}

export interface SelectedSfxVariant {
  logicalKey: SfxKey;
  key: string;
  detune: number;
  volumeScale: number;
}

export function normalizeSfxVariantProfile(
  key: SfxKey,
  profile: SfxVariantProfile | undefined = sfxVariantCatalog[key]
): NormalizedSfxVariantProfile {
  const variantKeys = profile?.variants.map((variant) => variant.key).filter((variantKey) => variantKey.length > 0) ?? [];
  if (variantKeys.length === 0) {
    return {
      key,
      variantKeys: [key],
      detuneRange: [0, 0],
      volumeJitter: [1, 1]
    };
  }
  return {
    key,
    variantKeys,
    detuneRange: normalizeRange(profile.detuneRange, [0, 0]),
    volumeJitter: normalizeRange(profile.volumeJitter, [1, 1])
  };
}

export function selectSfxVariant(key: SfxKey, random: () => number = Math.random): SelectedSfxVariant {
  const profile = normalizeSfxVariantProfile(key);
  const index = Math.floor(nextUnit(random) * profile.variantKeys.length);
  return {
    logicalKey: key,
    key: profile.variantKeys[index] ?? key,
    detune: Math.round(lerp(profile.detuneRange[0], profile.detuneRange[1], nextUnit(random))),
    volumeScale: lerp(profile.volumeJitter[0], profile.volumeJitter[1], nextUnit(random))
  };
}

export function sfxKeyForCombatEvent(event: Pick<CombatEventState, "type">): SfxKey {
  if (event.type === "hit") {
    return "sfx_hit";
  }
  if (event.type === "crit") {
    return "sfx_crit";
  }
  if (event.type === "kill") {
    return "sfx_kill";
  }
  if (event.type === "manual") {
    return "sfx_manual";
  }
  if (event.type === "ultimate") {
    return "sfx_morale";
  }
  if (event.type === "evolution") {
    return "sfx_evolution";
  }
  if (event.type === "morale") {
    return "sfx_morale";
  }
  if (event.type === "boss") {
    return "sfx_boss";
  }
  if (event.type === "playerHit") {
    return "sfx_player_hit";
  }
  return "sfx_level_up";
}

function normalizeRange(range: readonly [number, number], fallback: readonly [number, number]): readonly [number, number] {
  const min = Number.isFinite(range[0]) ? range[0] : fallback[0];
  const max = Number.isFinite(range[1]) ? range[1] : fallback[1];
  return min <= max ? [min, max] : [max, min];
}

function nextUnit(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(0.999999, Math.max(0, value));
}

function lerp(min: number, max: number, value: number): number {
  return min + (max - min) * value;
}
