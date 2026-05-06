import { describe, expect, it } from "vitest";
import { chapters } from "../content/chapters";
import { techniqueById } from "../content/techniques";
import { ultimateByHeroId, ultimateProfiles } from "../content/ultimates";
import { upgradeById } from "../content/upgrades";
import type { HeroId, RunState } from "../types";
import { executeAbility } from "./abilities";
import { applyUpgrade, damageEnemy, damagePlayer, gainXp, resolveDeadEnemies } from "./combat";
import { enterChapterRoom } from "./chapterRun";
import { createRun } from "./createRun";
import { spawnEnemy } from "./spawn";
import { updateRun } from "./updateRun";

function advanceRun(state: RunState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) {
    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, Math.min(0.05, seconds - elapsed));
  }
}

function heroMasteryId(heroId: HeroId): string {
  return `hero_${heroId}_musou`;
}

describe("combat simulation", () => {
  it("defines three eight-room chapters with the expected room mix", () => {
    expect(chapters).toHaveLength(3);
    for (const chapter of chapters) {
      const roomTypes = chapter.rooms.map((room) => room.type);
      expect(chapter.rooms).toHaveLength(8);
      expect(roomTypes.filter((type) => type === "normal")).toHaveLength(4);
      expect(roomTypes).toContain("elite");
      expect(roomTypes).toContain("treasure");
      expect(roomTypes).toContain("rest");
      expect(roomTypes[7]).toBe("boss");
    }
  });

  it("applies faction and fire damage modifiers", () => {
    const state = createRun("zhouyu", 42);
    const enemy = spawnEnemy(state, "infantry", 100);
    const before = enemy.hp;

    damageEnemy(state, enemy, 20, ["fire"]);

    expect(enemy.hp).toBeLessThan(before - 20);
    expect(enemy.burnTimer).toBeGreaterThan(0);
    expect(enemy.burnDps).toBeGreaterThan(0);
  });

  it("applies the Qun faction rhythm to Diaochan", () => {
    const state = createRun("diaochan", 88);

    expect(state.faction.id).toBe("qun");
    expect(state.player.moveSpeed).toBeGreaterThan(252);
    expect(state.player.cooldownScale).toBeLessThan(0.9);
    expect(state.player.areaScale).toBeGreaterThan(1.15);
  });

  it("reduces incoming damage with armor and can keep the run alive", () => {
    const state = createRun("xiahoudun", 9);
    const before = state.player.hp;

    const taken = damagePlayer(state, 18);

    expect(taken).toBeLessThan(18);
    expect(state.player.hp).toBeLessThan(before);
    expect(state.status).toBe("playing");
  });

  it("opens a three-choice upgrade state and applies the chosen upgrade", () => {
    const state = createRun("guanyu", 12);

    gainXp(state, 200);

    expect(state.status).toBe("levelUp");
    expect(state.pendingUpgradeIds).toHaveLength(3);

    const chosen = state.pendingUpgradeIds[0];
    const upgrade = applyUpgrade(state, chosen);

    expect(state.status).toBe("playing");
    expect(state.upgrades[upgrade.id]).toBe(1);
  });

  it("includes build-changing choices in early upgrade offers", () => {
    const state = createRun("diaochan", 31);

    gainXp(state, 60);

    expect(state.status).toBe("levelUp");
    expect(state.pendingUpgradeIds).toHaveLength(3);
    expect(
      state.pendingUpgradeIds.some((id) => ["build", "technique", "faction", "relic", "hero"].includes(upgradeById[id].rarity))
    ).toBe(true);
  });

  it("applies build-changing projectile and sustain upgrades", () => {
    const state = createRun("sunshangxiang", 32);
    spawnEnemy(state, "shield", 140);

    applyUpgrade(state, "build_front_arrow");
    executeAbility(state, state.hero.autoAbility);

    expect(state.projectiles.length).toBeGreaterThan(1);

    state.player.hp = state.player.maxHp - 20;
    applyUpgrade(state, "build_kill_heal");
    const enemy = spawnEnemy(state, "infantry", 100);
    enemy.hp = 0;
    resolveDeadEnemies(state);

    expect(state.player.hp).toBeGreaterThan(state.player.maxHp - 20);
  });

  it("unlocked technique upgrades fire independent auto attacks", () => {
    const state = createRun("guanyu", 66);
    spawnEnemy(state, "shield", 160);

    applyUpgrade(state, "tech_moon_blades");
    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.016);

    expect(state.unlocks.tech_moon_blades).toBe(true);
    expect(state.techniqueCooldowns.moon_blades).toBeGreaterThan(0);
    expect(state.projectiles.some((projectile) => projectile.vfxKey === "moon_blades")).toBe(true);
  });

  it("can run multiple unlocked techniques with separate cooldowns", () => {
    const state = createRun("zhouyu", 67);
    spawnEnemy(state, "captain", 180);

    applyUpgrade(state, "tech_moon_blades");
    applyUpgrade(state, "tech_frost_lotus");
    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.016);

    expect(state.techniqueCooldowns.moon_blades).toBeGreaterThan(0);
    expect(state.techniqueCooldowns.frost_lotus).toBeGreaterThan(0);
    expect(state.projectiles.some((projectile) => projectile.vfxKey === "moon_blades")).toBe(true);
    expect(state.areas.some((area) => area.vfxKey === "frost_lotus")).toBe(true);
  });

  it("unlocks hero weapon evolutions when requirements are met", () => {
    const state = createRun("guanyu", 18);
    state.player.level = 4;
    state.upgrades.wide_formation = 1;
    state.status = "levelUp";
    state.pendingUpgradeIds = ["evo_guanyu"];

    applyUpgrade(state, "evo_guanyu");

    expect(state.unlocks.evolution_guanyu).toBe(true);
    expect(state.player.evolvedPower).toBeGreaterThan(0);
    expect(state.combatEvents.some((event) => event.type === "evolution")).toBe(true);
  });

  it("triggers morale bursts from kills", () => {
    const state = createRun("zhouyu", 11);
    state.player.morale = 98;
    const enemy = spawnEnemy(state, "infantry", 100);
    enemy.hp = 0;

    resolveDeadEnemies(state);

    expect(state.player.morale).toBe(0);
    expect(state.areas.some((area) => area.vfxKey.includes("morale"))).toBe(true);
  });

  it("clears room-scoped objectives and opens the door", () => {
    const state = createRun("guanyu", 15);
    state.spawnTimer = 999;

    const goal = state.roomObjective.goal;
    for (let index = 0; index < goal; index += 1) {
      const enemy = spawnEnemy(state, "infantry", 100);
      enemy.hp = 0;
    }
    resolveDeadEnemies(state);

    expect(state.roomStatus).toBe("cleared");
    expect(state.doorOpen).toBe(true);
    expect(state.roomObjective.progress).toBe(goal);
  });

  it("drops and collects battle merit orbs", () => {
    const state = createRun("sunshangxiang", 14);
    const enemy = spawnEnemy(state, "infantry", 40);
    enemy.x = state.player.x + 40;
    enemy.y = state.player.y;
    enemy.hp = 0;
    resolveDeadEnemies(state);

    expect(state.xpOrbs).toHaveLength(1);
    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.2);

    expect(state.xpOrbs.length).toBeLessThan(1);
    expect(state.player.xp).toBeGreaterThan(0);
  });

  it("fires manual abilities on cooldown", () => {
    const state = createRun("zhaoyun", 3);
    spawnEnemy(state, "shield", 120);

    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: true, pausePressed: false }, 0.016);

    expect(state.player.manualCooldown).toBeGreaterThan(0);
    expect(state.areas.length + state.projectiles.length).toBeGreaterThan(0);
  });

  it("opens a sustained ultimate window from manual abilities", () => {
    const state = createRun("guanyu", 3);
    const profile = ultimateByHeroId.guanyu;
    state.spawnTimer = 999;

    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: true, pausePressed: false }, 0.016);

    expect(state.player.ultimateTimer).toBeGreaterThan(profile.duration - 0.1);
    expect(state.player.manualCooldown).toBeGreaterThan(profile.duration + state.hero.manualAbility.cooldown * state.player.cooldownScale - 0.1);
    expect(state.combatEvents.some((event) => event.type === "ultimate")).toBe(true);

    advanceRun(state, profile.duration + 0.2);

    expect(state.player.ultimateTimer).toBe(0);
  });

  it("gives every hero a visible ultimate pulse", () => {
    for (const profile of ultimateProfiles) {
      const state = createRun(profile.heroId, 101);
      state.spawnTimer = 999;
      spawnEnemy(state, "shield", 160);

      updateRun(state, { move: { x: 0, y: 0 }, manualPressed: true, pausePressed: false }, 0.016);
      state.player.ultimatePulseCooldown = 0;
      const before = state.projectiles.length + state.areas.length;

      updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.016);

      const vfxKeys = [...state.projectiles, ...state.areas].map((effect) => effect.vfxKey);
      expect(state.projectiles.length + state.areas.length).toBeGreaterThan(before);
      expect(vfxKeys).toContain(profile.pulseAbility.vfxKey);
    }
  });

  it("defines authored presentation and finishers for every hero ultimate", () => {
    const seenFinisherKeys = new Set<string>();
    for (const profile of ultimateProfiles) {
      expect(profile.presentation.startVfxKey).toBe(profile.vfxKey);
      expect(profile.presentation.pulseVfxKey).toBeTruthy();
      expect(profile.presentation.finisherVfxKey).toBe(profile.finisherVfxKey);
      expect(profile.presentation.shortLabel.length).toBeGreaterThan(0);
      expect(profile.ultimateAnimationKey).toBe(`hero_${profile.heroId}_ultimate`);
      expect(profile.finisherAbility.trigger).toBe("ultimate");
      expect(profile.finisherAbility.ownerHeroId).toBe(profile.heroId);
      expect(profile.finisherAbility.vfxKey).toBe(profile.finisherVfxKey);
      seenFinisherKeys.add(profile.finisherVfxKey);
    }
    expect(seenFinisherKeys.size).toBe(ultimateProfiles.length);
  });

  it("fires a distinct ultimate finisher before the sustained window closes", () => {
    for (const profile of ultimateProfiles) {
      const state = createRun(profile.heroId, 303);
      state.spawnTimer = 999;
      spawnEnemy(state, "captain", 180);

      updateRun(state, { move: { x: 0, y: 0 }, manualPressed: true, pausePressed: false }, 0.016);
      state.player.ultimateTimer = 0.24;
      state.player.ultimatePulseCooldown = 99;
      const before = state.projectiles.length + state.areas.length;

      updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.016);

      const vfxKeys = [...state.projectiles, ...state.areas].map((effect) => effect.vfxKey);
      expect(state.player.ultimateFinisherTriggered).toBe(true);
      expect(state.projectiles.length + state.areas.length).toBeGreaterThan(before);
      expect(vfxKeys).toContain(profile.finisherVfxKey);
      expect(state.combatEvents.some((event) => event.type === "ultimate" && event.vfxKey === profile.finisherVfxKey)).toBe(true);
    }
  });

  it("hero mastery upgrades extend ultimates and unlock a second pulse layer", () => {
    for (const profile of ultimateProfiles) {
      const state = createRun(profile.heroId, 202);
      state.spawnTimer = 999;
      applyUpgrade(state, heroMasteryId(profile.heroId));
      spawnEnemy(state, "captain", 180);

      expect(state.unlocks[profile.empoweredUnlockId]).toBe(true);
      expect(state.player.ultimateDurationBonus).toBeGreaterThan(0);
      expect(state.player.ultimatePower).toBeGreaterThan(0);

      updateRun(state, { move: { x: 0, y: 0 }, manualPressed: true, pausePressed: false }, 0.016);
      state.player.ultimatePulseCooldown = 0;
      state.player.ultimatePulseCount = profile.bonusEvery ? profile.bonusEvery - 1 : profile.alternatePulseAbility ? 1 : 0;

      updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.016);

      const expectedVfx = (profile.bonusPulseAbility ?? profile.alternatePulseAbility ?? profile.empoweredPulseAbility)?.vfxKey;
      const vfxKeys = [...state.projectiles, ...state.areas].map((effect) => effect.vfxKey);
      expect(state.player.ultimateTimer).toBeGreaterThan(profile.duration);
      if (expectedVfx) {
        expect(vfxKeys).toContain(expectedVfx);
      }
    }
  });

  it("keeps evolved power scoped to the current hero instead of neutral techniques", () => {
    const state = createRun("guanyu", 404);
    state.unlocks.evolution_guanyu = true;
    state.player.evolvedPower = 1;

    executeAbility(state, techniqueById.thunder_charm.ability);

    const thunderArea = state.areas.find((area) => area.vfxKey === "thunder_charm");
    expect(thunderArea?.damagePerSecond).toBeCloseTo(72 * 1.35, 2);

    executeAbility(state, state.hero.autoAbility);

    const heroProjectile = state.projectiles.find((projectile) => projectile.vfxKey === "qinglong_arc");
    expect(heroProjectile?.damage).toBeGreaterThan(28 * 2);
  });

  it("guarantees a hero mastery offer after the hero has evolved", () => {
    const state = createRun("guanyu", 18);
    state.player.level = 4;
    state.player.nextXp = 1;
    state.upgrades.wide_formation = 1;
    applyUpgrade(state, "evo_guanyu");

    gainXp(state, 1);

    expect(state.status).toBe("levelUp");
    expect(state.pendingUpgradeIds).toContain("hero_guanyu_musou");
  });

  it("lets Diaochan create charm dance areas with her manual skill", () => {
    const state = createRun("diaochan", 33);
    spawnEnemy(state, "shield", 120);

    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: true, pausePressed: false }, 0.016);

    expect(state.player.manualCooldown).toBeGreaterThan(0);
    expect(state.areas.some((area) => area.vfxKey === "allure_dance" && area.tags.includes("charm"))).toBe(true);
  });

  it("applies Qun upgrades and Diaochan evolution", () => {
    const state = createRun("diaochan", 54);

    applyUpgrade(state, "qun_flower_step");
    state.player.level = 4;
    state.upgrades.wide_formation = 1;
    applyUpgrade(state, "evo_diaochan");

    expect(state.upgrades.qun_flower_step).toBe(1);
    expect(state.unlocks.evolution_diaochan).toBe(true);
    expect(state.player.evolvedPower).toBeGreaterThan(0);
  });

  it("spawns Lu Bu when entering the boss room", () => {
    const state = createRun("caocao", 5);
    enterChapterRoom(state, 7);

    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.02);

    expect(state.bossSpawned).toBe(true);
    expect(state.enemies.some((enemy) => enemy.defId === "lubu")).toBe(true);
  });

  it("wins when Lu Bu is defeated", () => {
    const state = createRun("sunshangxiang", 7);
    enterChapterRoom(state, 7);
    const boss = spawnEnemy(state, "lubu", 100);
    boss.hp = 0;

    resolveDeadEnemies(state);

    expect(state.status).toBe("won");
    expect(state.chapterCleared).toBe(true);
    expect(state.score).toBeGreaterThan(0);
  });

  it("moves Lu Bu into later combat phases", () => {
    const state = createRun("caocao", 21);
    const boss = spawnEnemy(state, "lubu", 120);
    boss.hp = boss.maxHp * 0.3;

    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.016);

    expect(boss.phase).toBe(3);
    expect(state.combatEvents.some((event) => event.type === "boss")).toBe(true);
  });
});
