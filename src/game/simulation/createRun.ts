import { factionById } from "../content/factions";
import { heroById } from "../content/heroes";
import type { FactionId, HeroId, PlayerState, RunState } from "../types";

const worldSize = 3600;

export function createRun(heroId: HeroId, seed = 12891): RunState {
  const hero = heroById[heroId];
  const faction = factionById[hero.factionId as FactionId];
  const player = createPlayer(heroId);

  return {
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
}

function createPlayer(heroId: HeroId): PlayerState {
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
    evolvedPower: 0,
    bossDamage: 1,
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
  if (hero.id === "zhaoyun") {
    player.cooldownScale -= 0.08;
  }
  if (hero.id === "sunshangxiang") {
    player.pickupRadius += 18;
  }
  if (hero.id === "diaochan") {
    player.areaScale += 0.12;
    player.cooldownScale -= 0.06;
  }

  return player;
}
