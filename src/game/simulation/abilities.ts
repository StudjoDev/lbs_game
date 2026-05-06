import type { AbilityDef, AreaState, ProjectileState, RunState, Vector2 } from "../types";
import { add, clamp, fromAngle, normalize, scale } from "./math";
import { findNearestEnemy } from "./combat";
import { randomRange } from "./rng";

export function executeAbility(state: RunState, ability: AbilityDef): void {
  const facing = getAbilityFacing(state, ability.range);
  const ownedByCurrentHero = ability.ownerHeroId === state.hero.id;
  const evolved = isEvolvedHeroAbility(state, ability);
  const ultimateScale = ownedByCurrentHero && state.player.ultimateTimer > 0 ? 1.25 + state.player.ultimatePower : 1;
  const evolutionScale = evolved ? 1.24 + state.player.evolvedPower : 1;
  const damage = ability.damage * evolutionScale * ultimateScale;
  const areaRadius = ability.radius * state.player.areaScale * (evolved ? 1.16 : 1) * (ownedByCurrentHero && state.player.ultimateTimer > 0 ? 1.12 : 1);

  if (ability.effectId === "arc_sweep") {
    const offsets = evolved ? [-0.68, -0.34, 0, 0.34, 0.68] : [-0.42, 0, 0.42];
    for (const offset of offsets) {
      addProjectile(state, ability, rotate(facing, offset), damage, areaRadius, 360, 0.24, 6);
    }
  } else if (ability.effectId === "spear_flurry") {
    addProjectile(state, ability, facing, damage, areaRadius, 610, 0.72, 4);
    if (evolved) {
      addProjectile(state, ability, rotate(facing, -0.2), damage * 0.72, areaRadius * 0.86, 650, 0.68, 3);
      addProjectile(state, ability, rotate(facing, 0.2), damage * 0.72, areaRadius * 0.86, 650, 0.68, 3);
    }
  } else if (ability.effectId === "guard_swords") {
    const offsets = evolved ? [-0.48, -0.16, 0.16, 0.48] : [-0.34, 0, 0.34];
    for (const offset of offsets) {
      addProjectile(state, ability, rotate(facing, offset), damage, areaRadius, 520, 0.7, 3);
    }
    if (evolved) {
      addArea(state, ability, add(state.player, scale(facing, 170)), damage * 1.2, areaRadius * 2.2, 0.38, 0.12);
    }
  } else if (ability.effectId === "heavy_cleave") {
    const center = add(state.player, scale(facing, 88));
    addArea(state, ability, center, damage * 3.1, areaRadius, 0.22, 0.11);
    if (evolved) {
      addArea(state, ability, add(center, scale(facing, 110)), damage * 2, areaRadius * 0.9, 0.28, 0.12);
    }
  } else if (ability.effectId === "fire_note") {
    addProjectile(state, ability, facing, damage, areaRadius, 430, 0.92, 2);
    const center = add(state.player, scale(facing, 160));
    addArea(state, ability, center, damage * 0.9, areaRadius * 1.3, evolved ? 3 : 1.8, 0.35);
    if (evolved) {
      addArea(state, ability, add(center, scale(rotate(facing, 0.55), 90)), damage * 0.7, areaRadius, 2.4, 0.35);
      addArea(state, ability, add(center, scale(rotate(facing, -0.55), 90)), damage * 0.7, areaRadius, 2.4, 0.35);
    }
  } else if (ability.effectId === "fan_bolts") {
    const offsets = evolved ? [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72] : [-0.55, -0.28, 0, 0.28, 0.55];
    for (const offset of offsets) {
      addProjectile(state, ability, rotate(facing, offset), damage, areaRadius, 560, 0.72, 1);
    }
  } else if (ability.effectId === "petal_waltz") {
    const rings = evolved ? 3 : 2;
    for (let index = 0; index < rings; index += 1) {
      addArea(state, ability, state.player, damage * (1.35 + index * 0.22), areaRadius * (0.82 + index * 0.16), 0.2 + index * 0.08, 0.08);
    }
    const side = add(state.player, scale(rotate(facing, evolved ? 0.85 : 0.62), areaRadius * 0.58));
    addArea(state, ability, side, damage * 0.86, areaRadius * 0.58, 0.24, 0.08);
  } else if (ability.effectId === "dragon_slash") {
    addProjectile(state, ability, facing, damage, areaRadius, 760, 0.9, 12);
    if (evolved) {
      addArea(state, ability, add(state.player, scale(facing, 310)), damage * 1.8, areaRadius * 2.4, 0.42, 0.12);
    }
  } else if (ability.effectId === "seven_dashes") {
    const start = { x: state.player.x, y: state.player.y };
    const end = clampToWorld(state, add(start, scale(facing, ability.range)));
    state.player.x = end.x;
    state.player.y = end.y;
    addArea(state, ability, midpoint(start, end), damage * 2.2, areaRadius * 1.4, 0.3, 0.1);
    if (evolved) {
      addArea(state, ability, start, damage * 1.3, areaRadius, 0.32, 0.1);
      addArea(state, ability, end, damage * 1.6, areaRadius * 1.2, 0.32, 0.1);
    }
  } else if (ability.effectId === "tiger_cavalry") {
    const offsets = evolved ? [-0.32, -0.12, 0.12, 0.32] : [-0.18, 0, 0.18];
    for (const offset of offsets) {
      addProjectile(state, ability, rotate(facing, offset), damage, areaRadius, 720, 1, 14);
    }
  } else if (ability.effectId === "blood_rage") {
    state.player.berserkTimer = Math.max(state.player.berserkTimer, evolved ? 7 : 5.5);
    addArea(state, ability, state.player, damage * 2.5, areaRadius, 0.36, 0.12);
    if (evolved) {
      addArea(state, ability, state.player, damage * 1.3, areaRadius * 1.55, 1.4, 0.22);
    }
  } else if (ability.effectId === "red_cliff_fire") {
    const lanes = evolved ? 6 : 4;
    for (let index = 0; index < lanes; index += 1) {
      const center = add(state.player, scale(facing, 110 + index * 86));
      addArea(state, ability, center, damage, areaRadius, evolved ? 6 : 4.4, 0.35);
    }
  } else if (ability.effectId === "arrow_rain") {
    const drops = evolved ? 15 : 9;
    for (let index = 0; index < drops; index += 1) {
      const angle = randomRange(state, 0, Math.PI * 2);
      const radius = randomRange(state, 70, ability.range);
      const center = add(state.player, scale(fromAngle(angle), radius));
      addArea(state, ability, center, damage * 1.6, areaRadius, 1.1, 0.22);
    }
  } else if (ability.effectId === "allure_dance") {
    const waves = evolved ? 7 : 5;
    for (let index = 0; index < waves; index += 1) {
      const angle = (Math.PI * 2 * index) / waves + randomRange(state, -0.14, 0.14);
      const center = add(state.player, scale(fromAngle(angle), areaRadius * 0.36));
      addArea(state, ability, center, damage * (1.08 + index * 0.05), areaRadius * (0.78 + index * 0.06), evolved ? 1.05 : 0.82, 0.14);
    }
    addArea(state, ability, state.player, damage * 1.45, areaRadius * 1.22, evolved ? 1.3 : 0.95, 0.12);
  } else if (ability.effectId === "moon_blades") {
    const blades = 8;
    for (let index = 0; index < blades; index += 1) {
      const angle = (Math.PI * 2 * index) / blades + randomRange(state, -0.08, 0.08);
      addProjectile(state, ability, fromAngle(angle), damage, areaRadius, 500, 0.68, 3);
    }
  } else if (ability.effectId === "frost_lotus") {
    const target = findNearestEnemy(state, ability.range);
    const center = target ?? add(state.player, scale(facing, 180));
    addArea(state, ability, center, damage * 1.2, areaRadius, 1.25, 0.25);
    addArea(state, ability, center, damage * 0.55, areaRadius * 1.45, 0.55, 0.18);
  } else if (ability.effectId === "phoenix_feathers") {
    const offsets = [-0.82, -0.55, -0.28, 0, 0.28, 0.55, 0.82];
    for (const offset of offsets) {
      addProjectile(state, ability, rotate(facing, offset), damage, areaRadius, 620, 0.88, 2);
    }
  } else if (ability.effectId === "thunder_charm") {
    const targets = nearestEnemies(state, ability.range, 4);
    const centers = targets.length > 0 ? targets : [add(state.player, scale(facing, 220))];
    for (const target of centers) {
      addArea(state, ability, target, damage * 1.35, areaRadius, 0.42, 0.12);
    }
  } else if (ability.effectId === "shadow_clones") {
    const offsets = [-0.38, 0, 0.38];
    for (const offset of offsets) {
      addProjectile(state, ability, rotate(facing, offset), damage * 1.12, areaRadius, 720, 0.86, 6);
    }
  } else if (ability.effectId === "siege_drums") {
    addArea(state, ability, state.player, damage * 1.45, areaRadius, 0.42, 0.12);
    addArea(state, ability, add(state.player, scale(facing, 120)), damage * 0.9, areaRadius * 0.72, 0.5, 0.14);
  } else if (ability.effectId === "companion_arrows") {
    for (const offset of [-0.5, -0.25, 0, 0.25, 0.5]) {
      addProjectile(state, ability, rotate(facing, offset), damage, areaRadius, 610, 0.8, 2);
    }
  } else if (ability.effectId === "companion_oath") {
    addProjectile(state, ability, facing, damage * 1.25, areaRadius * 1.25, 650, 0.8, 8);
  } else if (ability.effectId === "companion_charge") {
    for (const offset of [-0.25, 0, 0.25]) {
      addProjectile(state, ability, rotate(facing, offset), damage * 1.1, areaRadius, 700, 0.9, 8);
    }
  } else if (ability.effectId === "companion_petals") {
    const petals = [-0.72, -0.36, 0, 0.36, 0.72];
    for (const offset of petals) {
      addProjectile(state, ability, rotate(facing, offset), damage * 0.92, areaRadius, 520, 0.72, 2);
    }
  }
}

export function addEnemyArrow(state: RunState, x: number, y: number): void {
  const direction = normalize({ x: state.player.x - x, y: state.player.y - y });
  state.projectiles.push({
    uid: state.nextUid++,
    source: "enemy",
    target: "player",
    x,
    y,
    vx: direction.x * 320,
    vy: direction.y * 320,
    radius: 13,
    damage: 13,
    ttl: 2.2,
    pierce: 0,
    hitIds: [],
    tags: ["arrow"],
    vfxKey: "enemy_arrow"
  });
}

export function addBossShockwave(state: RunState, x: number, y: number): void {
  const area: AreaState = {
    uid: state.nextUid++,
    source: "enemy",
    target: "player",
    x,
    y,
    radius: 120,
    damagePerSecond: 52,
    ttl: 0.45,
    tickTimer: 0,
    tickEvery: 0.16,
    tags: ["shock"],
    vfxKey: "lubu_shock"
  };
  state.areas.push(area);
}

function addProjectile(
  state: RunState,
  ability: AbilityDef,
  direction: Vector2,
  damage: number,
  radius: number,
  speed: number,
  ttl: number,
  pierce: number,
  forked = false
): ProjectileState {
  const start = add(state.player, scale(direction, 38));
  const projectile: ProjectileState = {
    uid: state.nextUid++,
    source: "player",
    target: "enemy",
    x: start.x,
    y: start.y,
    vx: direction.x * speed,
    vy: direction.y * speed,
    radius,
    damage,
    ttl,
    pierce: pierce + Math.floor(state.player.projectilePierce),
    hitIds: [],
    tags: ability.damageTags,
    vfxKey: ability.vfxKey
  };
  state.projectiles.push(projectile);
  addBuildProjectiles(state, ability, direction, damage, radius, speed, ttl, pierce, forked);
  return projectile;
}

function addBuildProjectiles(
  state: RunState,
  ability: AbilityDef,
  direction: Vector2,
  damage: number,
  radius: number,
  speed: number,
  ttl: number,
  pierce: number,
  forked: boolean
): void {
  if (forked || ability.ownerHeroId !== state.hero.id || ability.trigger === "ultimate") {
    return;
  }
  const frontShots = Math.min(2, Math.floor(state.player.frontShot));
  const rearShots = Math.min(1, Math.floor(state.player.rearShot));
  const extraVolleys = Math.min(1, Math.floor(state.player.extraVolley));

  for (let index = 0; index < frontShots; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    addProjectile(state, ability, rotate(direction, side * (0.18 + index * 0.04)), damage * 0.62, radius * 0.92, speed, ttl, pierce, true);
  }
  for (let index = 0; index < rearShots; index += 1) {
    addProjectile(state, ability, rotate(direction, Math.PI), damage * 0.58, radius * 0.9, speed * 0.92, ttl, pierce, true);
  }
  for (let index = 0; index < extraVolleys; index += 1) {
    addProjectile(state, ability, direction, damage * 0.48, radius * 0.86, speed * 0.86, ttl + 0.08, pierce, true);
  }
}

function addArea(
  state: RunState,
  ability: AbilityDef,
  center: Vector2,
  damagePerSecond: number,
  radius: number,
  ttl: number,
  tickEvery: number
): void {
  state.areas.push({
    uid: state.nextUid++,
    source: "player",
    target: "enemy",
    x: center.x,
    y: center.y,
    radius,
    damagePerSecond,
    ttl,
    tickTimer: 0,
    tickEvery,
    tags: ability.damageTags,
    vfxKey: ability.vfxKey
  });
}

function getAbilityFacing(state: RunState, range: number): Vector2 {
  const nearest = findNearestEnemy(state, range);
  if (nearest) {
    const direction = normalize({ x: nearest.x - state.player.x, y: nearest.y - state.player.y });
    state.lastFacing = direction;
    return direction;
  }
  return normalize(state.lastFacing);
}

function rotate(vector: Vector2, radians: number): Vector2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

function midpoint(a: Vector2, b: Vector2): Vector2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function nearestEnemies(state: RunState, range: number, limit: number): Vector2[] {
  return [...state.enemies]
    .map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) }))
    .filter((item) => item.distance <= range)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((item) => ({ x: item.enemy.x, y: item.enemy.y }));
}

function clampToWorld(state: RunState, point: Vector2): Vector2 {
  return {
    x: clamp(point.x, 80, state.world.width - 80),
    y: clamp(point.y, 80, state.world.height - 80)
  };
}

function isEvolvedHeroAbility(state: RunState, ability: AbilityDef): boolean {
  return ability.ownerHeroId === state.hero.id && Boolean(state.unlocks[`evolution_${state.hero.id}`]);
}
