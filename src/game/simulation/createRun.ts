import { factionById } from "../content/factions";
import { heroById } from "../content/heroes";
import { defaultChapterId, getChapterDef } from "../content/chapters";
import type { MetaRunBonuses } from "../meta/progression";
import type { ChapterId, FactionId, HeroId, PlayerState, RunState } from "../types";
import { initializeChapterRun } from "./chapterRun";
import { createObjective } from "./objectives";

const worldSize = 3600;

export function createRun(
  heroId: HeroId,
  seed = 12891,
  bonuses?: MetaRunBonuses,
  chapterId: ChapterId = defaultChapterId
): RunState {
  const hero = heroById[heroId];
  const faction = factionById[hero.factionId as FactionId];
  const player = createPlayer(heroId, bonuses);
  const chapter = getChapterDef(chapterId);
  const objective = createObjective();

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
    xpOrbs: [],
    objective,
    objectiveIndex: 0,
    chapterId: chapter.id,
    chapterName: chapter.name,
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

  if (hero.id === "guanyu") {
    player.areaScale += 0.1;
  }
  if (hero.id === "zhaoyun" || hero.id === "machao") {
    player.cooldownScale -= 0.08;
  }
  if (hero.id === "sunshangxiang") {
    player.pickupRadius += 18;
  }
  if (hero.id === "diaochan") {
    player.areaScale += 0.12;
    player.cooldownScale -= 0.06;
  }

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
