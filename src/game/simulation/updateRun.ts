import { enemyById } from "../content/enemies";
import { techniques } from "../content/techniques";
import { ultimateByHeroId, type UltimateProfile } from "../content/ultimates";
import type { AreaState, InputState, ProjectileState, RunState, XpOrbState } from "../types";
import { addBossShockwave, addEnemyArrow, executeAbility } from "./abilities";
import {
  addCombatEvent,
  addFloatingText,
  claimObjectiveReward,
  damageEnemy,
  damagePlayer,
  gainXp,
  healPlayer,
  resolveDeadEnemies,
  updateCombatEvents
} from "./combat";
import { updateChapterRoom } from "./chapterRun";
import { clamp, distance, normalize } from "./math";
import { updateSpawner } from "./spawn";

export function updateRun(state: RunState, input: InputState, dt: number): void {
  if (state.status !== "playing") {
    return;
  }

  const safeDt = Math.min(dt, 0.05);
  state.elapsed += safeDt;
  state.player.autoCooldown = Math.max(0, state.player.autoCooldown - safeDt);
  state.player.manualCooldown = Math.max(0, state.player.manualCooldown - safeDt);
  state.player.companionCooldown = Math.max(0, state.player.companionCooldown - safeDt);
  state.player.orbitCooldown = Math.max(0, state.player.orbitCooldown - safeDt);
  const wasUltimateActive = state.player.ultimateTimer > 0;
  state.player.ultimateTimer = Math.max(0, state.player.ultimateTimer - safeDt);
  state.player.ultimatePulseCooldown = Math.max(0, state.player.ultimatePulseCooldown - safeDt);
  updateTechniqueCooldowns(state, safeDt);
  state.player.berserkTimer = Math.max(0, state.player.berserkTimer - safeDt);
  if (wasUltimateActive && state.player.ultimateTimer <= 0.25 && !state.player.ultimateFinisherTriggered) {
    triggerUltimateFinisher(state, ultimateByHeroId[state.hero.id]);
  }
  if (state.player.ultimateTimer <= 0) {
    state.player.ultimatePulseCooldown = 0;
    state.player.ultimatePulseCount = 0;
    state.player.ultimateFinisherTriggered = false;
  }
  if (state.player.regen > 0) {
    healPlayer(state, state.player.regen * safeDt);
  }

  movePlayer(state, input, safeDt);
  claimObjectiveReward(state, updateChapterRoom(state, input.manualPressed, safeDt));
  if (state.status !== "playing") {
    updateFloatingTexts(state, safeDt);
    updateCombatEvents(state, safeDt);
    return;
  }
  if (state.roomStatus !== "fighting") {
    updateFloatingTexts(state, safeDt);
    updateCombatEvents(state, safeDt);
    return;
  }
  updateSpawner(state, safeDt);
  updateAbilities(state, input);
  updateBuildSupport(state);
  updateUltimateSupport(state);
  updateTechniqueSupport(state);
  updateCompanionSupport(state);
  updateEnemies(state, safeDt);
  updateProjectiles(state, safeDt);
  updateAreas(state, safeDt);
  updateXpOrbs(state, safeDt);
  updateFloatingTexts(state, safeDt);
  updateCombatEvents(state, safeDt);
  resolveDeadEnemies(state);

  if (state.elapsed >= state.duration && !state.bossSpawned) {
    state.bossSpawned = true;
    addFloatingText(state, state.player.x, state.player.y - 74, "呂布壓境", "alert");
    addCombatEvent(state, "boss", state.player.x, state.player.y, 1.8, "evolution_burst", "呂布壓境");
  }
}

export function setPaused(state: RunState, paused: boolean): void {
  if (paused && state.status === "playing") {
    state.status = "paused";
  } else if (!paused && state.status === "paused") {
    state.status = "playing";
  }
}

function movePlayer(state: RunState, input: InputState, dt: number): void {
  const move = normalize(input.move);
  const profile = ultimateByHeroId[state.hero.id];
  const ultimateMoveScale = state.player.ultimateTimer > 0 ? (profile.moveSpeedScale ?? 1) : 1;
  if (Math.hypot(move.x, move.y) > 0.01) {
    state.lastFacing = move;
  }
  state.player.x = clamp(state.player.x + move.x * state.player.moveSpeed * ultimateMoveScale * dt, 48, state.world.width - 48);
  state.player.y = clamp(state.player.y + move.y * state.player.moveSpeed * ultimateMoveScale * dt, 48, state.world.height - 48);
}

function updateAbilities(state: RunState, input: InputState): void {
  const hero = state.hero;
  if (state.player.autoCooldown <= 0) {
    executeAbility(state, hero.autoAbility);
    const profile = ultimateByHeroId[state.hero.id];
    const ultimateAutoScale = state.player.ultimateTimer > 0 ? (profile.autoCooldownScale ?? 0.78) : 1;
    state.player.autoCooldown = Math.max(0.15, hero.autoAbility.cooldown * state.player.cooldownScale * ultimateAutoScale);
  }
  if (input.manualPressed && state.player.manualCooldown <= 0) {
    executeAbility(state, hero.manualAbility);
    addCombatEvent(state, "manual", state.player.x, state.player.y, 1, hero.manualAbility.vfxKey, hero.manualAbility.name);
    const ultimateDuration = activateUltimate(state);
    state.player.manualCooldown = Math.max(0.4, hero.manualAbility.cooldown * state.player.cooldownScale + ultimateDuration);
  }
}

function updateBuildSupport(state: RunState): void {
  if (state.player.orbitGuard <= 0 || state.player.orbitCooldown > 0 || state.enemies.length === 0) {
    return;
  }
  const stacks = Math.min(4, Math.floor(state.player.orbitGuard));
  state.areas.push({
    uid: state.nextUid++,
    source: "player",
    target: "enemy",
    x: state.player.x,
    y: state.player.y,
    radius: (74 + stacks * 12) * state.player.areaScale,
    damagePerSecond: (34 + stacks * 13) * state.player.damageScale,
    ttl: 0.5,
    tickTimer: 0,
    tickEvery: 0.12,
    tags: ["blade", "shock"],
    vfxKey: "guard_swords"
  });
  state.player.orbitCooldown = Math.max(0.72, 1.55 - stacks * 0.16);
}

function activateUltimate(state: RunState): number {
  const profile = ultimateByHeroId[state.hero.id];
  const duration = profile.duration + state.player.ultimateDurationBonus;
  state.player.ultimateTimer = duration;
  state.player.ultimatePulseCooldown = Math.min(profile.pulseEvery, 0.35);
  state.player.ultimatePulseCount = 0;
  if (state.hero.id === "xiahoudun") {
    state.player.berserkTimer = Math.max(state.player.berserkTimer, duration);
  }
  state.player.ultimateFinisherTriggered = false;
  addFloatingText(state, state.player.x, state.player.y - 92, profile.name, "xp");
  addCombatEvent(state, "ultimate", state.player.x, state.player.y, 1.75, profile.presentation.startVfxKey, profile.name);
  return duration;
}

function updateUltimateSupport(state: RunState): void {
  if (state.player.ultimateTimer <= 0) {
    return;
  }
  const profile = ultimateByHeroId[state.hero.id];
  while (state.player.ultimatePulseCooldown <= 0 && state.player.ultimateTimer > 0) {
    state.player.ultimatePulseCount += 1;
    for (const ability of pulseAbilitiesFor(state, profile)) {
      executeAbility(state, ability);
    }
    if (state.player.ultimatePulseCount % 3 === 0) {
      addCombatEvent(state, "ultimate", state.player.x, state.player.y, 0.62, profile.presentation.pulseVfxKey, profile.presentation.shortLabel);
    }
    state.player.ultimatePulseCooldown += Math.max(0.3, profile.pulseEvery);
  }
}

function triggerUltimateFinisher(state: RunState, profile: UltimateProfile): void {
  state.player.ultimateFinisherTriggered = true;
  executeAbility(state, profile.finisherAbility);
  if (state.hero.id === "huatuo") {
    healPlayer(state, 18 + state.player.level * (1.2 + state.player.ultimatePower));
  }
  addFloatingText(state, state.player.x, state.player.y - 100, profile.presentation.shortLabel, "xp");
  addCombatEvent(state, "ultimate", state.player.x, state.player.y, 1.45, profile.finisherVfxKey, profile.finisherAbility.name);
}

function pulseAbilitiesFor(state: RunState, profile: UltimateProfile) {
  const empowered = Boolean(state.unlocks[profile.empoweredUnlockId]);
  const abilities = [empowered && profile.empoweredPulseAbility ? profile.empoweredPulseAbility : profile.pulseAbility];
  if (empowered && profile.alternatePulseAbility && state.player.ultimatePulseCount % 2 === 0) {
    abilities.push(profile.alternatePulseAbility);
  }
  if (empowered && profile.bonusPulseAbility && profile.bonusEvery && state.player.ultimatePulseCount % profile.bonusEvery === 0) {
    abilities.push(profile.bonusPulseAbility);
  }
  return abilities;
}

function updateTechniqueCooldowns(state: RunState, dt: number): void {
  for (const [id, cooldown] of Object.entries(state.techniqueCooldowns)) {
    state.techniqueCooldowns[id] = Math.max(0, cooldown - dt);
  }
}

function updateTechniqueSupport(state: RunState): void {
  if (state.enemies.length === 0) {
    return;
  }
  for (const technique of techniques) {
    if (!state.unlocks[technique.unlockId]) {
      continue;
    }
    if ((state.techniqueCooldowns[technique.id] ?? 0) > 0) {
      continue;
    }
    executeAbility(state, technique.ability);
    addCombatEvent(state, "levelUp", state.player.x, state.player.y, 0.42, technique.ability.vfxKey, technique.ability.name);
    state.techniqueCooldowns[technique.id] = Math.max(1.2, technique.cooldown * state.player.cooldownScale);
  }
}

function updateCompanionSupport(state: RunState): void {
  if (state.player.companionCooldown > 0) {
    return;
  }
  const hasFactionCompanion =
    state.unlocks.wei_tiger_guard || state.unlocks.shu_oath || state.unlocks.wu_chain_fire || state.unlocks.qun_flower_guard;
  if ((!hasFactionCompanion && state.player.companionCount <= 0) || state.enemies.length === 0) {
    return;
  }
  const summoned = Math.min(3, Math.floor(state.player.companionCount));
  executeAbility(state, {
    id: "companion_support",
    name: "陣營支援",
    description: "陣營羈絆自動追擊敵軍。",
    trigger: "auto",
    cooldown: 3.5,
    range: 560,
    radius: state.unlocks.wu_chain_fire ? 48 : state.unlocks.qun_flower_guard ? 46 : 38,
    damage: (46 + summoned * 12) * state.player.companionDamage,
    damageTags: state.unlocks.wu_chain_fire
      ? ["arrow", "fire"]
      : state.unlocks.qun_flower_guard
        ? ["blade", "charm"]
        : state.unlocks.shu_oath
          ? ["blade", "shock"]
          : ["command", "shock"],
    vfxKey: state.unlocks.wu_chain_fire
      ? "arrow_rain"
      : state.unlocks.qun_flower_guard
        ? "petal_waltz"
        : state.unlocks.shu_oath
          ? "dragon_slash"
          : "tiger_cavalry",
    effectId: state.unlocks.wu_chain_fire
      ? "companion_arrows"
      : state.unlocks.qun_flower_guard
        ? "companion_petals"
        : state.unlocks.shu_oath
          ? "companion_oath"
          : "companion_charge"
  });
  state.player.companionCooldown = Math.max(
    2.1,
    (state.unlocks.wei_tiger_guard ? 2.8 : state.unlocks.qun_flower_guard ? 3.1 : 3.5) - summoned * 0.22
  );
}

function updateEnemies(state: RunState, dt: number): void {
  for (const enemy of state.enemies) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
    enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
    if (enemy.burnTimer > 0) {
      enemy.burnTimer = Math.max(0, enemy.burnTimer - dt);
      enemy.hp -= enemy.burnDps * dt;
    }
    if (enemy.stunTimer > 0) {
      continue;
    }

    const def = enemyById[enemy.defId];
    updateBossPhase(state, enemy);
    const toPlayer = normalize({ x: state.player.x - enemy.x, y: state.player.y - enemy.y });
    const playerDistance = distance(enemy, state.player);

    if (def.tags.includes("ranged")) {
      const moveSign = playerDistance < 230 ? -1 : playerDistance > 315 ? 1 : 0;
      enemy.x += toPlayer.x * enemy.speed * moveSign * dt;
      enemy.y += toPlayer.y * enemy.speed * moveSign * dt;
      if (enemy.attackCooldown <= 0 && playerDistance <= def.attackRange) {
        addEnemyArrow(state, enemy.x, enemy.y);
        enemy.attackCooldown = def.attackCooldown;
      }
    } else {
      const burst = def.tags.includes("fast") && playerDistance > 180 ? 1.45 : 1;
      enemy.x += toPlayer.x * enemy.speed * burst * dt;
      enemy.y += toPlayer.y * enemy.speed * burst * dt;
      if (enemy.attackCooldown <= 0 && playerDistance <= enemy.radius + state.player.radius + 10) {
        damagePlayer(state, enemy.damage);
        enemy.attackCooldown = def.attackCooldown / bossPhaseSpeed(enemy);
      }
    }

    if (enemy.defId === "lubu" && enemy.attackCooldown <= 0 && playerDistance < 260) {
      addBossShockwave(state, enemy.x, enemy.y);
      enemy.attackCooldown = def.attackCooldown / bossPhaseSpeed(enemy);
    }
  }
}

function updateBossPhase(
  state: RunState,
  enemy: { defId: string; hp: number; maxHp: number; phase: number; speed: number; damage: number; x: number; y: number }
): void {
  if (enemy.defId !== "lubu") {
    return;
  }
  const ratio = enemy.hp / enemy.maxHp;
  const nextPhase = ratio < 0.34 ? 3 : ratio < 0.67 ? 2 : 1;
  if (nextPhase <= enemy.phase) {
    return;
  }
  enemy.phase = nextPhase;
  enemy.speed += nextPhase === 2 ? 22 : 30;
  enemy.damage += nextPhase === 2 ? 8 : 12;
  addBossShockwave(state, enemy.x, enemy.y);
  addFloatingText(state, enemy.x, enemy.y - 96, nextPhase === 2 ? "飛將震怒" : "無雙爆發", "alert");
  addCombatEvent(state, "boss", enemy.x, enemy.y, nextPhase === 2 ? 1.4 : 2, "evolution_burst", "呂布覺醒");
}

function bossPhaseSpeed(enemy: { defId: string; phase: number }): number {
  if (enemy.defId !== "lubu") {
    return 1;
  }
  return enemy.phase === 3 ? 1.55 : enemy.phase === 2 ? 1.25 : 1;
}

function updateProjectiles(state: RunState, dt: number): void {
  const survivors: ProjectileState[] = [];
  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.ttl -= dt;

    if (projectile.target === "enemy") {
      for (const enemy of state.enemies) {
        if (projectile.hitIds.includes(enemy.uid)) {
          continue;
        }
        if (distance(projectile, enemy) <= projectile.radius + enemy.radius) {
          damageEnemy(state, enemy, projectile.damage, projectile.tags);
          projectile.hitIds.push(enemy.uid);
          if (projectile.tags.includes("shock")) {
            enemy.stunTimer = Math.max(enemy.stunTimer, 0.18);
          }
          if (projectile.tags.includes("charm")) {
            enemy.stunTimer = Math.max(enemy.stunTimer, charmStunDuration(state, state.unlocks.evolution_diaochan ? 0.36 : 0.22));
          }
          if (projectile.hitIds.length > projectile.pierce) {
            if (!redirectRicochet(state, projectile)) {
              projectile.ttl = 0;
              break;
            }
          }
        }
      }
    } else if (distance(projectile, state.player) <= projectile.radius + state.player.radius) {
      damagePlayer(state, projectile.damage);
      projectile.ttl = 0;
    }

    if (projectile.ttl > 0) {
      survivors.push(projectile);
    }
  }
  state.projectiles = survivors;
}

function redirectRicochet(state: RunState, projectile: ProjectileState): boolean {
  if (state.player.ricochet <= 0) {
    return false;
  }
  const remainingBounces = Math.floor(state.player.ricochet) - projectile.hitIds.length + projectile.pierce + 1;
  if (remainingBounces <= 0) {
    return false;
  }
  let nearest:
    | {
        enemy: { uid: number; x: number; y: number };
        distance: number;
      }
    | undefined;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || projectile.hitIds.includes(enemy.uid)) {
      continue;
    }
    const current = distance(projectile, enemy);
    if (current > 360 || (nearest && current >= nearest.distance)) {
      continue;
    }
    nearest = { enemy, distance: current };
  }
  if (!nearest) {
    return false;
  }
  const velocity = Math.max(260, Math.hypot(projectile.vx, projectile.vy));
  const direction = normalize({ x: nearest.enemy.x - projectile.x, y: nearest.enemy.y - projectile.y });
  projectile.vx = direction.x * velocity;
  projectile.vy = direction.y * velocity;
  projectile.pierce += 1;
  projectile.ttl = Math.max(projectile.ttl, 0.22);
  return true;
}

function updateAreas(state: RunState, dt: number): void {
  const survivors: AreaState[] = [];
  for (const area of state.areas) {
    area.ttl -= dt;
    area.tickTimer -= dt;
    if (area.tickTimer <= 0) {
      area.tickTimer += area.tickEvery;
      const tickDamage = area.damagePerSecond * area.tickEvery;
      if (area.target === "enemy") {
        for (const enemy of state.enemies) {
          if (distance(area, enemy) <= area.radius + enemy.radius) {
            damageEnemy(state, enemy, tickDamage, area.tags);
            if (area.tags.includes("shock")) {
              enemy.stunTimer = Math.max(enemy.stunTimer, 0.14);
            }
            if (area.tags.includes("charm")) {
              enemy.stunTimer = Math.max(enemy.stunTimer, charmStunDuration(state, state.unlocks.evolution_diaochan ? 0.42 : 0.24));
            }
          }
        }
      } else if (distance(area, state.player) <= area.radius + state.player.radius) {
        damagePlayer(state, tickDamage);
      }
    }
    if (area.ttl > 0) {
      survivors.push(area);
    }
  }
  state.areas = survivors;
}

function updateXpOrbs(state: RunState, dt: number): void {
  const survivors: XpOrbState[] = [];
  for (const orb of state.xpOrbs) {
    const orbDistance = distance(orb, state.player);
    if (orbDistance <= state.player.pickupRadius) {
      const direction = normalize({ x: state.player.x - orb.x, y: state.player.y - orb.y });
      const speed = 420 + (state.player.pickupRadius - orbDistance) * 4;
      orb.x += direction.x * speed * dt;
      orb.y += direction.y * speed * dt;
    }
    if (distance(orb, state.player) <= state.player.radius + orb.radius + 8) {
      gainXp(state, orb.value);
      continue;
    }
    survivors.push(orb);
  }
  state.xpOrbs = survivors;
}

function charmStunDuration(state: RunState, baseDuration: number): number {
  if (state.player.heroId !== "diaochan" || state.player.ultimateTimer <= 0) {
    return baseDuration;
  }
  return baseDuration * (1.45 + state.player.ultimatePower);
}

function updateFloatingTexts(state: RunState, dt: number): void {
  state.floatingTexts = state.floatingTexts
    .map((text) => ({ ...text, y: text.y - 34 * dt, ttl: text.ttl - dt }))
    .filter((text) => text.ttl > 0);
}

export function collectDebugXp(state: RunState, amount: number): void {
  gainXp(state, amount);
}
