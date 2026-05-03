import type { CombatEventState } from "../types";
import type { SfxKey } from "./catalog";

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
