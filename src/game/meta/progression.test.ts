import { describe, expect, it } from "vitest";
import { createRun } from "../simulation/createRun";
import {
  accrueIdleRewards,
  applyRunSettlement,
  claimIdleRewards,
  createDefaultMetaProgressionState,
  getFacilityUpgradeCost,
  getTalentUpgradeCost,
  getMetaRunBonuses,
  idleCapMs,
  loadMetaProgression,
  mergeEquipment,
  metaProgressionStorageKey,
  normalizeMetaProgressionState,
  openChapterChest,
  saveMetaProgression,
  upgradeTalent,
  upgradeFacility
} from "./progression";

function createMemoryStorage(initial?: string): Pick<Storage, "getItem" | "setItem"> {
  const store = new Map<string, string>();
  if (initial !== undefined) {
    store.set(metaProgressionStorageKey, initial);
  }
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    }
  };
}

describe("meta progression", () => {
  it("normalizes broken and out-of-range storage", () => {
    const storage = createMemoryStorage("{not-json");

    expect(loadMetaProgression(storage, 0)).toEqual(createDefaultMetaProgressionState(0));

    const normalized = normalizeMetaProgressionState(
      {
        resources: { merit: -4, provisions: 2.8, renown: Number.NaN },
        facilities: { trainingGround: 99, arsenal: -2, granary: 3.8 },
        heroMastery: { guanyu: { level: 99, xp: 300 } },
        idle: { lastClaimedAt: "bad-date", unclaimed: { merit: 4, provisions: -1, renown: 1 } },
        stats: { runsPlayed: 1.8, wins: -4, bestKills: 33.3, bossDefeats: Number.NaN }
      },
      0
    );

    expect(normalized.resources).toEqual({ merit: 0, provisions: 2, renown: 0 });
    expect(normalized.facilities).toEqual({ trainingGround: 10, arsenal: 0, granary: 3 });
    expect(normalized.heroMastery.guanyu.level).toBe(20);
    expect(normalized.heroMastery.guanyu.xp).toBe(0);
    expect(normalized.idle.lastClaimedAt).toBe(new Date(0).toISOString());
    expect(normalized.idle.unclaimed).toEqual({ merit: 4, provisions: 0, renown: 1 });
    expect(normalized.stats).toEqual({ runsPlayed: 1, wins: 0, bestKills: 33, bossDefeats: 0 });
  });

  it("calculates capped offline rewards and claims them into resources", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    const state = createDefaultMetaProgressionState(start);
    state.facilities.granary = 2;

    const accrued = accrueIdleRewards(state, start + idleCapMs + 60 * 60 * 1000);

    expect(accrued.idle.unclaimed).toEqual({ merit: 32, provisions: 187, renown: 0 });

    const claimed = claimIdleRewards(accrued, start + idleCapMs + 60 * 60 * 1000);

    expect(claimed.rewards).toEqual({ merit: 32, provisions: 187, renown: 0 });
    expect(claimed.state.resources).toEqual({ merit: 32, provisions: 187, renown: 0 });
    expect(claimed.state.idle.unclaimed).toEqual({ merit: 0, provisions: 0, renown: 0 });
  });

  it("settles wins, losses, boss defeats, and hero mastery", () => {
    const state = createDefaultMetaProgressionState(0);

    const win = applyRunSettlement(state, {
      heroId: "guanyu",
      status: "won",
      kills: 80,
      score: 450,
      playerLevel: 6,
      bossDefeated: true
    });

    expect(win.settlement.resources).toEqual({ merit: 92, provisions: 63, renown: 2 });
    expect(win.settlement.heroXp).toBe(22);
    expect(win.settlement.heroLevelAfter).toBe(2);
    expect(win.settlement.chapterCleared).toBe(true);
    expect(win.settlement.chestKeys).toBe(2);
    expect(win.state.stats).toEqual({ runsPlayed: 1, wins: 1, bestKills: 80, bossDefeats: 1 });

    const loss = applyRunSettlement(win.state, {
      heroId: "guanyu",
      status: "lost",
      kills: 40,
      score: 220,
      playerLevel: 4
    });

    expect(loss.settlement.resources).toEqual({ merit: 32, provisions: 24, renown: 0 });
    expect(loss.state.stats.runsPlayed).toBe(2);
    expect(loss.state.stats.wins).toBe(1);
  });

  it("upgrades facilities only when resources are available", () => {
    const state = createDefaultMetaProgressionState(0);
    const missing = upgradeFacility(state, "trainingGround");

    expect(missing.upgraded).toBe(false);
    expect(missing.state.facilities.trainingGround).toBe(0);

    const cost = getFacilityUpgradeCost("trainingGround", 0);
    const funded = {
      ...state,
      resources: cost
    };
    const result = upgradeFacility(funded, "trainingGround");

    expect(result.upgraded).toBe(true);
    expect(result.state.facilities.trainingGround).toBe(1);
    expect(result.state.resources).toEqual({ merit: 0, provisions: 0, renown: 0 });
  });

  it("applies meta bonuses to run creation", () => {
    const state = createDefaultMetaProgressionState(0);
    state.facilities.trainingGround = 3;
    state.facilities.arsenal = 4;
    state.heroMastery.guanyu = { level: 5, xp: 0 };
    const bonuses = getMetaRunBonuses(state, "guanyu");
    const run = createRun("guanyu", 7, bonuses);

    expect(bonuses.damageScale).toBeCloseTo(1.11);
    expect(run.player.damageScale).toBeCloseTo(1.11);
    expect(run.player.cooldownScale).toBeCloseTo(0.94);
    expect(run.player.maxHp).toBeGreaterThan(150);
    expect(run.player.hp).toBe(run.player.maxHp);
  });

  it("upgrades talents, merges equipment, and opens chapter chests", () => {
    const state = createDefaultMetaProgressionState(0);
    const talentCost = getTalentUpgradeCost("attackDrill", 0);
    state.resources = { merit: 999, provisions: 999, renown: 5 };

    const talent = upgradeTalent(state, "attackDrill");

    expect(talent.upgraded).toBe(true);
    expect(talent.state.talents.attackDrill).toBe(1);
    expect(talent.state.resources.merit).toBe(999 - talentCost.merit);

    const itemKey = "bronze_sword:common";
    talent.state.equipment.inventory[itemKey] = { defId: "bronze_sword", rarity: "common", quantity: 3 };
    const merged = mergeEquipment(talent.state, itemKey);

    expect(merged.merged).toBe(true);
    expect(merged.state.equipment.inventory["bronze_sword:rare"].quantity).toBe(1);

    merged.state.chapterChests.keys = 1;
    const chest = openChapterChest(merged.state);

    expect(chest.opened).toBe(true);
    expect(chest.state.chapterChests.keys).toBe(0);
    expect(chest.state.dailyMissions.missions.openChest.progress).toBe(1);
  });

  it("persists normalized state", () => {
    const storage = createMemoryStorage();
    const state = createDefaultMetaProgressionState(0);
    state.resources.merit = 12.8;

    saveMetaProgression(state, storage, 0);
    const loaded = loadMetaProgression(storage, 0);

    expect(loaded.resources.merit).toBe(12);
  });
});
