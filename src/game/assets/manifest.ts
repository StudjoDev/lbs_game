export { audioAssetEntries, audioKeys, audioPaths } from "../audio/catalog";
import type { EnemyId } from "../types";

export const textureKeys = {
  heroes: ["hero_guanyu", "hero_zhaoyun", "hero_caocao", "hero_xiahoudun", "hero_zhouyu", "hero_sunshangxiang"],
  heroAttackFrames: [
    "hero_guanyu_attack_0",
    "hero_guanyu_attack_1",
    "hero_guanyu_attack_2",
    "hero_guanyu_attack_3",
    "hero_zhaoyun_attack_0",
    "hero_zhaoyun_attack_1",
    "hero_zhaoyun_attack_2",
    "hero_zhaoyun_attack_3",
    "hero_caocao_attack_0",
    "hero_caocao_attack_1",
    "hero_caocao_attack_2",
    "hero_caocao_attack_3",
    "hero_xiahoudun_attack_0",
    "hero_xiahoudun_attack_1",
    "hero_xiahoudun_attack_2",
    "hero_xiahoudun_attack_3",
    "hero_zhouyu_attack_0",
    "hero_zhouyu_attack_1",
    "hero_zhouyu_attack_2",
    "hero_zhouyu_attack_3",
    "hero_sunshangxiang_attack_0",
    "hero_sunshangxiang_attack_1",
    "hero_sunshangxiang_attack_2",
    "hero_sunshangxiang_attack_3"
  ],
  portraits: [
    "portrait_guanyu",
    "portrait_zhaoyun",
    "portrait_caocao",
    "portrait_xiahoudun",
    "portrait_zhouyu",
    "portrait_sunshangxiang"
  ],
  enemies: ["enemy_infantry", "enemy_archer", "enemy_shield", "enemy_cavalry", "enemy_captain", "enemy_lubu"],
  enemyAttackFrames: ["enemy_lubu_attack_0", "enemy_lubu_attack_1", "enemy_lubu_attack_2", "enemy_lubu_attack_3"],
  fx: ["slash", "spear", "fire", "arrow", "command", "shock", "xp_orb", "shadow"]
} as const;

const visualBasePath = `${import.meta.env.BASE_URL}assets/visual`;

export interface VisualAssetEntry {
  key: string;
  path: string;
}

export interface VfxProfile {
  textureKey: string;
  color: number;
  blendMode: "add" | "normal";
  scale: number;
  lifetime: number;
  particleKey?: string;
  animationKey?: string;
  telegraphShape?: "circle" | "slash" | "storm" | "rain" | "burst";
  presentationKind?: "meleeArc" | "rangedProjectile" | "areaField" | "rain" | "dash" | "aura";
  originMode?: "playerAnchored" | "projectile" | "targetArea" | "screenPulse";
  motionStyle?: "slashLunge" | "thrust" | "spin" | "cast" | "idle";
  arcDegrees?: number;
  followPlayer?: boolean;
}

export interface EnemyVisualProfile {
  spriteKey: string;
  shadowScale: number;
  hitTint: number;
  deathFxKey: string;
  baseScale: number;
  eliteFrame?: number;
  outlineColor?: number;
}

export const visualParticleAssets = [
  { key: "particle_smoke", path: `${visualBasePath}/particles/kenney-smoke.png` },
  { key: "particle_spark", path: `${visualBasePath}/particles/kenney-spark.png` },
  { key: "particle_magic", path: `${visualBasePath}/particles/kenney-magic.png` },
  { key: "particle_circle", path: `${visualBasePath}/particles/kenney-circle.png` },
  { key: "particle_dirt", path: `${visualBasePath}/particles/kenney-dirt.png` }
] as const satisfies readonly VisualAssetEntry[];

export const slashAnimationKey = "fx_slash_arc";

export const slashAnimationFrames = [1, 2, 3, 4, 5, 6].map((frame) => ({
  key: `fx_slash_${frame.toString().padStart(2, "0")}`,
  path: `${visualBasePath}/fx/slash/classic-${frame.toString().padStart(2, "0")}.png`
})) as readonly VisualAssetEntry[];

export const visualAssetEntries = [...visualParticleAssets, ...slashAnimationFrames] as const;

export const defaultVfxProfile: VfxProfile = {
  textureKey: "command",
  color: 0xaec5ff,
  blendMode: "add",
  scale: 1,
  lifetime: 0.42,
  particleKey: "particle_magic",
  telegraphShape: "circle",
  presentationKind: "areaField",
  originMode: "targetArea",
  motionStyle: "cast"
};

export const vfxProfiles: Record<string, VfxProfile> = {
  qinglong_arc: {
    textureKey: "melee_arc",
    color: 0x75f0aa,
    blendMode: "add",
    scale: 0.62,
    lifetime: 0.34,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 150,
    followPlayer: true
  },
  dragon_slash: {
    textureKey: "melee_arc",
    color: 0x75f0aa,
    blendMode: "add",
    scale: 0.9,
    lifetime: 0.38,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 190,
    followPlayer: true
  },
  spear_flash: {
    textureKey: "spear_thrust",
    color: 0xdffcff,
    blendMode: "add",
    scale: 0.88,
    lifetime: 0.24,
    particleKey: "particle_spark",
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "thrust",
    arcDegrees: 44,
    followPlayer: true
  },
  dragon_dash: {
    textureKey: "spear_thrust",
    color: 0x9bf3ff,
    blendMode: "add",
    scale: 0.9,
    lifetime: 0.28,
    particleKey: "particle_magic",
    telegraphShape: "slash",
    presentationKind: "dash",
    originMode: "playerAnchored",
    motionStyle: "thrust",
    arcDegrees: 62,
    followPlayer: true
  },
  wei_swords: {
    textureKey: "melee_arc",
    color: 0xd6ddff,
    blendMode: "add",
    scale: 0.58,
    lifetime: 0.3,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 125,
    followPlayer: true
  },
  tiger_cavalry: {
    textureKey: "tiger_cavalry",
    color: 0x9db8ff,
    blendMode: "add",
    scale: 1.08,
    lifetime: 0.42,
    particleKey: "particle_dirt",
    telegraphShape: "storm",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  iron_cleave: {
    textureKey: "heavy_cleave_wave",
    color: 0xffa15f,
    blendMode: "add",
    scale: 0.68,
    lifetime: 0.34,
    particleKey: "particle_dirt",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 178,
    followPlayer: true
  },
  blood_rage: {
    textureKey: "blood_rage",
    color: 0xff3f47,
    blendMode: "add",
    scale: 1.02,
    lifetime: 0.5,
    particleKey: "particle_smoke",
    telegraphShape: "burst",
    presentationKind: "aura",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 360,
    followPlayer: true
  },
  fire_note: {
    textureKey: "fire_note",
    color: 0xff8a4f,
    blendMode: "add",
    scale: 0.92,
    lifetime: 0.48,
    particleKey: "particle_smoke",
    telegraphShape: "storm",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  red_cliff_fire: {
    textureKey: "red_cliff_fire",
    color: 0xff6d32,
    blendMode: "add",
    scale: 1.12,
    lifetime: 0.72,
    particleKey: "particle_smoke",
    telegraphShape: "storm",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  crossbow_fan: {
    textureKey: "crossbow_fan",
    color: 0xffcc5a,
    blendMode: "add",
    scale: 0.72,
    lifetime: 0.22,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  arrow_rain: {
    textureKey: "arrow_rain",
    color: 0xffcc5a,
    blendMode: "add",
    scale: 0.9,
    lifetime: 0.42,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rain",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  petal_waltz: {
    textureKey: "petal_blade",
    color: 0xff9acb,
    blendMode: "add",
    scale: 0.82,
    lifetime: 0.64,
    particleKey: "particle_magic",
    telegraphShape: "storm",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 280,
    followPlayer: true
  },
  allure_dance: {
    textureKey: "petal_blade",
    color: 0xff9acb,
    blendMode: "add",
    scale: 1.1,
    lifetime: 0.72,
    particleKey: "particle_magic",
    telegraphShape: "storm",
    presentationKind: "aura",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 360,
    followPlayer: true
  },
  moon_blades: {
    textureKey: "melee_arc",
    color: 0xffd98a,
    blendMode: "add",
    scale: 0.64,
    lifetime: 0.32,
    particleKey: "particle_spark",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 250,
    followPlayer: true
  },
  frost_lotus: {
    textureKey: "frost_lotus",
    color: 0x9eefff,
    blendMode: "add",
    scale: 1,
    lifetime: 0.58,
    particleKey: "particle_magic",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  phoenix_feathers: {
    textureKey: "phoenix_feathers",
    color: 0xff8a4f,
    blendMode: "add",
    scale: 0.82,
    lifetime: 0.36,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  thunder_charm: {
    textureKey: "thunder_charm",
    color: 0xc9a8ff,
    blendMode: "add",
    scale: 1.1,
    lifetime: 0.38,
    particleKey: "particle_spark",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  shadow_clones: {
    textureKey: "melee_arc",
    color: 0xc7d2ff,
    blendMode: "add",
    scale: 0.74,
    lifetime: 0.3,
    particleKey: "particle_magic",
    animationKey: slashAnimationKey,
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "slashLunge",
    arcDegrees: 160,
    followPlayer: true
  },
  siege_drums: {
    textureKey: "siege_drums",
    color: 0xffd98a,
    blendMode: "add",
    scale: 1.18,
    lifetime: 0.62,
    particleKey: "particle_dirt",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  morale_fire: {
    textureKey: "red_cliff_fire",
    color: 0xff6d32,
    blendMode: "add",
    scale: 1.18,
    lifetime: 0.7,
    particleKey: "particle_smoke",
    telegraphShape: "storm",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  morale_dragon: {
    textureKey: "melee_arc",
    color: 0x77f0ae,
    blendMode: "add",
    scale: 1.18,
    lifetime: 0.56,
    particleKey: "particle_spark",
    telegraphShape: "slash",
    presentationKind: "meleeArc",
    originMode: "playerAnchored",
    motionStyle: "spin",
    arcDegrees: 360,
    followPlayer: true
  },
  morale_banner: {
    textureKey: "tiger_cavalry",
    color: 0x9db8ff,
    blendMode: "add",
    scale: 1.08,
    lifetime: 0.58,
    particleKey: "particle_magic",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  enemy_arrow: {
    textureKey: "enemy_arrow",
    color: 0xe7c27b,
    blendMode: "add",
    scale: 0.66,
    lifetime: 0.18,
    particleKey: "particle_spark",
    telegraphShape: "rain",
    presentationKind: "rangedProjectile",
    originMode: "projectile",
    motionStyle: "cast"
  },
  lubu_shock: {
    textureKey: "shock",
    color: 0xb15cff,
    blendMode: "add",
    scale: 1.25,
    lifetime: 0.5,
    particleKey: "particle_magic",
    telegraphShape: "burst",
    presentationKind: "areaField",
    originMode: "targetArea",
    motionStyle: "cast"
  },
  hit_spark: {
    textureKey: "particle_spark",
    color: 0xfff1cf,
    blendMode: "add",
    scale: 0.55,
    lifetime: 0.16,
    particleKey: "particle_spark",
    telegraphShape: "burst"
  },
  crit_spark: {
    textureKey: "particle_spark",
    color: 0xffdd7a,
    blendMode: "add",
    scale: 0.78,
    lifetime: 0.22,
    particleKey: "particle_spark",
    telegraphShape: "burst"
  },
  level_ring: {
    textureKey: "particle_magic",
    color: 0xffdd7a,
    blendMode: "add",
    scale: 1.14,
    lifetime: 0.55,
    particleKey: "particle_magic",
    telegraphShape: "burst"
  },
  evolution_burst: {
    textureKey: "particle_circle",
    color: 0xffdd7a,
    blendMode: "add",
    scale: 1.28,
    lifetime: 0.8,
    particleKey: "particle_magic",
    telegraphShape: "burst"
  },
  guard_flash: {
    textureKey: "particle_circle",
    color: 0xfff1cf,
    blendMode: "add",
    scale: 0.95,
    lifetime: 0.24,
    particleKey: "particle_spark",
    telegraphShape: "burst"
  }
};

export const enemyVisualProfiles: Record<EnemyId, EnemyVisualProfile> = {
  infantry: {
    spriteKey: "enemy_infantry",
    shadowScale: 0.8,
    hitTint: 0xfff1cf,
    deathFxKey: "particle_dirt",
    baseScale: 1,
    outlineColor: 0xded0b0
  },
  archer: {
    spriteKey: "enemy_archer",
    shadowScale: 0.76,
    hitTint: 0xffdf91,
    deathFxKey: "particle_dirt",
    baseScale: 0.96,
    outlineColor: 0xd6c17a
  },
  shield: {
    spriteKey: "enemy_shield",
    shadowScale: 0.94,
    hitTint: 0xdfe8ff,
    deathFxKey: "particle_dirt",
    baseScale: 1.04,
    outlineColor: 0xc5cbd6
  },
  cavalry: {
    spriteKey: "enemy_cavalry",
    shadowScale: 1.1,
    hitTint: 0xffcf86,
    deathFxKey: "particle_dirt",
    baseScale: 1.06,
    outlineColor: 0xe0b16b
  },
  captain: {
    spriteKey: "enemy_captain",
    shadowScale: 1.22,
    hitTint: 0xffdc86,
    deathFxKey: "particle_smoke",
    baseScale: 1.12,
    eliteFrame: 1,
    outlineColor: 0xe2b55f
  },
  lubu: {
    spriteKey: "enemy_lubu",
    shadowScale: 1.72,
    hitTint: 0xff7bb4,
    deathFxKey: "particle_magic",
    baseScale: 1.14,
    eliteFrame: 2,
    outlineColor: 0xff4e74
  }
};
