import { enemyById } from "../content/enemies";
import { techniques } from "../content/techniques";
import type { AreaState, InputState, ProjectileState, RunState, XpOrbState } from "../types";
import { addBossShockwave, addEnemyArrow, executeAbility } from "./abilities";
import {
  addCombatEvent,
  addFloatingText,
  damageEnemy,
  damagePlayer,
  gainXp,
  healPlayer,
  resolveDeadEnemies,
  updateCombatEvents
} from "./combat";
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
  updateTechniqueCooldowns(state, safeDt);
  state.player.berserkTimer = Math.max(0, state.player.berserkTimer - safeDt);
  if (state.player.regen > 0) {
    healPlayer(state, state.player.regen * safeDt);
  }

  movePlayer(state, input, safeDt);
  updateSpawner(state, safeDt);
  updateAbilities(state, input);
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
  if (Math.hypot(move.x, move.y) > 0.01) {
    state.lastFacing = move;
  }
  state.player.x = clamp(state.player.x + move.x * state.player.moveSpeed * dt, 48, state.world.width - 48);
  state.player.y = clamp(state.player.y + move.y * state.player.moveSpeed * dt, 48, state.world.height - 48);
}

function updateAbilities(state: RunState, input: InputState): void {
  const hero = state.hero;
  if (state.player.autoCooldown <= 0) {
    executeAbility(state, hero.autoAbility);
    state.player.autoCooldown = Math.max(0.15, hero.autoAbility.cooldown * state.player.cooldownScale);
  }
  if (input.manualPressed && state.player.manualCooldown <= 0) {
    executeAbility(state, hero.manualAbility);
    addCombatEvent(state, "manual", state.player.x, state.player.y, 1, hero.manualAbility.vfxKey, hero.manualAbility.name);
    state.player.manualCooldown = Math.max(0.4, hero.manualAbility.cooldown * state.player.cooldownScale);
  }
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
  if (!hasFactionCompanion || state.enemies.length === 0) {
    return;
  }
  executeAbility(state, {
    id: "companion_support",
    name: "陣營支援",
    description: "陣營羈絆自動追擊敵軍。",
    trigger: "auto",
    cooldown: 3.5,
    range: 560,
    radius: state.unlocks.wu_chain_fire ? 48 : state.unlocks.qun_flower_guard ? 46 : 38,
    damage: 46 * state.player.companionDamage,
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
  state.player.companionCooldown = state.unlocks.wei_tiger_guard ? 2.8 : state.unlocks.qun_flower_guard ? 3.1 : 3.5;
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
            enemy.stunTimer = Math.max(enemy.stunTimer, state.unlocks.evolution_diaochan ? 0.36 : 0.22);
          }
          if (projectile.hitIds.length > projectile.pierce) {
            projectile.ttl = 0;
            break;
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
              enemy.stunTimer = Math.max(enemy.stunTimer, state.unlocks.evolution_diaochan ? 0.42 : 0.24);
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

function updateFloatingTexts(state: RunState, dt: number): void {
  state.floatingTexts = state.floatingTexts
    .map((text) => ({ ...text, y: text.y - 34 * dt, ttl: text.ttl - dt }))
    .filter((text) => text.ttl > 0);
}

export function collectDebugXp(state: RunState, amount: number): void {
  gainXp(state, amount);
}
