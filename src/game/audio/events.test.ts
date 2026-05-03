import { describe, expect, it } from "vitest";
import type { CombatEventType } from "../types";
import { SfxThrottle, sfxKeyForCombatEvent } from "./events";

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
});
