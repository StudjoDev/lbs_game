import { enemyById } from "../content/enemies";
import { upgradeById, upgrades } from "../content/upgrades";
import type { CombatEventType, DamageTag, EnemyState, RunState, UpgradeDef, UpgradeRarity } from "../types";
import { distance, normalize } from "./math";
import { nextRandom } from "./rng";

export function damageEnemy(state: RunState, enemy: EnemyState, baseDamage: number, tags: DamageTag[]): number {
  const player = state.player;
  const def = enemyById[enemy.defId];
  let amount = baseDamage * player.damageScale;

  if (tags.includes("fire")) {
    const zhouyuUltimateScale = player.heroId === "zhouyu" && player.ultimateTimer > 0 ? 1.18 + player.ultimatePower : 1;
    amount *= player.burnScale;
    enemy.burnTimer = Math.max(enemy.burnTimer, (state.unlocks.evolution_zhouyu ? 3.4 : 2.4) * zhouyuUltimateScale);
    enemy.burnDps = Math.max(enemy.burnDps, amount * (state.unlocks.wu_chain_fire ? 0.34 : 0.22) * zhouyuUltimateScale);
  }
  if (tags.includes("blade") || tags.includes("pierce")) {
    amount *= player.comboScale;
  }
  if (tags.includes("command") && state.faction.id === "wei") {
    amount *= 1.1;
  }
  if (tags.includes("command") && player.heroId === "caocao" && player.ultimateTimer > 0) {
    amount *= 1.12 + player.ultimatePower;
  }
  if (def.tags.includes("boss")) {
    amount *= player.bossDamage;
  }
  if (player.heroId === "xiahoudun") {
    amount *= 1 + (1 - player.hp / player.maxHp) * 0.45;
  }
  if (player.berserkTimer > 0) {
    amount *= state.unlocks.evolution_xiahoudun ? 1.82 : 1.55;
    healPlayer(state, amount * (state.unlocks.evolution_xiahoudun ? 0.07 : 0.045));
  }
  if (player.heroId === "xiahoudun" && player.ultimateTimer > 0) {
    healPlayer(state, amount * (0.025 + player.ultimatePower * 0.05));
  }

  const critical = nextRandom(state) < player.critChance;
  if (critical) {
    amount *= player.critDamage;
  }

  enemy.hp -= amount;
  enemy.flashTimer = 0.12;
  if (tags.includes("shock")) {
    const push = normalize({ x: enemy.x - state.player.x, y: enemy.y - state.player.y });
    enemy.x += push.x * 18;
    enemy.y += push.y * 18;
  }

  addFloatingText(state, enemy.x, enemy.y - enemy.radius, critical ? `${Math.round(amount)}!` : Math.round(amount).toString(), critical ? "xp" : "damage");
  addCombatEvent(state, critical ? "crit" : "hit", enemy.x, enemy.y, critical ? 1.25 : 0.55, critical ? "crit_spark" : "hit_spark");
  return amount;
}

export function damagePlayer(state: RunState, amount: number): number {
  let reduced = Math.max(1, amount - state.player.armor);
  if (state.player.guardChance > 0 && nextRandom(state) < state.player.guardChance) {
    reduced *= 0.35;
    addFloatingText(state, state.player.x, state.player.y - 38, "格擋", "alert");
    addCombatEvent(state, "playerHit", state.player.x, state.player.y, 0.35, "guard_flash");
  } else {
    addCombatEvent(state, "playerHit", state.player.x, state.player.y, 0.7, "blood_rage");
  }
  state.player.hp = Math.max(0, state.player.hp - reduced);
  addFloatingText(state, state.player.x, state.player.y - 34, `-${Math.round(reduced)}`, "alert");
  if (state.player.hp <= 0) {
    state.status = "lost";
  }
  return reduced;
}

export function healPlayer(state: RunState, amount: number): void {
  const before = state.player.hp;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount);
  if (state.player.hp > before + 0.5) {
    addFloatingText(state, state.player.x, state.player.y - 44, `+${Math.round(state.player.hp - before)}`, "heal");
  }
}

export function gainXp(state: RunState, amount: number): void {
  state.player.xp += amount * state.player.xpScale;
  while (state.player.xp >= state.player.nextXp && state.status === "playing") {
    state.player.xp -= state.player.nextXp;
    state.player.level += 1;
    state.player.nextXp = Math.round(state.player.nextXp * 1.22 + 8);
    state.pendingUpgradeIds = chooseUpgradeOptions(state);
    state.status = "levelUp";
    addFloatingText(state, state.player.x, state.player.y - 70, "升級", "xp");
    addCombatEvent(state, "levelUp", state.player.x, state.player.y, 1.2, "level_ring", "升級");
  }
}

export function applyUpgrade(state: RunState, upgradeId: string): UpgradeDef {
  const upgrade = upgradeById[upgradeId];
  const current = state.upgrades[upgrade.id] ?? 0;
  if (!upgrade || current >= upgrade.maxStacks) {
    state.status = "playing";
    return upgrade;
  }

  state.upgrades[upgrade.id] = current + 1;
  if (upgrade.unlockId) {
    state.unlocks[upgrade.unlockId] = true;
  }
  for (const effect of upgrade.apply) {
    if (effect.stat === "maxHp") {
      state.player.maxHp += effect.amount;
      state.player.hp += effect.amount;
      state.player.armor += 1;
    } else if (effect.stat === "damageScale") {
      state.player.damageScale += effect.amount;
    } else if (effect.stat === "cooldownScale") {
      state.player.cooldownScale = Math.max(0.42, state.player.cooldownScale + effect.amount);
    } else if (effect.stat === "areaScale") {
      state.player.areaScale += effect.amount;
    } else if (effect.stat === "moveSpeed") {
      state.player.moveSpeed += effect.amount;
    } else if (effect.stat === "armor") {
      state.player.armor += effect.amount;
    } else if (effect.stat === "pickupRadius") {
      state.player.pickupRadius += effect.amount;
    } else if (effect.stat === "regen") {
      state.player.regen += effect.amount;
    } else if (effect.stat === "critChance") {
      state.player.critChance += effect.amount;
    } else if (effect.stat === "critDamage") {
      state.player.critDamage += effect.amount;
    } else if (effect.stat === "xpScale") {
      state.player.xpScale += effect.amount;
    } else if (effect.stat === "companionDamage") {
      state.player.companionDamage += effect.amount;
    } else if (effect.stat === "evolvedPower") {
      state.player.evolvedPower += effect.amount;
    } else if (effect.stat === "ultimateDuration") {
      state.player.ultimateDurationBonus += effect.amount;
    } else if (effect.stat === "ultimatePower") {
      state.player.ultimatePower += effect.amount;
    } else if (effect.stat === "bossDamage") {
      state.player.bossDamage += effect.amount;
    }
  }

  const isEvolution = upgrade.rarity === "evolution";
  addFloatingText(state, state.player.x, state.player.y - 78, isEvolution ? "武器進化" : upgrade.name, "xp");
  addCombatEvent(state, isEvolution ? "evolution" : "levelUp", state.player.x, state.player.y, isEvolution ? 1.8 : 0.9, isEvolution ? "evolution_burst" : "level_ring", upgrade.name);
  state.pendingUpgradeIds = [];
  state.status = "playing";
  return upgrade;
}

export function resolveDeadEnemies(state: RunState): void {
  const survivors: EnemyState[] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      survivors.push(enemy);
      continue;
    }
    const def = enemyById[enemy.defId];
    state.kills += 1;
    state.score += def.score;
    addCombatEvent(state, "kill", enemy.x, enemy.y, def.tags.includes("elite") ? 1 : 0.5, def.tags.includes("boss") ? "evolution_burst" : "hit_spark");
    if (enemy.defId === "lubu") {
      state.status = "won";
      addFloatingText(state, enemy.x, enemy.y - 70, "天下歸一", "xp");
      addCombatEvent(state, "boss", enemy.x, enemy.y, 2.2, "evolution_burst", "呂布已敗");
    } else {
      gainMorale(state, def.tags.includes("elite") ? 16 : 5);
      dropXpOrb(state, enemy.x, enemy.y, def.xp);
    }
  }
  state.enemies = survivors;
}

export function findNearestEnemy(state: RunState, range: number): EnemyState | undefined {
  let nearest: EnemyState | undefined;
  let nearestDistance = range;
  for (const enemy of state.enemies) {
    const current = distance(state.player, enemy);
    if (current < nearestDistance) {
      nearest = enemy;
      nearestDistance = current;
    }
  }
  return nearest;
}

export function addFloatingText(
  state: RunState,
  x: number,
  y: number,
  text: string,
  tone: "damage" | "heal" | "xp" | "alert"
): void {
  if (state.floatingTexts.length > 90 && tone === "damage") {
    return;
  }
  state.floatingTexts.push({
    uid: state.nextUid++,
    x,
    y,
    text,
    ttl: tone === "damage" ? 0.55 : 1,
    tone
  });
}

export function addCombatEvent(
  state: RunState,
  type: CombatEventType,
  x: number,
  y: number,
  intensity: number,
  vfxKey: string,
  text?: string
): void {
  state.combatEvents.push({
    uid: state.nextUid++,
    type,
    x,
    y,
    ttl: type === "hit" ? 0.18 : type === "ultimate" ? 0.75 : 0.45,
    intensity,
    vfxKey,
    text
  });
}

export function updateCombatEvents(state: RunState, dt: number): void {
  state.combatEvents = state.combatEvents.map((event) => ({ ...event, ttl: event.ttl - dt })).filter((event) => event.ttl > 0);
}

function chooseUpgradeOptions(state: RunState): string[] {
  const eligible = upgrades.filter((upgrade) => isUpgradeEligible(state, upgrade));
  const picks: string[] = [];

  const heroSpecific = eligible.filter((upgrade) => upgrade.rarity === "hero" && upgrade.heroId === state.hero.id);
  const heroPick = pickWeightedUpgrade(state, heroSpecific, picks);
  if (heroPick) {
    picks.push(heroPick.id);
  }

  const buildChanging = eligible.filter((upgrade) =>
    ["technique", "faction", "hero", "evolution", "relic"].includes(upgrade.rarity)
  );
  if (picks.length === 0) {
    const firstPick = pickWeightedUpgrade(state, buildChanging.length > 0 ? buildChanging : eligible, picks);
    if (firstPick) {
      picks.push(firstPick.id);
    }
  }

  while (eligible.length > 0 && picks.length < 3) {
    const picked = pickWeightedUpgrade(state, eligible, picks);
    if (!picked) {
      break;
    }
    picks.push(picked.id);
  }
  return picks;
}

function pickWeightedUpgrade(state: RunState, candidates: UpgradeDef[], excludedIds: string[]): UpgradeDef | undefined {
  const weighted = candidates
    .filter((upgrade) => !excludedIds.includes(upgrade.id))
    .flatMap((upgrade) => Array(weightForRarity(upgrade.rarity)).fill(upgrade));
  if (weighted.length === 0) {
    return undefined;
  }
  return weighted[Math.floor(nextRandom(state) * weighted.length)];
}

function isUpgradeEligible(state: RunState, upgrade: UpgradeDef): boolean {
  if ((state.upgrades[upgrade.id] ?? 0) >= upgrade.maxStacks) {
    return false;
  }
  if (upgrade.factionId && upgrade.factionId !== state.faction.id) {
    return false;
  }
  if (upgrade.heroId && upgrade.heroId !== state.hero.id) {
    return false;
  }
  if (upgrade.requires?.level && state.player.level < upgrade.requires.level) {
    return false;
  }
  if (upgrade.requires?.upgradeId && (state.upgrades[upgrade.requires.upgradeId] ?? 0) < (upgrade.requires.stacks ?? 1)) {
    return false;
  }
  return true;
}

function weightForRarity(rarity: UpgradeRarity): number {
  if (rarity === "evolution") {
    return 7;
  }
  if (rarity === "technique") {
    return 6;
  }
  if (rarity === "faction" || rarity === "hero") {
    return 4;
  }
  if (rarity === "relic") {
    return 2;
  }
  return 5;
}

function gainMorale(state: RunState, amount: number): void {
  state.player.morale = Math.min(state.player.maxMorale, state.player.morale + amount);
  if (state.player.morale >= state.player.maxMorale) {
    state.player.morale = 0;
    triggerMoraleBurst(state);
  }
}

function dropXpOrb(state: RunState, x: number, y: number, value: number): void {
  state.xpOrbs.push({
    uid: state.nextUid++,
    x,
    y,
    value,
    radius: value >= 20 ? 15 : 10
  });
  if (state.xpOrbs.length > 520) {
    const merged = state.xpOrbs.splice(0, state.xpOrbs.length - 420);
    const total = merged.reduce((sum, orb) => sum + orb.value, 0);
    state.xpOrbs.push({
      uid: state.nextUid++,
      x: state.player.x,
      y: state.player.y,
      value: total,
      radius: 18
    });
  }
}

function triggerMoraleBurst(state: RunState): void {
  const isShu = state.faction.id === "shu";
  const isWei = state.faction.id === "wei";
  const radius = (isWei ? 210 : isShu ? 240 : 260) * state.player.areaScale;
  const damage = (isWuLike(state) ? 92 : 78) * state.player.damageScale * (1 + state.player.evolvedPower);
  state.areas.push({
    uid: state.nextUid++,
    source: "player",
    target: "enemy",
    x: state.player.x,
    y: state.player.y,
    radius,
    damagePerSecond: damage,
    ttl: isWuLike(state) ? 2.2 : 0.5,
    tickTimer: 0,
    tickEvery: isWuLike(state) ? 0.28 : 0.12,
    tags: isWuLike(state) ? ["fire", "command"] : isShu ? ["blade", "shock"] : ["command", "shock"],
    vfxKey: isWuLike(state) ? "morale_fire" : isShu ? "morale_dragon" : "morale_banner"
  });
  if (isShu) {
    healPlayer(state, 8 + state.player.level * 2);
  }
  addFloatingText(state, state.player.x, state.player.y - 90, isWei ? "軍令爆發" : isShu ? "桃園戰意" : "江東火勢", "xp");
  addCombatEvent(state, "morale", state.player.x, state.player.y, 1.55, isWuLike(state) ? "morale_fire" : isShu ? "morale_dragon" : "morale_banner");
}

function isWuLike(state: RunState): boolean {
  return state.faction.id === "wu" || state.unlocks.wu_chain_fire;
}
