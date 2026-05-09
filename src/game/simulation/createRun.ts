import { factionById } from "../content/factions";
import { heroById } from "../content/heroes";
import { defaultChapterId, getChapterDef } from "../content/chapters";
import { getConquestCityDef } from "../content/conquest";
import type { MetaRunBonuses } from "../meta/progression";
import type { ChapterId, ConquestCityId, FactionId, HeroId, HeroPassiveEffect, PlayerState, RunState } from "../types";
import { initializeChapterRun } from "./chapterRun";
import { createObjective } from "./objectives";

const worldSize = 3600;

export function createRun(
  heroId: HeroId,
  seed = 12891,
  bonuses?: MetaRunBonuses,
  chapterId: ChapterId = defaultChapterId,
  conquestCityId?: ConquestCityId
): RunState {
  const hero = heroById[heroId];
  const faction = factionById[hero.factionId as FactionId];
  const player = createPlayer(heroId, bonuses);
  const conquestCity = getConquestCityDef(conquestCityId);
  const chapter = getChapterDef(conquestCity?.chapterId ?? chapterId);
  const objective = createObjective();
  const gatekeeperHero = conquestCity?.gatekeeperHeroId ? heroById[conquestCity.gatekeeperHeroId] : undefined;

  const state: RunState = {
    status: "playing",
    hero,
    faction,
    player,
    enemies: [],
    projectiles: [],
    areas: [],
    floatingTexts: [],
    combatEvents: [],
    combatDirector: {
      chainKills: 0,
      chainTimer: 0,
      chainTier: 0,
      pressureTimer: 0,
      freezeTimer: 0
    },
    xpOrbs: [],
    objective,
    objectiveIndex: 0,
    chapterId: chapter.id,
    chapterName: chapter.name,
    conquestCityId: conquestCity?.id,
    conquestCityName: conquestCity?.name,
    gatekeeperHeroId: conquestCity?.gatekeeperHeroId,
    gatekeeperName: conquestCity ? (gatekeeperHero?.name ?? "城防隊長") : undefined,
    gatekeeperDefeated: false,
    roomIndex: 0,
    roomCount: chapter.rooms.length,
    roomType: chapter.rooms[0].type,
    roomTitle: chapter.rooms[0].title,
    roomObjective: objective,
    roomStatus: "fighting",
    doorOpen: false,
    roomElapsed: 0,
    roomClearTimer: 0,
    chapterCleared: false,
    upgrades: {},
    unlocks: {},
    techniqueCooldowns: {},
    pendingUpgradeIds: [],
    elapsed: 0,
    duration: 480,
    bossSpawnTime: 420,
    bossSpawned: false,
    kills: 0,
    score: 0,
    world: {
      width: worldSize,
      height: worldSize
    },
    spawnTimer: 0.2,
    nextUid: 1,
    rngSeed: seed,
    lastFacing: { x: 1, y: 0 }
  };
  initializeChapterRun(state, chapter.id);
  return state;
}

function createPlayer(heroId: HeroId, bonuses?: MetaRunBonuses): PlayerState {
  const hero = heroById[heroId];
  const player: PlayerState = {
    id: "player",
    heroId,
    factionId: hero.factionId,
    x: worldSize / 2,
    y: worldSize / 2,
    radius: 24,
    hp: hero.baseStats.maxHp,
    maxHp: hero.baseStats.maxHp,
    moveSpeed: hero.baseStats.moveSpeed,
    armor: hero.baseStats.armor,
    pickupRadius: hero.baseStats.pickupRadius,
    damageScale: 1,
    cooldownScale: 1,
    areaScale: 1,
    burnScale: 1,
    comboScale: 1,
    guardChance: 0,
    critChance: 0.06,
    critDamage: 1.65,
    xpScale: 1,
    companionDamage: 1,
    companionCount: 0,
    evolvedPower: 0,
    bossDamage: 1,
    frontShot: 0,
    rearShot: 0,
    extraVolley: 0,
    projectilePierce: 0,
    ricochet: 0,
    orbitGuard: 0,
    orbitCooldown: 0,
    killHeal: 0,
    lowHpPower: 0,
    missingHpPower: 0,
    regen: 0,
    morale: 0,
    maxMorale: 100,
    level: 1,
    xp: 0,
    nextXp: 18,
    autoCooldown: 0.3,
    manualCooldown: 0,
    companionCooldown: 3.5,
    berserkTimer: 0,
    ultimateCharge: 1,
    ultimateTimer: 0,
    ultimatePulseCooldown: 0,
    ultimatePulseCount: 0,
    ultimateFinisherTriggered: false,
    ultimateDurationBonus: 0,
    ultimatePower: 0
  };

  if (hero.factionId === "shu") {
    player.moveSpeed *= 1.08;
    player.comboScale = 1.12;
  }
  if (hero.factionId === "wei") {
    player.armor += 2;
    player.guardChance = 0.1;
    player.damageScale += 0.04;
  }
  if (hero.factionId === "wu") {
    player.burnScale = 1.18;
    player.areaScale = 1.08;
  }
  if (hero.factionId === "qun") {
    player.moveSpeed *= 1.14;
    player.cooldownScale -= 0.06;
    player.areaScale += 0.06;
  }

  applyHeroPassiveEffects(player, hero.passiveEffects);

  if (bonuses) {
    const hpScale = Math.max(0.1, bonuses.maxHpScale);
    player.maxHp = Math.round(player.maxHp * hpScale);
    player.hp = player.maxHp;
    player.damageScale *= Math.max(0.1, bonuses.damageScale);
    player.cooldownScale = Math.max(0.42, player.cooldownScale * Math.max(0.1, bonuses.cooldownScale));
    player.moveSpeed += bonuses.moveSpeed ?? 0;
    player.armor += bonuses.armor ?? 0;
    player.pickupRadius += bonuses.pickupRadius ?? 0;
    player.xpScale += bonuses.xpScale ?? 0;
    player.bossDamage += bonuses.bossDamage ?? 0;
  }

  return player;
}

function applyHeroPassiveEffects(player: PlayerState, effects: readonly HeroPassiveEffect[]): void {
  for (const effect of effects) {
    applyHeroPassiveEffect(player, effect);
  }
}

function applyHeroPassiveEffect(player: PlayerState, effect: HeroPassiveEffect): void {
  if (effect.stat === "maxHp") {
    player.maxHp += effect.amount;
    player.hp += effect.amount;
  } else if (effect.stat === "moveSpeed") {
    player.moveSpeed += effect.amount;
  } else if (effect.stat === "armor") {
    player.armor += effect.amount;
  } else if (effect.stat === "pickupRadius") {
    player.pickupRadius += effect.amount;
  } else if (effect.stat === "damageScale") {
    player.damageScale += effect.amount;
  } else if (effect.stat === "cooldownScale") {
    player.cooldownScale = Math.max(0.42, player.cooldownScale + effect.amount);
  } else if (effect.stat === "areaScale") {
    player.areaScale += effect.amount;
  } else if (effect.stat === "burnScale") {
    player.burnScale += effect.amount;
  } else if (effect.stat === "comboScale") {
    player.comboScale += effect.amount;
  } else if (effect.stat === "guardChance") {
    player.guardChance = Math.min(0.4, player.guardChance + effect.amount);
  } else if (effect.stat === "critChance") {
    player.critChance = Math.min(0.55, player.critChance + effect.amount);
  } else if (effect.stat === "critDamage") {
    player.critDamage += effect.amount;
  } else if (effect.stat === "xpScale") {
    player.xpScale += effect.amount;
  } else if (effect.stat === "companionDamage") {
    player.companionDamage += effect.amount;
  } else if (effect.stat === "companionCount") {
    player.companionCount += effect.amount;
  } else if (effect.stat === "bossDamage") {
    player.bossDamage += effect.amount;
  } else if (effect.stat === "frontShot") {
    player.frontShot += effect.amount;
  } else if (effect.stat === "rearShot") {
    player.rearShot += effect.amount;
  } else if (effect.stat === "extraVolley") {
    player.extraVolley += effect.amount;
  } else if (effect.stat === "projectilePierce") {
    player.projectilePierce += effect.amount;
  } else if (effect.stat === "ricochet") {
    player.ricochet += effect.amount;
  } else if (effect.stat === "orbitGuard") {
    player.orbitGuard += effect.amount;
  } else if (effect.stat === "killHeal") {
    player.killHeal += effect.amount;
  } else if (effect.stat === "lowHpPower") {
    player.lowHpPower += effect.amount;
  } else if (effect.stat === "missingHpPower") {
    player.missingHpPower += effect.amount;
  } else if (effect.stat === "regen") {
    player.regen += effect.amount;
  } else if (effect.stat === "maxMorale") {
    player.maxMorale = Math.max(1, player.maxMorale + effect.amount);
    player.morale = Math.min(player.morale, player.maxMorale);
  } else if (effect.stat === "startingMorale") {
    player.morale = Math.min(player.maxMorale, Math.max(0, player.morale + effect.amount));
  } else if (effect.stat === "ultimateDuration") {
    player.ultimateDurationBonus += effect.amount;
  } else if (effect.stat === "ultimatePower") {
    player.ultimatePower += effect.amount;
  }
}
