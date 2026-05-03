import type { EnemyDef } from "../types";

export const enemies: EnemyDef[] = [
  {
    id: "infantry",
    name: "虎牢步兵",
    maxHp: 34,
    speed: 102,
    radius: 18,
    damage: 10,
    xp: 3,
    score: 10,
    attackRange: 28,
    attackCooldown: 0.75,
    spriteKey: "enemy_infantry",
    tags: ["troop"]
  },
  {
    id: "archer",
    name: "關東弓兵",
    maxHp: 26,
    speed: 76,
    radius: 16,
    damage: 8,
    xp: 4,
    score: 14,
    attackRange: 360,
    attackCooldown: 2,
    spriteKey: "enemy_archer",
    tags: ["troop", "ranged"]
  },
  {
    id: "shield",
    name: "重盾兵",
    maxHp: 78,
    speed: 70,
    radius: 22,
    damage: 13,
    xp: 7,
    score: 24,
    attackRange: 34,
    attackCooldown: 0.95,
    spriteKey: "enemy_shield",
    tags: ["troop", "armored"]
  },
  {
    id: "cavalry",
    name: "突騎兵",
    maxHp: 52,
    speed: 156,
    radius: 20,
    damage: 15,
    xp: 6,
    score: 20,
    attackRange: 36,
    attackCooldown: 1.1,
    spriteKey: "enemy_cavalry",
    tags: ["troop", "fast"]
  },
  {
    id: "captain",
    name: "精英將校",
    maxHp: 210,
    speed: 92,
    radius: 28,
    damage: 18,
    xp: 22,
    score: 110,
    attackRange: 44,
    attackCooldown: 1,
    spriteKey: "enemy_captain",
    tags: ["elite"]
  },
  {
    id: "lubu",
    name: "呂布",
    maxHp: 2400,
    speed: 128,
    radius: 46,
    damage: 30,
    xp: 0,
    score: 1600,
    attackRange: 74,
    attackCooldown: 0.82,
    spriteKey: "enemy_lubu",
    tags: ["boss"]
  }
];

export const enemyById = Object.fromEntries(enemies.map((enemy) => [enemy.id, enemy])) as Record<
  EnemyDef["id"],
  EnemyDef
>;
