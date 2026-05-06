import { enemyById } from "../content/enemies";
import type { EnemyId, EnemyState, RunState } from "../types";
import { currentRoomDef } from "./chapterRun";
import { clamp, fromAngle, scale } from "./math";
import { randomInt, randomRange } from "./rng";

const maxEnemies = 350;

export function updateSpawner(state: RunState, dt: number): void {
  if (state.enemies.length >= maxEnemies || state.roomStatus !== "fighting") {
    return;
  }
  const room = currentRoomDef(state);
  if (room.type === "treasure" || room.type === "rest") {
    return;
  }

  if (room.type === "boss" && !state.bossSpawned) {
    const boss = spawnEnemy(state, "lubu", 420);
    const chapterScale = state.chapterId === "red_cliff_line" ? 1.25 : state.chapterId === "hulao_outer" ? 1.12 : 1;
    boss.maxHp = Math.round(boss.maxHp * chapterScale);
    boss.hp = boss.maxHp;
    state.bossSpawned = true;
  }

  state.spawnTimer -= dt;
  const interval = Math.max(0.2, (0.86 - state.elapsed / 900) * room.spawn.intervalScale);
  while (state.spawnTimer <= 0 && state.enemies.length < maxEnemies) {
    spawnWave(state);
    state.spawnTimer += interval;
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
  const room = currentRoomDef(state);
  const roomLimit = room.type === "boss" ? 28 : maxEnemies;
  const count = Math.min(room.type === "elite" ? 8 : 10, 2 + Math.floor(state.roomElapsed / 18) + room.spawn.countBonus);
  for (let index = 0; index < count && state.enemies.length < maxEnemies; index += 1) {
    if (state.enemies.length >= roomLimit) {
      return;
    }
    spawnEnemy(state, chooseEnemy(state), randomRange(state, 650, 880));
  }
  if (state.roomType !== "boss" && randomInt(state, 0, 100) < room.spawn.eliteChance) {
    spawnEnemy(state, "captain", randomRange(state, 700, 920));
  }
}

function chooseEnemy(state: RunState): EnemyId {
  const room = currentRoomDef(state);
  if (room.type === "elite") {
    const roll = randomInt(state, 0, 100);
    if (roll < 34) {
      return "captain";
    }
    if (roll < 72) {
      return "shield";
    }
    return "cavalry";
  }
  if (room.type === "boss") {
    return room.spawn.preferred[randomInt(state, 0, room.spawn.preferred.length)] ?? "infantry";
  }
  if (randomInt(state, 0, 100) < room.spawn.guardChance) {
    return room.spawn.preferred[randomInt(state, 0, room.spawn.preferred.length)] ?? "infantry";
  }
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
