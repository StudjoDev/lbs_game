import { describe, expect, it } from "vitest";
import { upgradeById } from "../content/upgrades";
import { applyUpgrade, damageEnemy, damagePlayer, gainXp, resolveDeadEnemies } from "./combat";
import { createRun } from "./createRun";
import { spawnEnemy } from "./spawn";
import { updateRun } from "./updateRun";

describe("combat simulation", () => {
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
      state.pendingUpgradeIds.some((id) => ["technique", "faction", "relic", "hero"].includes(upgradeById[id].rarity))
    ).toBe(true);
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

  it("spawns Lu Bu at the boss timer", () => {
    const state = createRun("caocao", 5);
    state.elapsed = state.bossSpawnTime - 0.01;

    updateRun(state, { move: { x: 0, y: 0 }, manualPressed: false, pausePressed: false }, 0.02);

    expect(state.bossSpawned).toBe(true);
    expect(state.enemies.some((enemy) => enemy.defId === "lubu")).toBe(true);
  });

  it("wins when Lu Bu is defeated", () => {
    const state = createRun("sunshangxiang", 7);
    const boss = spawnEnemy(state, "lubu", 100);
    boss.hp = 0;

    resolveDeadEnemies(state);

    expect(state.status).toBe("won");
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
