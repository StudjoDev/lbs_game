import { describe, expect, it } from "vitest";
import type { CombatEventType } from "../types";
import { audioAssetEntries, sfxKeys, sfxVariantCatalog } from "./catalog";
import { normalizeSfxVariantProfile, selectSfxVariant, SfxThrottle, sfxKeyForCombatEvent } from "./events";

describe("combat audio events", () => {
  it("maps each combat event type to a stable sfx key", () => {
    const cases: Array<[CombatEventType, ReturnType<typeof sfxKeyForCombatEvent>]> = [
      ["hit", "sfx_hit"],
      ["crit", "sfx_crit"],
      ["kill", "sfx_kill"],
      ["levelUp", "sfx_level_up"],
      ["manual", "sfx_manual"],
      ["evolution", "sfx_evolution"],
      ["morale", "sfx_morale"],
      ["boss", "sfx_boss"],
      ["playerHit", "sfx_player_hit"]
    ];

    for (const [type, key] of cases) {
      expect(sfxKeyForCombatEvent({ type })).toBe(key);
    }
  });

  it("throttles dense hit sounds without blocking unthrottled cues", () => {
    const throttle = new SfxThrottle();

    expect(throttle.canPlay("sfx_hit", 100)).toBe(true);
    expect(throttle.canPlay("sfx_hit", 125)).toBe(false);
    expect(throttle.canPlay("sfx_hit", 142)).toBe(true);
    expect(throttle.canPlay("sfx_crit", 143)).toBe(true);
    expect(throttle.canPlay("sfx_crit", 144)).toBe(true);
  });

  it("maps every logical sfx cue to at least one preloaded physical variant", () => {
    const loadedKeys = new Set<string>(audioAssetEntries.map((entry) => entry.key));

    for (const key of sfxKeys) {
      const profile = normalizeSfxVariantProfile(key);
      expect(profile.variantKeys.length).toBeGreaterThan(0);
      expect(sfxVariantCatalog[key].variants.length).toBeGreaterThan(0);
      expect(audioAssetEntries.some((entry) => entry.logicalKey === key)).toBe(true);
      for (const variantKey of profile.variantKeys) {
        expect(loadedKeys.has(variantKey)).toBe(true);
      }
    }
  });

  it("selects deterministic variants and keeps the configured pitch range", () => {
    const first = selectSfxVariant("sfx_manual", () => 0);
    const last = selectSfxVariant("sfx_manual", () => 0.999999);

    expect(first.key).toBe("sfx_manual_1");
    expect(first.detune).toBe(sfxVariantCatalog.sfx_manual.detuneRange[0]);
    expect(first.volumeScale).toBe(sfxVariantCatalog.sfx_manual.volumeJitter[0]);
    expect(last.key).toBe(sfxVariantCatalog.sfx_manual.variants.at(-1)?.key);
    expect(last.detune).toBeLessThanOrEqual(sfxVariantCatalog.sfx_manual.detuneRange[1]);
    expect(last.volumeScale).toBeLessThanOrEqual(sfxVariantCatalog.sfx_manual.volumeJitter[1]);
  });
});
