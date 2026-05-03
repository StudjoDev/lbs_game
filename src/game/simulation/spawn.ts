import { enemyById } from "../content/enemies";
import type { EnemyId, EnemyState, RunState } from "../types";
import { clamp, fromAngle, scale } from "./math";
import { randomInt, randomRange } from "./rng";

const maxEnemies = 350;

export function updateSpawner(state: RunState, dt: number): void {
  if (state.enemies.length >= maxEnemies) {
    return;
  }

  state.spawnTimer -= dt;
  const interval = Math.max(0.18, 0.86 - state.elapsed / 760);
  while (state.spawnTimer <= 0 && state.enemies.length < maxEnemies) {
    spawnWave(state);
    state.spawnTimer += interval;
  }

  if (!state.bossSpawned && state.elapsed >= state.bossSpawnTime) {
    spawnEnemy(state, "lubu", 520);
    state.bossSpawned = true;
  }
}

export function spawnEnemy(state: RunState, defId: EnemyId, distanceFromPlayer = 760): EnemyState {
  const def = enemyById[defId];
  const angle = randomRange(state, 0, Math.PI * 2);
  const offset = scale(fromAngle(angle), distanceFromPlayer);
  const x = clamp(state.player.x + offset.x, 72, state.world.width - 72);
  const y = clamp(state.player.y + offset.y, 72, state.world.height - 72);
  const enemy: EnemyState = {
    uid: state.nextUid++,
    defId,
    x,
    y,
    radius: def.radius,
    hp: def.maxHp,
    maxHp: def.maxHp,
    speed: def.speed,
    damage: def.damage,
    attackCooldown: randomRange(state, 0.2, def.attackCooldown),
    burnTimer: 0,
    burnDps: 0,
    stunTimer: 0,
    flashTimer: 0,
    phase: 1
  };
  state.enemies.push(enemy);
  return enemy;
}

function spawnWave(state: RunState): void {
  const count = Math.min(10, 2 + Math.floor(state.elapsed / 45));
  for (let index = 0; index < count && state.enemies.length < maxEnemies; index += 1) {
    spawnEnemy(state, chooseEnemy(state), randomRange(state, 650, 880));
  }
  if (state.elapsed > 95 && randomInt(state, 0, 100) < 10) {
    spawnEnemy(state, "captain", randomRange(state, 700, 920));
  }
}

function chooseEnemy(state: RunState): EnemyId {
  const roll = randomInt(state, 0, 100);
  if (state.elapsed > 260 && roll < 16) {
    return "cavalry";
  }
  if (state.elapsed > 160 && roll < 24) {
    return "shield";
  }
  if (state.elapsed > 80 && roll < 34) {
    return "archer";
  }
  return "infantry";
}
